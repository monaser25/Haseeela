#!/usr/bin/env python3
"""Haseela Mobile Brand Assets Generator and Validator.

Extracts the authentic stylized slanted 'H' brand glyph from the source logo
(apps/web/public/haseeela_icon.png) with antialiased alpha unmixing, and produces
all required native mobile assets conforming to iOS App Store, Android Adaptive
Icon (66/108 safe circle), Android 13+ Monochrome, Expo Splash, and Status Bar
Notification specifications.
"""

import argparse
import os
import sys
from PIL import Image, ImageDraw
import numpy as np

# Brand color tokens (matches apps/mobile/src/theme/colors.ts lightColors.accent)
ACCENT_HEX = "#6D5EFC"
ACCENT_RGB = (109, 94, 252)  # R: 109, G: 94, B: 252
WHITE_RGB = (255, 255, 255)

# Adaptive icon safe circle specification: 66dp / 108dp diameter
SAFE_CIRCLE_RATIO = 66.0 / 108.0

# Expected asset specifications: name -> (width, height, mode, description)
ASSET_SPECS = {
    "icon.png": (1024, 1024, "RGB", "iOS/App Store primary icon (opaque, clear space)"),
    "android-icon-foreground.png": (1024, 1024, "RGBA", "Android adaptive foreground (safe circle)"),
    "android-icon-background.png": (1024, 1024, "RGB", "Android adaptive background (flat accent)"),
    "android-icon-monochrome.png": (1024, 1024, "RGBA", "Android themed monochrome icon"),
    "splash-icon.png": (512, 512, "RGBA", "Splash screen icon (imageWidth: 76)"),
    "favicon.png": (48, 48, "RGBA", "Web favicon (readable H)"),
    "notification-icon.png": (96, 96, "RGBA", "Android status bar push notification icon"),
}


def extract_mark_glyph(source_path):
    """Extract stylized slanted H mark from source logo with antialiased alpha.

    The source logo (1254x1254) contains a purple card interior around the white mark.
    Normalized coordinates x: 0.30..0.73, y: 0.25..0.74 define the safe region of
    interest safely inside the card and outside the drop shadow / white card border.
    Alpha unmixing isolates the antialiased white foreground from the purple interior.
    """
    if not os.path.exists(source_path):
        raise FileNotFoundError(f"Source logo not found: {source_path}")

    with Image.open(source_path) as img:
        img_rgb = img.convert("RGB")
        w, h = img_rgb.size
        if (w, h) != (1254, 1254):
            raise ValueError(f"Source logo expected 1254x1254, got {w}x{h}")
        arr = np.array(img_rgb, dtype=float)

    # Normalized ROI coordinates inside the purple card interior
    y0, y1 = int(round(h * 0.25)), int(round(h * 0.74))
    x0, x1 = int(round(w * 0.30)), int(round(w * 0.73))
    roi = arr[y0:y1, x0:x1]

    # Baseline purple interior color and white foreground
    bg_r, bg_g = 97.5, 76.5
    fg_r, fg_g = 255.0, 255.0

    # Linear unmixing from red and green channels
    alpha_raw = ((roi[:, :, 0] - bg_r) / (fg_r - bg_r) + (roi[:, :, 1] - bg_g) / (fg_g - bg_g)) / 2.0

    # Noise cutoff to eliminate baseline purple background variance
    noise_floor = 0.02
    alpha_clean = np.clip((alpha_raw - noise_floor) / (1.0 - noise_floor), 0.0, 1.0)

    # Locate tight bounding box of the glyph
    ys, xs = np.where(alpha_clean > 0.0)
    if len(ys) == 0:
        raise ValueError("Could not locate white mark glyph in source logo ROI")

    tight_alpha = alpha_clean[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    th, tw = tight_alpha.shape

    # Construct clean RGBA mark image (pure white RGB with isolated alpha)
    mark_rgba = np.zeros((th, tw, 4), dtype=np.uint8)
    mark_rgba[:, :, 0] = 255
    mark_rgba[:, :, 1] = 255
    mark_rgba[:, :, 2] = 255
    mark_rgba[:, :, 3] = np.round(tight_alpha * 255.0).astype(np.uint8)

    return Image.fromarray(mark_rgba, mode="RGBA")


def _scale_alpha_glyph(mark_pil, target_w, target_h):
    """Scale mark alpha channel to target dimensions using high-quality Lanczos."""
    alpha_channel = mark_pil.split()[3]
    return alpha_channel.resize((target_w, target_h), Image.Resampling.LANCZOS)


def _build_white_rgba_glyph(mark_pil, canvas_size, target_h):
    """Construct an RGBA canvas of canvas_size with centered pure white (255, 255, 255) glyph."""
    cw, ch = canvas_size
    target_w = int(round(mark_pil.width * (target_h / mark_pil.height)))
    scaled_alpha = _scale_alpha_glyph(mark_pil, target_w, target_h)

    canvas_alpha = Image.new("L", (cw, ch), 0)
    ox = (cw - target_w) // 2
    oy = (ch - target_h) // 2
    canvas_alpha.paste(scaled_alpha, (ox, oy))

    white_rgb = Image.new("RGB", (cw, ch), WHITE_RGB)
    return Image.merge("RGBA", (*white_rgb.split(), canvas_alpha))


def build_icon(mark_pil):
    """Build 1024x1024 opaque RGB primary icon for iOS / App Store."""
    canvas = Image.new("RGB", (1024, 1024), ACCENT_RGB)
    target_h = 540
    target_w = int(round(mark_pil.width * (target_h / mark_pil.height)))
    scaled_alpha = _scale_alpha_glyph(mark_pil, target_w, target_h)
    white_mark = Image.merge("RGBA", (*Image.new("RGB", (target_w, target_h), WHITE_RGB).split(), scaled_alpha))
    ox = (1024 - target_w) // 2
    oy = (1024 - target_h) // 2
    canvas.paste(white_mark, (ox, oy), scaled_alpha)
    return canvas


def build_android_foreground(mark_pil):
    """Build 1024x1024 RGBA adaptive icon foreground strictly inside 66/108 safe circle."""
    # Height of 460 ensures max radial distance from center is ~296.5 px <= 312.89 px
    return _build_white_rgba_glyph(mark_pil, (1024, 1024), 460)


def build_android_background():
    """Build 1024x1024 RGB flat accent background without construction grid."""
    return Image.new("RGB", (1024, 1024), ACCENT_RGB)


def build_android_monochrome(mark_pil):
    """Build 1024x1024 RGBA monochrome silhouette safe for Android 13+ themed masks."""
    return _build_white_rgba_glyph(mark_pil, (1024, 1024), 460)


def build_splash_icon(mark_pil):
    """Build 512x512 RGBA transparent white splash glyph readable at imageWidth 76."""
    return _build_white_rgba_glyph(mark_pil, (512, 512), 420)


def build_favicon(mark_pil):
    """Build 48x48 RGBA favicon with rounded accent background and readable white H."""
    canvas = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle([0, 0, 47, 47], radius=10, fill=ACCENT_RGB + (255,))
    target_h = 32
    target_w = int(round(mark_pil.width * (target_h / mark_pil.height)))
    scaled_alpha = _scale_alpha_glyph(mark_pil, target_w, target_h)
    white_mark = Image.merge("RGBA", (*Image.new("RGB", (target_w, target_h), WHITE_RGB).split(), scaled_alpha))
    ox = (48 - target_w) // 2
    oy = (48 - target_h) // 2
    canvas.paste(white_mark, (ox, oy), scaled_alpha)
    return canvas


def build_notification_icon(mark_pil):
    """Build 96x96 RGBA status bar notification icon (pure white glyph, transparent bg)."""
    return _build_white_rgba_glyph(mark_pil, (96, 96), 72)


def generate_all(source_path, output_dir):
    """Generate all mobile brand asset PNGs."""
    os.makedirs(output_dir, exist_ok=True)
    mark_pil = extract_mark_glyph(source_path)

    generators = {
        "icon.png": lambda: build_icon(mark_pil),
        "android-icon-foreground.png": lambda: build_android_foreground(mark_pil),
        "android-icon-background.png": lambda: build_android_background(),
        "android-icon-monochrome.png": lambda: build_android_monochrome(mark_pil),
        "splash-icon.png": lambda: build_splash_icon(mark_pil),
        "favicon.png": lambda: build_favicon(mark_pil),
        "notification-icon.png": lambda: build_notification_icon(mark_pil),
    }

    print(f"Generating mobile brand assets into {output_dir}...")
    for filename, fn in generators.items():
        img = fn()
        out_path = os.path.join(output_dir, filename)
        img.save(out_path, format="PNG", optimize=True)
        print(f"  [OK] {filename} ({img.size[0]}x{img.size[1]}, {img.mode})")

    print("Brand asset generation completed successfully.")


def _compute_silhouette_iou(glyph_mask, src_mask):
    """Compute Intersection over Union between a binary glyph mask and source mark."""
    ys, xs = np.where(glyph_mask)
    if len(ys) == 0:
        return 0.0
    tight = glyph_mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.uint8) * 255
    th_s, tw_s = src_mask.shape
    resized = np.array(
        Image.fromarray(tight).resize((tw_s, th_s), Image.Resampling.BILINEAR)
    ) > 128
    src_bin = src_mask > 0
    intersection = np.sum(src_bin & resized)
    union = np.sum(src_bin | resized)
    return float(intersection) / float(union) if union > 0 else 0.0


def verify_assets(source_path, output_dir):
    """Read-only contract verification of generated assets. Returns True if all pass."""
    errors = []

    # 1. Verify source logo intact and extract reference mark
    src_mask = None
    ref_fav_arr = None
    if not os.path.exists(source_path):
        errors.append(f"Source logo missing: {source_path}")
    else:
        try:
            with Image.open(source_path) as src_img:
                if src_img.size != (1254, 1254) or src_img.mode != "RGB":
                    errors.append(f"Source logo invalid: size={src_img.size}, mode={src_img.mode}")
                else:
                    ref_mark = extract_mark_glyph(source_path)
                    src_mask = np.array(ref_mark)[:, :, 3] > 50
                    ref_fav_arr = np.array(build_favicon(ref_mark))
        except Exception as e:
            errors.append(f"Source logo failed to process: {e}")

    # 2. Verify all output assets
    safe_radius = 1024.0 * SAFE_CIRCLE_RATIO / 2.0
    cx, cy = (1024.0 - 1.0) / 2.0, (1024.0 - 1.0) / 2.0
    cached_fg_arr = None

    for filename, (exp_w, exp_h, exp_mode, desc) in ASSET_SPECS.items():
        asset_path = os.path.join(output_dir, filename)
        if not os.path.exists(asset_path):
            errors.append(f"Missing asset: {filename} ({desc})")
            continue

        try:
            with Image.open(asset_path) as img:
                if img.size != (exp_w, exp_h):
                    errors.append(f"{filename}: expected size ({exp_w}, {exp_h}), got {img.size}")
                if img.mode != exp_mode:
                    errors.append(f"{filename}: expected mode '{exp_mode}', got '{img.mode}'")

                arr = np.array(img)

                # Asset-specific contract verifications
                if filename == "android-icon-background.png":
                    # Flat accent check (no Expo grid, solid color)
                    expected_arr = np.full((exp_h, exp_w, 3), ACCENT_RGB, dtype=np.uint8)
                    if not np.array_equal(arr, expected_arr):
                        errors.append(f"{filename}: background is not uniform #6D5EFC accent (grid/template remnants)")

                elif filename in ("android-icon-foreground.png", "android-icon-monochrome.png"):
                    alpha = arr[:, :, 3]
                    # Outside transparency: 4 corners must be transparent
                    corners = [alpha[0, 0], alpha[0, -1], alpha[-1, 0], alpha[-1, -1]]
                    if any(c != 0 for c in corners):
                        errors.append(f"{filename}: corners must be transparent (got alphas {corners})")

                    # Visible pixels must be pure white silhouette
                    visible = alpha > 0
                    if not np.any(visible):
                        errors.append(f"{filename}: glyph is missing or invisible (no alpha > 0)")
                    elif not np.all(arr[visible, :3] == [255, 255, 255]):
                        errors.append(f"{filename}: contains non-white pixels (must be pure white silhouette)")

                    # ALL nonzero alpha pixels must fit strictly within 66/108 safe circle
                    ys, xs = np.where(alpha > 0)
                    if len(ys) > 0:
                        dists = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
                        max_d = float(dists.max())
                        if max_d > safe_radius:
                            errors.append(
                                f"{filename}: glyph exceeds 66/108 safe circle (max dist {max_d:.2f} > {safe_radius:.2f})"
                            )
                        if max_d < 250.0:
                            errors.append(f"{filename}: glyph is unexpectedly small (max dist {max_d:.2f} < 250.0)")

                    # Geometry: dual-upright profile
                    if len(ys) > 0:
                        col_sums = np.sum(alpha, axis=0).astype(float)
                        if col_sums.max() > 0:
                            col_sums /= col_sums.max()
                            mid = len(col_sums) // 2
                            left_max = col_sums[:mid].max() if mid > 0 else 0
                            right_max = col_sums[mid:].max() if len(col_sums) > mid else 0
                            center_val = col_sums[mid] if len(col_sums) > mid else 0
                            if left_max < 0.5 or right_max < 0.5 or center_val >= left_max:
                                errors.append(f"{filename}: glyph lacks characteristic Haseela dual-upright profile")

                    # Authentic mark correlation with source
                    if src_mask is not None and len(ys) > 0:
                        iou = _compute_silhouette_iou(alpha > 50, src_mask)
                        if iou < 0.90:
                            errors.append(f"{filename}: glyph silhouette does not match source mark (IoU: {iou:.3f} < 0.90)")

                    # Cache foreground array for monochrome comparison
                    if filename == "android-icon-foreground.png":
                        cached_fg_arr = arr
                    elif filename == "android-icon-monochrome.png" and cached_fg_arr is not None:
                        # Monochrome silhouette must match foreground shape
                        if not np.array_equal(arr[:, :, 3], cached_fg_arr[:, :, 3]):
                            errors.append(f"{filename}: silhouette shape does not match android-icon-foreground.png")

                elif filename == "icon.png":
                    # 4 Corners must be accent color
                    corners = [list(arr[0, 0]), list(arr[0, -1]), list(arr[-1, 0]), list(arr[-1, -1])]
                    for c in corners:
                        if c != list(ACCENT_RGB):
                            errors.append(f"{filename}: corner pixel {c} does not match accent {list(ACCENT_RGB)}")
                            break

                    # Clear space: outer 16px rim must be accent color
                    rim_pixels = np.concatenate([arr[:16, :, :], arr[-16:, :, :], arr[:, :16, :], arr[:, -16:, :]], axis=None)
                    rim_expected = np.tile(ACCENT_RGB, len(rim_pixels) // 3)
                    if not np.array_equal(rim_pixels, rim_expected):
                        errors.append(f"{filename}: outer clear space rim contains non-accent pixels (insufficient margin)")

                    # No Expo blue template pixels
                    expo_blue = ((arr[:, :, 0] < 90) & (arr[:, :, 1] > 140) & (arr[:, :, 2] > 200))
                    if np.sum(expo_blue) > 0:
                        errors.append(f"{filename}: contains legacy Expo template blue pixels")

                    # Authentic white mark must be present (reject flat icon)
                    white_mask = (arr[:, :, 0] > 200) & (arr[:, :, 1] > 200) & (arr[:, :, 2] > 200)
                    white_count = np.sum(white_mask)
                    if white_count < 20000:
                        errors.append(f"{filename}: missing authentic white mark (flat/blank icon, found {white_count} white px)")
                    elif src_mask is not None:
                        iou = _compute_silhouette_iou(white_mask, src_mask)
                        if iou < 0.85:
                            errors.append(f"{filename}: white mark silhouette does not match source mark (IoU: {iou:.3f} < 0.85)")

                elif filename == "splash-icon.png":
                    alpha = arr[:, :, 3]
                    # Outside transparency: corners and outer margin must be transparent
                    corners = [alpha[0, 0], alpha[0, -1], alpha[-1, 0], alpha[-1, -1]]
                    if any(c != 0 for c in corners):
                        errors.append(f"{filename}: corners must be transparent (got alphas {corners})")
                    if np.any(alpha[:10, :] > 0) or np.any(alpha[-10:, :] > 0):
                        errors.append(f"{filename}: outer margin must be transparent")

                    # Visible pixels must be pure white
                    visible = alpha > 0
                    if not np.any(visible) or np.sum(alpha > 10) < 10000:
                        errors.append(f"{filename}: glyph is missing or invisible (blank splash canvas)")
                    elif not np.all(arr[visible, :3] == [255, 255, 255]):
                        errors.append(f"{filename}: contains non-white pixels (must be white silhouette)")

                    # Authentic mark correlation with source
                    if src_mask is not None and np.any(visible):
                        iou = _compute_silhouette_iou(alpha > 50, src_mask)
                        if iou < 0.90:
                            errors.append(f"{filename}: splash glyph does not match source mark (IoU: {iou:.3f} < 0.90)")

                elif filename == "favicon.png":
                    alpha = arr[:, :, 3]
                    # Corners must be transparent (rounded rect)
                    corners = [alpha[0, 0], alpha[0, -1], alpha[-1, 0], alpha[-1, -1]]
                    if any(c != 0 for c in corners):
                        errors.append(f"{filename}: corners must be transparent (got alphas {corners})")

                    # In-memory source-derived reference comparison
                    if ref_fav_arr is not None:
                        if not np.array_equal(arr, ref_fav_arr):
                            errors.append(f"{filename}: pixel layout/accent does not match source-derived reference favicon")
                    else:
                        white_mask = (arr[:, :, 0] > 200) & (arr[:, :, 1] > 200) & (arr[:, :, 2] > 200) & (alpha > 100)
                        white_count = np.sum(white_mask)
                        if white_count < 200 or white_count > 600:
                            errors.append(f"{filename}: missing or corrupted white glyph (found {white_count} px, expected 200..600)")

                elif filename == "notification-icon.png":
                    alpha = arr[:, :, 3]
                    # Outside transparency: corners and outer margin must be transparent (no opaque background)
                    corners = [alpha[0, 0], alpha[0, -1], alpha[-1, 0], alpha[-1, -1]]
                    if any(c != 0 for c in corners):
                        errors.append(f"{filename}: lacks transparent background (corners are opaque)")
                    if np.any(alpha[:5, :] > 0) or np.any(alpha[-5:, :] > 0):
                        errors.append(f"{filename}: outer margins must be transparent")

                    # Visible pixels must be pure white silhouette
                    visible = alpha > 0
                    if not np.any(visible) or np.sum(alpha > 10) < 500:
                        errors.append(f"{filename}: glyph is missing or invisible")
                    elif not np.all(arr[visible, :3] == [255, 255, 255]):
                        errors.append(f"{filename}: contains non-white pixels (status bar requires white alpha)")

                    # Authentic mark correlation with source
                    if src_mask is not None and np.any(visible):
                        iou = _compute_silhouette_iou(alpha > 50, src_mask)
                        if iou < 0.80:
                            errors.append(f"{filename}: notification glyph does not match source mark (IoU: {iou:.3f} < 0.80)")

        except Exception as e:
            errors.append(f"Failed to read/verify {filename}: {e}")

    if errors:
        print("Asset verification FAILED with errors:")
        for err in errors:
            print(f"  [FAIL] {err}")
        return False

    print("All mobile brand assets verified successfully against contract specifications.")
    for fn, (w, h, m, desc) in ASSET_SPECS.items():
        print(f"  [OK] {fn:<30} {w}x{h} ({m}) - {desc}")
    return True


def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    default_source = os.path.join(repo_root, "apps", "web", "public", "haseeela_icon.png")
    default_output = os.path.join(repo_root, "apps", "mobile", "assets", "images")

    parser = argparse.ArgumentParser(description="Haseela Mobile Brand Assets Generator and Validator")
    parser.add_argument("--source", default=default_source, help="Path to source logo PNG")
    parser.add_argument("--output-dir", default=default_output, help="Path to output directory")
    parser.add_argument("--check", action="store_true", help="Read-only validation of existing assets")

    args = parser.parse_args()

    if args.check:
        success = verify_assets(args.source, args.output_dir)
        sys.exit(0 if success else 1)
    else:
        generate_all(args.source, args.output_dir)


if __name__ == "__main__":
    main()
