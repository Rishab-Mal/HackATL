from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field


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
    contour: Optional[List[List[int]]] = None
    area_pixels: Optional[int] = None
    area_cm2: Optional[float] = None
    dominant_rgb: Optional[List[int]] = None
    secondary_colors: Optional[List[dict[str, Any]]] = None
    color_clusters: Optional[List[dict[str, Any]]] = None
    color_family: Optional[str] = None
    pattern_type: Optional[str] = None
    crop_data_url: Optional[str] = None
    is_fabric: Optional[bool] = None
    shape_label: Optional[str] = None
    aspect_ratio: Optional[float] = None
    fabric_type_guess: Optional[str] = None
    material_family: Optional[str] = None
    material_sort_family: Optional[str] = None
    weave_or_knit: Optional[str] = None
    composition_guess: Optional[str] = None
    fabric_confidence: Optional[str] = None
    material_evidence: Optional[str] = None
    gsm: Optional[float] = None
    fold_factor: Optional[float] = None
    estimated_weight_g: Optional[float] = None
    weight_label: Optional[str] = None
    sort_group_id: Optional[str] = None
    outline_color: Optional[str] = None


class ColorGroup(BaseModel):
    color_name: str
    color_hex: str
    piece_count: int
    total_size_percent: float
    avg_size_label: str
    sort_group_id: Optional[str] = None
    outline_color: Optional[str] = None
    fabric_type_guess: Optional[str] = None
    material_family: Optional[str] = None
    material_sort_family: Optional[str] = None
    weave_or_knit: Optional[str] = None
    composition_guess: Optional[str] = None
    color_family: Optional[str] = None
    pattern_type: Optional[str] = None
    estimated_weight_g: Optional[float] = None
    total_weight_label: Optional[str] = None
    piece_ids: Optional[List[int]] = None
    sort_instruction: Optional[str] = None


class DetectResponse(BaseModel):
    image_width: int
    image_height: int
    pieces: List[Piece]
    groups: List[ColorGroup]
    piece_table: Optional[List[dict[str, Any]]] = None
    annotated_image_data_url: Optional[str] = None
    scale_reference_found: Optional[bool] = None
    px_per_cm: Optional[float] = None
    marker_corners: Optional[List[List[int]]] = None
    scale_method: Optional[str] = None
    scale_confidence: Optional[str] = None
    reference_objects: List[dict[str, Any]] = Field(default_factory=list)
    discarded_objects: List[dict[str, Any]] = Field(default_factory=list)
    segmentation_method: Optional[str] = None
    llm_model: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)


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
    lot_key: Optional[str] = None
    piece_images: List[dict[str, Any]] = Field(default_factory=list)
    piece_count: int = 0
    weight_kg: float = 0.0
    price_usd: float = 0.0


class LotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = ""
    fabric_type: str
    composition: str
    color_name: str
    color_hex: str
    lot_key: Optional[str] = None
    piece_images: List[dict[str, Any]] = Field(default_factory=list)
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
    claimed_at: Optional[datetime] = None
    created_at: datetime


class LotClaim(BaseModel):
    buyer_name: str
    quantity_kg: Optional[float] = None


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


class ImpactEquivalents(BaseModel):
    car_miles: float
    phone_charges: int
    plastic_bottles: int
    showers: float
class ActivityItem(BaseModel):
    lot_id: int
    lot_name: str
    buyer_name: str
    claimed_at: datetime


class ImpactSummary(BaseModel):
    total_lots: int
    claimed_lots: int
    total_weight_kg: float
    total_carbon_saved_kg: float
    total_water_saved_l: float
    equivalents: ImpactEquivalents
    fabric_breakdown: dict


# ---------------------------------------------------------------------------
# AI Material Destination Engine
# ---------------------------------------------------------------------------


class DestinationOption(BaseModel):
    name: str
    revenue_usd: float
    co2_saved_kg: float
    score: int


class BuyerMatch(BaseModel):
    name: str
    match_pct: int


class DestinationAnalysisRequest(BaseModel):
    fabric_type: str
    composition: str = ""
    color_name: str = ""
    weight_kg: float
    material_family: Optional[str] = None


class DestinationAnalysis(BaseModel):
    recommended: DestinationOption
    alternatives: List[DestinationOption]
    recommended_buyers: List[BuyerMatch]
    sale_probability_pct: int
    expected_days_to_sale: float
    environmental_equivalents: ImpactEquivalents
    landfill_co2_saved_kg: float
