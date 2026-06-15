"""Admin-only metrics endpoint."""

from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..pricing import current_price, days_listed, decay_pct
from .auth import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])

ESTIMATED_COST_FACTOR = 0.28


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

    avg_days = (
        round(sum(days_listed(l.created_at) for l in claimed) / len(claimed), 1)
        if claimed else 0
    )

    # Top buyers
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

    # Fabric breakdown
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

    # Carter's pilot
    carters_lots = [l for l in claimed if l.claimed_by == "Carter's Circular Supply Pilot"]
    carters_weight = round(sum(l.weight_kg for l in carters_lots), 1)
    carters_revenue = round(sum(l.price_usd for l in carters_lots), 2)
    carters_carbon = round(sum(l.carbon_saved_kg for l in carters_lots), 1)

    today = datetime.utcnow().date()

    # Impact
    total_carbon = round(sum(l.carbon_saved_kg for l in lots), 1)
    total_water = round(sum(l.water_saved_l for l in lots), 0)

    # Impact by fabric type (for chart)
    fabric_impact: dict[str, dict] = {}
    for l in lots:
        key = l.fabric_type.split('/')[0].replace(' Blend', '').strip()
        entry = fabric_impact.setdefault(key, {"carbon_kg": 0.0, "water_l": 0.0, "weight_kg": 0.0})
        entry["carbon_kg"] = round(entry["carbon_kg"] + l.carbon_saved_kg, 2)
        entry["water_l"] = round(entry["water_l"] + l.water_saved_l, 0)
        entry["weight_kg"] = round(entry["weight_kg"] + l.weight_kg, 2)
    fabric_impact_rows = sorted(
        [{"fabric": k, **v} for k, v in fabric_impact.items()],
        key=lambda x: -x["carbon_kg"],
    )[:8]

    # Cumulative impact over last 30 days
    impact_trend = []
    running_carbon = 0.0
    running_water = 0.0
    for i in range(29, -1, -1):
        d = today - timedelta(days=i)
        for l in lots:
            if l.created_at.date() == d:
                running_carbon += l.carbon_saved_kg
                running_water += l.water_saved_l
        impact_trend.append({
            "date": d.strftime("%-m/%-d"),
            "carbon_kg": round(running_carbon, 1),
            "water_l": round(running_water, 0),
        })

    # Revenue trend — last 14 days bucketed by day
    daily_revenue: dict = defaultdict(float)
    daily_lots: dict = defaultdict(int)
    for l in claimed:
        day = l.created_at.date()
        daily_revenue[day] += l.price_usd
        daily_lots[day] += 1
    revenue_trend = []
    for i in range(13, -1, -1):
        d = today - timedelta(days=i)
        revenue_trend.append({
            "date": d.strftime("%-m/%-d"),
            "revenue": round(daily_revenue.get(d, 0), 2),
            "lots": daily_lots.get(d, 0),
        })

    # Recent activity — last 10 claimed lots
    recent = sorted(
        [l for l in claimed if l.claimed_by],
        key=lambda l: l.created_at,
        reverse=True,
    )[:10]
    activity_feed = [
        {
            "lot_name": l.name,
            "buyer": l.claimed_by,
            "fabric_type": l.fabric_type,
            "weight_kg": l.weight_kg,
            "price": round(l.price_usd, 2),
            "days_ago": days_listed(l.created_at),
        }
        for l in recent
    ]

    # Price decay alerts — lots listed >14 days with >30% decay
    decay_alerts = []
    for l in available:
        dp = decay_pct(l.price_usd, l.created_at)
        dl = days_listed(l.created_at)
        if dl > 14 and dp > 30:
            decay_alerts.append({
                "id": l.id,
                "name": l.name,
                "fabric_type": l.fabric_type,
                "days_listed": dl,
                "decay_pct": dp,
                "base_price": round(l.price_usd, 2),
                "current_price": round(current_price(l.price_usd, l.created_at), 2),
                "value_lost": round(l.price_usd - current_price(l.price_usd, l.created_at), 2),
            })
    decay_alerts.sort(key=lambda x: -x["decay_pct"])

    return {
        "revenue": round(revenue, 2),
        "estimated_cost": round(estimated_cost, 2),
        "gross_profit": round(gross_profit, 2),
        "profit_margin_pct": round(gross_profit / revenue * 100, 1) if revenue else 0,
        "inventory_value": round(inventory_value, 2),
        "total_lots": len(lots),
        "available_lots": len(available),
        "claimed_lots": len(claimed),
        "claim_rate_pct": round(len(claimed) / len(lots) * 100, 1) if lots else 0,
        "avg_days_to_claim": avg_days,
        "total_weight_kg": round(total_weight, 1),
        "total_carbon_saved_kg": total_carbon,
        "total_water_saved_l": int(total_water),
        # Carbon equivalencies
        "carbon_equiv_trees": round(total_carbon / 21, 1),
        "carbon_equiv_car_miles": int(total_carbon * 2.48),   # EPA: 0.404 kg CO2/mile → ~2.48 miles/kg
        "carbon_equiv_flights": round(total_carbon / 255, 2), # avg domestic flight ~255 kg CO2/passenger
        "carbon_equiv_phones": int(total_carbon * 122),       # ~8.2g CO2 per phone charge → 122/kg
        # Water equivalencies
        "water_equiv_showers": int(round(total_water / 65, 0)),
        "water_equiv_bathtubs": int(total_water / 150),       # avg bathtub ~150L
        "water_equiv_bottles": int(total_water / 0.5),        # 500ml bottles
        "water_equiv_days": round(total_water / 3.7 / 365, 1), # US avg daily drinking water 3.7L/day → person-years
        # Energy
        "energy_saved_kwh": round(total_weight * 15, 1),      # textile production ~15 kWh/kg
        "energy_equiv_homes": round(total_weight * 15 / 10800, 2), # avg US home ~10,800 kWh/yr
        # Fabric impact by type
        "fabric_impact": fabric_impact_rows,
        # Cumulative trend
        "impact_trend": impact_trend,
        "diversion_target_kg": 500,
        "diversion_pct": min(100, round(total_weight / 500 * 100, 1)),
        "carters_lots": len(carters_lots),
        "carters_weight_kg": carters_weight,
        "carters_revenue": carters_revenue,
        "carters_carbon_kg": carters_carbon,
        "top_buyers": top_buyers,
        "fabric_stats": fabric_rows,
        "revenue_trend": revenue_trend,
        "activity_feed": activity_feed,
        "decay_alerts": decay_alerts[:8],
        "decay_alert_count": len(decay_alerts),
    }


@router.post("/reset-demo")
def reset_demo(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Wipe all scanned lots so a fresh demo/pitch starts from a clean slate.

    Only clears the `lots` table — the transactional data. Demo logins and the
    buyer catalog (the "stage setup") are left untouched, so the marketplace
    and admin metrics simply return to zero. Triggered from the factory header,
    so the factory role is allowed (not just admin).
    """
    if current_user.role not in ("factory", "admin"):
        raise HTTPException(status_code=403, detail="Not allowed")

    deleted = db.query(models.Lot).delete()
    db.commit()

    # Cosmetic, best-effort: restart the id sequence so the next scan is lot #1.
    # Postgres-only; never let it break the reset or the SQLite fallback.
    try:
        if db.bind.dialect.name == "postgresql":
            db.execute(text("ALTER TABLE public.lots ALTER COLUMN id RESTART WITH 1"))
            db.commit()
    except Exception:
        db.rollback()

    return {"status": "ok", "deleted_lots": deleted}
