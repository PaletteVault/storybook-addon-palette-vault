/**
 * ============================================================================
 *  WHAT COLOURS DOES THIS STORY ACTUALLY RENDER
 * ============================================================================
 *
 *  Reads computed styles out of the rendered story and returns the colours it
 *  puts on screen, ranked by how much of the component each one covers.
 *
 *  WHY COMPUTED STYLES AND NOT THE SOURCE
 *
 *  A component's colours come from tokens, inherited rules, a theme provider
 *  and whatever the story overrode. Reading the stylesheet tells you what was
 *  declared; reading the computed style tells you what arrived. Those differ
 *  exactly when somebody most wants to know.
 *
 *  WHY EVERY PROPERTY IS MEASURED SEPARATELY
 *
 *  The first version of this file weighted every property by the element's box
 *  and got the Storybook example button backwards: white 84 per cent, blue 16.
 *  The button has no border and no outline, but `getComputedStyle` still
 *  returns a colour for all five, because they default to `currentColor`. Five
 *  invisible layers at full box area beat one real background five to one, and
 *  the measured split was 5.25 to 1, which is that and nothing else.
 *
 *  So a colour now only counts if the thing carrying it is painted, and it is
 *  weighted by the geometry of that thing: a border by its own thickness, an
 *  outline by its ring, text by the ink of its glyphs.
 * ============================================================================
 */

export interface ScannedColor {
	hex: string;
	weight: number;
	/** Which properties contributed, for the panel to explain a surprise. */
	sources: string[];
}

/** Properties worth reading. Shadows and gradients are handled separately. */
const PROPERTIES = [
	'color',
	'background-color',
	'border-top-color',
	'border-right-color',
	'border-bottom-color',
	'border-left-color',
	'outline-color',
	'text-decoration-color',
	'fill',
	'stroke',
] as const;

type Property = (typeof PROPERTIES)[number];

const TRANSPARENT = /^rgba?\([^)]*,\s*0(\.0+)?\s*\)$/;

/** Where Storybook mounts the story. Falls back to the body. */
const STORY_ROOT = '#storybook-root, #root';

/**
 * A CSS colour string as six hex digits, or null.
 *
 * Deliberately strict. The shared normalizeHex scrapes hex digits out of
 * anything it is handed, which turns `rgb(179, 13, 13)` into a colour that
 * appears nowhere on screen. Reading somebody else's document is exactly where
 * a lenient parser does damage.
 */
function parse(value: string): string | null {
	if (!value) return null;
	const text = value.trim().toLowerCase();

	if (text === 'transparent' || text === 'none' || TRANSPARENT.test(text)) {
		return null;
	}

	/*
	 * Every capture is read as possibly absent, because the template compiles
	 * with `noUncheckedIndexedAccess`. A regex that matched does have its
	 * groups, but the compiler cannot know that, and writing the check is
	 * cheaper than arguing with it or turning the flag off for one function.
	 */
	const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(text);
	if (rgb) {
		const channels = [rgb[1], rgb[2], rgb[3]];
		if (channels.some((channel) => channel === undefined)) return null;

		return channels
			.map((channel) => Math.max(0, Math.min(255, Math.round(Number(channel)))))
			.map((channel) => channel.toString(16).padStart(2, '0'))
			.join('');
	}

	const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text);
	const body = hex?.[1];
	if (body) {
		return body.length === 3
			? body
					.split('')
					.map((c) => c + c)
					.join('')
			: body;
	}

	return null;
}

/**
 * Characters this element paints itself.
 *
 * `textContent` includes every descendant, so a wrapper would be credited with
 * the text of everything inside it and the same glyphs would be counted once
 * per level of nesting. Only direct text nodes are actually coloured by this
 * element's own `color`.
 */
function ownText(element: Element): number {
	let count = 0;
	for (const node of element.childNodes) {
		if (node.nodeType === Node.TEXT_NODE) {
			count += (node.textContent ?? '').trim().length;
		}
	}
	return count;
}

/** Ink of the glyphs, not the box holding them. */
function inkOf(element: Element, style: CSSStyleDeclaration, box: number): number {
	const chars = ownText(element);
	if (!chars) return 0;
	const size = parseFloat(style.fontSize) || 16;
	// Half the em square is roughly the ink of a glyph at typical weights.
	return Math.min(box, chars * size * size * 0.5);
}

/** One side of a border: its length times its thickness, or nothing if unpainted. */
function edge(lineStyle: string, width: string, length: number): number {
	const thickness = parseFloat(width) || 0;
	if (!thickness || lineStyle === 'none' || lineStyle === 'hidden') return 0;
	return length * thickness;
}

/**
 * How much of the component this property on this element accounts for.
 *
 * Returns 0 for anything that carries a colour without painting it, which is
 * most of what `getComputedStyle` hands back.
 */
function weigh(
	property: Property,
	element: Element,
	style: CSSStyleDeclaration,
	rect: DOMRect,
): number {
	const { width: w, height: h } = rect;
	const box = w * h;
	const ring = 2 * (w + h);

	switch (property) {
		case 'background-color':
			return box;

		case 'color':
			return inkOf(element, style, box);

		case 'text-decoration-color': {
			if (style.textDecorationLine === 'none') return 0;
			const chars = ownText(element);
			if (!chars) return 0;
			const size = parseFloat(style.fontSize) || 16;
			// A rule is about a sixteenth of an em thick and as long as the text.
			return chars * size * 0.5 * (size / 16);
		}

		case 'border-top-color':
			return edge(style.borderTopStyle, style.borderTopWidth, w);
		case 'border-bottom-color':
			return edge(style.borderBottomStyle, style.borderBottomWidth, w);
		case 'border-left-color':
			return edge(style.borderLeftStyle, style.borderLeftWidth, h);
		case 'border-right-color':
			return edge(style.borderRightStyle, style.borderRightWidth, h);

		case 'outline-color': {
			const thickness = parseFloat(style.outlineWidth) || 0;
			if (!thickness || style.outlineStyle === 'none') return 0;
			return ring * thickness;
		}

		/*
		 * `fill` and `stroke` are computed for every element, not just SVG ones,
		 * and default to black. Reading them off a div would report black on a
		 * page that has none. The <svg> wrapper is skipped too: it carries the
		 * property but paints nothing, its children do.
		 */
		case 'fill': {
			if (!(element instanceof SVGElement)) return 0;
			if (element.tagName.toLowerCase() === 'svg') return 0;
			return box;
		}

		case 'stroke': {
			if (!(element instanceof SVGElement)) return 0;
			if (element.tagName.toLowerCase() === 'svg') return 0;
			const thickness = parseFloat(style.strokeWidth) || 0;
			if (!thickness) return 0;
			return ring * thickness;
		}
	}
}

export function scanColors(root?: ParentNode): ScannedColor[] {
	/*
	 * Prefer the story's own mount point. Scanning the body would fold in the
	 * preview iframe's own background and reset styles, which belong to
	 * Storybook rather than to the component being inspected.
	 */
	const target = root ?? document.querySelector(STORY_ROOT) ?? document.body;

	const tally = new Map<string, { weight: number; sources: Set<string> }>();

	const elements = [target, ...target.querySelectorAll('*')].filter(
		(node): node is Element => node instanceof Element,
	);

	for (const element of elements) {
		// Storybook injects its own furniture into the preview frame. Counting
		// it would report the frame's colours as the component's.
		if (element.closest('[data-storybook-ignore]')) continue;

		const style = getComputedStyle(element);
		if (style.display === 'none' || style.visibility === 'hidden') continue;
		if (Number(style.opacity) === 0) continue;

		const rect = element.getBoundingClientRect();
		if (!rect.width || !rect.height) continue;

		for (const property of PROPERTIES) {
			const weight = weigh(property, element, style, rect);
			if (!weight) continue;

			const hex = parse(style.getPropertyValue(property));
			if (!hex) continue;

			const entry = tally.get(hex) ?? { weight: 0, sources: new Set<string>() };
			entry.weight += weight;
			entry.sources.add(property);
			tally.set(hex, entry);
		}
	}

	return [...tally.entries()]
		.map(([hex, { weight, sources }]) => ({
			hex,
			weight,
			sources: [...sources],
		}))
		.sort((a, b) => b.weight - a.weight);
}
