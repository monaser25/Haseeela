# Haseela Mobile Brand Assets

This directory contains generated and static-contract-verified native brand visual assets for the Haseela mobile application (Expo / React Native).

## 1. Provenance & Visual Identity

- **Source Mark**: Extracted from the authentic Haseela brand logo at `apps/web/public/haseeela_icon.png` (1254x1254 RGB).
- **Glyph Geometry**: Stylized slanted 'H' with dual uprights, short parallel terminal strokes at top and bottom, and a curved connecting bridge.
- **Extraction Method**: Antialiased alpha unmixing from the source purple interior region (ROI normalized `x: 0.30..0.73, y: 0.25..0.74`) isolating the white glyph without drop shadow, outer card borders, or color fringing.
- **Brand Accent**: `#6D5EFC` (`rgb(109, 94, 252)`), defined in `apps/mobile/src/theme/colors.ts:42` (`lightColors.accent`) and configured in `app.json` splash background.

## 2. Deliverable Asset Specifications

| Asset | Dimensions | Format / Mode | Purpose & Platform Compliance |
|---|---|---|---|
| `icon.png` | 1024x1024 | PNG (RGB opaque) | iOS & App Store primary icon. No alpha channel, no pre-rounded corners. Clear space ensures glyph is not clipped by Apple's squircle mask. |
| `android-icon-foreground.png` | 1024x1024 | PNG (RGBA transparent) | Android adaptive icon foreground layer. All visible pixels fit strictly within the Android 66/108 safe circle (radius <= 312.89 px). |
| `android-icon-background.png` | 1024x1024 | PNG (RGB opaque) | Android adaptive icon background layer. Solid flat `#6D5EFC` accent with zero template grids or placeholder artifacts. |
| `android-icon-monochrome.png` | 1024x1024 | PNG (RGBA transparent) | Android 13+ Material You themed dynamic icon silhouette layer. Sized and placed identically to foreground. |
| `splash-icon.png` | 512x512 | PNG (RGBA transparent) | Centered white glyph rendered above `#6D5EFC` splash background. Scaled to remain crisp and readable at configured `imageWidth: 76`. |
| `favicon.png` | 48x48 | PNG (RGBA) | Web browser favicon with rounded accent background and readable white glyph, verified against source-derived pixel layout and brand accent #6D5EFC. |
| `notification-icon.png` | 96x96 | PNG (RGBA transparent) | Prepared asset for future Android status bar push notification integration. Pure white glyph on transparent background (no colored background) readable at 24dp. |
| `expo-logo.png` | 228x213 | PNG (RGBA) | Retained unmodified legacy asset. |

## 3. How to Regenerate & Verify

All commands below must be executed from the repository root.

### Prerequisites
- Python environment: built and verified using bundled Python 3.12 with `Pillow 12.3.0` and `numpy 2.3.5` (pre-installed in the workspace runtime dependencies).

### Generation
To regenerate all assets from the source logo into `apps/mobile/assets/images`:
```bash
python scripts/generate-mobile-brand-assets.py
```
*(Accepts optional `--source <path>` and `--output-dir <path>` arguments to redirect output).*

### Verification Check (--check)
To verify contract dimensions, modes, alpha channel transparency, safe circle containment, absence of template artifacts, and authentic source mark silhouette alignment without modifying files:
```bash
python scripts/generate-mobile-brand-assets.py --check
```

### Unit Tests
To run the automated public CLI test suite:
```bash
python -m unittest discover -s scripts -p 'test_mobile_brand_assets.py'
```

*Note: In specific host or container environments with isolated Python runtimes, replace `python` with the path to the designated Python interpreter.*

## 4. Verification Limits & Scope Notice

- The scripts and automated tests perform headless image contract verification (geometry, channel mode, dimensions, bounding box, radial containment, and color consistency).
- Native platform rendering on real devices or simulators (iOS Home Screen squircle masks, Android Adaptive Icon launcher shape animations, runtime splash screen handoff, and Android push notification status bar presentation) has **not** been executed in this scope and requires running on target platform simulators or physical hardware.
- The `notification-icon.png` asset is prepared for future push notification client wiring and is not currently referenced by active native push handlers.
