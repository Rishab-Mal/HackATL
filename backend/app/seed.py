"""Demo data so the frontend has something real to show immediately, even
before the vision pipeline or factory records are wired up.

Person 4 (marketplace, impact logic, and demo data) owns this file -- tune
the lots, buyer profiles, and descriptions to tell a believable story
(including the Carter's supplier rollout angle).
"""

from sqlalchemy.orm import Session

from . import models
from .constants import CARBON_PER_KG, WATER_PER_KG


def seed_data(db: Session) -> None:
    if db.query(models.FactoryRecord).count() > 0:
        return  # already seeded

    record_jersey = models.FactoryRecord(
        batch_name="Batch 12",
        fabric_type="Cotton/Spandex Jersey",
        composition="95% cotton, 5% spandex",
        notes="Offcuts from the kids' t-shirt run, June production.",
    )
    record_twill = models.FactoryRecord(
        batch_name="Batch 18",
        fabric_type="Cotton Twill",
        composition="100% cotton",
        notes="Offcuts from the pants line, denim-weight twill.",
    )
    db.add_all([record_jersey, record_twill])
    db.commit()

    lots = [
        _make_lot(
            name="Blue Cotton Jersey Scraps",
            description=(
                "Cone-shaped jersey offcuts in a consistent denim-blue tone, pulled "
                "from a single t-shirt production run. Soft hand-feel and a stable "
                "95/5 cotton-spandex blend make this lot a strong fit for cut-and-sew "
                "remnant projects or fiber reclaim feeding stock."
            ),
            fabric_type="Cotton/Spandex Jersey",
            composition="95% cotton, 5% spandex",
            color_name="blue",
            color_hex="#3a5ac8",
            piece_count=42,
            weight_kg=6.8,
            price_usd=24.0,
            status="available",
            factory_record=record_jersey,
        ),
        _make_lot(
            name="White Cotton Jersey Scraps",
            description=(
                "Bright, undyed jersey trim from the same kids' t-shirt run as our "
                "blue lot. Clean white base is easy to over-dye or print, making it "
                "popular with small-batch makers building patchwork or custom-color "
                "goods."
            ),
            fabric_type="Cotton/Spandex Jersey",
            composition="95% cotton, 5% spandex",
            color_name="white",
            color_hex="#f5f5f5",
            piece_count=31,
            weight_kg=4.2,
            price_usd=16.0,
            status="available",
            factory_record=record_jersey,
        ),
        _make_lot(
            name="Navy Cotton Twill Offcuts",
            description=(
                "Heavyweight twill remnants in a deep navy, cut from the pants "
                "production line. Denim-weight 100% cotton holds up well for "
                "mechanical recycling into reclaimed yarn or industrial wiping "
                "cloths."
            ),
            fabric_type="Cotton Twill",
            composition="100% cotton",
            color_name="navy",
            color_hex="#1e2850",
            piece_count=18,
            weight_kg=9.5,
            price_usd=30.0,
            status="claimed",
            factory_record=record_twill,
            claimed_by="Looptex Recyclers",
        ),
        _make_lot(
            name="Beige Cotton Twill Offcuts",
            description=(
                "Neutral beige twill offcuts, same heavyweight 100% cotton as our "
                "navy lot. Versatile color works well as filler stock for insulation "
                "or fiber-fill projects, or as a base for over-dyeing."
            ),
            fabric_type="Cotton Twill",
            composition="100% cotton",
            color_name="beige",
            color_hex="#dcc8aa",
            piece_count=12,
            weight_kg=3.1,
            price_usd=11.0,
            status="available",
            factory_record=record_twill,
        ),
    ]
    db.add_all(lots)

    buyers = [
        models.Buyer(
            name="Looptex Recyclers",
            type="recycler",
            location="Atlanta, GA",
            description=(
                "Mechanical recycler turning cotton-rich offcuts into reclaimed "
                "yarn for industrial wiping cloths and insulation."
            ),
            interested_materials="cotton,denim,twill",
        ),
        models.Buyer(
            name="Thread & Tide Studio",
            type="maker",
            location="Decatur, GA",
            description=(
                "Small-batch accessories maker sourcing colorful jersey scraps "
                "for scrunchies, bags, and quilted patchwork goods."
            ),
            interested_materials="cotton,jersey,spandex",
        ),
        models.Buyer(
            name="Carter's Circular Supply Pilot",
            type="recycler",
            location="Atlanta, GA",
            description=(
                "Supplier sustainability pilot evaluating reclaimed cotton "
                "blends for future packaging inserts and fill material."
            ),
            interested_materials="cotton,spandex,jersey,twill",
        ),
    ]
    db.add_all(buyers)
    db.commit()


def _make_lot(
    name,
    description,
    fabric_type,
    composition,
    color_name,
    color_hex,
    piece_count,
    weight_kg,
    price_usd,
    status,
    factory_record,
    claimed_by=None,
):
    return models.Lot(
        name=name,
        description=description,
        fabric_type=fabric_type,
        composition=composition,
        color_name=color_name,
        color_hex=color_hex,
        piece_count=piece_count,
        weight_kg=weight_kg,
        price_usd=price_usd,
        carbon_saved_kg=round(weight_kg * CARBON_PER_KG, 2),
        water_saved_l=round(weight_kg * WATER_PER_KG, 2),
        status=status,
        claimed_by=claimed_by,
        factory_record_id=factory_record.id,
    )

