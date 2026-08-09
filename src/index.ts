/**
 * The package entry.
 *
 * Exports the types a consumer might annotate a story with, and nothing at
 * runtime. Storybook loads the manager and preview through the `bundler`
 * entries in package.json rather than through this file, so importing the
 * addon in application code would be a mistake this keeps harmless.
 */

export { PARAM_KEY, ADDON_ID } from './constants';
export type { ScannedColor } from './scan';

/** Shape of `parameters.paletteVault` on a story. */
export interface PaletteVaultParameters {
  /**
   * Skip the scan for this story.
   *
   * Worth setting on stories that render nothing visual: an empty canvas
   * reports no colours, which reads as a broken panel rather than as an
   * intentionally empty component.
   */
  disable?: boolean;
}
