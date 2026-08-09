/**
 * ============================================================================
 *  THE PREVIEW SIDE
 * ============================================================================
 *
 *  Runs inside the story iframe, where the component actually exists. Scans
 *  after each render and sends the result to the panel over the channel.
 *
 *  WHY A DELAY BEFORE SCANNING
 *
 *  A story is not finished when the decorator returns. Fonts load, transitions
 *  settle, and a component that animates in reports its starting colours if
 *  read too early. One frame is not enough and a long wait makes the panel
 *  feel broken, so it scans twice: once immediately so something appears, and
 *  once after things settle, which is the reading that counts.
 * ============================================================================
 */

import type {
	Renderer,
	PartialStoryFn as StoryFunction,
	StoryContext,
} from 'storybook/internal/types';
import { useEffect, useChannel } from 'storybook/preview-api';

import { EVENT_REQUEST, EVENT_RESULT, PARAM_KEY } from './constants';
import { scanColors } from './scan';

const SETTLE_MS = 350;

export const withPaletteVault = (
	StoryFn: StoryFunction<Renderer>,
	context: StoryContext<Renderer>,
) => {
	const emit = useChannel({
		[EVENT_REQUEST]: () => report(),
	});

	const disabled = context.parameters?.[PARAM_KEY]?.disable === true;

	const report = () => {
		if (disabled) return;
		try {
			emit(EVENT_RESULT, { colors: scanColors(), storyId: context.id });
		} catch (error) {
			/*
			 * Reported rather than swallowed. A scan that throws leaves the
			 * panel showing the previous story's colours, which is worse than
			 * an empty panel because it is wrong rather than absent.
			 */
			emit(EVENT_RESULT, {
				colors: [],
				storyId: context.id,
				error: (error as Error).message,
			});
		}
	};

	useEffect(() => {
		if (disabled) return;

		report();
		const timer = setTimeout(report, SETTLE_MS);
		return () => clearTimeout(timer);
	}, [context.id, disabled]);

	return StoryFn();
};

export const decorators = [withPaletteVault];

export const initialGlobals = {};
