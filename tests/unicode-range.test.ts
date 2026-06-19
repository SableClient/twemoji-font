import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vite-plus/test';
import {
  buildUnicodeRangeCssFromCodepointsFile,
  compressCodepointsToRanges,
  filterUnicodeRangeCodepoints,
  findUncoveredCodepoints,
  formatUnicodeRangeEntry,
  parseUnicodeRangeCss,
  readCodepointsFromBuildFile,
  resolveCodepointsPath,
} from '../scripts/package/unicode-range.ts';

describe('unicode-range generation', () => {
  it('compresses consecutive codepoints into ranges', () => {
    expect(compressCodepointsToRanges([0x2194, 0x2195, 0x2196, 0x2b1b, 0x2b1c])).toEqual([
      { start: 0x2194, end: 0x2196 },
      { start: 0x2b1b, end: 0x2b1c },
    ]);
    expect(formatUnicodeRangeEntry({ start: 0x203c, end: 0x203c })).toBe('U+203C');
    expect(formatUnicodeRangeEntry({ start: 0x0030, end: 0x0039 })).toBe('U+30-39');
  });

  it('parses unicode-range declarations from CSS', () => {
    const css = 'unicode-range: U+1F300-1FAF8, U+203C, U+30-39;';
    expect(parseUnicodeRangeCss(css)).toEqual([
      { start: 0x1f300, end: 0x1faf8 },
      { start: 0x203c, end: 0x203c },
      { start: 0x30, end: 0x39 },
    ]);
  });

  it('ignores font-internal null glyphs when building unicode-range', () => {
    expect(filterUnicodeRangeCodepoints([0x0000, 0x000d, 0x203c, 0x2049])).toEqual([
      0x203c, 0x2049,
    ]);
  });

  it('reads assigned codepoints from build/codepoints.js', () => {
    const codepointsFile = resolveCodepointsPath();
    if (!existsSync(codepointsFile)) {
      return;
    }

    const codepoints = filterUnicodeRangeCodepoints(readCodepointsFromBuildFile(codepointsFile));
    expect(codepoints).toContain(0x203c);
    expect(codepoints).toContain(0x2049);
    expect(codepoints).toContain(0x2b1b);
    expect(codepoints).not.toContain(0);
  });

  it('covers every assigned codepoint in the generated unicode-range', () => {
    const codepointsFile = resolveCodepointsPath();
    if (!existsSync(codepointsFile)) {
      return;
    }

    const codepoints = filterUnicodeRangeCodepoints(readCodepointsFromBuildFile(codepointsFile));
    const generatedCss = buildUnicodeRangeCssFromCodepointsFile(codepointsFile);
    const uncovered = findUncoveredCodepoints(codepoints, parseUnicodeRangeCss(generatedCss));

    expect(uncovered).toEqual([]);
  });

  it('covers every assigned codepoint in dist/index.css when present', () => {
    const codepointsFile = resolveCodepointsPath();
    const indexCssPath = new URL('../dist/index.css', import.meta.url);
    if (!existsSync(codepointsFile) || !existsSync(indexCssPath)) {
      return;
    }

    const codepoints = filterUnicodeRangeCodepoints(readCodepointsFromBuildFile(codepointsFile));
    const indexCss = readFileSync(indexCssPath, 'utf8');
    const uncovered = findUncoveredCodepoints(codepoints, parseUnicodeRangeCss(indexCss));

    expect(uncovered).toEqual([]);
  });
});
