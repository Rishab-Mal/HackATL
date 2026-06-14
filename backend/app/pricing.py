"""Textile scrap pricing model.

Base price per kg is derived from fabric type and composition, then adjusted
by purity, color, weight tier, and piece-count multipliers. Price decays
exponentially after a grace period to incentivize quick marketplace turnover.

Decay formula: current = base * max(FLOOR, e^(-DECAY_RATE * max(0, days - GRACE)))
Half-life after grace period: ~46 days.
"""

import math
import re
from datetime import datetime

# ---------------------------------------------------------------------------
# Base price per kg (USD) by dominant fabric keyword
# ---------------------------------------------------------------------------

_FABRIC_BASE: dict[str, float] = {
    "silk": 14.00,
    "wool": 6.50,
    "linen": 4.50,
    "denim": 3.80,
    "twill": 3.50,
    "cotton": 3.20,
    "jersey": 2.80,
    "spandex": 2.20,
    "nylon": 1.80,
    "polyester": 1.20,
}

_DEFAULT_BASE = 2.00


def _base_per_kg(fabric_type: str) -> float:
    fabric_lower = fabric_type.lower()
    for keyword, price in _FABRIC_BASE.items():
        if keyword in fabric_lower:
            return price
    return _DEFAULT_BASE


# ---------------------------------------------------------------------------
# Purity multiplier — single-fiber lots are more recyclable
# ---------------------------------------------------------------------------

def _purity_multiplier(composition: str) -> float:
    match = re.search(r"(\d+)\s*%", composition)
    if not match:
        return 1.0
    dominant_pct = int(match.group(1))
    if dominant_pct >= 95:
        return 1.20
    if dominant_pct >= 85:
        return 1.10
    if dominant_pct >= 70:
        return 1.00
    return 0.85


# ---------------------------------------------------------------------------
# Color multiplier — neutrals/whites command a re-dyeing premium
# ---------------------------------------------------------------------------

_COLOR_MULTIPLIERS: dict[str, float] = {
    "white": 1.15,
    "natural": 1.15,
    "cream": 1.12,
    "ivory": 1.12,
    "beige": 1.10,
    "grey": 1.05,
    "gray": 1.05,
    "black": 1.05,
    "navy": 1.00,
    "blue": 1.00,
    "red": 0.97,
    "green": 0.97,
    "yellow": 0.95,
    "mixed": 0.85,
}


def _color_multiplier(color_name: str) -> float:
    return _COLOR_MULTIPLIERS.get(color_name.lower(), 1.00)


# ---------------------------------------------------------------------------
# Weight tier — bulk discount, small-lot premium
# ---------------------------------------------------------------------------

def _weight_multiplier(weight_kg: float) -> float:
    if weight_kg >= 15:
        return 0.88
    if weight_kg >= 8:
        return 0.95
    if weight_kg <= 1:
        return 1.20
    if weight_kg <= 3:
        return 1.10
    return 1.00


# ---------------------------------------------------------------------------
# Piece-count multiplier — fewer large pieces = more maker-friendly
# ---------------------------------------------------------------------------

def _piece_multiplier(piece_count: int) -> float:
    if piece_count < 10:
        return 1.20
    if piece_count <= 30:
        return 1.05
    if piece_count <= 50:
        return 1.00
    return 0.90


# ---------------------------------------------------------------------------
# Main pricing function
# ---------------------------------------------------------------------------

def calculate_base_price(
    fabric_type: str,
    composition: str,
    color_name: str,
    weight_kg: float,
    piece_count: int,
) -> float:
    """Return the base listing price (USD) for a lot."""
    per_kg = (
        _base_per_kg(fabric_type)
        * _purity_multiplier(composition)
        * _color_multiplier(color_name)
        * _weight_multiplier(weight_kg)
        * _piece_multiplier(piece_count)
    )
    return round(per_kg * weight_kg, 2)


# ---------------------------------------------------------------------------
# Price decay
# ---------------------------------------------------------------------------

DECAY_RATE = 0.015   # 1.5 % per day — half-life ~46 days after grace
GRACE_DAYS = 7       # no decay for first 7 days
FLOOR_PCT = 0.35     # never drop below 35 % of base price


def current_price(base_price: float, created_at: datetime) -> float:
    days = (datetime.utcnow() - created_at).total_seconds() / 86_400
    decay_days = max(0.0, days - GRACE_DAYS)
    factor = max(FLOOR_PCT, math.exp(-DECAY_RATE * decay_days))
    return round(base_price * factor, 2)


def decay_pct(base_price: float, created_at: datetime) -> int:
    """Percentage the price has dropped from base (0–65)."""
    cp = current_price(base_price, created_at)
    if base_price == 0:
        return 0
    return max(0, round((1 - cp / base_price) * 100))


def days_listed(created_at: datetime) -> int:
    return max(0, int((datetime.utcnow() - created_at).total_seconds() / 86_400))
