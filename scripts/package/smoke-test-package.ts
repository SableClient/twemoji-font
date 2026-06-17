import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import pkg from '../../package.json' with { type: 'json' };
import {
  readFontTableSummary,
  resolveBuiltFontPath,
  resolvePackagedWoff2Path,
} from '../verify/font-table-summary.ts';

assert.equal('./metadata' in pkg.exports, false);
assert.equal('./font' in pkg.exports, false);
assert.equal(typeof pkg.twemoji.version, 'string');
assert.equal(typeof pkg.twemoji.commit, 'string');
assert.equal(typeof pkg.twemoji.source, 'string');
assert.equal(existsSync(new URL('../../dist/index.css', import.meta.url)), true);
assert.equal(existsSync(new URL('../../dist/files/twemoji.woff2', import.meta.url)), true);
assert.equal(existsSync(new URL('../../dist/twemoji.woff2', import.meta.url)), false);
assert.equal(existsSync(new URL('../../dist/metadata.json', import.meta.url)), false);

const indexCss = readFileSync(new URL('../../dist/index.css', import.meta.url), 'utf8');
assert.match(indexCss, /src: url\('\.\/files\/twemoji\.woff2'\) format\('woff2'\);/);
assert.match(indexCss, /unicode-range:/);
assert.match(indexCss, /U\+1F300-1FAF8/);
assert.equal(indexCss.includes('truetype'), false);

const builtFontSummary = readFontTableSummary(resolveBuiltFontPath());
if (builtFontSummary) {
  assert.ok(builtFontSummary.colrGlyphCount > 0, 'expected COLR glyphs in built TTF');
  assert.ok(builtFontSummary.cpalColorCount > 0, 'expected CPAL colors in built TTF');
  assert.ok(builtFontSummary.cmapCodepointCount > 0, 'expected cmap codepoints in built TTF');
  assert.equal(builtFontSummary.has1f979Colr, true, 'expected COLR entry for U+1F979');
}

const packagedFontSummary = readFontTableSummary(resolvePackagedWoff2Path());
if (packagedFontSummary) {
  assert.ok(packagedFontSummary.colrGlyphCount > 0, 'expected COLR glyphs in packaged WOFF2');
  assert.ok(packagedFontSummary.cpalColorCount > 0, 'expected CPAL colors in packaged WOFF2');
}
