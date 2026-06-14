"""Color helpers for mask-based fabric scrap grouping."""

import cv2
import numpy as np

PALETTE = {
    "white": (245, 245, 245),
    "cream": (238, 229, 205),
    "black": (25, 25, 25),
    "charcoal": (55, 58, 62),
    "gray": (132, 135, 140),
    "red": (200, 40, 40),
    "burgundy": (112, 32, 48),
    "orange": (230, 130, 40),
    "yellow": (230, 220, 60),
    "olive": (112, 126, 72),
    "green": (60, 160, 80),
    "teal": (30, 140, 145),
    "sky blue": (116, 174, 220),
    "blue": (50, 90, 200),
    "navy": (30, 40, 90),
    "purple": (130, 60, 170),
    "pink": (230, 140, 180),
    "brown": (120, 80, 50),
    "beige": (220, 200, 170),
    "denim": (70, 100, 140),
}


def closest_color_name(rgb):
    """Return the palette name whose color is closest to ``rgb``."""

    r, g, b = rgb
    best_name = "gray"
    best_dist = float("inf")
    for name, (pr, pg, pb) in PALETTE.items():
        dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
        if dist < best_dist:
            best_dist = dist
            best_name = name
    return best_name


def rgb_to_hex(rgb):
    r, g, b = (max(0, min(255, int(c))) for c in rgb)
    return f"#{r:02x}{g:02x}{b:02x}"


def dominant_color_rgb(image_bgr, mask):
    """Return the dominant RGB color inside ``mask``.

    K-means is more stable than a mean for printed fabrics, shadows, and
    pieces with frayed light edges.
    """

    mask_bool = mask > 0
    pixels_bgr = image_bgr[mask_bool]
    if len(pixels_bgr) == 0:
        return (128, 128, 128)

    pixels_rgb = pixels_bgr[:, ::-1].astype(np.float32)

    # Drop extreme shadow/highlight pixels when enough pixels remain.
    hsv = cv2.cvtColor(pixels_bgr.reshape(-1, 1, 3), cv2.COLOR_BGR2HSV).reshape(-1, 3)
    keep = (hsv[:, 2] > 25) & (hsv[:, 2] < 245)
    if keep.sum() > 80:
        pixels_rgb = pixels_rgb[keep]

    if len(pixels_rgb) > 5000:
        idx = np.linspace(0, len(pixels_rgb) - 1, 5000).astype(int)
        pixels_rgb = pixels_rgb[idx]

    k = min(4, max(1, len(pixels_rgb) // 50))
    if k == 1:
        color = pixels_rgb.mean(axis=0)
        return tuple(int(c) for c in color)

    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 25, 0.5)
    compactness, labels, centers = cv2.kmeans(
        pixels_rgb,
        k,
        None,
        criteria,
        3,
        cv2.KMEANS_PP_CENTERS,
    )
    counts = np.bincount(labels.flatten(), minlength=k)
    color = centers[int(counts.argmax())]
    return tuple(int(max(0, min(255, c))) for c in color)


def color_clusters(image_bgr, mask, max_clusters=5):
    mask_bool = mask > 0
    pixels_bgr = image_bgr[mask_bool]
    if len(pixels_bgr) == 0:
        return []

    hsv = cv2.cvtColor(pixels_bgr.reshape(-1, 1, 3), cv2.COLOR_BGR2HSV).reshape(-1, 3)
    keep = (hsv[:, 2] > 25) & (hsv[:, 2] < 248)
    if keep.sum() > 100:
        pixels_bgr = pixels_bgr[keep]

    pixels_rgb = pixels_bgr[:, ::-1].astype(np.float32)
    if len(pixels_rgb) > 6000:
        pixels_rgb = pixels_rgb[np.linspace(0, len(pixels_rgb) - 1, 6000).astype(int)]

    k = min(max_clusters, max(1, len(pixels_rgb) // 80))
    if k == 1:
        rgb = tuple(int(c) for c in pixels_rgb.mean(axis=0))
        return [{"name": closest_color_name(rgb), "hex": rgb_to_hex(rgb), "rgb": list(rgb), "percent": 1.0}]

    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 25, 0.5)
    _, labels, centers = cv2.kmeans(pixels_rgb, k, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
    counts = np.bincount(labels.flatten(), minlength=k).astype(float)
    order = counts.argsort()[::-1]

    clusters = []
    for idx in order:
        percent = float(counts[idx] / counts.sum()) if counts.sum() else 0
        if percent < 0.04:
            continue
        rgb = tuple(int(max(0, min(255, c))) for c in centers[idx])
        clusters.append(
            {
                "name": closest_color_name(rgb),
                "hex": rgb_to_hex(rgb),
                "rgb": list(rgb),
                "percent": round(percent, 3),
            }
        )
    return clusters


def pattern_type(image_bgr, mask, clusters):
    if len(clusters) <= 1 or clusters[0]["percent"] > 0.82:
        return "solid"

    names = {cluster["name"] for cluster in clusters}
    if len(names) <= 1:
        return "solid"

    if {"pink", "green"} & names and len(clusters) >= 4 and clusters[0]["percent"] < 0.72:
        return "floral"

    x, y, w, h = cv2.boundingRect(mask)
    crop_gray = cv2.cvtColor(image_bgr[y : y + h, x : x + w], cv2.COLOR_BGR2GRAY)
    crop_mask = mask[y : y + h, x : x + w] > 0
    if crop_gray.size == 0 or crop_mask.sum() < 50:
        return "mixed"

    values = crop_gray[crop_mask]
    intensity_std = float(np.std(values))
    if intensity_std < 18 and len(names) <= 2:
        return "solid"

    masked = np.where(crop_mask, crop_gray.astype(np.float32), np.nan)
    row_profile = _nan_profile(masked, axis=1)
    col_profile = _nan_profile(masked, axis=0)
    row_std = float(np.nanstd(row_profile)) if row_profile.size else 0.0
    col_std = float(np.nanstd(col_profile)) if col_profile.size else 0.0

    if min(row_std, col_std) > 19 and len(names) >= 2:
        return "checkered"
    if max(row_std, col_std) > 20 and max(row_std, col_std) > min(row_std, col_std) * 1.8:
        return "striped"
    if len(clusters) >= 4 and clusters[0]["percent"] < 0.70:
        return "print"
    return "mixed"


def _nan_profile(masked_gray, axis):
    with np.errstate(invalid="ignore", divide="ignore"):
        profile = np.nanmean(masked_gray, axis=axis)
    return profile[~np.isnan(profile)]
