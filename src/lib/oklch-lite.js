/**
 * Hex to OKLCH, and nothing else.
 *
 * The full oklch.js from the website carries gamut mapping for P3 and Rec2020,
 * a chroma search and a CSS colour parser. None of that is needed to print a
 * value in a panel, and an addon that ships it would put several kilobytes
 * into every Storybook that installs this for one line of output.
 *
 * Shares its constants with the rest of Palette Vault, so the numbers here
 * agree with the ones on the website.
 */

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export function hexToOklch(hex) {
  const clean = String(hex).replace(/[^0-9a-fA-F]/g, '').padEnd(6, '0').slice(0, 6);

  const r = toLinear(parseInt(clean.slice(0, 2), 16) / 255);
  const g = toLinear(parseInt(clean.slice(2, 4), 16) / 255);
  const b = toLinear(parseInt(clean.slice(4, 6), 16) / 255);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const C = Math.hypot(a, bb);
  const h = C < 1e-6 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;

  return { L, C, h };
}
