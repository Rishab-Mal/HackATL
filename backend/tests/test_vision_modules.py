import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.vision.annotation import assign_sort_groups
from app.vision.colors import color_family, closest_color_name, color_clusters, dominant_color_rgb, pattern_type
from app.vision.measurement import detect_scale_reference, estimate_weight_g
from app.vision.segmentation import _clean_masks, detect_pieces


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

    def test_aruco_exclusion_does_not_include_dark_fabric(self):
        marker_px = 90
        dictionary = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
        marker = cv2.aruco.generateImageMarker(dictionary, 23, marker_px)
        canvas = np.full((360, 480), 245, dtype=np.uint8)
        canvas[240:330, 24:114] = marker
        image_bgr = cv2.cvtColor(canvas, cv2.COLOR_GRAY2BGR)
        cv2.rectangle(image_bgr, (170, 210), (290, 330), (18, 18, 18), -1)

        scale = detect_scale_reference(image_bgr, marker_size_cm=5.0, marker_id=23)
        dark_fabric_mask = np.zeros((360, 480), dtype=np.uint8)
        dark_fabric_mask[210:330, 170:290] = 255
        overlap = cv2.countNonZero(cv2.bitwise_and(scale["exclusion_mask"], dark_fabric_mask))

        self.assertEqual(scale["scale_method"], "aruco")
        self.assertEqual([obj["type"] for obj in scale["reference_objects"]], ["aruco"])
        self.assertEqual(overlap, 0)

    def test_original_resolution_aruco_maps_to_working_image(self):
        marker_px = 160
        dictionary = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
        marker = cv2.aruco.generateImageMarker(dictionary, 23, marker_px)
        original = np.full((700, 900), 255, dtype=np.uint8)
        original[500:660, 60:220] = marker
        original_bgr = cv2.cvtColor(original, cv2.COLOR_GRAY2BGR)
        working_bgr = np.full((350, 450, 3), 245, dtype=np.uint8)

        scale = detect_scale_reference(
            working_bgr,
            marker_size_cm=5.0,
            marker_id=23,
            original_image_bgr=original_bgr,
            original_to_work_scale=0.5,
        )

        self.assertEqual(scale["scale_method"], "aruco")
        self.assertAlmostEqual(scale["px_per_cm"], (marker_px * 0.5) / 5.0, delta=1.5)
        xs = [point[0] for point in scale["marker_corners"]]
        self.assertTrue(25 <= min(xs) <= 35)

    def test_plain_dark_square_is_not_marker_like_fallback(self):
        image = np.full((360, 480, 3), 245, dtype=np.uint8)
        cv2.rectangle(image, (50, 235), (150, 335), (18, 18, 18), -1)

        scale = detect_scale_reference(image, marker_size_cm=5.0, marker_id=23)

        self.assertEqual(scale["scale_method"], "fallback")
        self.assertFalse(scale["reference_objects"])

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

    def test_grouping_collapses_demo_color_and_material_outliers(self):
        pieces = []
        specs = [
            ("navy", "denim", "denim/cotton", "denim twill"),
            ("navy", "denim", "denim/cotton", "denim twill"),
            ("navy", "denim", "denim/cotton", "denim twill"),
            ("cream", "cotton woven", "cotton", "woven"),
            ("cream", "cotton woven", "cotton", "woven"),
            ("cream", "fleece", "polyester", "fleece/nap"),
            ("red", "fleece", "polyester", "fleece/nap"),
            ("burgundy", "fleece", "polyester", "fleece/nap"),
            ("red", "cotton jersey", "cotton", "knit"),
            ("black", "fleece", "polyester", "fleece/nap"),
            ("charcoal", "fleece", "polyester", "fleece/nap"),
            ("black", "denim", "denim/cotton", "denim twill"),
        ]
        for idx, (color, fabric, material, structure) in enumerate(specs, start=1):
            pieces.append(
                {
                    "id": idx,
                    "color_name": color,
                    "color_family": color_family(name=color),
                    "color_hex": "#222222",
                    "size_label": "medium",
                    "size_percent": 2.0,
                    "fabric_type_guess": fabric,
                    "material_family": material,
                    "weave_or_knit": structure,
                    "pattern_type": "solid",
                    "composition_guess": "mixed textile",
                    "estimated_weight_g": 5,
                }
            )

        groups = assign_sort_groups(pieces)
        counts = {group["color_family"]: group["piece_count"] for group in groups}

        self.assertEqual(len(groups), 4)
        self.assertEqual(counts, {"navy": 3, "cream": 3, "red": 3, "black": 3})

    def test_color_family_normalizes_dark_blue_red_and_cream(self):
        self.assertEqual(color_family(rgb=(24, 45, 88), name="black"), "navy")
        self.assertEqual(color_family(name="burgundy"), "red")
        self.assertEqual(color_family(name="beige"), "cream")
        self.assertEqual(color_family(rgb=(24, 24, 24), name="charcoal"), "black")

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

    def test_detect_pieces_regression_12_scraps_4_bins(self):
        image_bgr, raw_masks = _synthetic_scrap_scene()
        ok, encoded = cv2.imencode(".png", image_bgr)
        self.assertTrue(ok)

        with patch("app.vision.segmentation.segment_with_replicate", return_value=raw_masks), patch(
            "app.vision.segmentation.classify_materials", side_effect=_fake_materials
        ):
            result = detect_pieces(encoded.tobytes())

        counts = {group["color_family"]: group["piece_count"] for group in result["groups"]}
        reference_discards = [
            item for item in result["discarded_objects"] if item["reason"] == "reference_marker_or_ruler"
        ]

        self.assertEqual(result["scale_method"], "aruco")
        self.assertEqual(result["scale_confidence"], "high")
        self.assertEqual(len(result["pieces"]), 12)
        self.assertEqual(len(result["groups"]), 4)
        self.assertEqual(counts, {"navy": 3, "cream": 3, "red": 3, "black": 3})
        self.assertEqual(len(reference_discards), 1)


def _synthetic_scrap_scene():
    image = np.full((650, 900, 3), 245, dtype=np.uint8)
    masks = []

    dictionary = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
    marker = cv2.aruco.generateImageMarker(dictionary, 23, 90)
    image[535:625, 25:115] = cv2.cvtColor(marker, cv2.COLOR_GRAY2BGR)
    marker_mask = np.zeros(image.shape[:2], dtype=np.uint8)
    marker_mask[535:625, 25:115] = 255

    specs = [
        ([(250, 35), (420, 15), (455, 95), (390, 170), (270, 165)], (82, 48, 22)),
        ([(130, 430), (310, 390), (340, 530), (175, 570)], (78, 45, 20)),
        ([(485, 300), (610, 280), (660, 395), (570, 485), (475, 430)], (86, 48, 24)),
        ([(65, 40), (190, 70), (260, 120), (205, 220), (45, 170)], (214, 226, 238)),
        ([(350, 230), (515, 215), (535, 330), (385, 370), (315, 285)], (216, 229, 240)),
        ([(390, 465), (455, 450), (475, 590), (385, 565)], (213, 227, 238)),
        ([(285, 125), (360, 90), (395, 175), (330, 255), (265, 235)], (35, 35, 195)),
        ([(650, 260), (790, 230), (825, 330), (700, 380)], (30, 30, 205)),
        ([(470, 455), (610, 470), (650, 585), (530, 635), (490, 605)], (28, 28, 198)),
        ([(35, 240), (180, 235), (220, 340), (155, 445), (40, 420)], (18, 18, 18)),
        ([(665, 100), (790, 95), (835, 175), (760, 255), (650, 205)], (20, 20, 20)),
        ([(705, 450), (840, 430), (865, 545), (750, 610), (690, 535)], (17, 17, 17)),
    ]

    for pts, bgr in specs:
        mask = np.zeros(image.shape[:2], dtype=np.uint8)
        polygon = np.array(pts, dtype=np.int32)
        cv2.fillPoly(mask, [polygon], 255)
        cv2.fillPoly(image, [polygon], bgr)
        masks.append(mask)

    masks.append(marker_mask)
    return image, masks


def _fake_materials(_image_bgr, pieces, **_kwargs):
    seen = {}
    result = {}
    for piece in pieces:
        family = piece.get("color_family")
        seen[family] = seen.get(family, 0) + 1
        ordinal = seen[family]
        if family == "navy":
            fabric, material, structure, composition = "denim", "denim/cotton", "denim twill", "98% cotton, 2% elastane"
        elif family == "cream" and ordinal == 3:
            fabric, material, structure, composition = "fleece", "polyester", "fleece/nap", "100% polyester"
        elif family == "cream":
            fabric, material, structure, composition = "cotton woven", "cotton", "woven", "100% cotton"
        elif family == "red" and ordinal == 3:
            fabric, material, structure, composition = "cotton jersey", "cotton", "knit", "95% cotton, 5% spandex"
        elif family == "red":
            fabric, material, structure, composition = "fleece", "polyester", "fleece/nap", "100% polyester"
        elif family == "black" and ordinal == 3:
            fabric, material, structure, composition = "denim", "denim/cotton", "denim twill", "98% cotton, 2% elastane"
        else:
            fabric, material, structure, composition = "fleece", "polyester", "fleece/nap", "100% polyester"
        result[piece["id"]] = {
            "is_fabric": True,
            "fabric_type_guess": fabric,
            "material_family": material,
            "weave_or_knit": structure,
            "composition_guess": composition,
            "fabric_confidence": "medium",
            "material_evidence": "Synthetic regression fixture.",
            "gsm": 250,
            "fold_factor": 1.0,
        }
    return {"model": "test-double", "warning": None, "pieces": result}


if __name__ == "__main__":
    unittest.main()
