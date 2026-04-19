import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ZipFile } from 'yazl';
import pkg from '../../package.json' with { type: 'json' };

const deterministicZipTime = new Date('1980-01-01T00:00:00.000Z');
const archivePrefix = 'twemoji-font-';
const archiveDirectoryName = 'fonts';

export type CreateReleaseArchiveOptions = {
  licensePath: string;
  outputDir: string;
  ttfPath: string;
  version: string;
  woff2Path: string;
};

function logStage(message: string): void {
  console.log(`[build:release-assets] ${message}`);
}

function assertExists(path: string, label: string): void {
  if (!existsSync(path)) {
    throw new Error(`Missing ${label}: ${path}`);
  }
}

export function releaseArchiveDirectoryName(): string {
  return archiveDirectoryName;
}

export function releaseArchiveFileName(version: string): string {
  return `${archivePrefix}${version}.zip`;
}

function removeExistingReleaseArchives(outputDir: string): void {
  if (!existsSync(outputDir)) {
    return;
  }

  for (const entry of readdirSync(outputDir)) {
    if (entry.startsWith(archivePrefix) && entry.endsWith('.zip')) {
      rmSync(join(outputDir, entry), { force: true });
    }
  }
}

export async function createReleaseArchive({
  licensePath,
  outputDir,
  ttfPath,
  version,
  woff2Path,
}: CreateReleaseArchiveOptions): Promise<string> {
  assertExists(licensePath, 'release license asset');
  assertExists(ttfPath, 'release TTF asset');
  assertExists(woff2Path, 'release WOFF2 asset');

  mkdirSync(outputDir, { recursive: true });

  const archivePath = join(outputDir, releaseArchiveFileName(version));
  const archiveRoot = releaseArchiveDirectoryName();
  const zip = new ZipFile();

  zip.addFile(licensePath, 'LICENSE.md', {
    mode: 0o100644,
    mtime: deterministicZipTime,
  });
  zip.addFile(ttfPath, `${archiveRoot}/twemoji.ttf`, {
    mode: 0o100644,
    mtime: deterministicZipTime,
  });
  zip.addFile(woff2Path, `${archiveRoot}/twemoji.woff2`, {
    mode: 0o100644,
    mtime: deterministicZipTime,
  });

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(archivePath);

    output.on('close', resolve);
    output.on('error', reject);
    zip.outputStream.on('error', reject).pipe(output);
    zip.end();
  });

  return archivePath;
}

export async function buildReleaseAssets(root: string = process.cwd()): Promise<string> {
  const licensePath = join(root, 'LICENSE.md');
  const outputDir = join(root, 'build');
  const ttfPath = join(root, 'build', 'Twemoji Mozilla.ttf');
  const woff2Path = join(root, 'dist', 'files', 'twemoji.woff2');

  removeExistingReleaseArchives(outputDir);
  logStage(`creating release archive for version ${pkg.version}`);

  const archivePath = await createReleaseArchive({
    licensePath,
    outputDir,
    ttfPath,
    version: pkg.version,
    woff2Path,
  });

  logStage(`release asset archive ready: ${archivePath}`);
  return archivePath;
}

if (import.meta.main) {
  await buildReleaseAssets();
}
