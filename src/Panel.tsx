/**
 * ============================================================================
 *  THE PANEL
 * ============================================================================
 *
 *  Shows the colours the selected story renders, ranked by how much of it they
 *  cover, with their OKLCH values and the contrast between the two that matter
 *  most.
 *
 *  WHAT THIS DELIBERATELY DOES NOT DO
 *
 *  A full accessibility audit. Storybook's a11y addon already runs axe against
 *  the rendered story and reports every contrast failure with the element that
 *  caused it, and a second, worse implementation of the same check would just
 *  be noise beside it. What is missing from that picture is the inventory:
 *  which colours a component puts on screen at all, and whether they are the
 *  ones the design system meant.
 * ============================================================================
 */

import React, { useState } from 'react';
import { useChannel } from 'storybook/manager-api';
import { AddonPanel, Placeholder, Button } from 'storybook/internal/components';

import { EVENT_REQUEST, EVENT_RESULT } from './constants';
// @ts-expect-error plain JS shared with every other Palette Vault surface
import { hexToOklch } from './lib/oklch-lite.js';
// @ts-expect-error plain JS
import { contrastRatio, isDark } from './lib/color.js';

interface ScannedColor {
  hex: string;
  weight: number;
  sources: string[];
}

interface Result {
  colors: ScannedColor[];
  storyId: string;
  error?: string;
}

const clean = (hex: string) => `#${hex.toUpperCase()}`;

export const Panel: React.FC<{ active: boolean }> = ({ active }) => {
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const emit = useChannel({
    [EVENT_RESULT]: (payload: Result) => setResult(payload),
  });

  if (!active) return null;

  const colors = result?.colors ?? [];
  const total = colors.reduce((sum, entry) => sum + entry.weight, 0) || 1;

  const copy = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(clean(hex));
      setCopied(hex);
      setTimeout(() => setCopied(null), 700);
    } catch {
      /* Clipboard refused, not worth interrupting anybody over. */
    }
  };

  /*
   * The pair worth reporting: the surface the component actually paints,
   * against the text colour it puts on top. Every pair would be a matrix
   * nobody reads, and the a11y addon already covers the exhaustive case.
   *
   * The first version took the top row of the table as the background, which
   * on the Storybook Header and Page stories picked #333333, a text colour,
   * and reported its contrast against another text colour. A component whose
   * background is transparent has no surface of its own to measure, and
   * saying so is more use than a confident number about a pair that never
   * appears together on screen.
   */
  const surface = colors.find((entry) => entry.sources.includes('background-color'));
  const text = colors.find((entry) => entry.sources.includes('color'));

  /*
   * A surface only speaks for the component if it covers a fair share of it.
   * The Sign up button on the Page story is a background-color at 8 per cent,
   * and pairing it with the body text colour would describe a combination
   * nobody can see.
   */
  const DOMINANT = 0.25;
  const dominant = surface != null && surface.weight / total >= DOMINANT;

  const ratio =
    dominant && surface && text && surface !== text ? (contrastRatio(surface.hex, text.hex) as number) : null;

  return (
    <AddonPanel active={active}>
      <div style={{ padding: 15 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <strong>Colors in this story</strong>
          {/*
           * ariaLabel={false} declares "this button reads fine from its own
           * text", which is what Storybook 11 will require of every button.
           * Passing a real label instead would make a screen reader say the
           * word twice.
           */}
          <Button size="small" ariaLabel={false} onClick={() => emit(EVENT_REQUEST)}>
            Rescan
          </Button>
        </div>

        {result?.error && <Placeholder>Could not read the story: {result.error}</Placeholder>}

        {!result && <Placeholder>Select a story to see its colors.</Placeholder>}

        {result && !result.error && colors.length === 0 && (
          <Placeholder>
            This story renders no colors of its own. Everything it shows is inherited or transparent.
          </Placeholder>
        )}

        {colors.length > 0 && (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {colors.slice(0, 12).map((entry) => {
                  const oklch = hexToOklch(entry.hex);
                  const share = (entry.weight / total) * 100;

                  return (
                    <tr key={entry.hex}>
                      <td style={{ padding: '4px 8px 4px 0', width: 46 }}>
                        <button
                          type="button"
                          onClick={() => copy(entry.hex)}
                          title={`Copy ${clean(entry.hex)}`}
                          style={{
                            width: 38,
                            height: 26,
                            border: '1px solid rgba(0,0,0,.15)',
                            borderRadius: 4,
                            background: clean(entry.hex),
                            color: isDark(entry.hex) ? '#fff' : '#000',
                            cursor: 'pointer',
                            fontSize: 9,
                          }}
                        >
                          {copied === entry.hex ? 'ok' : ''}
                        </button>
                      </td>
                      <td style={{ padding: '4px 8px 4px 0', fontFamily: 'monospace' }}>{clean(entry.hex)}</td>
                      <td
                        style={{
                          padding: '4px 8px 4px 0',
                          fontFamily: 'monospace',
                          opacity: 0.75,
                        }}
                      >
                        oklch({(oklch.L * 100).toFixed(1)}% {oklch.C.toFixed(3)} {oklch.h.toFixed(1)})
                      </td>
                      <td style={{ padding: '4px 8px 4px 0', opacity: 0.75 }}>
                        {share < 1 ? '<1' : share.toFixed(0)}%
                      </td>
                      <td style={{ padding: '4px 0', opacity: 0.6, fontSize: 11 }}>{entry.sources.join(', ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {ratio != null && surface && text && (
              <p style={{ marginTop: 14, opacity: 0.8 }}>
                The surface this component paints is {clean(surface.hex)} and the main text color on it is{' '}
                {clean(text.hex)}, measuring <strong>{ratio.toFixed(2)}:1</strong>.{' '}
                {ratio >= 4.5
                  ? 'That clears AA for body text.'
                  : ratio >= 3
                    ? 'That clears AA for large text only, not for body text.'
                    : 'That fails every WCAG threshold.'}
              </p>
            )}

            {ratio == null && (
              <p style={{ marginTop: 14, opacity: 0.8 }}>
                This component paints no background of its own, so its contrast depends on wherever it is placed. The
                a11y addon checks each element against the surface it actually sits on.
              </p>
            )}

            <p style={{ marginTop: 10, opacity: 0.6, fontSize: 11 }}>
              Percentages are share of painted area, so a full-width surface outranks a hairline border. Text colors are
              weighted by the ink of the glyphs rather than the box around them.
            </p>
          </>
        )}
      </div>
    </AddonPanel>
  );
};
