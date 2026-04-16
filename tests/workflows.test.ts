import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vite-plus/test';

const checkUpstreamWorkflow = readFileSync(
  new URL('../.github/workflows/check-upstream.yml', import.meta.url),
  'utf8',
);
const prepareReleaseWorkflow = readFileSync(
  new URL('../.github/workflows/prepare-release.yml', import.meta.url),
  'utf8',
);
const releaseWorkflow = readFileSync(
  new URL('../.github/workflows/release.yml', import.meta.url),
  'utf8',
);

describe('workflow configuration', () => {
  it('uses setup-vp for bootstrap and vp script invocations for repo commands', () => {
    for (const workflow of [checkUpstreamWorkflow, releaseWorkflow]) {
      expect(workflow).toContain('voidzero-dev/setup-vp@');
      expect(workflow).toContain("node-version: '24.14.1'");
      expect(workflow).toContain('cache: true');
      expect(workflow).toContain('actions/setup-python@');
      expect(workflow).toContain("python-version: '3.13'");
      expect(workflow).toContain('sudo apt-get update');
      expect(workflow).toContain('sudo apt-get install -y fontforge');
      expect(workflow).not.toContain('sudo apt-get install -y fontforge ttfautohint');
      expect(workflow).toContain('python -m pip install -e .');
      expect(workflow).toContain('vp install --frozen-lockfile');
      expect(workflow).toContain('vp run check');
      expect(workflow).toContain('vp run test');
      expect(workflow).toContain('vp run verify');
      expect(workflow).not.toContain('actions/setup-node@');
      expect(workflow).not.toContain('pnpm install --frozen-lockfile');
    }
  });

  it('uses knope release workflows instead of a standalone publish workflow', () => {
    expect(prepareReleaseWorkflow).toContain('name: Create Release PR');
    expect(prepareReleaseWorkflow).toContain('branches: [master]');
    expect(prepareReleaseWorkflow).toContain(
      "!contains(github.event.head_commit.message, 'chore: prepare release')",
    );
    expect(prepareReleaseWorkflow).toContain('knope-dev/action@');
    expect(prepareReleaseWorkflow).toContain('knope prepare-release --verbose');
    expect(prepareReleaseWorkflow).toContain('pull-requests: write');
    expect(prepareReleaseWorkflow).toContain('contents: write');
    expect(prepareReleaseWorkflow).toContain('fregante/setup-git-user@');
    expect(prepareReleaseWorkflow).not.toContain('npm publish');

    expect(releaseWorkflow).toContain('name: Release');
    expect(releaseWorkflow).toContain('pull_request:');
    expect(releaseWorkflow).toContain('types: [closed]');
    expect(releaseWorkflow).toContain("github.head_ref == 'release'");
    expect(releaseWorkflow).toContain('knope-dev/action@');
    expect(releaseWorkflow).toContain('knope release --verbose');
    expect(releaseWorkflow).toContain('npm publish --provenance --access public');
    expect(releaseWorkflow).toContain('id-token: write');
  });

  it('writes a Knope change file when automating upstream Twemoji refreshes', () => {
    expect(checkUpstreamWorkflow).toContain('.changeset');
    expect(checkUpstreamWorkflow).toContain('@sableclient/twemoji-font');
    expect(checkUpstreamWorkflow).toContain('Update to Twemoji');
    expect(checkUpstreamWorkflow).toContain('create-pull-request');
  });
});
