import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';
import pkg from '../package.json' with { type: 'json' };

const gradientMarkers = ['linearGradient', 'radialGradient', 'stop-color'] as const;

function collectSvgFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectSvgFiles(fullPath);
    }
    if (entry.isFile() && entry.name.endsWith('.svg')) {
      return [fullPath];
    }
    return [];
  });
}

function findGradientMarkers(contents: string): string[] {
  return gradientMarkers.filter((marker) => contents.includes(marker));
}

describe('layerize source audit', () => {
  it('keeps no dead gradient fallback logic when the source corpus has no gradients', () => {
    const layerize = readFileSync(
      new URL('../scripts/layerize/layerize.ts', import.meta.url),
      'utf8',
    );
    const cacheSvgDir =
      pkg.twemoji === undefined
        ? null
        : fileURLToPath(new URL(`../.cache/twemoji/${pkg.twemoji.commit}/svg`, import.meta.url));
    const cachedGradientHits =
      cacheSvgDir && existsSync(cacheSvgDir)
        ? collectSvgFiles(cacheSvgDir)
            .flatMap((filePath) => {
              const hits = findGradientMarkers(readFileSync(filePath, 'utf8'));
              return hits.length > 0 ? [filePath + ':' + hits.join(',')] : [];
            })
            .slice(0, 5)
        : [];

    const localGradientHits = [
      fileURLToPath(new URL('../extras', import.meta.url)),
      fileURLToPath(new URL('../overrides', import.meta.url)),
    ]
      .flatMap((dirPath) => collectSvgFiles(dirPath))
      .flatMap((filePath) => {
        const hits = findGradientMarkers(readFileSync(filePath, 'utf8'));
        return hits.length > 0 ? [filePath + ':' + hits.join(',')] : [];
      })
      .slice(0, 5);

    expect(pkg.twemoji).toMatchObject({
      version: expect.any(String),
      commit: expect.stringMatching(/^[0-9a-f]{40}$/),
      source: expect.stringMatching(/\/v\/[0-9]+\.[0-9]+\.[0-9]+\/svg$/),
    });
    expect(cachedGradientHits).toEqual([]);
    expect(localGradientHits).toEqual([]);
    expect(layerize).not.toContain('type UrlColorMap');
    expect(layerize).not.toContain('function recordGradient');
    expect(layerize).not.toContain("=== 'linearGradient'");
    expect(layerize).not.toContain("['stop-color']");
    expect(layerize).not.toContain('urlColor[');
  });
});
