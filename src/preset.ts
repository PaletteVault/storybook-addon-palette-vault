/**
 * Node-side preset.
 *
 * This addon reads the rendered story in the browser and needs nothing from
 * the builder, so there is nothing to augment here. The file stays because
 * .storybook/local-preset.ts re-exports it; an addon published without a
 * development Storybook could delete both.
 */

export {};
