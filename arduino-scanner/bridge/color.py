"""
Host-side color correction for the OV7675.

The OV7675's default registers give a heavy green/magenta cast and a noisy,
posterized RGB565 image. The Arduino_OV767X library exposes no white-balance
control, so we fix it here on the computer where we can actually tune it.

Pipeline (all on a BGR uint8 image):
  1. denoise        - kill RGB565 speckle
  2. white balance  - neutralize the color cast (fixed-gain / percentile / gray-world)
  3. gamma          - lift midtones
  4. saturation     - restore color the WB step flattens

The OV7675 has a strong GREEN bias and a weak RED channel, so skin/warm tones
render green. A fixed per-channel gain (boost R, cut G) fixes this far more
reliably than scene-adaptive white balance, which gets fooled by any dominant
real color in the frame. These defaults were calibrated against this sensor;
tune them live in preview.py (keys 1-6) and copy the values you like into
DEFAULT_GAIN below.

`correct()` is cheap enough to run live in preview.py.
"""

import cv2
import numpy as np

# Per-channel gain (B, G, R). Calibrated for the Tiny ML Kit OV7675.
DEFAULT_GAIN = (0.98, 0.78, 1.28)


def _white_balance_fixed(bgr: np.ndarray, gain) -> np.ndarray:
    out = bgr.astype(np.float32)
    for c in range(3):
        out[:, :, c] *= gain[c]
    return np.clip(out, 0, 255).astype(np.uint8)


def _white_balance_percentile(bgr: np.ndarray, p: float = 99.0) -> np.ndarray:
    """Per-channel percentile white balance: map the p-th percentile of each
    channel to a common bright target. Neutralizes a cast using bright/neutral
    areas (e.g. a white surface) without crushing genuinely colored scenes the
    way gray-world does."""
    out = np.empty_like(bgr, dtype=np.float32)
    target = 235.0
    for c in range(3):
        ch = bgr[:, :, c].astype(np.float32)
        ref = np.percentile(ch, p)
        if ref < 1.0:
            ref = 1.0
        out[:, :, c] = ch * (target / ref)
    return np.clip(out, 0, 255).astype(np.uint8)


def _white_balance_grayworld(bgr: np.ndarray) -> np.ndarray:
    """Classic gray-world: assume the scene averages to gray. Good for cluttered
    multi-color scrap piles, can wash out scenes with one dominant real color."""
    out = bgr.astype(np.float32)
    means = out.reshape(-1, 3).mean(axis=0)
    gray = means.mean()
    for c in range(3):
        if means[c] > 1.0:
            out[:, :, c] *= gray / means[c]
    return np.clip(out, 0, 255).astype(np.uint8)


def _apply_gamma(bgr: np.ndarray, gamma: float) -> np.ndarray:
    if abs(gamma - 1.0) < 1e-3:
        return bgr
    inv = 1.0 / gamma
    lut = np.array([((i / 255.0) ** inv) * 255 for i in range(256)], dtype=np.uint8)
    return cv2.LUT(bgr, lut)


def _apply_saturation(bgr: np.ndarray, scale: float) -> np.ndarray:
    if abs(scale - 1.0) < 1e-3:
        return bgr
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * scale, 0, 255)
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)


def correct(
    bgr: np.ndarray,
    wb: str = "fixed",           # "fixed" | "percentile" | "grayworld" | "none"
    gain=DEFAULT_GAIN,           # per-channel (B,G,R) gain for wb="fixed"
    denoise: int = 1,            # 0 none, 1 median (fast), 2 bilateral (nicer/slower)
    gamma: float = 1.1,
    saturation: float = 1.25,
) -> np.ndarray:
    img = bgr
    if denoise == 1:
        img = cv2.medianBlur(img, 3)
    elif denoise == 2:
        img = cv2.bilateralFilter(img, 5, 50, 50)

    if wb == "fixed":
        img = _white_balance_fixed(img, gain)
    elif wb == "percentile":
        img = _white_balance_percentile(img)
    elif wb == "grayworld":
        img = _white_balance_grayworld(img)

    img = _apply_gamma(img, gamma)
    img = _apply_saturation(img, saturation)
    return img
