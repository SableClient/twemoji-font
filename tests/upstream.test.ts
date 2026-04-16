import { describe, expect, it } from 'vite-plus/test';
import { existsSync, readFileSync } from 'node:fs';
import {
  buildVersionFileText,
  resolveVersionArgument,
} from '../scripts/upstream/publish-prepare.ts';
import { parseTwemojiVersion } from '../scripts/upstream/check-upstream.ts';

describe('parseTwemojiVersion', () => {
  it('extracts the upstream version from the source metadata string', () => {
    expect(
      parseTwemojiVersion(
        'https://github.com/jdecked/twemoji/tree/40c2213f8f9bc53b1188fdae325a63a82ffb5bec/v/17.0.2/svg',
      ),
    ).toBe('17.0.2');
  });

  it('returns null for invalid input', () => {
    expect(parseTwemojiVersion('garbage')).toBeNull();
  });
});

describe('buildVersionFileText', () => {
  it('rebuilds the upstream source metadata string for a pinned gh-pages commit', () => {
    expect(buildVersionFileText('17.0.2', '40c2213f8f9bc53b1188fdae325a63a82ffb5bec')).toBe(
      'https://github.com/jdecked/twemoji/tree/40c2213f8f9bc53b1188fdae325a63a82ffb5bec/v/17.0.2/svg',
    );
  });
});

describe('resolveVersionArgument', () => {
  it('ignores the script separator forwarded by vp run', () => {
    expect(resolveVersionArgument(['node', 'publish-prepare.ts', '--', '17.0.2'])).toBe('17.0.2');
  });
});

describe('publish-prepare implementation', () => {
  it('uses GitHub API branch and zipball endpoints instead of git CLI cloning', () => {
    const helper = readFileSync(
      new URL('../scripts/upstream/twemoji-source.ts', import.meta.url),
      'utf8',
    );

    expect(helper).toContain(
      "const upstreamRepoApiBase = 'https://api.github.com/repos/jdecked/twemoji';",
    );
    expect(helper).toContain('/branches/gh-pages');
    expect(helper).toContain('/zipball/');
    expect(helper).not.toContain('execFileSync');
    expect(helper).not.toContain('ls-remote');
    expect(helper).not.toContain('clone');
  });

  it('warms a checked-out cache directory instead of rewriting twe-svg.zip', () => {
    const script = readFileSync(
      new URL('../scripts/upstream/publish-prepare.ts', import.meta.url),
      'utf8',
    );
    const helperUrl = new URL('../scripts/upstream/twemoji-source.ts', import.meta.url);

    expect(existsSync(helperUrl)).toBe(true);

    const helper = readFileSync(helperUrl, 'utf8');

    expect(script).toContain('./twemoji-source.ts');
    expect(helper).toContain('.cache');
    expect(helper).toContain('twemoji');
    expect(script).not.toContain('twe-svg.zip');
    expect(script).not.toContain('twe-svg.zip.version.txt');
    expect(helper).not.toContain('yazl');
    expect(helper).not.toContain('ZipFile');
  });
});
