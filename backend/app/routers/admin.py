"""Admin-only metrics endpoint."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..pricing import current_price, days_listed

router = APIRouter(prefix="/api/admin", tags=["admin"])

ESTIMATED_COST_FACTOR = 0.28  # assume 28% of listing price = acquisition / handling cost


@router.get("/metrics")
def get_metrics(db: Session = Depends(get_db)):
    lots = db.query(models.Lot).all()
    claimed = [l for l in lots if l.status == "claimed"]
    available = [l for l in lots if l.status == "available"]

    revenue = sum(l.price_usd for l in claimed)
    estimated_cost = revenue * ESTIMATED_COST_FACTOR
    gross_profit = revenue - estimated_cost
    inventory_value = sum(current_price(l.price_usd, l.created_at) for l in available)
    total_weight = sum(l.weight_kg for l in lots)

    # Avg days listed before claim (approximated from created_at)
    avg_days = (
        round(sum(days_listed(l.created_at) for l in claimed) / len(claimed), 1)
        if claimed else 0
    )

    # Top buyers by lots claimed
    buyer_counts: dict[str, dict] = {}
    for l in claimed:
        if l.claimed_by:
            entry = buyer_counts.setdefault(l.claimed_by, {"lots": 0, "value": 0.0})
            entry["lots"] += 1
            entry["value"] += l.price_usd
    top_buyers = sorted(
        [{"name": k, **v} for k, v in buyer_counts.items()],
        key=lambda x: -x["value"],
    )[:6]

    # Revenue + weight by fabric type
    fabric_stats: dict[str, dict] = {}
    for l in lots:
        entry = fabric_stats.setdefault(l.fabric_type, {"weight_kg": 0.0, "revenue": 0.0, "lots": 0})
        entry["weight_kg"] = round(entry["weight_kg"] + l.weight_kg, 2)
        entry["lots"] += 1
        if l.status == "claimed":
            entry["revenue"] = round(entry["revenue"] + l.price_usd, 2)
    fabric_rows = sorted(
        [{"fabric_type": k, **v} for k, v in fabric_stats.items()],
        key=lambda x: -x["revenue"],
    )

    # Carbon + water equivalencies
    total_carbon = round(sum(l.carbon_saved_kg for l in lots), 1)
    total_water = round(sum(l.water_saved_l for l in lots), 0)

    return {
        # P&L
        "revenue": round(revenue, 2),
        "estimated_cost": round(estimated_cost, 2),
        "gross_profit": round(gross_profit, 2),
        "profit_margin_pct": round(gross_profit / revenue * 100, 1) if revenue else 0,
        "inventory_value": round(inventory_value, 2),
        # Lot performance
        "total_lots": len(lots),
        "available_lots": len(available),
        "claimed_lots": len(claimed),
        "claim_rate_pct": round(len(claimed) / len(lots) * 100, 1) if lots else 0,
        "avg_days_to_claim": avg_days,
        "total_weight_kg": round(total_weight, 1),
        # Impact
        "total_carbon_saved_kg": total_carbon,
        "total_water_saved_l": int(total_water),
        "carbon_equiv_trees": round(total_carbon / 21, 1),   # 1 tree absorbs ~21 kg CO2/yr
        "water_equiv_showers": round(total_water / 65, 0),   # avg shower ~65 L
        # Breakdowns
        "top_buyers": top_buyers,
        "fabric_stats": fabric_rows,
    }
