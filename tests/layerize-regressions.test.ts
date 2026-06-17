import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { readUpstreamSvgFixture } from './fixtures/upstream-svg.ts';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'twemoji-font-layerize-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function layerizeSingleGlyph(fileName: string): Record<string, string[]> {
  const tempDir = makeTempDir();
  const sourceDir = join(tempDir, 'source');
  const overridesDir = join(tempDir, 'overrides');
  const extrasDir = join(tempDir, 'extras');
  const buildDir = join(tempDir, 'build');

  mkdirSync(sourceDir, { recursive: true });
  mkdirSync(overridesDir, { recursive: true });
  mkdirSync(extrasDir, { recursive: true });

  writeFileSync(join(extrasDir, 'ligatures.json'), '[]\n');
  writeFileSync(join(sourceDir, `${fileName}.svg`), readUpstreamSvgFixture(fileName));

  execFileSync(
    process.execPath,
    [
      resolve('scripts/layerize/layerize.ts'),
      sourceDir,
      overridesDir,
      extrasDir,
      buildDir,
      'Test Font',
    ],
    { cwd: resolve('.'), stdio: 'pipe' },
  );

  return JSON.parse(readFileSync(join(buildDir, 'layer_info.json'), 'utf8')) as Record<
    string,
    string[]
  >;
}

describe('layerize regression glyphs', () => {
  it('keeps space invader eyes in the same purple COLR layer', () => {
    const layerInfo = layerizeSingleGlyph('1f47e');
    expect(layerInfo['1f47e']).toHaveLength(1);

    const tempDir = tempDirs[tempDirs.length - 1];
    const layerSvg = readFileSync(
      join(tempDir, 'build/glyphs', `${layerInfo['1f47e'][0]}.svg`),
      'utf8',
    );

    expect(layerSvg).toMatch(/M16 21h-4v-8h4/i);
    expect(layerSvg).toMatch(/M20 21v-8h4v8/i);
  });

  it('keeps orange peeking-hand paths out of absolute-coordinate garbage', () => {
    const layerInfo = layerizeSingleGlyph('1fae3');
    const tempDir = tempDirs[tempDirs.length - 1];
    const layerSvgs = layerInfo['1fae3'].map((layerName) =>
      readFileSync(join(tempDir, 'build/glyphs', `${layerName}.svg`), 'utf8'),
    );

    expect(layerSvgs.some((svg) => /M13\.995 13\.645l\.324/i.test(svg))).toBe(true);
    expect(layerSvgs.every((svg) => !/[^a-z]L\.844-5\.591/.test(svg))).toBe(true);
  });
});
