"""Geometry, calibration, and measurement helpers for fabric scraps."""

from __future__ import annotations

import cv2
import numpy as np


GSM_BY_FABRIC = {
    "cotton woven": 145,
    "cotton jersey": 180,
    "rib knit": 240,
    "denim": 360,
    "fleece": 310,
    "polyester woven": 115,
    "polyester knit": 165,
    "cotton-poly blend": 175,
    "spandex blend": 205,
    "satin/silky synthetic": 120,
    "checkered woven": 150,
    "striped knit": 175,
    "floral printed cotton": 135,
    "unknown textile": 170,
}

DEFAULT_VIEW_WIDTH_CM = 38.0


def detect_scale_reference(
    image_bgr,
    marker_size_cm: float,
    marker_id: int | None = None,
    fallback_view_width_cm: float = DEFAULT_VIEW_WIDTH_CM,
    original_image_bgr=None,
    original_to_work_scale: float = 1.0,
):
    """Detect scale and reference objects.

    Priority:
    1. decoded ArUco marker (trusted)
    2. visible 0-5 cm ruler/calibration strip (trusted enough for demo)
    3. fallback table-view width estimate (low confidence)

    A decoded ArUco marker is the only high-confidence reference. Marker-like
    fallback is used only when ArUco fails, because dark fabric scraps can look
    square enough to trigger looser heuristics.
    """

    h, w = image_bgr.shape[:2]
    blank = np.zeros((h, w), dtype=np.uint8)

    aruco = _detect_aruco(image_bgr, marker_size_cm, marker_id)
    if aruco is None and original_image_bgr is not None and original_image_bgr is not image_bgr:
        aruco = _scaled_reference(
            _detect_aruco(original_image_bgr, marker_size_cm, marker_id),
            float(original_to_work_scale or 1.0),
            marker_size_cm,
        )

    ruler = _detect_ruler(image_bgr)

    exclusion = blank.copy()
    reference_objects = []

    if aruco:
        cv2.fillPoly(exclusion, [np.array(aruco["polygon"], dtype=np.int32)], 255)
        aruco["used_for_scale"] = True
        aruco["excluded_from_masks"] = True
        reference_objects.append(aruco)
        exclusion = _dilate(exclusion, 7)
        return {
            "found": True,
            "px_per_cm": aruco["px_per_cm"],
            "homography": aruco["homography"],
            "marker_mask": exclusion,
            "exclusion_mask": exclusion,
            "marker_corners": aruco["polygon"],
            "scale_method": "aruco",
            "scale_confidence": "high",
            "reference_objects": reference_objects,
        }

    marker_like = _detect_marker_like_object(image_bgr, marker_size_cm)
    if marker_like:
        cv2.fillPoly(exclusion, [np.array(marker_like["polygon"], dtype=np.int32)], 255)
        marker_like["used_for_scale"] = True
        marker_like["excluded_from_masks"] = True
        reference_objects.append(marker_like)
        exclusion = _dilate(exclusion, 7)
        return {
            "found": True,
            "px_per_cm": marker_like["px_per_cm"],
            "homography": None,
            "marker_mask": exclusion,
            "exclusion_mask": exclusion,
            "marker_corners": marker_like["polygon"],
            "scale_method": "marker_like",
            "scale_confidence": "medium",
            "reference_objects": reference_objects,
        }

    if ruler:
        cv2.fillPoly(exclusion, [np.array(ruler["polygon"], dtype=np.int32)], 255)
        ruler["used_for_scale"] = True
        ruler["excluded_from_masks"] = True
        reference_objects.append(ruler)
        exclusion = _dilate(exclusion, 7)
        return {
            "found": True,
            "px_per_cm": ruler["px_per_cm"],
            "homography": None,
            "marker_mask": exclusion,
            "exclusion_mask": exclusion,
            "marker_corners": None,
            "scale_method": "ruler",
            "scale_confidence": "medium",
            "reference_objects": reference_objects,
        }

    px_per_cm = float(w / fallback_view_width_cm)
    exclusion = _dilate(exclusion, 7)
    return {
        "found": False,
        "px_per_cm": px_per_cm,
        "homography": None,
        "marker_mask": exclusion,
        "exclusion_mask": exclusion,
        "marker_corners": None,
        "scale_method": "fallback",
        "scale_confidence": "low",
        "reference_objects": reference_objects,
    }


def _scaled_reference(reference, scale, marker_size_cm):
    if not reference or abs(scale - 1.0) < 1e-6:
        return reference
    pts = np.array(reference["polygon"], dtype=np.float32) * scale
    scaled = dict(reference)
    scaled["polygon"] = pts.astype(int).tolist()
    scaled["px_per_cm"] = float(reference["px_per_cm"] * scale)
    world = np.array(
        [
            [0.0, 0.0],
            [marker_size_cm, 0.0],
            [marker_size_cm, marker_size_cm],
            [0.0, marker_size_cm],
        ],
        dtype=np.float32,
    )
    homography, _ = cv2.findHomography(pts, world)
    scaled["homography"] = homography
    return scaled


def contour_for_mask(mask):
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    contour = max(contours, key=cv2.contourArea)
    epsilon = max(1.5, 0.008 * cv2.arcLength(contour, True))
    return cv2.approxPolyDP(contour, epsilon, True)


def contour_points(contour):
    return [[int(x), int(y)] for [[x, y]] in contour.tolist()]


def area_cm2_from_contour(contour, homography, px_per_cm):
    if contour is None:
        return None
    if homography is not None:
        pts = contour.astype(np.float32)
        transformed = cv2.perspectiveTransform(pts, homography)
        area = abs(cv2.contourArea(transformed))
        if area > 0:
            return float(area)
    if px_per_cm:
        return float(cv2.contourArea(contour) / (px_per_cm**2))
    return None


def shape_label(mask, contour, bbox):
    area = float(cv2.countNonZero(mask))
    x, y, w, h = bbox
    if area <= 0 or w <= 0 or h <= 0:
        return "irregular"

    aspect = max(w / h, h / w)
    rectangularity = area / (w * h)

    if area < 2500:
        return "small offcut"
    if aspect >= 3.2:
        return "strip"
    if rectangularity > 0.68 and aspect < 1.8:
        return "panel"
    return "irregular"


def size_label(size_percent: float) -> str:
    if percent_to_area_bucket(size_percent) == "small":
        return "small"
    if percent_to_area_bucket(size_percent) == "medium":
        return "medium"
    return "large"


def percent_to_area_bucket(size_percent: float) -> str:
    if size_percent < 1.5:
        return "small"
    if size_percent < 5:
        return "medium"
    return "large"


def estimate_weight_g(area_cm2, fabric_type, gsm=None, fold_factor=1.0):
    if area_cm2 is None:
        return None
    gsm_value = float(gsm or GSM_BY_FABRIC.get(fabric_type, GSM_BY_FABRIC["unknown textile"]))
    factor = max(0.5, min(4.0, float(fold_factor or 1.0)))
    return round((area_cm2 / 10000.0) * gsm_value * factor, 1)


def weight_label(weight_g):
    if weight_g is None:
        return "estimate unavailable"
    if weight_g < 10:
        return f"{weight_g:.1f} g"
    if weight_g < 1000:
        return f"{weight_g:.0f} g"
    return f"{weight_g / 1000:.2f} kg"


def _detect_aruco(image_bgr, marker_size_cm, marker_id):
    if not hasattr(cv2, "aruco"):
        return None

    dictionaries = [
        "DICT_4X4_50",
        "DICT_4X4_100",
        "DICT_5X5_100",
        "DICT_APRILTAG_16h5",
        "DICT_APRILTAG_25h9",
    ]
    variants = _aruco_image_variants(image_bgr)

    for dict_name in dictionaries:
        if not hasattr(cv2.aruco, dict_name):
            continue
        dictionary = cv2.aruco.getPredefinedDictionary(getattr(cv2.aruco, dict_name))
        detector = cv2.aruco.ArucoDetector(dictionary, cv2.aruco.DetectorParameters())
        for variant, scale, offset in variants:
            corners, ids, _ = detector.detectMarkers(variant)
            if ids is None or len(corners) == 0:
                continue
            flat_ids = ids.flatten().tolist()
            selected_idx = 0
            if marker_id is not None:
                if marker_id not in flat_ids:
                    continue
                selected_idx = flat_ids.index(marker_id)
            pts = corners[selected_idx].reshape(4, 2).astype(np.float32)
            pts = pts / scale + np.array(offset, dtype=np.float32)
            return _aruco_result(pts, marker_size_cm, flat_ids[selected_idx], dict_name)
    return None


def _aruco_result(pts, marker_size_cm, marker_id, dictionary_name):
    side_lengths = [
        np.linalg.norm(pts[1] - pts[0]),
        np.linalg.norm(pts[2] - pts[1]),
        np.linalg.norm(pts[3] - pts[2]),
        np.linalg.norm(pts[0] - pts[3]),
    ]
    px_per_cm = float(np.mean(side_lengths) / marker_size_cm)
    world = np.array(
        [
            [0.0, 0.0],
            [marker_size_cm, 0.0],
            [marker_size_cm, marker_size_cm],
            [0.0, marker_size_cm],
        ],
        dtype=np.float32,
    )
    homography, _ = cv2.findHomography(pts, world)
    return {
        "type": "aruco",
        "id": int(marker_id),
        "dictionary": dictionary_name,
        "polygon": pts.astype(int).tolist(),
        "px_per_cm": px_per_cm,
        "homography": homography,
        "confidence": "high",
    }


def _aruco_image_variants(image_bgr):
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    variants = [(gray, 1.0, (0, 0))]

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    variants.append((clahe, 1.0, (0, 0)))

    sharpen = cv2.addWeighted(gray, 1.7, cv2.GaussianBlur(gray, (0, 0), 1.4), -0.7, 0)
    variants.append((sharpen, 1.0, (0, 0)))

    adaptive = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 31, 5)
    variants.append((adaptive, 1.0, (0, 0)))

    upscaled = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    variants.append((upscaled, 2.0, (0, 0)))

    x2 = int(w * 0.45)
    y1 = int(h * 0.55)
    roi = gray[y1:h, 0:x2]
    if roi.size:
        variants.append((cv2.resize(roi, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC), 2.5, (0, y1)))
    return variants


def _detect_marker_like_object(image_bgr, marker_size_cm):
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    roi_y1 = int(h * 0.45)
    roi_x2 = int(w * 0.45)
    roi = gray[roi_y1:h, 0:roi_x2]

    _, dark = cv2.threshold(roi, 80, 255, cv2.THRESH_BINARY_INV)
    dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8), iterations=1)
    contours, _ = cv2.findContours(dark, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < 800 or area > w * h * 0.025:
            continue
        x, y, bw, bh = cv2.boundingRect(contour)
        aspect = bw / max(1, bh)
        if not 0.78 <= aspect <= 1.28:
            continue
        global_contour = contour + np.array([[[0, roi_y1]]], dtype=np.int32)
        rect = cv2.minAreaRect(global_contour)
        box = cv2.boxPoints(rect).astype(int)
        if not _has_marker_like_interior(gray, box):
            continue
        side_px = float((rect[1][0] + rect[1][1]) / 2.0)
        score = area + side_px * 20
        obj = {
            "type": "marker_like",
            "polygon": box.tolist(),
            "px_per_cm": side_px / marker_size_cm,
            "confidence": "medium",
            "note": "Strict high-contrast square fallback used because ArUco could not be decoded.",
        }
        if best is None or score > best[0]:
            best = (score, obj)
    return best[1] if best else None


def _has_marker_like_interior(gray, polygon):
    mask = np.zeros(gray.shape, dtype=np.uint8)
    cv2.fillPoly(mask, [np.array(polygon, dtype=np.int32)], 255)
    x, y, w, h = cv2.boundingRect(np.array(polygon, dtype=np.int32))
    if w < 20 or h < 20:
        return False
    crop = gray[y : y + h, x : x + w]
    crop_mask = mask[y : y + h, x : x + w] > 0
    if crop.size == 0 or crop_mask.sum() < 400:
        return False
    values = crop[crop_mask]
    dark = float(np.mean(values < 70))
    light = float(np.mean(values > 175))
    contrast = float(np.std(values))
    edges = cv2.Canny(crop, 60, 160)
    edge_fraction = float(np.mean(edges[crop_mask] > 0))
    return dark > 0.30 and light > 0.08 and contrast > 55 and edge_fraction > 0.025


def _detect_ruler(image_bgr):
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    roi_y1 = int(h * 0.55)
    roi_x2 = int(w * 0.55)
    roi = gray[roi_y1:h, 0:roi_x2]
    if roi.size == 0:
        return None

    _, dark = cv2.threshold(roi, 95, 255, cv2.THRESH_BINARY_INV)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (11, 3))
    dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, kernel, iterations=1)
    contours, _ = cv2.findContours(dark, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best = None
    for contour in contours:
        x, y, bw, bh = cv2.boundingRect(contour)
        if bw < roi.shape[1] * 0.12 or bh > roi.shape[0] * 0.35:
            continue
        aspect = bw / max(1, bh)
        if aspect < 3.0:
            continue
        area = cv2.contourArea(contour)
        score = bw * 2 + area / 100
        if best is None or score > best[0]:
            best = (score, (x, y, bw, bh), contour)

    if best is None:
        return None

    _, (x, y, bw, bh), contour = best
    gx, gy = x, y + roi_y1
    pad_x = max(8, int(bw * 0.18))
    pad_y = max(10, int(bh * 2.5))
    poly = np.array(
        [
            [max(0, gx - pad_x), max(0, gy - pad_y)],
            [min(w - 1, gx + bw + pad_x), max(0, gy - pad_y)],
            [min(w - 1, gx + bw + pad_x), min(h - 1, gy + bh + pad_y)],
            [max(0, gx - pad_x), min(h - 1, gy + bh + pad_y)],
        ],
        dtype=np.int32,
    )

    return {
        "type": "ruler",
        "polygon": poly.tolist(),
        "px_per_cm": float(bw / 5.0),
        "confidence": "medium",
        "note": "Detected horizontal 0-5 cm ruler/calibration strip.",
    }


def _dilate(mask, size):
    if mask is None:
        return None
    kernel = np.ones((size, size), np.uint8)
    return cv2.dilate(mask, kernel, iterations=1)
