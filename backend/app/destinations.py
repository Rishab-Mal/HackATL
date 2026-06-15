"""AI Material Destination Engine.

Given a detected fabric group (fabric type, composition, color, weight), score
candidate reuse pathways (upcycling, fiber reclamation, insulation, landfill,
etc.), match interested buyers, and translate the environmental payoff into
everyday equivalents. Pure analysis layer -- no DB writes, no lot changes.

Scoring formula: 40% revenue + 30% CO2 saved + 20% demand + 10% speed-to-sale,
each normalized to 0-100. Demand/speed are derived from buyer-interest overlap
so the math stays deterministic even without an LLM available.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

from sqlalchemy.orm import Session

from . import models, pricing, schemas
from .constants import (
    CARBON_PER_KG,
    CO2_KG_PER_CAR_MILE,
    CO2_KG_PER_PHONE_CHARGE,
    WATER_L_PER_PLASTIC_BOTTLE,
    WATER_L_PER_SHOWER,
    WATER_PER_KG,
)

# ---------------------------------------------------------------------------
# Destination catalog
# ---------------------------------------------------------------------------

_CATEGORY_KEYWORDS = {
    "denim_cotton": ["denim", "cotton", "twill", "jersey", "linen"],
    "synthetic": ["polyester", "nylon", "spandex"],
    "wool_silk": ["wool", "silk"],
}

# name, revenue_multiplier (x base $/kg price), co2_multiplier (x CARBON_PER_KG)
DESTINATIONS: dict[str, list[tuple[str, float, float]]] = {
    "denim_cotton": [
        ("Upcycling — Tote Bags & Accessories", 1.5, 1.3),
        ("Fiber Reclamation", 1.2, 1.0),
        ("Insulation Manufacturing", 1.0, 0.7),
        ("Industrial Wiping Cloths", 0.8, 0.5),
        ("Landfill Disposal", 0.0, 0.0),
    ],
    "synthetic": [
        ("Insulation Manufacturing", 1.2, 0.8),
        ("Fiber Reclamation", 1.0, 1.0),
        ("Industrial Wiping Cloths", 0.8, 0.5),
        ("Landfill Disposal", 0.0, 0.0),
    ],
    "wool_silk": [
        ("Upcycling — Apparel Accessories", 1.6, 1.3),
        ("Fiber Reclamation", 1.1, 1.0),
        ("Insulation Manufacturing", 0.9, 0.7),
        ("Landfill Disposal", 0.0, 0.0),
    ],
    "general": [
        ("Fiber Reclamation", 1.1, 1.0),
        ("Industrial Wiping Cloths", 0.9, 0.6),
        ("Insulation Manufacturing", 0.8, 0.6),
        ("Landfill Disposal", 0.0, 0.0),
    ],
}


def _category_for_fabric(fabric_type: str) -> str:
    fabric_lower = (fabric_type or "").lower()
    for category, keywords in _CATEGORY_KEYWORDS.items():
        if any(keyword in fabric_lower for keyword in keywords):
            return category
    return "general"


# ---------------------------------------------------------------------------
# Buyer matching
# ---------------------------------------------------------------------------


def _match_buyers(db: Session, fabric_type: str, material_family: str | None, color_name: str):
    keywords = {k.lower() for k in (fabric_type, material_family, color_name) if k}

    scored = []
    for buyer in db.query(models.Buyer).all():
        materials = {m.strip().lower() for m in buyer.interested_materials.split(",") if m.strip()}
        overlap = len(keywords & materials)
        if overlap == 0:
            continue
        match_pct = min(99, 70 + overlap * 15)
        scored.append((match_pct, buyer.name))

    scored.sort(key=lambda item: item[0], reverse=True)
    top = scored[:3]
    matches = [schemas.BuyerMatch(name=name, match_pct=pct) for pct, name in top]
    demand_score = min(100, len(scored) * 33)
    return matches, demand_score


# ---------------------------------------------------------------------------
# LLM reuse-pathway naming (optional flavor text, heuristic fallback)
# ---------------------------------------------------------------------------


def _llm_destination_names(fabric_type, material_family, names, api_key, model_names):
    if not api_key:
        return None

    prompt = (
        "Rewrite each reuse pathway name below into a short (3-6 word), specific, "
        f"marketable name for scrap fabric of type '{fabric_type}' "
        f"(material family: '{material_family or 'unknown'}'). "
        "Keep the same order and meaning -- do not reorder or merge entries. "
        "Return JSON only: {\"names\": [\"...\", ...]}. Pathways: " + json.dumps(names)
    )
    body = {
        "model": model_names[0] if model_names else "openai/gpt-4o-mini",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.4,
        "max_tokens": 300,
    }
    request = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:8000",
            "X-OpenRouter-Title": "Scrap Sorter Destination Engine",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
        content = payload["choices"][0]["message"]["content"]
        if isinstance(content, list):
            content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
        data = json.loads(content)
        result_names = data.get("names")
        if isinstance(result_names, list) and len(result_names) == len(names):
            return [str(n) for n in result_names]
    except (urllib.error.URLError, json.JSONDecodeError, KeyError, IndexError, TypeError, ValueError):
        return None
    return None


# ---------------------------------------------------------------------------
# Main scoring entrypoint
# ---------------------------------------------------------------------------


def analyze_destinations(
    fabric_type: str,
    composition: str,
    color_name: str,
    weight_kg: float,
    material_family: str | None,
    db: Session,
    settings,
    piece_count: int = 20,
) -> schemas.DestinationAnalysis:
    category = _category_for_fabric(fabric_type)
    catalog = DESTINATIONS[category]

    base_price = pricing.calculate_base_price(
        fabric_type=fabric_type or "mixed textile",
        composition=composition or "",
        color_name=color_name or "",
        weight_kg=weight_kg,
        piece_count=piece_count,
    )
    base_co2 = weight_kg * CARBON_PER_KG

    recommended_buyers, demand_score = _match_buyers(db, fabric_type, material_family, color_name)

    names = [entry[0] for entry in catalog]
    llm_names = _llm_destination_names(
        fabric_type, material_family, names, settings.openrouter_api_key, settings.openrouter_vision_models
    )

    revenues = [round(base_price * rev_mult, 2) for _, rev_mult, _ in catalog]
    co2s = [round(base_co2 * co2_mult, 2) for _, _, co2_mult in catalog]
    max_revenue = max(revenues) or 1.0
    max_co2 = max(co2s) or 1.0

    options: list[schemas.DestinationOption] = []
    for idx, (name, rev_mult, co2_mult) in enumerate(catalog):
        is_landfill = rev_mult == 0 and co2_mult == 0
        item_demand = 0 if is_landfill else demand_score
        revenue_norm = revenues[idx] / max_revenue * 100
        co2_norm = co2s[idx] / max_co2 * 100
        score = round(0.4 * revenue_norm + 0.3 * co2_norm + 0.2 * item_demand + 0.1 * item_demand)
        options.append(
            schemas.DestinationOption(
                name=llm_names[idx] if llm_names else name,
                revenue_usd=revenues[idx],
                co2_saved_kg=co2s[idx],
                score=score,
            )
        )

    ordered = sorted(options, key=lambda o: o.score, reverse=True)
    recommended, *alternatives = ordered

    sale_probability_pct = min(98, 60 + round(demand_score * 0.35))
    expected_days_to_sale = round(1 + (100 - demand_score) / 100 * 6, 1)

    co2_mult_recommended = recommended.co2_saved_kg / base_co2 if base_co2 else 0.0
    water_saved_l = weight_kg * WATER_PER_KG * co2_mult_recommended

    equivalents = schemas.ImpactEquivalents(
        car_miles=round(recommended.co2_saved_kg / CO2_KG_PER_CAR_MILE, 1),
        phone_charges=int(recommended.co2_saved_kg / CO2_KG_PER_PHONE_CHARGE),
        plastic_bottles=int(water_saved_l / WATER_L_PER_PLASTIC_BOTTLE),
        showers=round(water_saved_l / WATER_L_PER_SHOWER, 1),
    )

    landfill_co2_saved_kg = next(
        (round(base_co2 * co2_mult, 2) for _, rev_mult, co2_mult in catalog if rev_mult == 0 and co2_mult == 0),
        0.0,
    )

    return schemas.DestinationAnalysis(
        recommended=recommended,
        alternatives=alternatives,
        recommended_buyers=recommended_buyers,
        sale_probability_pct=sale_probability_pct,
        expected_days_to_sale=expected_days_to_sale,
        environmental_equivalents=equivalents,
        landfill_co2_saved_kg=landfill_co2_saved_kg,
    )
