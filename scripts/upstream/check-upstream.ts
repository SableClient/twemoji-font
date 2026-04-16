import { readTwemojiMetadata } from './twemoji-source.ts';

export function parseTwemojiVersion(value: string): string | null {
  return value.match(/v\/([0-9]+\.[0-9]+\.[0-9]+)\/svg/)?.[1] ?? null;
}

if (import.meta.main) {
  const current = readTwemojiMetadata().version;
  const response = await fetch('https://api.github.com/repos/jdecked/twemoji/releases/latest', {
    headers: { 'User-Agent': '@sableclient/twemoji-font' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch latest Twemoji release: ${response.status}`);
  }

  const release = (await response.json()) as { tag_name?: string };
  const latest = String(release.tag_name).replace(/^v/, '');

  process.stdout.write(
    JSON.stringify(
      {
        current,
        latest,
        needsUpdate: current !== latest,
      },
      null,
      2,
    ),
  );
}
