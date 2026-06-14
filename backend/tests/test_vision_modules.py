import sys
import unittest
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.vision.annotation import assign_sort_groups
from app.vision.colors import closest_color_name, color_clusters, dominant_color_rgb, pattern_type
from app.vision.measurement import detect_scale_reference, estimate_weight_g
from app.vision.segmentation import _clean_masks


class VisionModuleTests(unittest.TestCase):
    def test_dominant_color_uses_mask_pixels(self):
        image = np.zeros((100, 100, 3), dtype=np.uint8)
        image[:] = (255, 255, 255)
        image[20:80, 20:80] = (20, 40, 210)  # BGR red-ish fabric
        mask = np.zeros((100, 100), dtype=np.uint8)
        mask[20:80, 20:80] = 255

        rgb = dominant_color_rgb(image, mask)

        self.assertEqual(closest_color_name(rgb), "red")

    def test_aruco_marker_scale_detection(self):
        marker_px = 160
        dictionary = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
        marker = cv2.aruco.generateImageMarker(dictionary, 23, marker_px)
        canvas = np.full((320, 320), 255, dtype=np.uint8)
        canvas[80:240, 80:240] = marker
        image_bgr = cv2.cvtColor(canvas, cv2.COLOR_GRAY2BGR)

        scale = detect_scale_reference(image_bgr, marker_size_cm=5.0, marker_id=23)

        self.assertTrue(scale["found"])
        self.assertEqual(scale["scale_method"], "aruco")
        self.assertAlmostEqual(scale["px_per_cm"], marker_px / 5.0, delta=1.5)

    def test_ruler_scale_detection_when_aruco_missing(self):
        image = np.full((320, 500, 3), 245, dtype=np.uint8)
        cv2.rectangle(image, (30, 238), (270, 306), (255, 255, 255), -1)
        cv2.rectangle(image, (58, 270), (258, 286), (20, 20, 20), -1)

        scale = detect_scale_reference(image, marker_size_cm=5.0, marker_id=23)

        self.assertTrue(scale["found"])
        self.assertEqual(scale["scale_method"], "ruler")
        self.assertAlmostEqual(scale["px_per_cm"], 40.0, delta=4.0)

    def test_fallback_scale_is_still_usable(self):
        image = np.full((240, 380, 3), 245, dtype=np.uint8)

        scale = detect_scale_reference(image, marker_size_cm=5.0, marker_id=23)

        self.assertFalse(scale["found"])
        self.assertEqual(scale["scale_method"], "fallback")
        self.assertAlmostEqual(scale["px_per_cm"], 10.0, delta=0.1)

    def test_weight_formula_uses_area_gsm_and_fold_factor(self):
        weight = estimate_weight_g(area_cm2=1000, fabric_type="denim", gsm=350, fold_factor=1.2)
        self.assertEqual(weight, 42.0)

    def test_grouping_assigns_bins_and_rolls_up_weight(self):
        pieces = [
            {
                "id": 1,
                "color_name": "blue",
                "color_hex": "#2244aa",
                "size_label": "medium",
                "size_percent": 3.0,
                "fabric_type_guess": "denim",
                "material_family": "denim/cotton",
                "weave_or_knit": "denim twill",
                "pattern_type": "solid",
                "composition_guess": "98% cotton, 2% elastane",
                "estimated_weight_g": 20,
            },
            {
                "id": 2,
                "color_name": "blue",
                "color_hex": "#2244aa",
                "size_label": "large",
                "size_percent": 4.0,
                "fabric_type_guess": "denim",
                "material_family": "denim/cotton",
                "weave_or_knit": "denim twill",
                "pattern_type": "solid",
                "composition_guess": "98% cotton, 2% elastane",
                "estimated_weight_g": 30,
            },
        ]

        groups = assign_sort_groups(pieces)

        self.assertEqual(len(groups), 1)
        self.assertEqual(groups[0]["piece_count"], 2)
        self.assertEqual(groups[0]["estimated_weight_g"], 50)
        self.assertEqual(pieces[0]["sort_group_id"], "A")

    def test_mask_cleanup_removes_marker_and_duplicates(self):
        image = np.full((100, 100, 3), 245, dtype=np.uint8)
        image[10:60, 10:60] = (20, 40, 210)
        mask_big = np.zeros((100, 100), dtype=np.uint8)
        mask_big[10:60, 10:60] = 255
        mask_dup = np.zeros((100, 100), dtype=np.uint8)
        mask_dup[12:58, 12:58] = 255
        marker = np.zeros((100, 100), dtype=np.uint8)
        marker[70:90, 70:90] = 255
        mask_marker = marker.copy()

        kept, discarded = _clean_masks(
            [mask_big, mask_dup, mask_marker],
            image_bgr=image,
            exclusion_mask=marker,
            max_pieces=10,
        )

        self.assertEqual(len(kept), 1)
        reasons = {item["reason"] for item in discarded}
        self.assertIn("reference_marker_or_ruler", reasons)
        self.assertIn("duplicate_sam_mask", reasons)

    def test_mask_cleanup_rejects_full_background(self):
        image = np.full((100, 100, 3), 245, dtype=np.uint8)
        fabric = np.zeros((100, 100), dtype=np.uint8)
        fabric[25:55, 25:55] = 255
        background = np.full((100, 100), 255, dtype=np.uint8)

        kept, discarded = _clean_masks(
            [background, fabric],
            image_bgr=image,
            exclusion_mask=np.zeros((100, 100), dtype=np.uint8),
            max_pieces=10,
        )

        self.assertEqual(len(kept), 1)
        self.assertEqual(cv2.countNonZero(kept[0]), cv2.countNonZero(fabric))
        self.assertTrue(any(item["reason"] == "too_large_or_background" for item in discarded))

    def test_striped_pattern_detection(self):
        image = np.full((100, 120, 3), 245, dtype=np.uint8)
        mask = np.zeros((100, 120), dtype=np.uint8)
        mask[20:80, 20:100] = 255
        for x in range(20, 100, 16):
            image[20:80, x : x + 8] = (35, 45, 95)

        clusters = color_clusters(image, mask)
        pattern = pattern_type(image, mask, clusters)

        self.assertEqual(pattern, "striped")


if __name__ == "__main__":
    unittest.main()
