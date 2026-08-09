<p align="center">
  <img src="icon.png" width="96" height="96" alt="Palette Vault">
</p>

<h1 align="center">Palette Vault for Storybook</h1>

<p align="center">
  Shows which colors a story actually renders, ranked by how much of the
  component each one covers.
</p>

---

A component's colors arrive from tokens, inherited rules, a theme provider and
whatever the story overrode. Reading the stylesheet tells you what was
declared. This addon reads the computed styles of the rendered story and tells
you what arrived, which is a different answer exactly when somebody needs to
know.

The panel lists every color the story paints, with its share of the painted
area, its OKLCH value, and which CSS properties put it there. Click a swatch to
copy the hex.

## Install

```sh
npm install --save-dev storybook-addon-palette-vault
```

Then add it in `.storybook/main.ts`:

```ts
export default {
  addons: ['storybook-addon-palette-vault'],
};
```

Open any story and select the **Colors** panel. Requires Storybook 10 or later.

## What the percentages mean

Share of painted area, not a count of elements. Counting elements makes a one
pixel divider rank alongside a full-bleed panel, and the eye does not read them
that way.

Each property is measured by its own geometry:

| Property                | Weight                           | Counted when                              |
| ----------------------- | -------------------------------- | ----------------------------------------- |
| `background-color`      | box area                         | always                                    |
| `border-*-color`        | side length times thickness      | thickness above zero and style not `none` |
| `outline-color`         | ring times thickness             | same                                      |
| `color`                 | ink of the glyphs                | the element has text of its own           |
| `text-decoration-color` | text length times rule thickness | `text-decoration-line` is not `none`      |
| `fill` / `stroke`       | box area / ring times thickness  | the element is inside an SVG              |

Two of those conditions exist because of measured bugs rather than theory. A
button with no border still reports a border color, because the property
defaults to `currentColor`, and weighting all four sides by the full box put
white above the button's own blue at 84 per cent to 16. And `fill` is computed
for every element, not only SVG ones, defaulting to black, so an unguarded read
reports black on a page that has none.

Text is weighted by the ink of its glyphs rather than the box holding it,
because a paragraph inside a full width container does not color the container.
Only an element's own text nodes count, so a wrapper is not credited with
everything nested inside it.

The scan starts at `#storybook-root`. The preview frame's own background and
reset styles belong to Storybook, not to the component under inspection.

## The contrast line

Below the table, the panel reports the contrast between the surface the
component paints and the main text color on it.

It only does this when the component has a surface worth naming: a
`background-color` covering at least a quarter of the painted area. A component
with a transparent background has no surface of its own, and its contrast
depends on where it is placed, so the panel says that instead of inventing a
number. The Storybook `Header` and `Page` examples are both in that category.

## What this deliberately does not do

A full accessibility audit. Storybook's a11y addon already runs axe against the
rendered story and reports every contrast failure with the element that caused
it. A second, worse implementation of the same check would be noise beside it.

What is missing from that picture is the inventory: which colors a component
puts on screen at all, and whether they are the ones the design system meant.
That is what this fills in.

## Per-story options

```ts
export const Empty = {
  parameters: { paletteVault: { disable: true } },
};
```

Worth setting on stories that render nothing visual. An empty canvas reports no
colors, which reads as a broken panel rather than as an empty component.

## Known limitation

Percentages shift with the width of the preview. Border weight scales with the
width of the element while glyph ink does not, so a wide viewport gives borders
a larger share. The reading is correct at each width; it is just not comparable
across two of them.

## Links

- [Palette Vault](https://palettevault.github.io/) is the project this belongs to
- [Plugins for other tools](https://palettevault.github.io/plugins/), including
  Figma, Framer, VS Code, Chrome and Firefox

## License

MIT
