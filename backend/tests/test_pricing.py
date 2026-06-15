import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.pricing import calculate_base_price, current_price


class PricingTests(unittest.TestCase):
    def test_positive_tiny_lot_has_minimum_price(self):
        price = calculate_base_price(
            fabric_type="unknown textile",
            composition="unknown",
            color_name="black",
            weight_kg=0.0005,
            piece_count=6,
        )

        self.assertEqual(price, 0.01)

    def test_decayed_positive_price_does_not_round_to_zero(self):
        price = current_price(0.01, datetime.utcnow() - timedelta(days=365))

        self.assertEqual(price, 0.01)


if __name__ == "__main__":
    unittest.main()
