import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import unzipper from 'unzipper';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
  createReleaseArchive,
  releaseArchiveDirectoryName,
  releaseArchiveFileName,
} from '../scripts/package/build-release-assets.ts';

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe('release asset archive', () => {
  it('packages the TTF and WOFF2 in a versioned zip', async () => {
    const root = mkdtempSync(join(tmpdir(), 'twemoji-release-assets-'));
    tempRoots.push(root);

    const outputDir = join(root, 'build');
    const licensePath = join(root, 'LICENSE.md');
    const ttfPath = join(root, 'build', 'Twemoji Mozilla.ttf');
    const woff2Path = join(root, 'dist', 'files', 'twemoji.woff2');

    mkdirSync(join(root, 'build'), { recursive: true });
    mkdirSync(join(root, 'dist', 'files'), { recursive: true });
    writeFileSync(licensePath, 'license-bytes');
    writeFileSync(ttfPath, 'ttf-bytes');
    writeFileSync(woff2Path, 'woff2-bytes');

    const archivePath = await createReleaseArchive({
      licensePath,
      outputDir,
      ttfPath,
      version: '1.2.3',
      woff2Path,
    });

    expect(archivePath).toBe(join(outputDir, releaseArchiveFileName('1.2.3')));

    const archive = await unzipper.Open.file(archivePath);
    const entryPaths = archive.files.map((file) => file.path).sort();
    const rootDir = releaseArchiveDirectoryName();
    const [licenseFile, ttfFile, woff2File] = archive.files;

    expect(entryPaths).toEqual([
      'LICENSE.md',
      `${rootDir}/twemoji.ttf`,
      `${rootDir}/twemoji.woff2`,
    ]);
    expect(licenseFile).toBeTruthy();
    expect(ttfFile).toBeTruthy();
    expect(woff2File).toBeTruthy();
    expect((await licenseFile!.buffer()).toString('utf8')).toBe('license-bytes');
    expect(await ttfFile!.buffer()).toBeTruthy();
    expect(await woff2File!.buffer()).toBeTruthy();
  });

  it('writes deterministic archive bytes for the same inputs', async () => {
    const root = mkdtempSync(join(tmpdir(), 'twemoji-release-assets-'));
    tempRoots.push(root);

    const firstOutputDir = join(root, 'build-a');
    const secondOutputDir = join(root, 'build-b');
    const licensePath = join(root, 'LICENSE.md');
    const ttfPath = join(root, 'Twemoji Mozilla.ttf');
    const woff2Path = join(root, 'twemoji.woff2');

    writeFileSync(licensePath, 'same-license');
    writeFileSync(ttfPath, 'same-ttf');
    writeFileSync(woff2Path, 'same-woff2');

    const firstArchive = await createReleaseArchive({
      licensePath,
      outputDir: firstOutputDir,
      ttfPath,
      version: '1.2.3',
      woff2Path,
    });
    const secondArchive = await createReleaseArchive({
      licensePath,
      outputDir: secondOutputDir,
      ttfPath,
      version: '1.2.3',
      woff2Path,
    });

    expect(readFileSync(firstArchive)).toEqual(readFileSync(secondArchive));
  });
});
