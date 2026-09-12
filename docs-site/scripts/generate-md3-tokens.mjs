/**
 * Generates src/styles/md3-tokens.css — the Material Design 3 token layer.
 *
 * Nothing here runs during `npm run build`. The generated CSS is committed.
 * Re-run this only when the brand seed changes:
 *
 *   npm i --no-save @material/material-color-utilities@0.4.0
 *   node scripts/generate-md3-tokens.mjs
 *
 * Why a generator instead of hand-written hex: MD3 colour roles are not picked,
 * they are *derived*. Each role is a fixed tone of a tonal palette built from a
 * seed by the CAM16/HCT model. Hand-writing the 13 tones of 6 palettes is where
 * design systems drift, so the palettes come straight out of Google's own
 * implementation (@material/material-color-utilities, the library that backs
 * Material Theme Builder) and the role table below is the published MD3 mapping.
 *
 * The seed itself is measured, not chosen by eye: SEED_PRIMARY and SEED_TERTIARY
 * are pixel-count-weighted centroids of the two colour families in the Luq logo
 * (public/img/library_image_cropped.png), computed by the same script — see
 * measureLogoBrandColors().
 */

import { readFileSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { inflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// material-color-utilities 0.4.0 ships ESM with extensionless relative imports,
// which strict Node ESM rejects. Retry those specifiers with an explicit .js so
// the published package loads unpatched.
if (typeof registerHooks !== "function") {
  throw new Error(
    "node:module registerHooks is unavailable — run this generator on Node 22.15+ or 23.5+."
  );
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (error.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".")) {
        return nextResolve(`${specifier}.js`, context);
      }
      throw error;
    }
  },
});

const { Hct, TonalPalette } =
  await import("@material/material-color-utilities");

const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOGO_PATH = join(SITE_ROOT, "public", "img", "library_image_cropped.png");
const OUTPUT_PATH = join(SITE_ROOT, "src", "styles", "md3-tokens.css");
// tailwind.config.mjs reads this so the legacy luq.* colour scales resolve to
// real MD3 palette tones instead of a second, hand-maintained set of hex codes.
const PALETTE_JSON_PATH = join(SITE_ROOT, "src", "styles", "md3-palette.json");

/** Hue windows used to split the logo's two brand families. */
const PURPLE_HUE_WINDOW = [260, 340];
const TEAL_HUE_WINDOW = [150, 210];

/** MD3 tonal palette tones, plus the surface-container tones the 2023 spec added. */
const PALETTE_TONES = [
  0, 4, 6, 10, 12, 17, 20, 22, 24, 30, 40, 50, 60, 70, 80, 87, 90, 92, 94, 95,
  96, 98, 99, 100,
];

// ---------------------------------------------------------------------------
// PNG decoding (8-bit RGBA only — enough for the logo)
// ---------------------------------------------------------------------------

function decodePng(filePath) {
  const file = readFileSync(filePath);
  const chunks = [];
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;
  let cursor = 8;

  while (cursor < file.length) {
    const length = file.readUInt32BE(cursor);
    const type = file.toString("ascii", cursor + 4, cursor + 8);
    const body = file.subarray(cursor + 8, cursor + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
    }
    if (type === "IDAT") chunks.push(body);
    cursor += 12 + length;
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(
      `expected 8-bit RGBA PNG, got bitDepth=${bitDepth} colorType=${colorType}`
    );
  }

  const inflated = inflateSync(Buffer.concat(chunks));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const pixels = Buffer.alloc(height * stride);

  let read = 0;
  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[read];
    read += 1;
    const scanline = inflated.subarray(read, read + stride);
    read += stride;
    const rowStart = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const left =
        x >= bytesPerPixel ? pixels[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[rowStart - stride + x] : 0;
      const upLeft =
        x >= bytesPerPixel && y > 0
          ? pixels[rowStart - stride + x - bytesPerPixel]
          : 0;
      pixels[rowStart + x] =
        (scanline[x] + unfilter(filterType, left, up, upLeft)) & 0xff;
    }
  }

  return { width, height, stride, pixels };
}

function unfilter(filterType, left, up, upLeft) {
  switch (filterType) {
    case 0:
      return 0;
    case 1:
      return left;
    case 2:
      return up;
    case 3:
      return Math.floor((left + up) / 2);
    case 4: {
      const estimate = left + up - upLeft;
      const dLeft = Math.abs(estimate - left);
      const dUp = Math.abs(estimate - up);
      const dUpLeft = Math.abs(estimate - upLeft);
      if (dLeft <= dUp && dLeft <= dUpLeft) return left;
      return dUp <= dUpLeft ? up : upLeft;
    }
    default:
      throw new Error(`unknown PNG filter ${filterType}`);
  }
}

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

const toLinear = (channel) => {
  const v = channel / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const toSrgb = (linear) => {
  const v =
    linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
};

function hueOf(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let hue;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

const saturationOf = (r, g, b) => {
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
};

const hexOf = (r, g, b) =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;

/** WCAG 2.1 relative luminance from an ARGB integer. */
function relativeLuminance(argb) {
  const r = toLinear((argb >> 16) & 0xff);
  const g = toLinear((argb >> 8) & 0xff);
  const b = toLinear(argb & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(argbA, argbB) {
  const a = relativeLuminance(argbA);
  const b = relativeLuminance(argbB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

const hexFromArgb = (argb) =>
  `#${((argb & 0xffffff) >>> 0).toString(16).padStart(6, "0")}`;

// ---------------------------------------------------------------------------
// Step 1 — measure the brand colours out of the logo
// ---------------------------------------------------------------------------

function measureLogoBrandColors() {
  const { width, height, stride, pixels } = decodePng(LOGO_PATH);
  const families = {
    purple: { window: PURPLE_HUE_WINDOW, r: 0, g: 0, b: 0, count: 0 },
    teal: { window: TEAL_HUE_WINDOW, r: 0, g: 0, b: 0, count: 0 },
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * stride + x * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const alpha = pixels[i + 3];
      // Opaque, actually coloured pixels only: drop the transparent margin,
      // the near-white paper and the near-grey antialiasing fringe.
      if (alpha < 250) continue;
      if (r > 235 && g > 235 && b > 235) continue;
      if (saturationOf(r, g, b) < 0.15) continue;

      const hue = hueOf(r, g, b);
      for (const family of Object.values(families)) {
        const [low, high] = family.window;
        if (hue < low || hue > high) continue;
        // Average in linear light: averaging gamma-encoded bytes darkens the result.
        family.r += toLinear(r);
        family.g += toLinear(g);
        family.b += toLinear(b);
        family.count += 1;
      }
    }
  }

  const centroid = (family) => {
    if (family.count === 0)
      throw new Error("no pixels matched a brand hue window");
    return {
      hex: hexOf(
        toSrgb(family.r / family.count),
        toSrgb(family.g / family.count),
        toSrgb(family.b / family.count)
      ),
      pixels: family.count,
    };
  };

  return {
    totalPixels: width * height,
    purple: centroid(families.purple),
    teal: centroid(families.teal),
  };
}

// ---------------------------------------------------------------------------
// Step 2 — build the MD3 core palettes
// ---------------------------------------------------------------------------

const argbFromHex = (hex) => (0xff000000 | parseInt(hex.slice(1), 16)) >>> 0;

function buildPalettes(primaryHex, tertiaryHex) {
  const primaryHct = Hct.fromInt(argbFromHex(primaryHex));
  const tertiaryHct = Hct.fromInt(argbFromHex(tertiaryHex));
  const hue = primaryHct.hue;

  return {
    meta: {
      primaryHct,
      tertiaryHct,
    },
    // MD3 CorePalette rules: the key colour drives primary, and secondary /
    // neutral / neutral-variant are the same hue held at fixed lower chromas.
    primary: TonalPalette.fromHueAndChroma(
      hue,
      Math.max(48, primaryHct.chroma)
    ),
    secondary: TonalPalette.fromHueAndChroma(hue, 16),
    // Default MD3 would put tertiary at hue+60/chroma 24. Luq's logo already
    // owns a second brand hue (the teal ears), so tertiary is seeded from that
    // measured hue instead — the analogous-hue default only exists because most
    // brands have nothing better to put there.
    tertiary: TonalPalette.fromHueAndChroma(
      tertiaryHct.hue,
      Math.max(24, tertiaryHct.chroma)
    ),
    neutral: TonalPalette.fromHueAndChroma(hue, 4),
    neutralVariant: TonalPalette.fromHueAndChroma(hue, 8),
    // MD3 fixes the error palette; it is not derived from the seed.
    error: TonalPalette.fromHueAndChroma(25, 84),
  };
}

// ---------------------------------------------------------------------------
// Step 3 — MD3 role -> [palette, lightTone, darkTone]
// ---------------------------------------------------------------------------

const ROLES = [
  ["primary", "primary", 40, 80],
  ["on-primary", "primary", 100, 20],
  ["primary-container", "primary", 90, 30],
  ["on-primary-container", "primary", 10, 90],
  ["inverse-primary", "primary", 80, 40],

  ["secondary", "secondary", 40, 80],
  ["on-secondary", "secondary", 100, 20],
  ["secondary-container", "secondary", 90, 30],
  ["on-secondary-container", "secondary", 10, 90],

  ["tertiary", "tertiary", 40, 80],
  ["on-tertiary", "tertiary", 100, 20],
  ["tertiary-container", "tertiary", 90, 30],
  ["on-tertiary-container", "tertiary", 10, 90],

  ["error", "error", 40, 80],
  ["on-error", "error", 100, 20],
  ["error-container", "error", 90, 30],
  ["on-error-container", "error", 10, 90],

  ["background", "neutral", 98, 6],
  ["on-background", "neutral", 10, 90],
  ["surface", "neutral", 98, 6],
  ["on-surface", "neutral", 10, 90],
  ["surface-variant", "neutralVariant", 90, 30],
  ["on-surface-variant", "neutralVariant", 30, 80],

  ["surface-dim", "neutral", 87, 6],
  ["surface-bright", "neutral", 98, 24],
  ["surface-container-lowest", "neutral", 100, 4],
  ["surface-container-low", "neutral", 96, 10],
  ["surface-container", "neutral", 94, 12],
  ["surface-container-high", "neutral", 92, 17],
  ["surface-container-highest", "neutral", 90, 22],

  ["outline", "neutralVariant", 50, 60],
  ["outline-variant", "neutralVariant", 80, 30],

  ["inverse-surface", "neutral", 20, 90],
  ["inverse-on-surface", "neutral", 95, 20],

  ["scrim", "neutral", 0, 0],
  ["shadow", "neutral", 0, 0],
];

/** Foreground/background pairs that must clear WCAG AA (4.5:1) in both schemes. */
const CONTRAST_PAIRS = [
  ["on-primary", "primary"],
  ["on-primary-container", "primary-container"],
  ["on-secondary", "secondary"],
  ["on-secondary-container", "secondary-container"],
  ["on-tertiary", "tertiary"],
  ["on-tertiary-container", "tertiary-container"],
  ["on-error", "error"],
  ["on-error-container", "error-container"],
  ["on-surface", "surface"],
  ["on-surface", "surface-container-lowest"],
  ["on-surface", "surface-container-low"],
  ["on-surface", "surface-container"],
  ["on-surface", "surface-container-high"],
  ["on-surface", "surface-container-highest"],
  ["on-surface-variant", "surface"],
  ["on-surface-variant", "surface-container-highest"],
  ["on-background", "background"],
  ["inverse-on-surface", "inverse-surface"],
  ["primary", "surface"],
  ["error", "surface"],
];

/** Non-text pairs: WCAG 2.1 non-text contrast minimum is 3:1. */
const NON_TEXT_PAIRS = [
  ["outline", "surface"],
  ["outline", "surface-container-highest"],
];

function resolveScheme(palettes, toneIndex) {
  const scheme = new Map();
  for (const [role, paletteName, lightTone, darkTone] of ROLES) {
    const tone = toneIndex === 0 ? lightTone : darkTone;
    scheme.set(role, palettes[paletteName].tone(tone));
  }
  return scheme;
}

function auditContrast(scheme, schemeName) {
  const rows = [];
  let failures = 0;
  const check = (pairs, minimum, kind) => {
    for (const [foreground, background] of pairs) {
      const ratio = contrastRatio(
        scheme.get(foreground),
        scheme.get(background)
      );
      const passed = ratio >= minimum;
      if (!passed) failures += 1;
      rows.push({
        schemeName,
        foreground,
        background,
        ratio,
        minimum,
        kind,
        passed,
      });
    }
  };
  check(CONTRAST_PAIRS, 4.5, "text");
  check(NON_TEXT_PAIRS, 3, "non-text");
  return { rows, failures };
}

// ---------------------------------------------------------------------------
// Step 4 — emit CSS
// ---------------------------------------------------------------------------

const TYPESCALE = [
  ["display-large", 57, 64, 400, -0.25],
  ["display-medium", 45, 52, 400, 0],
  ["display-small", 36, 44, 400, 0],
  ["headline-large", 32, 40, 400, 0],
  ["headline-medium", 28, 36, 400, 0],
  ["headline-small", 24, 32, 400, 0],
  ["title-large", 22, 28, 400, 0],
  ["title-medium", 16, 24, 500, 0.15],
  ["title-small", 14, 20, 500, 0.1],
  ["body-large", 16, 24, 400, 0.5],
  ["body-medium", 14, 20, 400, 0.25],
  ["body-small", 12, 16, 400, 0.4],
  ["label-large", 14, 20, 500, 0.1],
  ["label-medium", 12, 16, 500, 0.5],
  ["label-small", 11, 16, 500, 0.5],
];

const SHAPE = [
  ["none", "0px"],
  ["extra-small", "4px"],
  ["small", "8px"],
  ["medium", "12px"],
  ["large", "16px"],
  ["extra-large", "28px"],
  ["full", "9999px"],
];

/** MD3 elevation: a two-part shadow plus a surface-tint opacity, per level. */
const ELEVATION = [
  [0, "none", 0],
  [
    1,
    "0px 1px 2px 0px rgb(var(--md-sys-color-shadow-rgb) / 0.30), 0px 1px 3px 1px rgb(var(--md-sys-color-shadow-rgb) / 0.15)",
    5,
  ],
  [
    2,
    "0px 1px 2px 0px rgb(var(--md-sys-color-shadow-rgb) / 0.30), 0px 2px 6px 2px rgb(var(--md-sys-color-shadow-rgb) / 0.15)",
    8,
  ],
  [
    3,
    "0px 1px 3px 0px rgb(var(--md-sys-color-shadow-rgb) / 0.30), 0px 4px 8px 3px rgb(var(--md-sys-color-shadow-rgb) / 0.15)",
    11,
  ],
  [
    4,
    "0px 2px 3px 0px rgb(var(--md-sys-color-shadow-rgb) / 0.30), 0px 6px 10px 4px rgb(var(--md-sys-color-shadow-rgb) / 0.15)",
    12,
  ],
  [
    5,
    "0px 4px 4px 0px rgb(var(--md-sys-color-shadow-rgb) / 0.30), 0px 8px 12px 6px rgb(var(--md-sys-color-shadow-rgb) / 0.15)",
    14,
  ],
];

const EASING = [
  ["linear", "cubic-bezier(0, 0, 1, 1)"],
  ["standard", "cubic-bezier(0.2, 0, 0, 1)"],
  ["standard-accelerate", "cubic-bezier(0.3, 0, 1, 1)"],
  ["standard-decelerate", "cubic-bezier(0, 0, 0, 1)"],
  ["emphasized", "cubic-bezier(0.2, 0, 0, 1)"],
  ["emphasized-accelerate", "cubic-bezier(0.3, 0, 0.8, 0.15)"],
  ["emphasized-decelerate", "cubic-bezier(0.05, 0.7, 0.1, 1)"],
];

const DURATION = [
  ["short-1", 50],
  ["short-2", 100],
  ["short-3", 150],
  ["short-4", 200],
  ["medium-1", 250],
  ["medium-2", 300],
  ["medium-3", 350],
  ["medium-4", 400],
  ["long-1", 450],
  ["long-2", 500],
  ["long-3", 550],
  ["long-4", 600],
  ["extra-long-1", 700],
  ["extra-long-2", 800],
  ["extra-long-3", 900],
  ["extra-long-4", 1000],
];

const STATE_LAYER = [
  ["hover", "0.08"],
  ["focus", "0.10"],
  ["pressed", "0.10"],
  ["dragged", "0.16"],
];

/**
 * Syntax-highlighting colours.
 *
 * MD3 has no code-block spec. Code blocks stay dark in both schemes (they carry
 * a dark Prism theme and a light one would need a second token set), so the
 * surface is the neutral palette at tone 6 — the same value the dark scheme
 * uses for `surface` — and every token is tone 80, the tone MD3 pairs with a
 * tone-6 background. Hues are spread far enough apart to stay tellable apart;
 * generate() measures each one's contrast and fails the build below 4.5:1.
 */
const CODE_BACKGROUND_TONE = 6;
const CODE_TOKENS = [
  ["comment", 145, 12, 62],
  ["keyword", 285, 40, 80],
  ["string", 130, 40, 80],
  ["number", 95, 40, 80],
  ["function", 75, 44, 84],
  ["type", 195, 40, 80],
  ["property", 245, 36, 82],
  ["operator", 300, 6, 88],
  ["regex", 25, 40, 80],
];

const rgbTriplet = (argb) =>
  `${(argb >> 16) & 0xff} ${(argb >> 8) & 0xff} ${argb & 0xff}`;

function emitSchemeBlock(scheme, indent) {
  return ROLES.map(([role]) => {
    const argb = scheme.get(role);
    return `${indent}--md-sys-color-${role}-rgb: ${rgbTriplet(argb)};\n${indent}--md-sys-color-${role}: rgb(var(--md-sys-color-${role}-rgb));`;
  }).join("\n");
}

function emitPaletteBlock(palettes, indent) {
  const names = [
    "primary",
    "secondary",
    "tertiary",
    "neutral",
    "neutralVariant",
    "error",
  ];
  const cssName = { neutralVariant: "neutral-variant" };
  return names
    .map((name) => {
      const label = cssName[name] ?? name;
      return PALETTE_TONES.map(
        (tone) =>
          `${indent}--md-ref-palette-${label}-${tone}: ${hexFromArgb(palettes[name].tone(tone))};`
      ).join("\n");
    })
    .join("\n");
}

function generate() {
  const measured = measureLogoBrandColors();
  const palettes = buildPalettes(measured.purple.hex, measured.teal.hex);
  const light = resolveScheme(palettes, 0);
  const dark = resolveScheme(palettes, 1);

  const lightAudit = auditContrast(light, "light");
  const darkAudit = auditContrast(dark, "dark");

  const codeBackground = palettes.neutral.tone(CODE_BACKGROUND_TONE);
  const codeTokens = CODE_TOKENS.map(([name, hue, chroma, tone]) => {
    const argb = TonalPalette.fromHueAndChroma(hue, chroma).tone(tone);
    return { name, argb, ratio: contrastRatio(argb, codeBackground) };
  });
  const codeFailures = codeTokens.filter((token) => token.ratio < 4.5);
  const failures =
    lightAudit.failures + darkAudit.failures + codeFailures.length;

  const header = `/*
 * Material Design 3 design tokens for the Luq documentation site.
 *
 * GENERATED FILE — do not hand-edit. Regenerate with:
 *   npm i --no-save @material/material-color-utilities@0.4.0
 *   node scripts/generate-md3-tokens.mjs
 *
 * Seed colours, measured from public/img/library_image_cropped.png
 * (${measured.totalPixels} px total, opaque + saturated pixels only):
 *   primary seed  ${measured.purple.hex}  (${measured.purple.pixels} px, HCT ${palettes.meta.primaryHct.hue.toFixed(1)}/${palettes.meta.primaryHct.chroma.toFixed(1)}/${palettes.meta.primaryHct.tone.toFixed(1)})
 *   tertiary seed ${measured.teal.hex}  (${measured.teal.pixels} px, HCT ${palettes.meta.tertiaryHct.hue.toFixed(1)}/${palettes.meta.tertiaryHct.chroma.toFixed(1)}/${palettes.meta.tertiaryHct.tone.toFixed(1)})
 *
 * Tonal palettes produced by @material/material-color-utilities 0.4.0 (HCT /
 * CAM16). Role -> tone mapping is the published MD3 colour-role table.
 *
 * Measured contrast (WCAG 2.1), ${CONTRAST_PAIRS.length} text pairs + ${NON_TEXT_PAIRS.length} non-text pairs per scheme:
 *   light: min text ${Math.min(...lightAudit.rows.filter((r) => r.kind === "text").map((r) => r.ratio)).toFixed(2)}:1, min non-text ${Math.min(...lightAudit.rows.filter((r) => r.kind === "non-text").map((r) => r.ratio)).toFixed(2)}:1
 *   dark:  min text ${Math.min(...darkAudit.rows.filter((r) => r.kind === "text").map((r) => r.ratio)).toFixed(2)}:1, min non-text ${Math.min(...darkAudit.rows.filter((r) => r.kind === "non-text").map((r) => r.ratio)).toFixed(2)}:1
 *   code:  min ${Math.min(...codeTokens.map((t) => t.ratio)).toFixed(2)}:1 over ${hexFromArgb(codeBackground)}
 *   failures: ${failures}
 */`;

  const css = `${header}

/* ---------------------------------------------------------------------------
 * Reference tonal palettes
 * ------------------------------------------------------------------------ */
:root {
${emitPaletteBlock(palettes, "  ")}
}

/* ---------------------------------------------------------------------------
 * System colour roles — light scheme
 * ------------------------------------------------------------------------ */
:root {
${emitSchemeBlock(light, "  ")}
  --md-sys-color-surface-tint-rgb: var(--md-sys-color-primary-rgb);
  --md-sys-color-surface-tint: var(--md-sys-color-primary);
  color-scheme: light;
}

/* ---------------------------------------------------------------------------
 * System colour roles — dark scheme
 * ------------------------------------------------------------------------ */
.dark {
${emitSchemeBlock(dark, "  ")}
  --md-sys-color-surface-tint-rgb: var(--md-sys-color-primary-rgb);
  --md-sys-color-surface-tint: var(--md-sys-color-primary);
  color-scheme: dark;
}

/* ---------------------------------------------------------------------------
 * Shape, elevation, state, motion and type scales (scheme-independent)
 * ------------------------------------------------------------------------ */
:root {
${SHAPE.map(([name, value]) => `  --md-sys-shape-corner-${name}: ${value};`).join("\n")}

${ELEVATION.map(([level, shadow]) => `  --md-sys-elevation-level${level}: ${shadow};`).join("\n")}
${ELEVATION.map(([level, , tint]) => `  --md-sys-elevation-tint-level${level}: ${tint}%;`).join("\n")}

${STATE_LAYER.map(([name, value]) => `  --md-sys-state-${name}-opacity: ${value};`).join("\n")}

${EASING.map(([name, value]) => `  --md-sys-motion-easing-${name}: ${value};`).join("\n")}
${DURATION.map(([name, value]) => `  --md-sys-motion-duration-${name}: ${value}ms;`).join("\n")}

${TYPESCALE.map(
  ([name, size, lineHeight, weight, tracking]) =>
    `  --md-sys-typescale-${name}-size: ${size}px;\n  --md-sys-typescale-${name}-line-height: ${lineHeight}px;\n  --md-sys-typescale-${name}-weight: ${weight};\n  --md-sys-typescale-${name}-tracking: ${tracking}px;`
).join("\n")}
}

/* ---------------------------------------------------------------------------
 * Code-block palette (dark in both schemes; measured against the surface below)
 * ------------------------------------------------------------------------ */
:root {
  --md-code-surface: ${hexFromArgb(codeBackground)};
  --md-code-surface-container: ${hexFromArgb(palettes.neutral.tone(12))};
  --md-code-outline: ${hexFromArgb(palettes.neutralVariant.tone(30))};
  --md-code-on-surface: ${hexFromArgb(palettes.neutral.tone(90))};
  --md-code-on-surface-variant: ${hexFromArgb(palettes.neutralVariant.tone(80))};
${codeTokens
  .map(
    (token) =>
      `  --md-code-${token.name}: ${hexFromArgb(token.argb)}; /* ${token.ratio.toFixed(2)}:1 */`
  )
  .join("\n")}
}
`;

  writeFileSync(OUTPUT_PATH, css, "utf8");

  const paletteNames = {
    primary: "primary",
    secondary: "secondary",
    tertiary: "tertiary",
    neutral: "neutral",
    neutralVariant: "neutral-variant",
    error: "error",
  };
  const paletteJson = {
    seed: {
      primary: measured.purple.hex,
      tertiary: measured.teal.hex,
      measuredFrom: "public/img/library_image_cropped.png",
    },
    tones: Object.fromEntries(
      Object.entries(paletteNames).map(([key, label]) => [
        label,
        Object.fromEntries(
          PALETTE_TONES.map((tone) => [
            tone,
            hexFromArgb(palettes[key].tone(tone)),
          ])
        ),
      ])
    ),
  };
  writeFileSync(
    PALETTE_JSON_PATH,
    `${JSON.stringify(paletteJson, null, 2)}\n`,
    "utf8"
  );

  for (const row of [...lightAudit.rows, ...darkAudit.rows]) {
    if (!row.passed) {
      console.error(
        `FAIL ${row.schemeName} ${row.foreground} on ${row.background}: ${row.ratio.toFixed(2)}:1 < ${row.minimum}:1`
      );
    }
  }
  console.log(
    `primary seed  ${measured.purple.hex} (${measured.purple.pixels} px)`
  );
  console.log(
    `tertiary seed ${measured.teal.hex} (${measured.teal.pixels} px)`
  );
  console.log(
    `light: min text ${Math.min(...lightAudit.rows.filter((r) => r.kind === "text").map((r) => r.ratio)).toFixed(2)}:1`
  );
  console.log(
    `dark:  min text ${Math.min(...darkAudit.rows.filter((r) => r.kind === "text").map((r) => r.ratio)).toFixed(2)}:1`
  );
  for (const token of codeTokens) {
    console.log(
      `code   ${token.name.padEnd(9)} ${hexFromArgb(token.argb)} ${token.ratio.toFixed(2)}:1`
    );
  }
  console.log(`wrote ${OUTPUT_PATH} (${failures} contrast failures)`);
  if (failures > 0) process.exitCode = 1;
}

generate();
