"""Tiny named-color palette used to turn average RGB values into labels like
"blue" or "denim" for grouping scrap pieces.

Person 1 owns this file. Feel free to expand the palette to better match the
fabrics you photograph for the demo.
"""

PALETTE = {
    "white": (245, 245, 245),
    "black": (25, 25, 25),
    "gray": (130, 130, 130),
    "red": (200, 40, 40),
    "orange": (230, 130, 40),
    "yellow": (230, 220, 60),
    "green": (60, 160, 80),
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
