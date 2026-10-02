"""Tests for mobile brand assets generator and check contract.

Verifies generated asset dimensions, color modes, safe zones, transparency,
monochrome pairing, and absence of legacy Expo templates, using public CLI behavior,
isolated temporary fixtures, and comprehensive negative failure tests.
"""

import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from PIL import Image, ImageDraw
import numpy as np


class TestMobileBrandAssets(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        cls.generator_script = os.path.join(cls.repo_root, "scripts", "generate-mobile-brand-assets.py")
        cls.source_logo = os.path.join(cls.repo_root, "apps", "web", "public", "haseeela_icon.png")
        cls.python_exe = sys.executable

    def run_cli(self, args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL):
        """Invoke the generator CLI without capturing through OS pipes."""
        cmd = [self.python_exe, self.generator_script] + args
        return subprocess.run(cmd, cwd=self.repo_root, stdout=stdout, stderr=stderr)

    def test_source_logo_untouched_and_valid(self):
        """Verify source logo validity and prove no writes occur via hash preservation."""
        self.assertTrue(os.path.exists(self.source_logo), f"Source logo not found at {self.source_logo}")
        with Image.open(self.source_logo) as img:
            self.assertEqual(img.size, (1254, 1254))
            self.assertEqual(img.mode, "RGB")

        # Copy source logo to temp fixture to demonstrate CLI generate and --check do not mutate it
        with tempfile.TemporaryDirectory() as tmpdir:
            temp_source = os.path.join(tmpdir, "source_logo.png")
            temp_out = os.path.join(tmpdir, "output")
            shutil.copyfile(self.source_logo, temp_source)

            with open(temp_source, "rb") as f:
                initial_hash = hashlib.sha256(f.read()).hexdigest()

            # Run generation
            res_gen = self.run_cli(["--source", temp_source, "--output-dir", temp_out])
            self.assertEqual(res_gen.returncode, 0)

            # Run verification check
            res_check = self.run_cli(["--check", "--source", temp_source, "--output-dir", temp_out])
            self.assertEqual(res_check.returncode, 0)

            # Verify source hash unchanged
            with open(temp_source, "rb") as f:
                post_hash = hashlib.sha256(f.read()).hexdigest()

            self.assertEqual(initial_hash, post_hash, "Source logo bytes were mutated during generate/check")

    def test_check_does_not_modify_output_assets(self):
        """Verify --check is strictly read-only and preserves all asset bytes exactly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            res_gen = self.run_cli(["--source", self.source_logo, "--output-dir", tmpdir])
            self.assertEqual(res_gen.returncode, 0)

            initial_hashes = {}
            for fname in os.listdir(tmpdir):
                if fname.endswith(".png"):
                    p = os.path.join(tmpdir, fname)
                    with open(p, "rb") as f:
                        initial_hashes[fname] = hashlib.sha256(f.read()).hexdigest()

            res_check = self.run_cli(["--check", "--source", self.source_logo, "--output-dir", tmpdir])
            self.assertEqual(res_check.returncode, 0)

            post_hashes = {}
            for fname in os.listdir(tmpdir):
                if fname.endswith(".png"):
                    p = os.path.join(tmpdir, fname)
                    with open(p, "rb") as f:
                        post_hashes[fname] = hashlib.sha256(f.read()).hexdigest()

            self.assertEqual(initial_hashes, post_hashes, "--check modified output asset bytes")

    def test_cli_generation_into_temp_dir(self):
        """Verify generator creates all declared PNG assets with exact dimensions and modes."""
        with tempfile.TemporaryDirectory() as tmpdir:
            res = self.run_cli(["--source", self.source_logo, "--output-dir", tmpdir])
            self.assertEqual(res.returncode, 0, "Generator CLI failed in temp directory")

            expected_specs = {
                "icon.png": ((1024, 1024), "RGB"),
                "android-icon-foreground.png": ((1024, 1024), "RGBA"),
                "android-icon-background.png": ((1024, 1024), "RGB"),
                "android-icon-monochrome.png": ((1024, 1024), "RGBA"),
                "splash-icon.png": ((512, 512), "RGBA"),
                "favicon.png": ((48, 48), "RGBA"),
                "notification-icon.png": ((96, 96), "RGBA"),
            }

            for filename, (expected_size, expected_mode) in expected_specs.items():
                file_path = os.path.join(tmpdir, filename)
                self.assertTrue(os.path.exists(file_path), f"Expected asset missing: {filename}")
                with Image.open(file_path) as img:
                    self.assertEqual(img.size, expected_size, f"Incorrect dimensions for {filename}")
                    self.assertEqual(img.mode, expected_mode, f"Incorrect mode for {filename}")

    def test_android_adaptive_safe_circle_compliance(self):
        """Verify foreground and monochrome glyphs fit strictly within 66/108 safe circle."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self.run_cli(["--source", self.source_logo, "--output-dir", tmpdir])

            # Safe circle radius on 1024x1024 is 1024 * (66 / 108) / 2 ~= 312.89 px
            safe_radius = 1024.0 * (66.0 / 108.0) / 2.0
            cx, cy = (1024.0 - 1.0) / 2.0, (1024.0 - 1.0) / 2.0

            for target in ["android-icon-foreground.png", "android-icon-monochrome.png"]:
                path = os.path.join(tmpdir, target)
                with Image.open(path) as img:
                    arr = np.array(img)
                    alpha = arr[:, :, 3]

                    # Outside transparency: corners must be transparent
                    self.assertEqual(alpha[0, 0], 0, f"{target} top-left corner not transparent")
                    self.assertEqual(alpha[0, -1], 0, f"{target} top-right corner not transparent")
                    self.assertEqual(alpha[-1, 0], 0, f"{target} bottom-left corner not transparent")
                    self.assertEqual(alpha[-1, -1], 0, f"{target} bottom-right corner not transparent")

                    # ALL nonzero alpha pixels must fit within safe circle
                    ys, xs = np.where(alpha > 0)
                    self.assertGreater(len(ys), 0, f"No visible mark found in {target}")

                    distances = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
                    max_dist = float(distances.max())
                    self.assertLessEqual(
                        max_dist,
                        safe_radius,
                        f"{target} extends beyond 66/108 safe circle: max dist {max_dist:.2f} > {safe_radius:.2f}",
                    )
                    # Sizing lower bound: ensure mark is not tiny (occupies >= 250 px radius)
                    self.assertGreater(
                        max_dist,
                        250.0,
                        f"{target} mark is unexpectedly small: max dist {max_dist:.2f} < 250.0",
                    )

    def test_monochrome_matches_foreground_shape(self):
        """Verify android monochrome icon matches android foreground silhouette exactly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self.run_cli(["--source", self.source_logo, "--output-dir", tmpdir])

            fg_path = os.path.join(tmpdir, "android-icon-foreground.png")
            mono_path = os.path.join(tmpdir, "android-icon-monochrome.png")

            with Image.open(fg_path) as fg_img, Image.open(mono_path) as mono_img:
                fg_arr = np.array(fg_img)
                mono_arr = np.array(mono_img)
                self.assertTrue(
                    np.array_equal(fg_arr[:, :, 3], mono_arr[:, :, 3]),
                    "Monochrome silhouette alpha does not match foreground alpha",
                )

    def test_brand_background_flat_accent(self):
        """Verify android background is solid brand accent #6D5EFC without template grid."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self.run_cli(["--source", self.source_logo, "--output-dir", tmpdir])

            bg_path = os.path.join(tmpdir, "android-icon-background.png")
            with Image.open(bg_path) as img:
                arr = np.array(img)
                expected_color = np.array([109, 94, 252], dtype=np.uint8)
                self.assertTrue(
                    np.all(arr == expected_color),
                    "android-icon-background.png is not a uniform #6D5EFC flat color (grid remnants?)",
                )

    def test_notification_icon_is_pure_white_alpha(self):
        """Verify notification-icon.png has transparent margins and contains white alpha glyph."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self.run_cli(["--source", self.source_logo, "--output-dir", tmpdir])

            notif_path = os.path.join(tmpdir, "notification-icon.png")
            with Image.open(notif_path) as img:
                arr = np.array(img)
                alpha = arr[:, :, 3]
                rgb = arr[:, :, :3]

                # Outside transparency
                self.assertEqual(alpha[0, 0], 0, "notification-icon corner is not transparent")
                self.assertTrue(np.all(alpha[:5, :] == 0), "notification-icon top margin is not transparent")
                self.assertTrue(np.all(alpha[-5:, :] == 0), "notification-icon bottom margin is not transparent")

                # Visible pixels should have pure white RGB (255, 255, 255)
                visible = alpha > 0
                self.assertGreater(np.sum(visible), 0, "notification-icon has no visible pixels")
                self.assertTrue(
                    np.all(rgb[visible] == [255, 255, 255]),
                    "notification-icon contains non-white pixels; Android status bar requires white alpha glyph",
                )

    def test_splash_icon_has_transparency_and_white_glyph(self):
        """Verify splash-icon.png has transparent outside and centered white glyph."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self.run_cli(["--source", self.source_logo, "--output-dir", tmpdir])

            splash_path = os.path.join(tmpdir, "splash-icon.png")
            with Image.open(splash_path) as img:
                arr = np.array(img)
                alpha = arr[:, :, 3]
                rgb = arr[:, :, :3]

                # Outside transparency
                self.assertEqual(alpha[0, 0], 0)
                self.assertTrue(np.all(alpha[:10, :] == 0))
                self.assertTrue(np.all(alpha[-10:, :] == 0))

                visible = alpha > 0
                self.assertGreater(np.sum(alpha > 10), 10000, "splash-icon has insufficient visible pixels")
                self.assertTrue(np.all(rgb[visible] == [255, 255, 255]))

    def test_favicon_has_rounded_accent_and_readable_white_mark(self):
        """Verify favicon.png has rounded accent background and readable white H glyph."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self.run_cli(["--source", self.source_logo, "--output-dir", tmpdir])

            fav_path = os.path.join(tmpdir, "favicon.png")
            with Image.open(fav_path) as img:
                arr = np.array(img)
                # Corners must be transparent (rounded rect)
                self.assertEqual(arr[0, 0, 3], 0)
                self.assertEqual(arr[0, -1, 3], 0)
                self.assertEqual(arr[-1, 0, 3], 0)
                self.assertEqual(arr[-1, -1, 3], 0)

                # White mark pixels present
                white_pts = (arr[:, :, 0] > 200) & (arr[:, :, 1] > 200) & (arr[:, :, 2] > 200) & (arr[:, :, 3] > 100)
                self.assertGreater(np.sum(white_pts), 100, "favicon lacks readable white H glyph")

    def test_absence_of_expo_placeholders_and_h_geometry(self):
        """Verify no Expo template blue pixels and verify H mark dual upright geometry."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self.run_cli(["--source", self.source_logo, "--output-dir", tmpdir])

            # In icon.png, corners should be brand accent #6D5EFC and mark should be white
            icon_path = os.path.join(tmpdir, "icon.png")
            with Image.open(icon_path) as img:
                arr = np.array(img)
                # Check corners are brand accent
                self.assertEqual(list(arr[0, 0]), [109, 94, 252])
                self.assertEqual(list(arr[0, -1]), [109, 94, 252])
                self.assertEqual(list(arr[-1, 0]), [109, 94, 252])
                self.assertEqual(list(arr[-1, -1]), [109, 94, 252])

                # No Expo blue
                expo_blue = ((arr[:, :, 0] < 90) & (arr[:, :, 1] > 140) & (arr[:, :, 2] > 200))
                self.assertEqual(np.sum(expo_blue), 0, "Found Expo template blue pixels in icon.png")

            # Check H mark geometry in foreground: two vertical upright peaks in column sum
            fg_path = os.path.join(tmpdir, "android-icon-foreground.png")
            with Image.open(fg_path) as img:
                arr = np.array(img)
                alpha = arr[:, :, 3]
                col_sums = np.sum(alpha, axis=0).astype(float)
                col_sums /= col_sums.max()
                midpoint = 512
                left_peak = col_sums[:midpoint].max()
                right_peak = col_sums[midpoint:].max()
                center_valley = col_sums[midpoint]
                self.assertGreater(left_peak, 0.5, "H left upright not found")
                self.assertGreater(right_peak, 0.5, "H right upright not found")
                self.assertLess(center_valley, left_peak, "H glyph lacks characteristic two-upright profile")

    def _create_verified_baseline(self, tmpdir):
        """Generate all assets in tmpdir and verify baseline --check passes cleanly."""
        res_gen = self.run_cli(["--source", self.source_logo, "--output-dir", tmpdir])
        self.assertEqual(res_gen.returncode, 0, "Baseline generation must exit 0")
        res_check = self.run_cli(["--check", "--source", self.source_logo, "--output-dir", tmpdir])
        self.assertEqual(res_check.returncode, 0, "Baseline check must exit 0")

    # --- Negative CLI Tests (individually testing failure modes) ---

    def test_cli_check_rejects_flat_icon(self):
        """Negative test: --check must reject flat icon.png without white mark."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self._create_verified_baseline(tmpdir)
            Image.new("RGB", (1024, 1024), (109, 94, 252)).save(os.path.join(tmpdir, "icon.png"))
            res = self.run_cli(["--check", "--source", self.source_logo, "--output-dir", tmpdir])
            self.assertEqual(res.returncode, 1, "--check must reject flat icon.png")

    def test_cli_check_rejects_blank_splash(self):
        """Negative test: --check must reject blank transparent splash-icon.png."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self._create_verified_baseline(tmpdir)
            Image.new("RGBA", (512, 512), (0, 0, 0, 0)).save(os.path.join(tmpdir, "splash-icon.png"))
            res = self.run_cli(["--check", "--source", self.source_logo, "--output-dir", tmpdir])
            self.assertEqual(res.returncode, 1, "--check must reject blank splash-icon.png")

    def test_cli_check_rejects_opaque_notification(self):
        """Negative test: --check must reject notification-icon.png with opaque white background."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self._create_verified_baseline(tmpdir)
            Image.new("RGBA", (96, 96), (255, 255, 255, 255)).save(os.path.join(tmpdir, "notification-icon.png"))
            res = self.run_cli(["--check", "--source", self.source_logo, "--output-dir", tmpdir])
            self.assertEqual(res.returncode, 1, "--check must reject opaque notification-icon.png")

    def test_cli_check_rejects_square_favicon(self):
        """Negative test: --check must reject favicon with generic square instead of Haseela mark."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self._create_verified_baseline(tmpdir)

            square_fav = Image.new("RGBA", (48, 48), (109, 94, 252, 255))
            draw = ImageDraw.Draw(square_fav)
            draw.rectangle((12, 12, 35, 35), fill=(255, 255, 255, 255))
            sq_pix = square_fav.load()
            sq_pix[0, 0] = (0, 0, 0, 0)
            sq_pix[0, 47] = (0, 0, 0, 0)
            sq_pix[47, 0] = (0, 0, 0, 0)
            sq_pix[47, 47] = (0, 0, 0, 0)
            square_fav.save(os.path.join(tmpdir, "favicon.png"))

            res = self.run_cli(["--check", "--source", self.source_logo, "--output-dir", tmpdir])
            self.assertEqual(res.returncode, 1, "Favicon without Haseela glyph was accepted")

    def test_cli_check_rejects_red_patch_favicon(self):
        """Negative test: --check must reject favicon with off-brand red pixels in accent region."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self._create_verified_baseline(tmpdir)

            fav_path = os.path.join(tmpdir, "favicon.png")
            fav = Image.open(fav_path)
            fav_pix = fav.load()
            for y in range(12, 18):
                for x in range(3, 7):
                    self.assertEqual(fav_pix[x, y], (109, 94, 252, 255))
                    fav_pix[x, y] = (255, 0, 0, 255)
            fav.save(fav_path)

            res = self.run_cli(["--check", "--source", self.source_logo, "--output-dir", tmpdir])
            self.assertEqual(res.returncode, 1, "Favicon with off-brand red patch was accepted")

    def test_cli_check_rejects_wrong_accent_favicon(self):
        """Negative test: --check must reject favicon with incorrect background accent color."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self._create_verified_baseline(tmpdir)

            fav_path = os.path.join(tmpdir, "favicon.png")
            fav = Image.open(fav_path)
            fav_pix = fav.load()
            for y in range(48):
                for x in range(48):
                    if fav_pix[x, y] == (109, 94, 252, 255):
                        fav_pix[x, y] = (37, 99, 235, 255)
            fav.save(fav_path)

            res = self.run_cli(["--check", "--source", self.source_logo, "--output-dir", tmpdir])
            self.assertEqual(res.returncode, 1, "--check must reject wrong accent color in favicon")

    def test_cli_check_rejects_blank_favicon(self):
        """Negative test: --check must reject blank transparent or flat favicon.png."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self._create_verified_baseline(tmpdir)
            Image.new("RGBA", (48, 48), (0, 0, 0, 0)).save(os.path.join(tmpdir, "favicon.png"))
            res = self.run_cli(["--check", "--source", self.source_logo, "--output-dir", tmpdir])
            self.assertEqual(res.returncode, 1, "--check must reject blank favicon.png")

    def test_cli_check_rejects_colored_foreground(self):
        """Negative test: --check must reject foreground with colored/non-white glyph."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self._create_verified_baseline(tmpdir)
            fg_path = os.path.join(tmpdir, "android-icon-foreground.png")
            with Image.open(fg_path) as fg:
                r, g, b, a = fg.split()
                colored_fg = Image.merge("RGBA", (Image.new("L", fg.size, 0), r, Image.new("L", fg.size, 0), a))
                colored_fg.save(fg_path)
            res = self.run_cli(["--check", "--source", self.source_logo, "--output-dir", tmpdir])
            self.assertEqual(res.returncode, 1, "--check must reject colored foreground")

    def test_cli_check_rejects_monochrome_mismatch(self):
        """Negative test: --check must reject monochrome not matching foreground silhouette."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self._create_verified_baseline(tmpdir)
            mono_path = os.path.join(tmpdir, "android-icon-monochrome.png")
            circle_img = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
            draw = ImageDraw.Draw(circle_img)
            draw.ellipse([400, 400, 624, 624], fill=(255, 255, 255, 255))
            circle_img.save(mono_path)
            res = self.run_cli(["--check", "--source", self.source_logo, "--output-dir", tmpdir])
            self.assertEqual(res.returncode, 1, "--check must reject monochrome silhouette mismatch")

    def test_cli_check_rejects_safe_circle_violation(self):
        """Negative test: --check must reject foreground glyph exceeding 66/108 safe circle."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self._create_verified_baseline(tmpdir)
            fg_path = os.path.join(tmpdir, "android-icon-foreground.png")
            oversized = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
            draw = ImageDraw.Draw(oversized)
            draw.rectangle([100, 100, 924, 924], fill=(255, 255, 255, 255))
            oversized.save(fg_path)
            res = self.run_cli(["--check", "--source", self.source_logo, "--output-dir", tmpdir])
            self.assertEqual(res.returncode, 1, "--check must reject safe circle violation")

    def test_cli_check_rejects_altered_mark(self):
        """Negative test: --check must reject splash glyph with altered/generic mark geometry."""
        with tempfile.TemporaryDirectory() as tmpdir:
            self._create_verified_baseline(tmpdir)
            sp_path = os.path.join(tmpdir, "splash-icon.png")
            square = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
            draw = ImageDraw.Draw(square)
            draw.rectangle([150, 150, 362, 362], fill=(255, 255, 255, 255))
            square.save(sp_path)
            res = self.run_cli(["--check", "--source", self.source_logo, "--output-dir", tmpdir])
            self.assertEqual(res.returncode, 1, "--check must reject altered mark silhouette")

    def test_cli_check_rejects_missing_or_corrupt_files(self):
        """Negative test: --check must reject missing file or corrupt dimensions."""
        with tempfile.TemporaryDirectory() as tmpdir:
            res_empty = self.run_cli(["--check", "--output-dir", tmpdir])
            self.assertEqual(res_empty.returncode, 1, "--check should fail on empty directory")

            self._create_verified_baseline(tmpdir)
            os.remove(os.path.join(tmpdir, "icon.png"))
            res_missing = self.run_cli(["--check", "--source", self.source_logo, "--output-dir", tmpdir])
            self.assertEqual(res_missing.returncode, 1, "--check should fail when asset missing")

            dummy = Image.new("RGB", (50, 50), (0, 0, 0))
            dummy.save(os.path.join(tmpdir, "icon.png"))
            res_corrupt = self.run_cli(["--check", "--source", self.source_logo, "--output-dir", tmpdir])
            self.assertEqual(res_corrupt.returncode, 1, "--check should fail on wrong dimensions")


if __name__ == "__main__":
    unittest.main()
