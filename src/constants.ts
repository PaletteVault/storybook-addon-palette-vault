/**
 * Shared identifiers.
 *
 * Kept in one file because the manager and the preview run in different
 * frames and talk over a channel keyed by these strings. A typo in one of them
 * produces an addon that builds, loads, and silently never receives anything,
 * which is the hardest failure in this architecture to diagnose.
 */

export const ADDON_ID = 'palette-vault';
export const PANEL_ID = `${ADDON_ID}/panel`;
export const PARAM_KEY = 'paletteVault';

/** Preview to manager: here are the colours this story renders. */
export const EVENT_RESULT = `${ADDON_ID}/result`;

/** Manager to preview: scan again, the user asked. */
export const EVENT_REQUEST = `${ADDON_ID}/request`;
