"""Demo data so the frontend has something real to show immediately, even
before the vision pipeline or factory records are wired up.

Person 4 (marketplace, impact logic, and demo data) owns this file -- tune
the fabric types, buyer profiles, and pricing to tell a believable story
(including the Carter's supplier rollout angle).

Generates a large, varied set of lots (100+) across many fabric types,
colors, and statuses so the Marketplace / Sorted Lots filters have something
real to filter.
"""

import random

from sqlalchemy.orm import Session

from . import models
from .constants import CARBON_PER_KG, WATER_PER_KG
from .vision.colors import PALETTE, rgb_to_hex

RANDOM_SEED = 42
NUM_FACTORY_RECORDS = 14
NUM_LOTS = 110

# (fabric type, composition)
FABRIC_TYPES = [
    ("Cotton/Spandex Jersey", "95% cotton, 5% spandex"),
    ("Cotton Twill", "100% cotton"),
    ("Cotton/Polyester Blend", "60% cotton, 40% polyester"),
    ("Organic Cotton Jersey", "100% organic cotton"),
    ("Stretch Denim", "98% cotton, 2% elastane"),
    ("Cotton Fleece", "80% cotton, 20% polyester"),
    ("Ribbed Knit", "92% cotton, 8% spandex"),
    ("Cotton Canvas", "100% cotton"),
    ("French Terry", "70% cotton, 30% polyester"),
    ("Poplin", "100% cotton"),
    ("Modal/Cotton Blend", "50% modal, 50% cotton"),
    ("Linen/Cotton Blend", "55% linen, 45% cotton"),
]

LOT_NOUNS = ["Scraps", "Offcuts", "Remnants", "Trim Waste"]


def seed_data(db: Session) -> None:
    if db.query(models.FactoryRecord).count() > 0:
        return  # already seeded

    rng = random.Random(RANDOM_SEED)

    buyers = _make_buyers()
    db.add_all(buyers)
    db.commit()

    factory_records = _make_factory_records(rng)
    db.add_all(factory_records)
    db.commit()

    lots = _make_lots(rng, factory_records, buyers)
    db.add_all(lots)
    db.commit()


def _make_buyers():
    return [
        models.Buyer(
            name="Looptex Recyclers",
            type="recycler",
            location="Atlanta, GA",
            description=(
                "Mechanical recycler turning cotton-rich offcuts into reclaimed "
                "yarn for industrial wiping cloths and insulation."
            ),
            interested_materials="cotton,denim,twill,canvas",
        ),
        models.Buyer(
            name="Thread & Tide Studio",
            type="maker",
            location="Decatur, GA",
            description=(
                "Small-batch accessories maker sourcing colorful jersey scraps "
                "for scrunchies, bags, and quilted patchwork goods."
            ),
            interested_materials="cotton,jersey,spandex,knit",
        ),
        models.Buyer(
            name="Carter's Circular Supply Pilot",
            type="recycler",
            location="Atlanta, GA",
            description=(
                "Supplier sustainability pilot evaluating reclaimed cotton "
                "blends for future packaging inserts and fill material."
            ),
            interested_materials="cotton,spandex,jersey,twill,denim,fleece",
        ),
        models.Buyer(
            name="Re:Loom Fiber Co.",
            type="recycler",
            location="Chattanooga, TN",
            description=(
                "Fiber recycler shredding polyester and fleece blends back into "
                "raw fill for furniture and outdoor gear."
            ),
            interested_materials="polyester,fleece,terry,blend",
        ),
        models.Buyer(
            name="Stitch & Story Makers",
            type="maker",
            location="Asheville, NC",
            description=(
                "Maker collective turning linen and modal offcuts into "
                "limited-run tote bags and apparel trims."
            ),
            interested_materials="cotton,linen,modal,canvas",
        ),
        models.Buyer(
            name="Southern Quilt Collective",
            type="maker",
            location="Macon, GA",
            description=(
                "Volunteer quilting group sourcing cotton scraps of all colors "
                "for community quilts and donation projects."
            ),
            interested_materials="cotton,jersey,poplin,knit",
        ),
        models.Buyer(
            name="EcoFill Industries",
            type="recycler",
            location="Birmingham, AL",
            description=(
                "Industrial recycler converting mixed cotton/poly scraps into "
                "acoustic and thermal insulation panels."
            ),
            interested_materials="cotton,polyester,fleece,denim",
        ),
        models.Buyer(
            name="Bolt & Seam Studio",
            type="maker",
            location="Athens, GA",
            description=(
                "Independent designer using stretch knits and terry scraps for "
                "activewear sample runs."
            ),
            interested_materials="cotton,spandex,knit,terry",
        ),
    ]


def _make_factory_records(rng: random.Random):
    records = []
    used_batches: set[int] = set()
    while len(records) < NUM_FACTORY_RECORDS:
        batch_num = rng.randint(1, 99)
        if batch_num in used_batches:
            continue
        used_batches.add(batch_num)

        fabric_type, composition = rng.choice(FABRIC_TYPES)
        records.append(
            models.FactoryRecord(
                batch_name=f"Batch {batch_num}",
                fabric_type=fabric_type,
                composition=composition,
                notes=f"Offcuts logged from production batch {batch_num}.",
            )
        )
    return records


def _make_lots(rng: random.Random, factory_records, buyers):
    colors = list(PALETTE.items())  # [(name, (r, g, b)), ...]
    buyer_names = [b.name for b in buyers]

    lots = []
    for _ in range(NUM_LOTS):
        factory_record = rng.choice(factory_records)
        color_name, rgb = rng.choice(colors)

        piece_count = rng.randint(5, 60)
        weight_kg = round(rng.uniform(0.5, 15.0), 1)
        price_usd = round(weight_kg * rng.uniform(2.5, 6.0), 2)

        is_claimed = rng.random() < 0.3

        lots.append(
            models.Lot(
                name=f"{color_name.capitalize()} {factory_record.fabric_type} {rng.choice(LOT_NOUNS)}",
                fabric_type=factory_record.fabric_type,
                composition=factory_record.composition,
                color_name=color_name,
                color_hex=rgb_to_hex(rgb),
                piece_count=piece_count,
                weight_kg=weight_kg,
                price_usd=price_usd,
                carbon_saved_kg=round(weight_kg * CARBON_PER_KG, 2),
                water_saved_l=round(weight_kg * WATER_PER_KG, 2),
                status="claimed" if is_claimed else "available",
                claimed_by=rng.choice(buyer_names) if is_claimed else None,
                factory_record_id=factory_record.id,
            )
        )
    return lots
