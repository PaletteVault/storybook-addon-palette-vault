/**
 * ============================================================================
 *  COLOUR MATHS
 * ============================================================================
 *
 *  Self-contained on purpose: the extension ships independently of the site,
 *  so it carries its own copy rather than importing across projects. Keep the
 *  two in sync when the naming or generation rules change.
 *
 *  Everything perceptual happens in OKLab/OKLCH. That matters twice over here:
 *  generated palettes stay balanced, and clustering colours out of an image
 *  puts the boundaries where a person would put them, which plain RGB distance
 *  does not.
 *
 *  Conversion matrices follow Björn Ottosson's Oklab definition.
 * ============================================================================
 */

/* ==========================================================================
 * sRGB ↔ linear
 * ========================================================================== */

export const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/* ==========================================================================
 * OKLab
 * ========================================================================== */

function oklabToLinearSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** r,g,b in 0..255 → OKLab triple. Used as the clustering space. */
export function rgbToOklab(r, g, b) {
  const lr = toLinear(r / 255);
  const lg = toLinear(g / 255);
  const lb = toLinear(b / 255);

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Squared distance in OKLab — perceptual difference, cheap to compute. */
export function oklabDistance(a, b) {
  const dl = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return dl * dl + da * da + db * db;
}

/* ==========================================================================
 * OKLCH → HEX, with gamut mapping
 * ========================================================================== */

const EPS = 1e-4;
const inGamut = ([r, g, b]) => r >= -EPS && r <= 1 + EPS && g >= -EPS && g <= 1 + EPS && b >= -EPS && b <= 1 + EPS;

function oklchToLinear(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  return oklabToLinearSrgb(L, C * Math.cos(h), C * Math.sin(h));
}

/**
 * Colours outside sRGB get their chroma reduced by binary search, keeping
 * lightness and hue. Clipping the channels instead would shift the hue and
 * hand back a visibly different colour.
 */
export function oklchToHex(L, C, hDeg) {
  let linear = oklchToLinear(L, C, hDeg);

  if (!inGamut(linear)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 18; i += 1) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(L, mid, hDeg))) lo = mid;
      else hi = mid;
    }
    linear = oklchToLinear(L, lo, hDeg);
  }

  return linear
    .map((channel) => {
      const value = Math.round(Math.min(1, Math.max(0, toGamma(channel))) * 255);
      return value.toString(16).padStart(2, '0');
    })
    .join('');
}

/** HEX → { L, C, h }, L in 0..1 and h in degrees. */
export function hexToOklch(hex) {
  const { r, g, b } = hexToRgb(hex);
  const [L, a, bb] = rgbToOklab(r, g, b);
  const C = Math.sqrt(a * a + bb * bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
}

/* ==========================================================================
 * Plain conversions
 * ========================================================================== */

export function normalizeHex(value) {
  const clean = String(value)
    .replace(/[^0-9a-fA-F]/g, '')
    .slice(0, 6)
    .toLowerCase();
  return clean.length === 6 ? clean : '888888';
}

export function hexToRgb(hex) {
  const clean = normalizeHex(hex);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

export const rgbToHex = (r, g, b) =>
  [r, g, b]
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

export function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;

  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (delta > 1e-6) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === rf) h = ((gf - bf) / delta + (gf < bf ? 6 : 0)) * 60;
    else if (max === gf) h = ((bf - rf) / delta + 2) * 60;
    else h = ((rf - gf) / delta + 4) * 60;
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/* ==========================================================================
 * Contrast
 * ========================================================================== */

export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * toLinear(r / 255) + 0.7152 * toLinear(g / 255) + 0.0722 * toLinear(b / 255);
}

/** Whether the colour needs light text on top of it. */
export const isDark = (hex) => luminance(hex) < 0.45;

/** WCAG contrast ratio, 1..21. */
export function contrastRatio(hexA, hexB) {
  const a = luminance(hexA);
  const b = luminance(hexB);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

/* ==========================================================================
 * Slug and naming — identical rules to the website, so a palette generated
 * here opens at the same address there.
 * ========================================================================== */

export const paletteSlug = (colors) => colors.map(normalizeHex).join('');

export function parseSlug(slug) {
  const clean = String(slug ?? '')
    .replace(/[^0-9a-fA-F]/g, '')
    .toLowerCase();
  if (clean.length !== 24) return null;
  return [0, 1, 2, 3].map((i) => clean.slice(i * 6, i * 6 + 6));
}

const HUE_NAMES = [
  [15, 'red'],
  [45, 'orange'],
  [68, 'yellow'],
  [100, 'lime'],
  [155, 'green'],
  [195, 'cyan'],
  [220, 'azure'],
  [255, 'blue'],
  [280, 'violet'],
  [310, 'purple'],
  [340, 'magenta'],
  [360, 'red'],
];

const NOUNS = {
  red: ['Ember', 'Poppy', 'Cherry', 'Brick', 'Garnet', 'Chili', 'Rust', 'Cardinal'],
  orange: ['Amber', 'Apricot', 'Clay', 'Marmalade', 'Copper', 'Tangerine', 'Ochre', 'Peach'],
  yellow: ['Honey', 'Straw', 'Mustard', 'Saffron', 'Butter', 'Wheat', 'Lemon', 'Brass'],
  lime: ['Fern', 'Olive', 'Sprout', 'Moss', 'Pear', 'Meadow', 'Chartreuse', 'Basil'],
  green: ['Pine', 'Jade', 'Clover', 'Forest', 'Sage', 'Emerald', 'Ivy', 'Juniper'],
  cyan: ['Lagoon', 'Mint', 'Teal', 'Reef', 'Aqua', 'Seafoam', 'Turquoise', 'Spray'],
  azure: ['Harbor', 'Sky', 'Glacier', 'Tide', 'Denim', 'Marine', 'Frost', 'Bay'],
  blue: ['Cobalt', 'Indigo', 'Sapphire', 'Ocean', 'Midnight', 'Ink', 'Steel', 'Horizon'],
  violet: ['Iris', 'Lilac', 'Amethyst', 'Dusk', 'Wisteria', 'Orchid', 'Thistle', 'Twilight'],
  purple: ['Plum', 'Mulberry', 'Velvet', 'Aubergine', 'Fig', 'Grape', 'Heather', 'Nightshade'],
  magenta: ['Fuchsia', 'Rose', 'Blossom', 'Peony', 'Raspberry', 'Petal', 'Camellia', 'Bloom'],
  neutral: ['Stone', 'Ash', 'Linen', 'Slate', 'Pebble', 'Smoke', 'Chalk', 'Granite'],
};

const ADJECTIVES = {
  pale: ['Pale', 'Soft', 'Powdered', 'Airy', 'Whispered', 'Faded', 'Hushed', 'Milky'],
  light: ['Light', 'Bright', 'Sunlit', 'Clear', 'Fresh', 'Open', 'Crisp', 'Morning'],
  vivid: ['Vivid', 'Electric', 'Bold', 'Loud', 'Neon', 'Punchy', 'Radiant', 'Hot'],
  muted: ['Muted', 'Dusty', 'Weathered', 'Quiet', 'Worn', 'Vintage', 'Washed', 'Softened'],
  deep: ['Deep', 'Rich', 'Dark', 'Shadowed', 'Late', 'Heavy', 'Velvet', 'Smoked'],
};

const hueFamily = (h) => HUE_NAMES.find(([limit]) => h < limit)?.[1] ?? 'red';

/** FNV-1a: same palette always gets the same name, different ones vary. */
function hash(text) {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

export function paletteName(colors) {
  if (!Array.isArray(colors) || colors.length !== 4) return 'Palette';

  const hsls = colors.map(hexToHsl);
  const avgL = hsls.reduce((sum, c) => sum + c.l, 0) / 4;
  const avgS = hsls.reduce((sum, c) => sum + c.s, 0) / 4;

  // Only visibly coloured swatches vote for the hue, weighted by saturation —
  // otherwise three greyish tones outvote the one accent that defines it.
  const votes = new Map();
  for (const { h, s, l } of hsls) {
    if (s < 12 || l < 6 || l > 96) continue;
    votes.set(hueFamily(h), (votes.get(hueFamily(h)) ?? 0) + s);
  }
  const dominant = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral';

  let mood;
  if (avgL >= 82) mood = 'pale';
  else if (avgS >= 72 && avgL >= 45) mood = 'vivid';
  else if (avgL <= 38) mood = 'deep';
  else if (avgS <= 34) mood = 'muted';
  else mood = 'light';

  const seed = hash(colors.join(''));
  const adjectives = ADJECTIVES[mood];
  const nouns = NOUNS[dominant] ?? NOUNS.neutral;

  // Separate bits of the hash, or the two words correlate and some pairs
  // become unreachable.
  return `${adjectives[seed % adjectives.length]} ${nouns[(seed >>> 8) % nouns.length]}`;
}

/* ==========================================================================
 * Export formats
 * ========================================================================== */

export const FORMATS = {
  hex: (colors) => colors.map((hex) => `#${hex.toUpperCase()}`).join(', '),
  rgb: (colors) =>
    colors
      .map((hex) => {
        const { r, g, b } = hexToRgb(hex);
        return `rgb(${r}, ${g}, ${b})`;
      })
      .join(', '),
  css: (colors) => `:root {\n${colors.map((hex, i) => `  --color-${i + 1}: #${hex};`).join('\n')}\n}`,
  array: (colors) => JSON.stringify(colors.map((hex) => `#${hex}`)),
};
