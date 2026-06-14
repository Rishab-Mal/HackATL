"""Factory production-record endpoints. Owned by Person 2 (backend, lots,
and factory records).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/factory-records", tags=["factory"])


@router.post("", response_model=schemas.FactoryRecordOut)
def create_factory_record(record: schemas.FactoryRecordCreate, db: Session = Depends(get_db)):
    db_record = models.FactoryRecord(**record.model_dump())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


@router.get("", response_model=list[schemas.FactoryRecordOut])
def list_factory_records(db: Session = Depends(get_db)):
    return db.query(models.FactoryRecord).order_by(models.FactoryRecord.created_at.desc()).all()


@router.get("/{record_id}", response_model=schemas.FactoryRecordOut)
def get_factory_record(record_id: int, db: Session = Depends(get_db)):
    record = db.get(models.FactoryRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Factory record not found")
    return record
