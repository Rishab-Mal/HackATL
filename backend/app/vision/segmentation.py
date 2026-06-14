"""Computer-vision pipeline for sorting fabric scraps.

The main path uses Replicate-hosted SAM/SAM2 for segmentation, then local
OpenCV/Pillow code for measurement, color extraction, grouping, and rendering.
"""

from __future__ import annotations

import base64
from io import BytesIO

import cv2
import numpy as np
from PIL import Image, ImageOps

from ..config import get_settings
from .annotation import assign_sort_groups, piece_table, render_annotated_image
from .colors import color_family, closest_color_name, color_clusters, dominant_color_rgb, pattern_type, rgb_to_hex
from .material_llm import classify_materials
from .measurement import (
    area_cm2_from_contour,
    contour_for_mask,
    contour_points,
    detect_scale_reference,
    estimate_weight_g,
    shape_label,
    size_label,
    weight_label,
)
from .replicate_sam import SegmentationError, segment_with_replicate

MIN_AREA_FRACTION = 0.0008
MAX_AREA_FRACTION = 0.45


def detect_pieces(image_bytes: bytes) -> dict:
    settings = get_settings()
    image_bgr, original_bgr, original_to_work_scale = _decode_image(image_bytes, settings.max_image_dimension)
    h, w = image_bgr.shape[:2]
    total_area = h * w
    warnings = []

    scale = detect_scale_reference(
        image_bgr,
        marker_size_cm=settings.aruco_marker_size_cm,
        marker_id=settings.aruco_marker_id,
        original_image_bgr=original_bgr,
        original_to_work_scale=original_to_work_scale,
    )

    try:
        raw_masks = segment_with_replicate(
            image_bgr,
            token=settings.replicate_api_token,
            model=settings.replicate_sam_model,
            max_masks=max(settings.max_pieces * 3, 50),
        )
        segmentation_method = f"replicate:{settings.replicate_sam_model}"
    except SegmentationError as exc:
        raise ValueError(str(exc)) from exc

    masks, discarded_objects = _clean_masks(
        raw_masks,
        image_bgr=image_bgr,
        exclusion_mask=scale["exclusion_mask"],
        max_pieces=settings.max_pieces,
    )
    if not masks:
        raise ValueError("No fabric pieces remained after SAM mask cleanup")

    pieces = []
    for idx, mask in enumerate(masks, start=1):
        contour = contour_for_mask(mask)
        if contour is None:
            continue

        x, y, bw, bh = cv2.boundingRect(contour)
        area_pixels = int(cv2.countNonZero(mask))
        size_percent = round(area_pixels / total_area * 100, 2)
        clusters = color_clusters(image_bgr, mask)
        if clusters:
            dominant_rgb = tuple(clusters[0]["rgb"])
            dominant_name = clusters[0]["name"]
            dominant_hex = clusters[0]["hex"]
        else:
            dominant_rgb = dominant_color_rgb(image_bgr, mask)
            dominant_name = closest_color_name(dominant_rgb)
            dominant_hex = rgb_to_hex(dominant_rgb)
        family = color_family(rgb=dominant_rgb, name=dominant_name, clusters=clusters)
        area_cm2 = area_cm2_from_contour(contour, scale["homography"], scale["px_per_cm"])
        area_cm2 = round(area_cm2, 1) if area_cm2 is not None else None
        aspect_ratio = round(max(bw / max(1, bh), bh / max(1, bw)), 2)
        pattern = pattern_type(image_bgr, mask, clusters)

        pieces.append(
            {
                "id": idx,
                "bbox": [int(x), int(y), int(bw), int(bh)],
                "contour": contour_points(contour),
                "mask": mask,
                "area_pixels": area_pixels,
                "area_cm2": area_cm2,
                "color_name": dominant_name,
                "color_hex": dominant_hex,
                "dominant_rgb": [int(c) for c in dominant_rgb],
                "color_family": family,
                "secondary_colors": clusters[1:],
                "color_clusters": clusters,
                "pattern_type": pattern,
                "size_percent": size_percent,
                "size_label": size_label(size_percent),
                "shape_label": shape_label(mask, contour, (x, y, bw, bh)),
                "aspect_ratio": aspect_ratio,
            }
        )

    if not pieces:
        raise ValueError("No measurable fabric pieces found")

    material_result = classify_materials(
        image_bgr,
        pieces,
        api_key=settings.openrouter_api_key,
        models=settings.openrouter_vision_models,
        timeout_s=settings.openrouter_timeout_s,
    )
    if material_result.get("warning"):
        warnings.append(material_result["warning"])

    for piece in pieces:
        material = material_result["pieces"].get(piece["id"], {})
        piece.update(material)
        piece["estimated_weight_g"] = estimate_weight_g(
            piece.get("area_cm2"),
            piece.get("fabric_type_guess", "unknown textile"),
            gsm=piece.get("gsm"),
            fold_factor=piece.get("fold_factor", 1.0),
        )
        piece["weight_label"] = weight_label(piece.get("estimated_weight_g"))
        piece["crop_data_url"] = _piece_crop_data_url(image_bgr, piece)

    groups = assign_sort_groups(pieces)
    annotated = render_annotated_image(image_bgr, pieces, groups)
    rows = piece_table(pieces)

    response_pieces = [_public_piece(piece) for piece in pieces]

    if scale["scale_method"] == "fallback":
        warnings.append(
            "No trusted ArUco marker or 0-5 cm ruler was detected; area and weight use a fallback table-view estimate."
        )
    elif scale["scale_method"] == "ruler":
        warnings.append("ArUco marker was not decoded, so the visible 0-5 cm ruler was used for scale.")
    elif scale["scale_method"] == "marker_like":
        warnings.append("ArUco marker was not decoded; a strict marker-like square fallback was used for scale.")

    if any(obj.get("type") == "marker_like" for obj in scale["reference_objects"]) and scale["scale_method"] != "aruco":
        warnings.append("A marker-like square was excluded from fabric masks but could not be decoded as a trusted ArUco marker.")

    return {
        "image_width": w,
        "image_height": h,
        "pieces": response_pieces,
        "groups": groups,
        "piece_table": rows,
        "annotated_image_data_url": annotated,
        "scale_reference_found": bool(scale["found"]),
        "px_per_cm": round(scale["px_per_cm"], 3) if scale["px_per_cm"] else None,
        "marker_corners": scale["marker_corners"],
        "scale_method": scale["scale_method"],
        "scale_confidence": scale["scale_confidence"],
        "reference_objects": _public_reference_objects(scale["reference_objects"]),
        "discarded_objects": discarded_objects,
        "segmentation_method": segmentation_method,
        "llm_model": material_result.get("model"),
        "warnings": warnings,
    }


def _decode_image(image_bytes: bytes, max_dimension: int):
    image = Image.open(BytesIO(image_bytes))
    image = ImageOps.exif_transpose(image).convert("RGB")
    w, h = image.size
    scale = min(1.0, max_dimension / max(w, h))
    original_rgb = np.array(image)
    original_bgr = cv2.cvtColor(original_rgb, cv2.COLOR_RGB2BGR)
    if scale < 1.0:
        image = image.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    rgb = np.array(image)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), original_bgr, scale


def _clean_masks(raw_masks, image_bgr, exclusion_mask, max_pieces):
    h, w = image_bgr.shape[:2]
    total_area = h * w
    min_area = int(total_area * MIN_AREA_FRACTION)
    max_area = int(total_area * MAX_AREA_FRACTION)
    background_bgr = _estimate_background_bgr(image_bgr)
    exclusion_mask = exclusion_mask if exclusion_mask is not None else np.zeros((h, w), dtype=np.uint8)

    candidates = []
    discarded = []
    for raw in raw_masks:
        for mask in _split_components(raw):
            mask = _smooth_mask(mask)
            area = int(cv2.countNonZero(mask))
            reason = _mask_rejection_reason(
                mask=mask,
                image_bgr=image_bgr,
                exclusion_mask=exclusion_mask,
                background_bgr=background_bgr,
                area=area,
                min_area=min_area,
                max_area=max_area,
                total_area=total_area,
            )
            if reason:
                discarded.append(_discard_record(mask, reason))
                continue
            candidates.append(mask)

    candidates.sort(key=cv2.countNonZero, reverse=True)
    kept = []
    for mask in candidates:
        duplicate = False
        for existing in kept:
            inter = cv2.countNonZero(cv2.bitwise_and(mask, existing))
            area = cv2.countNonZero(mask)
            existing_area = cv2.countNonZero(existing)
            union = area + existing_area - inter
            iou = inter / union if union else 0
            overlap_min = inter / max(1, min(area, existing_area))
            if iou > 0.62 or overlap_min > 0.78:
                duplicate = True
                break
        if not duplicate:
            kept.append(mask)
        else:
            discarded.append(_discard_record(mask, "duplicate_sam_mask"))
        if len(kept) >= max_pieces:
            break

    kept.sort(key=cv2.countNonZero, reverse=True)
    return kept, discarded[:80]


def _split_components(mask):
    binary = (mask > 0).astype(np.uint8)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    components = []
    for label in range(1, num_labels):
        area = int(stats[label, cv2.CC_STAT_AREA])
        if area <= 0:
            continue
        component = np.zeros(binary.shape, dtype=np.uint8)
        component[labels == label] = 255
        components.append(component)
    return components


def _smooth_mask(mask):
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    return mask


def _mask_rejection_reason(mask, image_bgr, exclusion_mask, background_bgr, area, min_area, max_area, total_area):
    h, w = mask.shape[:2]
    if area < min_area:
        return "too_small"
    if area > max_area:
        return "too_large_or_background"

    x, y, bw, bh = cv2.boundingRect(mask)
    if bw <= 1 or bh <= 1:
        return "empty_bbox"

    reference_overlap = cv2.countNonZero(cv2.bitwise_and(mask, exclusion_mask)) / max(1, area)
    if reference_overlap > 0.14:
        return "reference_marker_or_ruler"

    if bw > w * 0.94 and bh > h * 0.94:
        return "full_image_background"

    border = max(5, min(w, h) // 120)
    border_pixels = (
        cv2.countNonZero(mask[:border, :])
        + cv2.countNonZero(mask[h - border :, :])
        + cv2.countNonZero(mask[:, :border])
        + cv2.countNonZero(mask[:, w - border :])
    )
    border_fraction = border_pixels / max(1, area)
    spans_image = bw > w * 0.74 or bh > h * 0.74
    if border_fraction > 0.035 and spans_image:
        return "touches_image_border_like_background"

    if _is_table_background(mask, image_bgr, background_bgr, area, total_area, border_fraction, spans_image):
        return "table_background"

    if _is_ruler_like(mask, image_bgr, (x, y, bw, bh)):
        return "ruler_or_scale_card"

    return None


def _estimate_background_bgr(image_bgr):
    h, w = image_bgr.shape[:2]
    patch = max(12, min(w, h) // 18)
    patches = [
        image_bgr[:patch, :patch],
        image_bgr[:patch, w - patch : w],
        image_bgr[h - patch : h, :patch],
        image_bgr[h - patch : h, w - patch : w],
    ]
    pixels = np.concatenate([p.reshape(-1, 3) for p in patches], axis=0)
    return np.median(pixels, axis=0)


def _is_table_background(mask, image_bgr, background_bgr, area, total_area, border_fraction, spans_image):
    if area < total_area * 0.03:
        return False
    if not spans_image and area < total_area * 0.14:
        return False
    pixels = image_bgr[mask > 0]
    if len(pixels) == 0:
        return False
    mean_bgr = pixels.mean(axis=0)
    color_distance = float(np.linalg.norm(mean_bgr - background_bgr))
    return color_distance < 34 and (spans_image or border_fraction > 0.02 or area > total_area * 0.18)


def _is_ruler_like(mask, image_bgr, bbox):
    x, y, bw, bh = bbox
    h, w = mask.shape[:2]
    aspect = max(bw / max(1, bh), bh / max(1, bw))
    lower_left = x < w * 0.58 and y > h * 0.50
    if not lower_left or aspect < 3.0:
        return False

    crop = image_bgr[y : y + bh, x : x + bw]
    crop_mask = mask[y : y + bh, x : x + bw] > 0
    if crop.size == 0 or crop_mask.sum() < 60:
        return False
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    selected = hsv[crop_mask]
    low_sat = selected[:, 1] < 45
    dark_or_light = (selected[:, 2] < 85) | (selected[:, 2] > 185)
    neutral_fraction = float(np.mean(low_sat & dark_or_light))
    return neutral_fraction > 0.58


def _discard_record(mask, reason):
    x, y, w, h = cv2.boundingRect(mask)
    return {
        "reason": reason,
        "bbox": [int(x), int(y), int(w), int(h)],
        "area_pixels": int(cv2.countNonZero(mask)),
    }


def _piece_crop_data_url(image_bgr, piece):
    x, y, w, h = piece["bbox"]
    pad = max(8, int(max(w, h) * 0.10))
    x1, y1 = max(0, x - pad), max(0, y - pad)
    x2 = min(image_bgr.shape[1], x + w + pad)
    y2 = min(image_bgr.shape[0], y + h + pad)
    crop = image_bgr[y1:y2, x1:x2]
    rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(rgb)
    pil.thumbnail((260, 260), Image.Resampling.LANCZOS)
    buf = BytesIO()
    pil.save(buf, format="JPEG", quality=86)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _public_reference_objects(reference_objects):
    public = []
    for obj in reference_objects:
        clean = {}
        for key, value in obj.items():
            if key == "homography":
                continue
            clean[key] = _json_safe(value)
        public.append(clean)
    return public


def _json_safe(value):
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [_json_safe(item) for item in value]
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    return value


def _public_piece(piece):
    hidden = {"mask"}
    return {k: v for k, v in piece.items() if k not in hidden}
