import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import unzipper from 'unzipper';

type PackageJson = Record<string, unknown> & { twemoji?: TwemojiMetadata };
type LogFn = (message: string) => void;

export type TwemojiMetadata = {
  version: string;
  commit: string;
  source: string;
};

export const upstreamRepoUrl = 'https://github.com/jdecked/twemoji';
export const upstreamRepoApiBase = 'https://api.github.com/repos/jdecked/twemoji';
const ghPagesBranchApiUrl = `${upstreamRepoApiBase}/branches/gh-pages`;

function maybeLog(log: LogFn | undefined, message: string): void {
  log?.(message);
}

function packageJsonPath(root = process.cwd()): string {
  return join(root, 'package.json');
}

function readPackageJson(root = process.cwd()): PackageJson {
  return JSON.parse(readFileSync(packageJsonPath(root), 'utf8')) as PackageJson;
}

export function buildVersionFileText(version: string, commit: string): string {
  return `${upstreamRepoUrl}/tree/${commit}/v/${version}/svg`;
}

export function resolveVersionArgument(argv: string[]): string | undefined {
  return argv.slice(2).find((value) => value !== '--');
}

export function buildTwemojiCacheRoot(root = process.cwd()): string {
  return join(root, '.cache', 'twemoji');
}

export function buildTwemojiCacheDir(commit: string, root = process.cwd()): string {
  return join(buildTwemojiCacheRoot(root), commit);
}

export function buildTwemojiSvgDir(commit: string, root = process.cwd()): string {
  return join(buildTwemojiCacheDir(commit, root), 'svg');
}

export function readTwemojiMetadata(root = process.cwd()): TwemojiMetadata {
  const twemoji = readPackageJson(root).twemoji;

  if (
    !twemoji ||
    typeof twemoji.version !== 'string' ||
    typeof twemoji.commit !== 'string' ||
    typeof twemoji.source !== 'string'
  ) {
    throw new Error('package.json must define twemoji.version, twemoji.commit, and twemoji.source');
  }

  return twemoji;
}

export function writeTwemojiMetadata(metadata: TwemojiMetadata, root = process.cwd()): void {
  const pkg = readPackageJson(root);
  pkg.twemoji = metadata;
  writeFileSync(packageJsonPath(root), `${JSON.stringify(pkg, null, 2)}\n`);
}

function buildSourceTreeSegment(version: string): string {
  return `/v/${version}/svg/`;
}

function buildZipballApiUrl(commit: string): string {
  return `${upstreamRepoApiBase}/zipball/${commit}`;
}

function buildCodeloadZipUrl(commit: string): string {
  return `https://codeload.github.com/jdecked/twemoji/zip/${commit}`;
}

function buildGitHubApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': '@sableclient/twemoji-font',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

async function resolveGhPagesCommit(): Promise<string> {
  const response = await fetch(ghPagesBranchApiUrl, {
    headers: buildGitHubApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve gh-pages branch: ${response.status}`);
  }

  const payload = (await response.json()) as { commit?: { sha?: string } };
  const commit = payload.commit?.sha;

  if (!commit) {
    throw new Error('GitHub branch response did not include commit.sha');
  }

  return commit;
}

async function resolveSnapshotZipUrl(commit: string): Promise<string> {
  const response = await fetch(buildZipballApiUrl(commit), {
    headers: buildGitHubApiHeaders(),
    redirect: 'manual',
  });

  const redirectedUrl = response.headers.get('location');

  if (redirectedUrl) {
    return redirectedUrl;
  }

  if (!response.ok) {
    throw new Error(`Failed to resolve upstream snapshot URL: ${response.status}`);
  }

  return buildCodeloadZipUrl(commit);
}

async function downloadSnapshotZip(snapshotUrl: string, destinationPath: string): Promise<void> {
  const response = await fetch(snapshotUrl, {
    headers: { 'User-Agent': '@sableclient/twemoji-font' },
  });

  if (!response.ok || response.body === null) {
    throw new Error(`Failed to download upstream snapshot: ${response.status}`);
  }

  await pipeline(
    Readable.fromWeb(response.body as globalThis.ReadableStream<Uint8Array>),
    createWriteStream(destinationPath),
  );
}

async function extractVersionedSvgDirectory(
  sourceZipPath: string,
  version: string,
  destinationDir: string,
): Promise<void> {
  const sourceZip = await unzipper.Open.file(sourceZipPath);
  const sourceTreeSegment = buildSourceTreeSegment(version);
  const entries = sourceZip.files
    .filter(
      (entry) =>
        entry.type === 'File' &&
        entry.path.includes(sourceTreeSegment) &&
        entry.path.slice(entry.path.indexOf(sourceTreeSegment) + sourceTreeSegment.length) !== '',
    )
    .sort((a, b) => a.path.localeCompare(b.path, 'en'));

  if (entries.length === 0) {
    throw new Error(`Upstream snapshot does not contain ${sourceTreeSegment}`);
  }

  for (const entry of entries) {
    const relativePath = entry.path.slice(
      entry.path.indexOf(sourceTreeSegment) + sourceTreeSegment.length,
    );
    const outputPath = join(destinationDir, relativePath);
    mkdirSync(dirname(outputPath), { recursive: true });
    await pipeline(entry.stream(), createWriteStream(outputPath));
  }
}

async function writeTwemojiSvgDir(
  version: string,
  commit: string,
  root = process.cwd(),
  log?: LogFn,
): Promise<string> {
  const tempRoot = join(tmpdir(), `twemoji-upstream-${process.pid}-${Date.now()}`);
  const downloadedZipPath = join(tempRoot, 'twemoji-source.zip');
  const finalCacheDir = buildTwemojiCacheDir(commit, root);
  const finalSvgDir = buildTwemojiSvgDir(commit, root);

  mkdirSync(tempRoot, { recursive: true });

  try {
    maybeLog(log, `resolving zipball URL for gh-pages@${commit}`);
    const snapshotUrl = await resolveSnapshotZipUrl(commit);

    maybeLog(log, `downloading exact snapshot from gh-pages@${commit}`);
    await downloadSnapshotZip(snapshotUrl, downloadedZipPath);

    maybeLog(log, `extracting v/${version}/svg into ${finalSvgDir}`);
    rmSync(finalCacheDir, { recursive: true, force: true });
    mkdirSync(finalSvgDir, { recursive: true });
    await extractVersionedSvgDirectory(downloadedZipPath, version, finalSvgDir);

    return finalSvgDir;
  } catch (error) {
    rmSync(finalCacheDir, { recursive: true, force: true });
    throw error;
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

export async function ensureTwemojiSvgDir(root = process.cwd(), log?: LogFn): Promise<string> {
  const metadata = readTwemojiMetadata(root);
  const svgDir = buildTwemojiSvgDir(metadata.commit, root);

  if (existsSync(svgDir)) {
    return svgDir;
  }

  maybeLog(log, `warming pinned SVG cache for ${metadata.version} from ${metadata.commit}`);
  return writeTwemojiSvgDir(metadata.version, metadata.commit, root, log);
}

export async function prepareTwemojiUpstream(
  version: string,
  root = process.cwd(),
  log?: LogFn,
): Promise<TwemojiMetadata> {
  maybeLog(log, 'resolving gh-pages commit');
  const commit = await resolveGhPagesCommit();
  const metadata = {
    version,
    commit,
    source: buildVersionFileText(version, commit),
  };

  await writeTwemojiSvgDir(version, commit, root, log);
  writeTwemojiMetadata(metadata, root);
  maybeLog(log, 'source snapshot ready');

  return metadata;
}
