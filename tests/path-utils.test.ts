import { describe, expect, it } from 'vite-plus/test';
import { normalizeSvgForLayerize } from '../scripts/layerize/normalize-svg.ts';
import {
  ensureClosedPathForFontForge,
  normalizeLeadingMoveto,
  splitCompoundPathData,
} from '../scripts/layerize/path-utils.ts';

describe('path-utils', () => {
  it('splits compound paths at closepath + moveto boundaries', () => {
    const combined = [
      'M24.337 16.836c1.044-1.046 1.23-2.552.417-3.364-.813-.813-2.32-.625-3.363.42',
      '-1.045 1.046-1.231 2.552-.418 3.364.814.813 2.32.625 3.364-.42Z',
      'm3.288 2.845c.458-.459.54-1.12.183-1.477-.357-.357-1.019-.274-1.478.185',
      '-.458.459-.54 1.12-.183 1.477.357.357 1.019.275 1.478-.184Z',
      'M11.5 23a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z',
    ].join('');

    const segments = splitCompoundPathData(combined);

    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatch(/^M24\.337/);
    expect(segments[1]).toMatch(/^M27\.625/);
    expect(segments[2]).toMatch(/^M11\.5 23a5\.5/);
  });

  it('splits and absolutizes relative moveto subpaths inside one path', () => {
    const combined =
      'M25 20H11c-2.757 0-5 2.243-5 5s2.243 5 5 5h14c2.757 0 5-2.243 5-5s-2.243-5-5-5zm0 2c1.483 0 2.71 1.084 2.949 2.5H24.5V22h.5zm-1.5 0v2.5h-3V22h3z';

    const segments = splitCompoundPathData(combined);

    expect(segments.length).toBeGreaterThan(1);
    for (const segment of segments) {
      expect(segment).toMatch(/^M[-\d.]/);
    }
    expect(segments[2]).toContain('V22');
  });

  it('converts document-relative leading moveto to absolute', () => {
    expect(normalizeLeadingMoveto('m4.636 0l4.542.801L27.2.961')).toBe(
      'M4.636 0l4.542.801L27.2.961',
    );
    expect(normalizeLeadingMoveto('m13.995 13.645.324-.473s.708')).toBe(
      'M13.995 13.645l.324-.473s.708',
    );
  });

  it('does not split standalone uppercase moveto dashes in dotted-line paths', () => {
    const combined =
      'M18.079 35.949c-.789 0-1.571-.043-2.325-.129l.17-1.49c1.492.169 3.091.158 4.74-.04l.281 1.475-.096.015c-.945.113-1.874.169-2.77.169zm-7.281-1.399a16.756 16.756 0 0 1-4.378-2.68l.97-1.145a15.235 15.235 0 0 0 3.988 2.439l-.58 1.386zM.087 18.314a18.58 18.58 0 0 1 .553-5.086l1.454.367a17.067 17.067 0 0 0-.508 4.676l-1.499.043z';

    const segments = splitCompoundPathData(combined);

    expect(segments.length).toBeGreaterThan(1);
    expect(segments.some((segment) => segment.startsWith('M0.087 18.314'))).toBe(true);
    expect(segments.every((segment) => !/L-\d/.test(segment))).toBe(true);
  });

  it('leaves single-subpath data unchanged', () => {
    const pathData = 'M24.5 23a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z';
    expect(splitCompoundPathData(pathData)).toEqual([pathData]);
  });

  it('closes only unterminated paths for FontForge import', () => {
    expect(ensureClosedPathForFontForge('M0 0L10 0L10 10Z')).toBe('M0 0L10 0L10 10Z');
    expect(ensureClosedPathForFontForge('M0 0L10 0L10 10')).toBe('M0 0L10 0L10 10z');
  });
});

describe('normalize-svg', () => {
  it('keeps same-fill paths separate and converts ellipses to paths', () => {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">',
      '<path fill="#E95F28" d="M15.682 4.413l-4.542.801L8.8.961"/>',
      '<path fill="#E95F28" d="m4.636 0l4.542.801L27.2.961"/>',
      '<ellipse fill="#664500" cx="12" cy="13.5" rx="2.5" ry="3.5"/>',
      '</svg>',
    ].join('');

    const normalized = normalizeSvgForLayerize(svg, 'sample.svg');

    expect(normalized.match(/<path/g)?.length).toBe(3);
    expect(normalized).not.toContain('<ellipse');
    expect(normalized.match(/fill="#e95f28"/gi)?.length).toBe(2);
  });
});
