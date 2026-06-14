from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Vision (Person 1)
# ---------------------------------------------------------------------------


class Piece(BaseModel):
    id: int
    bbox: List[int]  # [x, y, width, height] in pixels
    color_name: str
    color_hex: str
    size_percent: float
    size_label: str  # small | medium | large


class ColorGroup(BaseModel):
    color_name: str
    color_hex: str
    piece_count: int
    total_size_percent: float
    avg_size_label: str


class DetectResponse(BaseModel):
    image_width: int
    image_height: int
    pieces: List[Piece]
    groups: List[ColorGroup]


# ---------------------------------------------------------------------------
# Factory records (Person 2)
# ---------------------------------------------------------------------------


class FactoryRecordCreate(BaseModel):
    batch_name: str
    fabric_type: str
    composition: str
    notes: Optional[str] = ""


class FactoryRecordOut(FactoryRecordCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


# ---------------------------------------------------------------------------
# Lots (Person 2)
# ---------------------------------------------------------------------------


class LotCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    fabric_type: str
    composition: str
    color_name: str
    color_hex: str
    piece_count: int = 0
    weight_kg: float = 0.0
    price_usd: float = 0.0
    factory_record_id: Optional[int] = None


class LotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = ""
    fabric_type: str
    composition: str
    color_name: str
    color_hex: str
    piece_count: int
    weight_kg: float
    price_usd: float          # base price at time of listing
    current_price_usd: float  # price after decay (computed, not stored)
    price_decay_pct: int      # % dropped from base (0–65)
    days_listed: int          # days since created
    carbon_saved_kg: float
    water_saved_l: float
    status: str
    claimed_by: Optional[str] = None
    factory_record_id: Optional[int] = None
    created_at: datetime


class LotClaim(BaseModel):
    buyer_name: str


class ColorOption(BaseModel):
    color_name: str
    color_hex: str


class LotFilterOptions(BaseModel):
    fabric_types: List[str]
    colors: List[ColorOption]
    min_price: float
    max_price: float


# ---------------------------------------------------------------------------
# Marketplace / buyers / impact (Person 4)
# ---------------------------------------------------------------------------


class BuyerCreate(BaseModel):
    name: str
    type: str  # recycler | maker
    location: str = ""
    description: str = ""
    interested_materials: List[str] = []


class BuyerOut(BaseModel):
    id: int
    name: str
    type: str
    location: str
    description: str
    interested_materials: List[str]

    @classmethod
    def from_orm_obj(cls, obj):
        materials = [m for m in obj.interested_materials.split(",") if m]
        return cls(
            id=obj.id,
            name=obj.name,
            type=obj.type,
            location=obj.location,
            description=obj.description,
            interested_materials=materials,
        )


class ImpactSummary(BaseModel):
    total_lots: int
    claimed_lots: int
    total_weight_kg: float
    total_carbon_saved_kg: float
    total_water_saved_l: float
    fabric_breakdown: dict
