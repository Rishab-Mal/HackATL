"""OpenRouter vision model calls for material and composition estimates."""

from __future__ import annotations

import base64
from io import BytesIO
import json
import re
import urllib.error
import urllib.request

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .measurement import GSM_BY_FABRIC


ALLOWED_FABRICS = list(GSM_BY_FABRIC.keys())
ALLOWED_FAMILIES = [
    "cotton",
    "polyester",
    "cotton-poly blend",
    "denim/cotton",
    "synthetic blend",
    "unknown",
]
ALLOWED_STRUCTURES = [
    "woven",
    "knit",
    "denim twill",
    "fleece/nap",
    "satin",
    "unknown",
]


def classify_materials(image_bgr, pieces, api_key: str, models: list[str], timeout_s: int = 60):
    if not api_key:
        return _heuristic_materials(pieces, "OPENROUTER_API_KEY is not configured")

    contact_sheet = _make_contact_sheet(image_bgr, pieces)
    full_image = _image_data_url(image_bgr)
    sheet_image = _pil_data_url(contact_sheet)

    metadata = [
        {
            "id": p["id"],
            "color_name": p["color_name"],
            "color_hex": p.get("color_hex"),
            "secondary_colors": [
                {"name": c.get("name"), "percent": c.get("percent")} for c in p.get("secondary_colors", [])[:4]
            ],
            "pattern_type": p.get("pattern_type"),
            "size_label": p["size_label"],
            "shape_label": p["shape_label"],
            "area_cm2": p.get("area_cm2"),
            "aspect_ratio": p.get("aspect_ratio"),
        }
        for p in pieces
    ]

    prompt = _classification_prompt(metadata)
    errors = []
    for model in models:
        try:
            data = _call_openrouter(api_key, model, prompt, full_image, sheet_image, timeout_s)
            return _normalize_llm_result(data, pieces, model, None)
        except Exception as exc:
            errors.append(f"{model}: {exc}")

    return _heuristic_materials(pieces, "OpenRouter classification failed: " + " | ".join(errors))


def _classification_prompt(metadata):
    return (
        "You are classifying clean garment-factory fabric scraps from an iPhone photo. "
        "You get the original table image plus a numbered contact sheet. Each card is an original crop with the detected scrap outlined. "
        "Classify every provided piece id. Use broad, visually defensible textile categories, not tiny chemistry distinctions. "
        "If a piece is printed, striped, checkered, denim, fleece-like, shiny satin-like, jersey/knit, or plain woven, use that visual evidence. "
        "Use only these fabric_type values: "
        f"{', '.join(ALLOWED_FABRICS)}. "
        "Composition must be a short percent string like '95% cotton, 5% spandex'. "
        "Estimate gsm from the visible material class, thickness, drape, texture, and folds. "
        "fold_factor should be 1.0 for flat single-layer pieces, 1.5-2.5 for visibly folded/thick pieces. "
        "Be conservative with confidence when the crop is ambiguous. Return JSON only, no markdown. Piece metadata: "
        + json.dumps(metadata)
    )


def _call_openrouter(api_key, model, prompt, full_image, sheet_image, timeout_s):
    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "pieces": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "id": {"type": "integer"},
                        "is_fabric": {"type": "boolean"},
                        "fabric_type": {"type": "string", "enum": ALLOWED_FABRICS},
                        "material_family": {"type": "string", "enum": ALLOWED_FAMILIES},
                        "weave_or_knit": {"type": "string", "enum": ALLOWED_STRUCTURES},
                        "composition": {"type": "string"},
                        "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
                        "gsm": {"type": "number"},
                        "fold_factor": {"type": "number"},
                        "evidence": {"type": "string"},
                    },
                    "required": [
                        "id",
                        "is_fabric",
                        "fabric_type",
                        "material_family",
                        "weave_or_knit",
                        "composition",
                        "confidence",
                        "gsm",
                        "fold_factor",
                        "evidence",
                    ],
                },
            }
        },
        "required": ["pieces"],
    }
    body = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": full_image, "detail": "low"}},
                    {"type": "image_url", "image_url": {"url": sheet_image, "detail": "high"}},
                ],
            }
        ],
        "temperature": 0.1,
        "max_tokens": 4000,
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": "fabric_piece_classification", "strict": True, "schema": schema},
        },
    }
    request = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:8000",
            "X-OpenRouter-Title": "Scrap Sorter Vision Lab",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_s) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")[:500]
        raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc

    content = payload["choices"][0]["message"]["content"]
    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    return _json_from_text(content)


def _json_from_text(text):
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def _normalize_llm_result(data, pieces, model, warning):
    by_id = {int(item.get("id")): item for item in data.get("pieces", []) if item.get("id") is not None}
    results = {}
    for piece in pieces:
        item = by_id.get(piece["id"], {})
        fabric = item.get("fabric_type") if item.get("fabric_type") in ALLOWED_FABRICS else None
        if not fabric:
            fabric = _guess_from_color(piece)
        gsm = _clean_number(item.get("gsm"), GSM_BY_FABRIC.get(fabric, 170), 80, 500)
        fold_factor = _clean_number(item.get("fold_factor"), 1.0, 0.5, 4.0)
        material_family = item.get("material_family")
        if material_family not in ALLOWED_FAMILIES:
            material_family = _family_for_fabric(fabric)
        weave_or_knit = item.get("weave_or_knit")
        if weave_or_knit not in ALLOWED_STRUCTURES:
            weave_or_knit = _structure_for_fabric(fabric)
        results[piece["id"]] = {
            "is_fabric": bool(item.get("is_fabric", True)),
            "fabric_type_guess": fabric,
            "material_family": material_family,
            "weave_or_knit": weave_or_knit,
            "composition_guess": item.get("composition") or _default_composition(fabric),
            "fabric_confidence": item.get("confidence") if item.get("confidence") in {"low", "medium", "high"} else "medium",
            "material_evidence": item.get("evidence") or "Estimated from visual texture, color, and piece crop.",
            "gsm": gsm,
            "fold_factor": fold_factor,
        }
    return {
        "model": model,
        "warning": warning,
        "pieces": results,
    }


def _clean_number(value, default, low, high):
    try:
        value = float(value)
    except (TypeError, ValueError):
        return float(default)
    return float(max(low, min(high, value)))


def _heuristic_materials(pieces, warning):
    data = {"pieces": []}
    for piece in pieces:
        fabric = _guess_from_color(piece)
        data["pieces"].append(
            {
                "id": piece["id"],
                "is_fabric": True,
                "fabric_type": fabric,
                "material_family": _family_for_fabric(fabric),
                "weave_or_knit": _structure_for_fabric(fabric),
                "composition": _default_composition(fabric),
                "confidence": "low",
                "gsm": GSM_BY_FABRIC.get(fabric, 170),
                "fold_factor": 1.0,
                "evidence": "Fallback estimate because the vision LLM was unavailable.",
            }
        )
    return _normalize_llm_result(data, pieces, "heuristic-fallback", warning)


def _guess_from_color(piece):
    color = piece.get("color_name", "")
    pattern = piece.get("pattern_type")
    if pattern == "floral":
        return "floral printed cotton"
    if pattern == "checkered":
        return "checkered woven"
    if pattern == "striped":
        return "striped knit"
    if color in {"denim", "navy", "blue"} and piece.get("shape_label") in {"panel", "strip", "irregular"}:
        return "denim"
    if color in {"white", "cream", "beige"}:
        return "cotton jersey"
    if color in {"black", "charcoal", "gray"}:
        return "polyester knit"
    if color in {"pink", "red", "yellow", "olive", "green"}:
        return "cotton jersey"
    return "cotton-poly blend"


def _default_composition(fabric):
    defaults = {
        "cotton woven": "100% cotton",
        "cotton jersey": "95% cotton, 5% spandex",
        "rib knit": "95% cotton, 5% spandex",
        "denim": "98% cotton, 2% elastane",
        "fleece": "80% cotton, 20% polyester",
        "polyester woven": "100% polyester",
        "polyester knit": "100% polyester",
        "cotton-poly blend": "60% cotton, 40% polyester",
        "spandex blend": "90% polyester, 10% spandex",
        "satin/silky synthetic": "100% polyester",
        "checkered woven": "100% cotton",
        "striped knit": "95% cotton, 5% spandex",
        "floral printed cotton": "100% cotton",
        "unknown textile": "mixed textile",
    }
    return defaults.get(fabric, "mixed textile")


def _family_for_fabric(fabric):
    if fabric == "denim":
        return "denim/cotton"
    if fabric in {"polyester woven", "polyester knit", "fleece", "satin/silky synthetic", "spandex blend"}:
        return "polyester" if fabric != "spandex blend" else "synthetic blend"
    if fabric == "cotton-poly blend":
        return "cotton-poly blend"
    if fabric in {"cotton woven", "cotton jersey", "rib knit", "checkered woven", "striped knit", "floral printed cotton"}:
        return "cotton"
    return "unknown"


def _structure_for_fabric(fabric):
    mapping = {
        "cotton woven": "woven",
        "cotton jersey": "knit",
        "rib knit": "knit",
        "denim": "denim twill",
        "fleece": "fleece/nap",
        "polyester woven": "woven",
        "polyester knit": "knit",
        "cotton-poly blend": "woven",
        "spandex blend": "knit",
        "satin/silky synthetic": "satin",
        "checkered woven": "woven",
        "striped knit": "knit",
        "floral printed cotton": "woven",
    }
    return mapping.get(fabric, "unknown")


def _make_contact_sheet(image_bgr, pieces):
    cards = []
    for piece in pieces[:35]:
        crop = _piece_crop(image_bgr, piece)
        cards.append((piece["id"], crop))

    card_w, card_h = 220, 220
    cols = 5
    rows = max(1, (len(cards) + cols - 1) // cols)
    sheet = Image.new("RGB", (cols * card_w, rows * card_h), "white")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for idx, (piece_id, crop) in enumerate(cards):
        row, col = divmod(idx, cols)
        x, y = col * card_w, row * card_h
        crop.thumbnail((card_w - 16, card_h - 36), Image.Resampling.LANCZOS)
        ox = x + (card_w - crop.width) // 2
        oy = y + 28 + (card_h - 36 - crop.height) // 2
        sheet.paste(crop, (ox, oy))
        draw.rectangle([x + 6, y + 6, x + 58, y + 25], fill=(0, 0, 0))
        draw.text((x + 12, y + 10), f"ID {piece_id}", fill=(255, 255, 255), font=font)
        draw.rectangle([x, y, x + card_w - 1, y + card_h - 1], outline=(210, 210, 210))

    return sheet


def _piece_crop(image_bgr, piece):
    x, y, w, h = piece["bbox"]
    pad = max(8, int(max(w, h) * 0.12))
    x1, y1 = max(0, x - pad), max(0, y - pad)
    x2 = min(image_bgr.shape[1], x + w + pad)
    y2 = min(image_bgr.shape[0], y + h + pad)

    crop = image_bgr[y1:y2, x1:x2]
    rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(rgb).convert("RGB")
    draw = ImageDraw.Draw(pil)
    contour = piece.get("contour") or []
    if len(contour) >= 2:
        local = [(int(px - x1), int(py - y1)) for px, py in contour]
        draw.line(local + [local[0]], fill=(37, 99, 235), width=4)
    return pil


def _image_data_url(image_bgr):
    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(rgb)
    pil.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
    return _pil_data_url(pil)


def _pil_data_url(image):
    buf = BytesIO()
    image.save(buf, format="JPEG", quality=88)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"
