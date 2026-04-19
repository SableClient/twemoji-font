import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import pkg from '../../package.json' with { type: 'json' };

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
assert.equal(indexCss.includes('truetype'), false);
