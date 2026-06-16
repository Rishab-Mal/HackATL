import sys
import unittest
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.database import Base
from app.models import Lot
from app.routers import lots


class LotsApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

        app = FastAPI()
        app.include_router(lots.router)

        def override_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[lots.get_db] = override_db
        self.client = TestClient(app)

    def tearDown(self):
        Base.metadata.drop_all(bind=self.engine)
        self.engine.dispose()

    def test_create_lot_round_trips_piece_images_and_lot_key(self):
        payload = {
            "name": "Blue cotton",
            "description": "test lot",
            "fabric_type": "cotton",
            "composition": "100% cotton",
            "color_name": "blue",
            "color_hex": "#2244aa",
            "lot_key": "cotton::100-cotton::blue",
            "piece_images": [
                {
                    "src": "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
                    "piece_id": 1,
                    "color_name": "blue",
                }
            ],
            "piece_count": 1,
            "weight_kg": 0.2,
            "price_usd": 2.5,
        }

        created = self.client.post("/api/lots", json=payload)

        self.assertEqual(created.status_code, 200)
        created_body = created.json()
        self.assertEqual(created_body["lot_key"], payload["lot_key"])
        self.assertEqual(created_body["piece_images"], payload["piece_images"])

        fetched = self.client.get("/api/lots", params={"status": "available"})
        self.assertEqual(fetched.status_code, 200)
        fetched_body = fetched.json()
        self.assertEqual(len(fetched_body), 1)
        self.assertEqual(fetched_body[0]["piece_images"], payload["piece_images"])

    def test_merge_lot_appends_compatible_image_shapes(self):
        first = {
            "name": "Blue cotton",
            "fabric_type": "cotton",
            "composition": "100% cotton",
            "color_name": "blue",
            "color_hex": "#2244aa",
            "lot_key": "cotton::100-cotton::blue",
            "piece_images": [{"url": "data:image/gif;base64,first", "piece_id": 1}],
            "piece_count": 1,
            "weight_kg": 0.2,
            "price_usd": 2.5,
        }
        second = {
            **first,
            "piece_images": [{"crop_data_url": "data:image/gif;base64,second", "piece_id": 2}],
            "piece_count": 2,
            "weight_kg": 0.3,
        }

        self.client.post("/api/lots", json=first)
        merged = self.client.post("/api/lots", json=second)

        self.assertEqual(merged.status_code, 200)
        images = merged.json()["piece_images"]
        self.assertEqual([img["src"] for img in images], ["data:image/gif;base64,first", "data:image/gif;base64,second"])
        self.assertEqual(merged.json()["piece_count"], 3)

    def test_create_lot_merges_and_backfills_legacy_null_lot_key(self):
        db = self.SessionLocal()
        try:
            db.add(
                Lot(
                    name="Legacy blue cotton",
                    fabric_type="cotton",
                    composition="100% cotton",
                    color_name="blue",
                    color_hex="#2244aa",
                    lot_key=None,
                    piece_images=[],
                    piece_count=1,
                    weight_kg=0.2,
                    price_usd=2.5,
                    carbon_saved_kg=0.42,
                    water_saved_l=540,
                    status="available",
                )
            )
            db.commit()
        finally:
            db.close()

        response = self.client.post(
            "/api/lots",
            json={
                "name": "Blue cotton",
                "fabric_type": "cotton",
                "composition": "100% cotton",
                "color_name": "blue",
                "color_hex": "#2244aa",
                "lot_key": "cotton::100-cotton::blue",
                "piece_images": [{"src": "data:image/gif;base64,new", "piece_id": 2}],
                "piece_count": 1,
                "weight_kg": 0.3,
                "price_usd": 2.5,
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["lot_key"], "cotton::100-cotton::blue")
        self.assertEqual(body["piece_count"], 2)
        self.assertEqual(body["piece_images"], [{"src": "data:image/gif;base64,new", "piece_id": 2}])

        fetched = self.client.get("/api/lots", params={"status": "available"}).json()
        self.assertEqual(len(fetched), 1)


if __name__ == "__main__":
    unittest.main()
