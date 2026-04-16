import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vite-plus/test';

describe('build logging', () => {
  it('documents stage markers for long-running build steps', () => {
    const buildFont = readFileSync(new URL('../scripts/build-font.ts', import.meta.url), 'utf8');
    const buildPackage = readFileSync(
      new URL('../scripts/package/build-package.ts', import.meta.url),
      'utf8',
    );
    const layerize = readFileSync(
      new URL('../scripts/layerize/layerize.ts', import.meta.url),
      'utf8',
    );
    const webfontDriver = readFileSync(
      new URL('../scripts/font/fontforge-runner.ts', import.meta.url),
      'utf8',
    );

    expect(buildFont).toContain('[build:font]');
    expect(buildPackage).toContain('[build:package]');
    expect(layerize).toContain('[layerize]');
    expect(webfontDriver).toContain('[raw-font]');
  });
});
