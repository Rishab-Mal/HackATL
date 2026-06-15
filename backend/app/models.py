from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from .database import Base


class Lot(Base):
    """A sellable group of scraps, created from a camera scan (a vision color /
    fabric group). Every descriptive field comes from the vision pipeline; the
    price and environmental impact are computed when the lot is created.
    """

    __tablename__ = "lots"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    # From the camera (vision pipeline)
    fabric_type = Column(String, nullable=False)
    composition = Column(String, nullable=False)
    color_name = Column(String, nullable=False)
    color_hex = Column(String, nullable=False)
    piece_count = Column(Integer, default=0)
    weight_kg = Column(Float, default=0.0)
    # Computed at listing time
    price_usd = Column(Float, default=0.0)
    carbon_saved_kg = Column(Float, default=0.0)
    water_saved_l = Column(Float, default=0.0)
    # Marketplace lifecycle
    status = Column(String, default="available")  # available | claimed | unlisted
    claimed_by = Column(String, nullable=True)
    claimed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class User(Base):
    """Portal user — role determines which UI they see."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # factory | admin | buyer
    name = Column(String, default="")


class Buyer(Base):
    """A recycler or maker profile in the marketplace."""

    __tablename__ = "buyers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # recycler | maker
    location = Column(String, default="")
    description = Column(Text, default="")
    interested_materials = Column(String, default="")  # comma-separated
