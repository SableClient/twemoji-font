import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vite-plus/test';
import pkg from '../package.json' with { type: 'json' };

describe('package output', () => {
  it('exposes the expected public package surface and pinned upstream source metadata', () => {
    expect(pkg.name).toBe('@sableclient/twemoji-font');
    expect(pkg.type).toBe('module');
    expect(pkg.files).toEqual(['dist']);
    expect(pkg.exports['.']).toBe('./dist/index.css');
    expect(pkg.exports['./font']).toBe('./dist/twemoji.woff2');
    expect('./metadata' in pkg.exports).toBe(false);
    expect(pkg.twemoji).toMatchObject({
      version: expect.any(String),
      commit: expect.stringMatching(/^[0-9a-f]{40}$/),
      source: expect.stringMatching(/\/v\/[0-9]+\.[0-9]+\.[0-9]+\/svg$/),
    });
  });

  it('generates the expected dist files', () => {
    expect(existsSync(new URL('../dist/twemoji.woff2', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../dist/index.css', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../dist/metadata.json', import.meta.url))).toBe(false);
  });
});
