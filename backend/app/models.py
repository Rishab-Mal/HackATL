from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .database import Base


class FactoryRecord(Base):
    """A production record the factory enters by hand, e.g. 'Batch 12 is 95% cotton, 5% spandex'.

    Owned by Person 2 (backend / lots / factory records).
    """

    __tablename__ = "factory_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_name = Column(String, nullable=False)
    fabric_type = Column(String, nullable=False)
    composition = Column(String, nullable=False)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    lots = relationship("Lot", back_populates="factory_record")


class Lot(Base):
    """A sellable group of scraps, created from a vision color group plus an
    optional factory record. Owned by Person 2.
    """

    __tablename__ = "lots"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    fabric_type = Column(String, nullable=False)
    composition = Column(String, nullable=False)
    color_name = Column(String, nullable=False)
    color_hex = Column(String, nullable=False)
    piece_count = Column(Integer, default=0)
    weight_kg = Column(Float, default=0.0)
    price_usd = Column(Float, default=0.0)
    carbon_saved_kg = Column(Float, default=0.0)
    water_saved_l = Column(Float, default=0.0)
    status = Column(String, default="available")  # available | claimed
    claimed_by = Column(String, nullable=True)
    claimed_at = Column(DateTime, nullable=True)
    factory_record_id = Column(Integer, ForeignKey("factory_records.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    factory_record = relationship("FactoryRecord", back_populates="lots")


class User(Base):
    """Portal user — role determines which UI they see."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # factory | admin | buyer
    name = Column(String, default="")


class Buyer(Base):
    """A recycler or maker profile in the marketplace. Owned by Person 4."""

    __tablename__ = "buyers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # recycler | maker
    location = Column(String, default="")
    description = Column(Text, default="")
    interested_materials = Column(String, default="")  # comma-separated
