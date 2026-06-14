"""Scrap piece detection.

This is the MVP version: it uses plain OpenCV (background thresholding +
contours) to find individual scrap pieces in a photo, then reads off each
piece's average color and rough size as a percentage of the image.

This is intentionally NOT a real fabric classifier -- it only does visual
sorting (color, count, rough size), which is exactly Person 1's job per the
project brief.

When you're ready, swap the body of ``detect_pieces`` (or just the contour
step) for a Segment Anything (SAM) call -- keep the same return shape
(``{"image_width", "image_height", "pieces", "groups"}``) so nothing else in
the app needs to change.
"""

import cv2
import numpy as np

from .colors import closest_color_name, rgb_to_hex

MAX_DIMENSION = 900
MIN_AREA_FRACTION = 0.003  # ignore specks smaller than 0.3% of the image
MAX_PIECES = 40


def detect_pieces(image_bytes: bytes) -> dict:
    image = _decode_image(image_bytes)
    h, w = image.shape[:2]
    total_area = h * w

    mask = _foreground_mask(image, total_area)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    min_area = total_area * MIN_AREA_FRACTION
    pieces = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area:
            continue

        x, y, bw, bh = cv2.boundingRect(contour)

        piece_mask = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(piece_mask, [contour], -1, 255, thickness=cv2.FILLED)

        mean_bgr = cv2.mean(image, mask=piece_mask)[:3]
        mean_rgb = (mean_bgr[2], mean_bgr[1], mean_bgr[0])

        size_percent = round(area / total_area * 100, 2)
        pieces.append(
            {
                "bbox": [int(x), int(y), int(bw), int(bh)],
                "color_rgb": mean_rgb,
                "size_percent": size_percent,
                "size_label": _size_label(size_percent),
            }
        )

    pieces.sort(key=lambda p: p["size_percent"], reverse=True)
    pieces = pieces[:MAX_PIECES]

    result_pieces = []
    for i, p in enumerate(pieces):
        result_pieces.append(
            {
                "id": i + 1,
                "bbox": p["bbox"],
                "color_name": closest_color_name(p["color_rgb"]),
                "color_hex": rgb_to_hex(p["color_rgb"]),
                "size_percent": p["size_percent"],
                "size_label": p["size_label"],
            }
        )

    return {
        "image_width": w,
        "image_height": h,
        "pieces": result_pieces,
        "groups": _group_by_color(result_pieces),
    }


def _decode_image(image_bytes: bytes):
    file_bytes = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image")

    h, w = image.shape[:2]
    scale = min(1.0, MAX_DIMENSION / max(h, w))
    if scale < 1.0:
        image = cv2.resize(image, (int(w * scale), int(h * scale)))
    return image


def _foreground_mask(image, total_area):
    """Assume scraps sit on a fairly uniform background (table/mat) and
    separate them out with an Otsu threshold on the grayscale image."""

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Otsu sometimes picks the background as the "foreground" -- the real
    # foreground (scraps) should be the minority of pixels.
    if cv2.countNonZero(thresh) > total_area * 0.6:
        thresh = cv2.bitwise_not(thresh)

    kernel = np.ones((5, 5), np.uint8)
    cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel, iterations=1)
    return cleaned


def _size_label(percent: float) -> str:
    if percent < 1.5:
        return "small"
    if percent < 5:
        return "medium"
    return "large"


def _group_by_color(pieces):
    grouped: dict[str, dict] = {}
    for p in pieces:
        key = p["color_name"]
        group = grouped.setdefault(
            key,
            {
                "color_name": p["color_name"],
                "color_hex": p["color_hex"],
                "piece_count": 0,
                "total_size_percent": 0.0,
                "_labels": [],
            },
        )
        group["piece_count"] += 1
        group["total_size_percent"] += p["size_percent"]
        group["_labels"].append(p["size_label"])

    groups = []
    for group in grouped.values():
        labels = group.pop("_labels")
        group["avg_size_label"] = max(set(labels), key=labels.count)
        group["total_size_percent"] = round(group["total_size_percent"], 2)
        groups.append(group)

    groups.sort(key=lambda g: g["total_size_percent"], reverse=True)
    return groups
