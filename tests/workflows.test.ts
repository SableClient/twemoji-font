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
const qualityWorkflow = readFileSync(
  new URL('../.github/workflows/quality-checks.yml', import.meta.url),
  'utf8',
);
const releaseWorkflow = readFileSync(
  new URL('../.github/workflows/release.yml', import.meta.url),
  'utf8',
);
const knopeConfig = readFileSync(new URL('../knope.toml', import.meta.url), 'utf8');
const pyproject = readFileSync(new URL('../pyproject.toml', import.meta.url), 'utf8');

describe('workflow configuration', () => {
  it('uses setup-vp for bootstrap and vp script invocations for repo commands', () => {
    for (const workflow of [checkUpstreamWorkflow, qualityWorkflow, releaseWorkflow]) {
      expect(workflow).toContain('voidzero-dev/setup-vp@');
      expect(workflow).toContain("node-version-file: '.node-version'");
      expect(workflow).toContain('cache: true');
      expect(workflow).toContain('actions/setup-python@');
      expect(workflow).toContain("python-version-file: 'pyproject.toml'");
      expect(workflow).not.toContain("python-version: '3.13'");
      expect(workflow).toContain('sudo apt-get update');
      expect(workflow).toContain('sudo apt-get install -y fontforge');
      expect(workflow).not.toContain('sudo apt-get install -y fontforge ttfautohint');
      expect(workflow).toContain('python -m pip install -e .');
      expect(workflow).toContain('vp install --frozen-lockfile');
      expect(workflow).not.toContain('pnpm install --frozen-lockfile');
    }

    expect(checkUpstreamWorkflow).toContain('run: vp run verify');
    expect(qualityWorkflow).toContain('run: vp run check');
    expect(qualityWorkflow).toContain('run: vp run test');
    expect(qualityWorkflow).toContain('run: vp run build');
    expect(qualityWorkflow).toContain('run: vp run verify:ci');
    expect(releaseWorkflow).not.toContain('run: vp run check\n');
    expect(releaseWorkflow).not.toContain('run: vp run test\n');
    expect(releaseWorkflow).not.toContain('run: vp run verify\n');
    expect(releaseWorkflow).not.toContain('run: vp run verify:ci\n');
    expect(releaseWorkflow).not.toContain('run: vp run check:repeatability\n');
    expect(releaseWorkflow).not.toContain('vp run typecheck');
    expect(releaseWorkflow).not.toContain('vp run smoke');
    expect(releaseWorkflow).toContain('vp run build');
    expect(qualityWorkflow).not.toContain('actions/setup-node@');
    expect(checkUpstreamWorkflow).not.toContain('actions/setup-node@');
    expect(releaseWorkflow).toContain('actions/setup-node@');
    expect(releaseWorkflow).toContain("registry-url: 'https://registry.npmjs.org'");
  });

  it('uses knope release workflows instead of a standalone publish workflow', () => {
    expect(prepareReleaseWorkflow).toContain('name: Create Release PR');
    expect(prepareReleaseWorkflow).toContain('branches: [master]');
    expect(prepareReleaseWorkflow).toContain(
      "!contains(github.event.head_commit.message, 'chore: prepare release')",
    );
    expect(prepareReleaseWorkflow).toContain('knope-dev/action@');
    expect(prepareReleaseWorkflow).toContain('refs/tags/v1.0.0');
    expect(prepareReleaseWorkflow).toContain('--override-version 1.0.0');
    expect(prepareReleaseWorkflow).toContain('id: prepare-release-args');
    expect(prepareReleaseWorkflow).toContain(
      'run: knope prepare-release ${STEPS_PREPARE_RELEASE_ARGS_OUTPUTS_ARGS}',
    );
    expect(prepareReleaseWorkflow).toContain(
      'STEPS_PREPARE_RELEASE_ARGS_OUTPUTS_ARGS: ${{ steps.prepare-release-args.outputs.args }}',
    );
    expect(prepareReleaseWorkflow).toContain('pull-requests: write');
    expect(prepareReleaseWorkflow).toContain('contents: write');
    expect(prepareReleaseWorkflow).toContain('fregante/setup-git-user@');
    expect(prepareReleaseWorkflow).not.toContain('npm publish');

    expect(qualityWorkflow).toContain('name: Quality Checks');
    expect(qualityWorkflow).toContain('push:');
    expect(qualityWorkflow).toContain('pull_request:');
    expect(qualityWorkflow).toContain('vp run check');
    expect(qualityWorkflow).toContain('vp run test');
    expect(qualityWorkflow).toContain('vp run build');
    expect(qualityWorkflow).toContain('vp run verify:ci');
    expect(qualityWorkflow).not.toContain('npm publish');

    expect(releaseWorkflow).toContain('name: Release');
    expect(releaseWorkflow).toContain('pull_request:');
    expect(releaseWorkflow).toContain('types: [closed]');
    expect(releaseWorkflow).toContain("github.head_ref == 'release'");
    expect(releaseWorkflow).toContain('vp run build');
    expect(releaseWorkflow).toContain('vp run build:release-assets');
    expect(releaseWorkflow).not.toContain('run: vp run verify\n');
    expect(releaseWorkflow).not.toContain('run: vp run check\n');
    expect(releaseWorkflow).not.toContain('run: vp run test\n');
    expect(releaseWorkflow).not.toContain('run: vp run verify:ci\n');
    expect(releaseWorkflow).not.toContain('run: vp run check:repeatability\n');
    expect(releaseWorkflow).not.toContain('vp run typecheck');
    expect(releaseWorkflow).not.toContain('vp run smoke');
    expect(releaseWorkflow).toContain('knope-dev/action@');
    expect(releaseWorkflow).toContain('knope release --verbose');
    expect(releaseWorkflow).toContain('npm publish --provenance --access public');
    expect(releaseWorkflow).toContain('NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}');
    expect(releaseWorkflow).toContain('id-token: write');
    expect(knopeConfig).toContain('assets = "build/*.zip"');
  });

  it('writes a Knope change file when automating upstream Twemoji refreshes', () => {
    expect(checkUpstreamWorkflow).toContain('.changeset');
    expect(checkUpstreamWorkflow).toContain('Update to Twemoji');
    expect(checkUpstreamWorkflow).toContain('create-pull-request');
  });

  it('uses pyproject.toml as the Python version source of truth', () => {
    expect(pyproject).toContain('requires-python = ">=3.13,<3.14"');
  });
});
