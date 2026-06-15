"""Replicate SAM/SAM2 integration.

The preferred model returns a list of mask images. This adapter also accepts
single composite mask images and recursively scans nested output shapes so a
minor Replicate wrapper change does not break the demo.
"""

from __future__ import annotations

import os
import tempfile
import urllib.request

import cv2
import numpy as np


class SegmentationError(RuntimeError):
    pass


def segment_with_replicate(image_bgr, token: str, model: str, max_masks: int = 80):
    if not token:
        raise SegmentationError("REPLICATE_API_TOKEN is not configured")

    try:
        import replicate
    except ImportError as exc:
        raise SegmentationError("Install the replicate package first") from exc

    os.environ["REPLICATE_API_TOKEN"] = token

    # JPEG (visually lossless at q92) instead of PNG keeps the upload ~5-10x
    # smaller, which trims a real chunk off the SAM round trip. Segmentation
    # quality is unaffected at this quality level.
    ok, encoded = cv2.imencode(".jpg", image_bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])
    if not ok:
        raise SegmentationError("Could not encode image for Replicate")

    with tempfile.NamedTemporaryFile(suffix=".jpg") as tmp:
        tmp.write(encoded.tobytes())
        tmp.flush()
        with open(tmp.name, "rb") as image_file:
            input_payload = _input_payload(model, image_file, max_masks=max_masks)
            try:
                output = replicate.run(_resolved_ref(replicate, model), input=input_payload)
            except Exception as exc:
                raise SegmentationError(f"Replicate SAM call failed: {exc}") from exc

    masks = _extract_masks(output, image_bgr.shape[:2])
    if not masks:
        raise SegmentationError("Replicate returned no usable masks")
    return masks


def warmup_replicate(token: str, model: str, max_masks: int = 8) -> bool:
    """Fire a tiny throwaway SAM call to boot the Replicate container ahead of a
    real scan, so the worker does not pay the cold-start delay. Best effort: any
    failure is swallowed since this only ever runs in the background."""

    if not token:
        return False
    try:
        import replicate
    except ImportError:
        return False

    os.environ["REPLICATE_API_TOKEN"] = token
    primer = np.full((96, 96, 3), 200, dtype=np.uint8)
    primer[24:72, 24:72] = (60, 90, 160)  # one shape so the model has something to segment
    ok, encoded = cv2.imencode(".jpg", primer, [cv2.IMWRITE_JPEG_QUALITY, 80])
    if not ok:
        return False

    try:
        with tempfile.NamedTemporaryFile(suffix=".jpg") as tmp:
            tmp.write(encoded.tobytes())
            tmp.flush()
            with open(tmp.name, "rb") as image_file:
                payload = _input_payload(model, image_file, max_masks=max_masks)
                replicate.run(_resolved_ref(replicate, model), input=payload)
        return True
    except Exception:
        # A warm container is the only goal here; the result is discarded.
        return False


def _resolved_ref(replicate, model: str) -> str:
    if ":" in model:
        return model
    resolved = replicate.models.get(model)
    version = getattr(getattr(resolved, "latest_version", None), "id", None)
    if not version:
        return model
    return f"{model}:{version}"


def _input_payload(model: str, image_file, max_masks: int):
    payload = {"image": image_file}
    if "lucataco/segment-anything-2" in model:
        payload.update(
            {
                "mask_limit": max_masks,
                "points_per_side": 32,
                "pred_iou_thresh": 0.72,
                "stability_score_thresh": 0.88,
                "min_mask_region_area": 80,
                "crop_n_layers": 0,
            }
        )
    elif "yyjim/segment-anything-everything" in model:
        payload.update(
            {
                "mask_only": True,
                "mask_limit": max_masks,
                "points_per_side": 32,
                "pred_iou_thresh": 0.78,
                "stability_score_thresh": 0.88,
                "min_mask_region_area": 80,
            }
        )
    elif "meta/sam-2" in model:
        payload.update(
            {
                "points_per_side": 32,
                "pred_iou_thresh": 0.82,
                "stability_score_thresh": 0.9,
            }
        )
    return payload


def _extract_masks(output, target_shape):
    masks = []

    if output is None:
        return masks

    if isinstance(output, dict):
        for key in ("masks", "mask", "output", "image", "combined_mask", "segmentation"):
            if key in output:
                masks.extend(_extract_masks(output[key], target_shape))
        return masks

    if isinstance(output, (list, tuple)):
        for item in output:
            masks.extend(_extract_masks(item, target_shape))
        return masks

    image_bytes = _output_to_bytes(output)
    if image_bytes is None:
        return masks

    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    decoded = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
    if decoded is None:
        return masks

    return _image_to_masks(decoded, target_shape)


def _output_to_bytes(output):
    if hasattr(output, "read"):
        return output.read()

    if hasattr(output, "url"):
        return _read_url(output.url)

    if isinstance(output, bytes):
        return output

    if isinstance(output, str):
        if output.startswith("http://") or output.startswith("https://"):
            return _read_url(output)
        if output.startswith("data:image/"):
            import base64

            _, b64 = output.split(",", 1)
            return base64.b64decode(b64)

    return None


def _read_url(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def _image_to_masks(decoded, target_shape):
    target_h, target_w = target_shape

    if decoded.shape[:2] != (target_h, target_w):
        decoded = cv2.resize(decoded, (target_w, target_h), interpolation=cv2.INTER_NEAREST)

    if decoded.ndim == 2:
        return _components_from_binary(decoded > 127)

    if decoded.shape[2] == 4:
        alpha = decoded[:, :, 3]
        if int(alpha.max()) > 0:
            return _components_from_binary(alpha > 20)
        decoded = decoded[:, :, :3]

    bgr = decoded[:, :, :3]
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    # Binary mask image, usually white foreground on black background.
    unique = np.unique(gray)
    if len(unique) <= 8:
        return _components_from_binary(gray > max(5, int(gray.mean())))

    # Colored label/composite mask image. Quantize colors and split connected
    # components per visible label color.
    flat = bgr.reshape(-1, 3).astype(np.float32)
    sample = flat
    if len(sample) > 12000:
        sample = sample[np.linspace(0, len(sample) - 1, 12000).astype(int)]

    k = min(16, max(4, len(np.unique(sample.astype(np.uint8), axis=0)) // 8))
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, centers = cv2.kmeans(sample, k, None, criteria, 2, cv2.KMEANS_PP_CENTERS)

    # Assign every pixel to the nearest sampled center.
    centers = centers.astype(np.float32)
    dists = ((flat[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
    label_img = dists.argmin(axis=1).reshape(target_h, target_w)

    masks = []
    for idx, center in enumerate(centers):
        # Skip near-black/near-white background-like regions.
        if center.mean() < 15 or center.mean() > 242:
            continue
        masks.extend(_components_from_binary(label_img == idx))
    return masks


def _components_from_binary(binary):
    binary = binary.astype(np.uint8)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    masks = []
    for label in range(1, num_labels):
        area = int(stats[label, cv2.CC_STAT_AREA])
        if area <= 0:
            continue
        mask = np.zeros(binary.shape, dtype=np.uint8)
        mask[labels == label] = 255
        masks.append(mask)
    return masks
