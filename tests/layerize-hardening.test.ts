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

describe('layerize pipeline hardening', () => {
  it('records dropped thin strokes without failing the build', () => {
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
        '  <path fill="#f00" stroke="#000" stroke-width="0.1" d="M2 2h30v30H2z"/>',
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

    const dropped = JSON.parse(
      readFileSync(join(buildDir, 'dropped-strokes.json'), 'utf8'),
    ) as Array<{ baseName: string }>;

    expect(dropped.some((entry) => entry.baseName === '1f600')).toBe(true);
  });
});
