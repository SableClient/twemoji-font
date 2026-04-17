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

describe('layerize svg normalization', () => {
  it('keeps overlapping same-color paths split even when path data starts with whitespace', () => {
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
      join(sourceDir, '1f600.svg'),
      [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">',
        '  <path fill="#f00" d=" M 2 2 H 22 V 22 H 2 Z"/>',
        '  <path fill="#f00" d="M 12 12 H 32 V 32 H 12 Z"/>',
        '</svg>',
      ].join('\n'),
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

    expect(layerInfo['1f600']).toHaveLength(2);
  });
});
