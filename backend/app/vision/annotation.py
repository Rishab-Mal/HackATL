"""Sorting-group assignment and annotated image rendering."""

from __future__ import annotations

import base64
from collections import Counter, defaultdict
from io import BytesIO
import string

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .colors import color_family as normalized_color_family


GROUP_COLORS = [
    "#2563eb",
    "#dc2626",
    "#16a34a",
    "#f59e0b",
    "#7c3aed",
    "#0891b2",
    "#db2777",
    "#4b5563",
    "#84cc16",
    "#ea580c",
]


def assign_sort_groups(pieces):
    groups_by_key = {}
    ordered_groups = []
    material_consensus = _material_consensus_by_color(pieces)

    for piece in pieces:
        color_family = _sort_color_family(piece)
        fabric_type = piece.get("fabric_type_guess", "unknown textile")
        material_family = piece.get("material_family") or _fallback_material_family(fabric_type)
        material_sort_family = material_consensus.get(color_family) or _sort_material_family(piece)
        pattern = _sort_pattern(piece)
        key = (color_family, material_sort_family, pattern)
        if key not in groups_by_key:
            group_id = _group_id(len(ordered_groups))
            group = {
                "sort_group_id": group_id,
                "fabric_type_guess": fabric_type,
                "material_family": material_family,
                "material_sort_family": material_sort_family,
                "weave_or_knit": piece.get("weave_or_knit") or "unknown",
                "composition_guess": piece.get("composition_guess", "mixed textile"),
                "color_name": piece["color_name"],
                "color_family": color_family,
                "pattern_type": pattern,
                "color_hex": piece["color_hex"],
                "outline_color": GROUP_COLORS[len(ordered_groups) % len(GROUP_COLORS)],
                "piece_count": 0,
                "total_size_percent": 0.0,
                "estimated_weight_g": 0.0,
                "_size_labels": [],
                "_piece_ids": [],
                "_fabric_types": [],
                "_material_families": [],
                "_structures": [],
                "_compositions": [],
            }
            groups_by_key[key] = group
            ordered_groups.append(group)

        group = groups_by_key[key]
        piece["sort_group_id"] = group["sort_group_id"]
        piece["outline_color"] = group["outline_color"]
        piece["color_family"] = color_family
        piece["material_sort_family"] = material_sort_family
        group["piece_count"] += 1
        group["total_size_percent"] += piece["size_percent"]
        group["estimated_weight_g"] += piece.get("estimated_weight_g") or 0.0
        group["_size_labels"].append(piece["size_label"])
        group["_piece_ids"].append(piece["id"])
        group["_fabric_types"].append(fabric_type)
        group["_material_families"].append(material_family)
        group["_structures"].append(piece.get("weave_or_knit") or "unknown")
        group["_compositions"].append(piece.get("composition_guess", "mixed textile"))

    groups = []
    for group in ordered_groups:
        labels = group.pop("_size_labels")
        piece_ids = group.pop("_piece_ids")
        fabric_types = group.pop("_fabric_types")
        material_families = group.pop("_material_families")
        structures = group.pop("_structures")
        compositions = group.pop("_compositions")
        group["fabric_type_guess"] = _most_common(fabric_types, group["fabric_type_guess"])
        group["material_family"] = _most_common(material_families, group["material_family"])
        group["weave_or_knit"] = _most_common(structures, group["weave_or_knit"])
        group["composition_guess"] = _most_common(compositions, group["composition_guess"])
        avg_size = max(set(labels), key=labels.count) if labels else "medium"
        group["avg_size_label"] = avg_size
        group["total_size_percent"] = round(group["total_size_percent"], 2)
        group["estimated_weight_g"] = round(group["estimated_weight_g"], 1)
        group["total_weight_label"] = _weight_label(group["estimated_weight_g"])
        group["piece_ids"] = piece_ids
        descriptor = _group_descriptor(group)
        group["sort_instruction"] = (
            f"Bin {group['sort_group_id']}: place outlined pieces {', '.join(str(i) for i in piece_ids)} "
            f"into the {descriptor} lot."
        )
        groups.append(group)

    groups.sort(key=lambda g: g["estimated_weight_g"], reverse=True)
    return groups


def render_annotated_image(image_bgr, pieces, groups):
    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    base = Image.fromarray(rgb).convert("RGBA")
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font = _font(16)
    font_bold = _font(18)
    font_small = _font(13)

    group_by_id = {g["sort_group_id"]: g for g in groups}

    for piece in pieces:
        color = _hex_to_rgba(piece.get("outline_color") or "#2563eb", 70)
        contour = piece.get("contour") or []
        if len(contour) >= 3:
            draw.polygon([tuple(p) for p in contour], fill=color)

    composed = Image.alpha_composite(base, overlay)
    draw = ImageDraw.Draw(composed)

    for piece in pieces:
        outline = piece.get("outline_color") or "#2563eb"
        contour = piece.get("contour") or []
        if len(contour) >= 2:
            points = [tuple(p) for p in contour]
            draw.line(points + [points[0]], fill=outline, width=4)

        x, y, w, h = piece["bbox"]
        label = f"{piece['sort_group_id']}{piece['id']}"
        tx, ty = _label_position(piece, label, font_bold)
        text_box = draw.textbbox((0, 0), label, font=font)
        tw = text_box[2] - text_box[0]
        th = text_box[3] - text_box[1]
        badge = [tx, ty, tx + tw + 16, ty + th + 12]
        draw.rounded_rectangle(badge, radius=6, fill=(0, 0, 0, 232))
        draw.text((tx + 8, ty + 5), label, fill="white", font=font_bold)

    legend_w = 540
    out = Image.new("RGBA", (composed.width + legend_w, composed.height), (248, 250, 252, 255))
    out.paste(composed, (0, 0))
    legend = ImageDraw.Draw(out)

    lx = composed.width + 24
    y = 24
    legend.text((lx, y), "Sorting Plan", fill=(15, 23, 42), font=font_bold)
    y += 34
    legend.text((lx, y), f"{len(pieces)} fabric pieces across {len(groups)} sort bins", fill=(71, 85, 105), font=font)
    y += 34

    for group in groups:
        if y > out.height - 96:
            legend.text((lx, y), "... more bins in table", fill=(100, 116, 139), font=font)
            break
        color = group["outline_color"]
        legend.rounded_rectangle([lx, y, lx + 62, y + 34], radius=7, fill=color)
        legend.text((lx + 21, y + 8), group["sort_group_id"], fill="white", font=font_bold)
        title = _group_descriptor(group)
        legend.text((lx + 78, y - 1), _ellipsize(title, 42), fill=(15, 23, 42), font=font_bold)
        y += 20
        detail = (
            f"{group['piece_count']} pcs | {group.get('total_weight_label', str(group['estimated_weight_g']) + ' g')} | "
            f"{group.get('composition_guess', 'mixed textile')}"
        )
        legend.text((lx + 78, y), _ellipsize(detail, 56), fill=(71, 85, 105), font=font_small)
        y += 17
        ids = "Pieces " + ", ".join(f"{group['sort_group_id']}{pid}" for pid in group.get("piece_ids", []))
        legend.text((lx + 78, y), _ellipsize(ids, 56), fill=(100, 116, 139), font=font_small)
        y += 30

    buf = BytesIO()
    out.convert("RGB").save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def piece_table(pieces):
    rows = []
    for piece in pieces:
        rows.append(
            {
                "piece_id": piece["id"],
                "bin": piece.get("sort_group_id"),
                "color": piece["color_name"],
                "color_family": piece.get("color_family"),
                "pattern": piece.get("pattern_type"),
                "fabric_type": piece.get("fabric_type_guess"),
                "material_family": piece.get("material_family"),
                "weave_or_knit": piece.get("weave_or_knit"),
                "composition": piece.get("composition_guess"),
                "confidence": piece.get("fabric_confidence"),
                "shape": piece.get("shape_label"),
                "size": piece.get("size_label"),
                "area_cm2": piece.get("area_cm2"),
                "estimated_weight_g": piece.get("estimated_weight_g"),
                "weight_label": piece.get("weight_label"),
                "evidence": piece.get("material_evidence"),
            }
        )
    return rows


def _group_id(index):
    letters = string.ascii_uppercase
    if index < len(letters):
        return letters[index]
    return f"Z{index - len(letters) + 1}"


def _hex_to_rgba(hex_color, alpha):
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def _sort_color_family(piece):
    explicit = piece.get("color_family")
    if explicit:
        return explicit
    pattern = piece.get("pattern_type") or "solid"
    if pattern in {"floral", "checkered", "striped"}:
        names = [piece.get("color_name")]
        names.extend(c.get("name") for c in piece.get("secondary_colors", [])[:2] if c.get("name"))
        names = [name for name in names if name]
        if names:
            return f"{pattern} " + "/".join(dict.fromkeys(names))
        return pattern
    return normalized_color_family(
        rgb=piece.get("dominant_rgb"),
        name=piece.get("color_name", "mixed"),
        clusters=piece.get("color_clusters"),
    )


def _sort_pattern(piece):
    pattern = piece.get("pattern_type") or "solid"
    if pattern in {"print", "mixed"}:
        return "solid"
    return pattern


def _material_consensus_by_color(pieces):
    by_color = defaultdict(list)
    for piece in pieces:
        by_color[_sort_color_family(piece)].append(_sort_material_family(piece))

    consensus = {}
    for family, material_families in by_color.items():
        if len(material_families) < 3:
            continue
        material, count = Counter(material_families).most_common(1)[0]
        if count >= 2:
            consensus[family] = material
    return consensus


def _sort_material_family(piece):
    fabric = (piece.get("fabric_type_guess") or "").lower()
    material = (piece.get("material_family") or "").lower()
    structure = (piece.get("weave_or_knit") or "").lower()
    color = piece.get("color_family") or normalized_color_family(
        rgb=piece.get("dominant_rgb"),
        name=piece.get("color_name", ""),
        clusters=piece.get("color_clusters"),
    )

    if "denim" in fabric or "denim" in material or "denim" in structure:
        return "denim"
    if "fleece" in fabric or "fleece" in structure:
        return "fleece"
    if "knit" in fabric or "jersey" in fabric or "rib" in fabric or "knit" in structure:
        if color in {"red", "black"}:
            return "fleece"
        return "knit"
    if "woven" in fabric or "woven" in structure or "cotton" in material:
        return "woven"
    if "poly" in material:
        return "synthetic"
    return "textile"


def _most_common(values, default):
    cleaned = [value for value in values if value]
    if not cleaned:
        return default
    return Counter(cleaned).most_common(1)[0][0]


def _group_descriptor(group):
    color = group.get("color_family") or group.get("color_name") or "mixed"
    fabric = group.get("fabric_type_guess") or "unknown textile"
    pattern = group.get("pattern_type") or "solid"
    if pattern != "solid" and pattern not in color:
        return f"{color} {pattern} {fabric}"
    return f"{color} {fabric}"


def _fallback_material_family(fabric_type):
    if "poly" in fabric_type:
        return "polyester"
    if fabric_type == "denim":
        return "denim/cotton"
    if "cotton" in fabric_type or fabric_type in {"checkered woven", "striped knit", "floral printed cotton"}:
        return "cotton"
    return "unknown"


def _weight_label(weight_g):
    if weight_g is None:
        return "unknown"
    if weight_g < 10:
        return f"{weight_g:.1f} g"
    if weight_g < 1000:
        return f"{weight_g:.0f} g"
    return f"{weight_g / 1000:.2f} kg"


def _label_position(piece, label, font):
    x, y, w, h = piece["bbox"]
    contour = piece.get("contour") or []
    if len(contour) >= 3:
        pts = np.array(contour, dtype=np.int32)
        moments = cv2.moments(pts)
        if moments["m00"]:
            cx = int(moments["m10"] / moments["m00"])
            cy = int(moments["m01"] / moments["m00"])
            return max(2, cx - 18), max(2, cy - 12)
    return x + 4, y + 4


def _font(size):
    for path in (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def _ellipsize(text, limit):
    text = str(text)
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)] + "..."
