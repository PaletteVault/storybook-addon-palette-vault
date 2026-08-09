/**
 * Registers the panel with Storybook's manager.
 *
 * `paramKey` is what lets a story switch the addon off with
 * `parameters: { paletteVault: { disable: true } }`, which matters for stories
 * that render nothing visual: a scan of an empty canvas reports no colours and
 * reads as a broken panel rather than as an empty component.
 */

import React from 'react';
import { addons, types } from 'storybook/manager-api';

import { ADDON_ID, PANEL_ID, PARAM_KEY } from './constants';
import { Panel } from './Panel';

addons.register(ADDON_ID, () => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: 'Colors',
    match: ({ viewMode }) => viewMode === 'story',
    paramKey: PARAM_KEY,
    render: ({ active }) => <Panel active={Boolean(active)} />,
  });
});
