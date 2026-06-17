import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vite-plus/test';

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

describe('layerize 1f979 compound path handling', () => {
  it('keeps the left eye sclera in its own COLR layer', () => {
    const tempDir = makeTempDir();
    const sourceDir = join(tempDir, 'source');
    const overridesDir = join(tempDir, 'overrides');
    const extrasDir = join(tempDir, 'extras');
    const buildDir = join(tempDir, 'build');

    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(overridesDir, { recursive: true });
    mkdirSync(extrasDir, { recursive: true });

    writeFileSync(join(extrasDir, 'ligatures.json'), '[]\n');
    writeFileSync(
      join(sourceDir, '1f979.svg'),
      readFileSync(
        resolve('.cache/twemoji/40c2213f8f9bc53b1188fdae325a63a82ffb5bec/svg/1f979.svg'),
        'utf8',
      ),
    );

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

    const layerInfo = JSON.parse(readFileSync(join(buildDir, 'layer_info.json'), 'utf8')) as Record<
      string,
      string[]
    >;

    const layerSvgs = layerInfo['1f979'].map((layerName) =>
      readFileSync(join(buildDir, 'glyphs', `${layerName}.svg`), 'utf8'),
    );
    const pathData = layerSvgs.flatMap((svg) =>
      [...svg.matchAll(/\sd="([^"]+)"/g)].map((match) => match[1]),
    );

    expect(pathData.some((d) => /M11\.5 23a5\.5/i.test(d))).toBe(true);
    expect(pathData.every((d) => !(d.includes('M24.337') && /M11\.5 23a5\.5/i.test(d)))).toBe(true);
  });
});
