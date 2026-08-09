/**
 * ============================================================================
 *  COLOUR SPACE CONVERSIONS
 * ============================================================================
 *
 *  Everything a colour page states about one hex value, other than OKLCH,
 *  which lives in oklch.js and predates this file.
 *
 *  WHY THESE PARTICULAR SPACES
 *
 *  RGB and HSL are what people type. CMYK is what a printer asks for. CIE-Lab
 *  is what perceptual difference is measured in. XYZ and Yxy are the step
 *  everything else is derived through, so showing them makes the chain
 *  legible rather than magical. Hunter Lab is older than CIE-Lab and still
 *  quoted in paint and food industries, which is the only reason it is here.
 *
 *  WHITE POINT AND WHY IT IS STATED
 *
 *  A Lab value is meaningless without saying which white it was measured
 *  against. This module uses **D65, the two degree observer**, because that is
 *  what sRGB itself is defined against, so converting an sRGB colour to Lab
 *  under D50 would silently mix two references.
 *
 *  Published tables elsewhere on the web often use D50, and the numbers differ
 *  by a visible amount, so anyone comparing this page against another and
 *  finding a mismatch is not looking at a bug. That is worth stating on the
 *  page itself rather than leaving as a surprise.
 * ============================================================================
 */

import { hexToRgb } from './palette.js';

/** D65, two degree observer. The white sRGB is defined against. */
export const WHITE_POINT = { X: 95.047, Y: 100.0, Z: 108.883 };

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/* ------------------------------------------------------------------ CMYK -- */

/**
 * The naive four colour conversion, which is what every hex tool reports.
 *
 * Deliberately not a colour managed one. Real CMYK depends on the press, the
 * paper and the ink set, and no formula can know those. A page that printed a
 * profiled number would be claiming an accuracy it cannot have, so this is the
 * plain arithmetic conversion and the page says as much.
 *
 * @returns {{c: number, m: number, y: number, k: number}} each 0 to 1
 */
export function rgbToCmyk(r, g, b) {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;

  const k = 1 - Math.max(R, G, B);

  // Pure black would divide by zero, and its CMY are all zero by definition.
  if (k === 1) return { c: 0, m: 0, y: 0, k: 1 };

  return {
    c: (1 - R - k) / (1 - k),
    m: (1 - G - k) / (1 - k),
    y: (1 - B - k) / (1 - k),
    k,
  };
}

export const hexToCmyk = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return rgbToCmyk(r, g, b);
};

/* ------------------------------------------------------------------- XYZ -- */

/** sRGB companding, undone. The 2.4 exponent is not a plain gamma of 2.2. */
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/**
 * sRGB to CIE XYZ, scaled 0 to 100 as the published tables print it.
 *
 * The matrix is the sRGB primaries under D65. Using the D50 matrix here, as
 * some references do, shifts every downstream Lab value.
 */
export function rgbToXyz(r, g, b) {
  const R = toLinear(r / 255) * 100;
  const G = toLinear(g / 255) * 100;
  const B = toLinear(b / 255) * 100;

  return {
    X: R * 0.4124564 + G * 0.3575761 + B * 0.1804375,
    Y: R * 0.2126729 + G * 0.7151522 + B * 0.072175,
    Z: R * 0.0193339 + G * 0.119192 + B * 0.9503041,
  };
}

export const hexToXyz = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return rgbToXyz(r, g, b);
};

/* ------------------------------------------------------------------- Yxy -- */

/**
 * XYZ as luminance plus a pair of chromaticity coordinates.
 *
 * Y is carried through unchanged; x and y say where the colour sits on the
 * horseshoe diagram regardless of how bright it is.
 */
export function xyzToYxy({ X, Y, Z }) {
  const sum = X + Y + Z;
  // Absolute black has no chromaticity. Reporting 0,0 is conventional and
  // avoids dividing by zero.
  if (sum === 0) return { Y: 0, x: 0, y: 0 };
  return { Y, x: X / sum, y: Y / sum };
}

export const hexToYxy = (hex) => xyzToYxy(hexToXyz(hex));

/* --------------------------------------------------------------- CIE-Lab -- */

const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 24389 / 27;

const labF = (t) => (t > LAB_EPSILON ? Math.cbrt(t) : (LAB_KAPPA * t + 16) / 116);

/**
 * XYZ to CIE-Lab, under the white point declared at the top of this file.
 *
 * L runs 0 to 100. `a` is green to red, `b` is blue to yellow, both roughly
 * plus or minus 128 but not bounded in principle.
 */
export function xyzToLab({ X, Y, Z }) {
  const fx = labF(X / WHITE_POINT.X);
  const fy = labF(Y / WHITE_POINT.Y);
  const fz = labF(Z / WHITE_POINT.Z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export const hexToLab = (hex) => xyzToLab(hexToXyz(hex));

/* ------------------------------------------------------------ Hunter Lab -- */

/**
 * Hunter Lab, which predates CIE-Lab and is not the same thing.
 *
 * Included because paint, plastics and food colour specifications still quote
 * it, and because a page showing CIE-Lab alone invites the reader to assume
 * any "Lab" number they hold is comparable. It is not: the two use different
 * formulas and give different numbers for the same colour.
 *
 * THIS IS THE HISTORICAL FORM, AND THAT IS DELIBERATE
 *
 * The constants below are Hunter's originals, which assume illuminant C. A
 * modern restatement rescales them to whatever white point is in use, and
 * under D65 it produces visibly different numbers: for #E38B2A it gives
 * a = 24.83, b = 32.60 where every published table says 21.29 and 34.61.
 *
 * The modern form is arguably more correct and is certainly more consistent
 * with the D65 values above it. It is not what anyone comparing this page
 * against a paint specification will have in their hand, and a number that
 * disagrees with every other table is useless however well founded it is. So
 * the page carries the conventional value and says which illuminant it
 * assumes, rather than being quietly right and practically wrong.
 */
export const HUNTER_ILLUMINANT = 'C';

export function xyzToHunterLab({ X, Y, Z }) {
  if (Y <= 0) return { L: 0, a: 0, b: 0 };

  const root = Math.sqrt(Y);

  return {
    L: 10 * root,
    a: (17.5 * (1.02 * X - Y)) / root,
    b: (7.0 * (Y - 0.847 * Z)) / root,
  };
}

export const hexToHunterLab = (hex) => xyzToHunterLab(hexToXyz(hex));

/* -------------------------------------------------------- base notations -- */

const pad = (value, radix, width) => value.toString(radix).padStart(width, '0').toUpperCase();

/**
 * One channel written four ways.
 *
 * Binary is padded to eight places because a channel is a byte, and an
 * unpadded 101010 hides that fact.
 */
export function channelBases(value) {
  return {
    binary: pad(value, 2, 8),
    octal: value.toString(8),
    decimal: String(value),
    hex: pad(value, 16, 2),
  };
}

export function hexToBases(hex) {
  const { r, g, b } = hexToRgb(hex);
  return { red: channelBases(r), green: channelBases(g), blue: channelBases(b) };
}

/* ---------------------------------------------------------- web safe 216 -- */

/** The six levels each channel may take in the 216 colour palette. */
export const WEB_SAFE_LEVELS = [0x00, 0x33, 0x66, 0x99, 0xcc, 0xff];

const snap = (value) =>
  WEB_SAFE_LEVELS.reduce((best, level) =>
    Math.abs(level - value) < Math.abs(best - value) ? level : best,
  );

/**
 * The nearest of the 216 web safe colours.
 *
 * Snapped per channel rather than by perceptual distance, which is how the
 * palette was always defined and how every other tool reports it. A
 * perceptual nearest would be a different, defensible answer, and quietly
 * giving it would make this page disagree with every other one for no visible
 * reason.
 */
export function toWebSafe(hex) {
  const { r, g, b } = hexToRgb(hex);
  return [snap(r), snap(g), snap(b)]
    .map((value) => pad(value, 16, 2).toLowerCase())
    .join('');
}

/** All 216, in the conventional order: red outermost, blue innermost. */
export function webSafePalette() {
  const out = [];
  for (const r of WEB_SAFE_LEVELS) {
    for (const g of WEB_SAFE_LEVELS) {
      for (const b of WEB_SAFE_LEVELS) {
        out.push([r, g, b].map((v) => pad(v, 16, 2).toLowerCase()).join(''));
      }
    }
  }
  return out;
}

/* --------------------------------------------------------------- summary -- */

/**
 * Which primary a colour leans on, for the one prose sentence about it.
 *
 * Returns null when two channels are within a few points of each other,
 * because "mainly red" about a colour that is equally red and green is worse
 * than saying nothing.
 */
export function dominantChannel(hex) {
  const { r, g, b } = hexToRgb(hex);
  const sorted = [
    ['red', r],
    ['green', g],
    ['blue', b],
  ].sort((a, z) => z[1] - a[1]);

  const [top, second] = sorted;
  if (top[1] - second[1] < 12) return null;
  return top[0];
}

/** Channel shares as percentages of the total, which is what the bars show. */
export function rgbShares(hex) {
  const { r, g, b } = hexToRgb(hex);
  const total = r + g + b;
  if (total === 0) return { red: 0, green: 0, blue: 0 };
  return {
    red: (r / total) * 100,
    green: (g / total) * 100,
    blue: (b / total) * 100,
  };
}

/* ---------------------------------------------------------- how far apart -- */

/**
 * Distance between two colours in OKLab, where 1 spans the whole space.
 *
 * Used to decide whether a colour on a reference list is close enough to a
 * catalogue colour to link there. `nearestColor` answers "which is closest",
 * which is not the same question: on a list of 216 against a catalogue of 95
 * it found a nearest for 215 of them, and the worst pair was 0.204 apart, a
 * muted rose linking to a deep wine red. Nearest is not near.
 *
 * @see LINKABLE for the threshold and why it sits where it does
 */
export function perceptualDistance(hexA, hexB) {
  const toLab = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    const R = toLinear(r / 255);
    const G = toLinear(g / 255);
    const B = toLinear(b / 255);

    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);

    return {
      L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    };
  };

  const A = toLab(hexA);
  const B = toLab(hexB);
  return Math.hypot(A.L - B.L, A.a - B.a, A.b - B.b);
}

/**
 * How close two colours must be before one may link to the other.
 *
 * Measured rather than picked. Across the 216 web safe colours the median
 * distance to the nearest catalogue colour is 0.067 and the worst is 0.204;
 * across the CSS keywords the median is 0.039. A cut at 0.10 keeps 176 of the
 * 216 and 125 of the 141, and every pair it drops was one a reader would have
 * called a different colour.
 */
export const LINKABLE = 0.1;

export { clamp };
