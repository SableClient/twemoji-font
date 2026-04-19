import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vite-plus/test';

describe('repo script layout', () => {
  it('keeps build helper sources grouped by subsystem under scripts/', () => {
    expect(existsSync(new URL('../scripts/build-font.ts', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../scripts/font/build-raw-font.ts', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../scripts/font/fix-direction.py', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../scripts/font/fontforge-generate.py', import.meta.url))).toBe(
      true,
    );
    expect(existsSync(new URL('../scripts/font/fontforge-runner.ts', import.meta.url))).toBe(true);
    expect(
      existsSync(new URL('../scripts/font/add-variation-selector-mappings.py', import.meta.url)),
    ).toBe(true);
    expect(existsSync(new URL('../scripts/font/normalize-font-metadata.py', import.meta.url))).toBe(
      true,
    );
    expect(existsSync(new URL('../scripts/layerize/layerize.ts', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../scripts/layerize/layerize-order.ts', import.meta.url))).toBe(
      true,
    );
    expect(existsSync(new URL('../scripts/layerize/normalize-svg.ts', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../scripts/layerize/layerize-svg.ts', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../scripts/package/build-package.ts', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../scripts/package/build-release-assets.ts', import.meta.url))).toBe(
      true,
    );
    expect(existsSync(new URL('../scripts/package/smoke-test-package.ts', import.meta.url))).toBe(
      true,
    );
    expect(existsSync(new URL('../scripts/upstream/check-upstream.ts', import.meta.url))).toBe(
      true,
    );
    expect(existsSync(new URL('../scripts/upstream/publish-prepare.ts', import.meta.url))).toBe(
      true,
    );
    expect(
      existsSync(new URL('../scripts/verify/check-build-repeatability.ts', import.meta.url)),
    ).toBe(true);
    expect(existsSync(new URL('../knope.toml', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../CHANGELOG.md', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../.changeset/.gitkeep', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../.github/workflows/prepare-release.yml', import.meta.url))).toBe(
      true,
    );
    expect(existsSync(new URL('../.github/workflows/release.yml', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../.github/workflows/publish.yml', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/tools', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../Makefile', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../twe-svg.zip', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../twe-svg.zip.version.txt', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../scripts/lib', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../scripts/layerize.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../scripts/fixDirection.py', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../scripts/fontforge-generate.py', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../scripts/lib/webfont-driver.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../scripts/run-webfont.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../layerize.js', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../fixDirection.py', import.meta.url))).toBe(false);
  });

  it('does not keep the retired browser-only visual test harness checked in', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

    expect(pkg.devDependencies?.resemblejs).toBeUndefined();
    expect(existsSync(new URL('./index.html', import.meta.url))).toBe(false);
    expect(existsSync(new URL('./index.css', import.meta.url))).toBe(false);
    expect(existsSync(new URL('./index.js', import.meta.url))).toBe(false);
    expect(existsSync(new URL('./reporter.js', import.meta.url))).toBe(false);
  });

  it('does not keep the retired text-presentation keycap extras', () => {
    expect(existsSync(new URL('../extras/2122-20e3.svg', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../extras/24c2-20e3.svg', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../extras/a9-20e3.svg', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../extras/ae-20e3.svg', import.meta.url))).toBe(false);
  });

  it('does not keep retired grunt runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

    expect(pkg.devDependencies?.svgo).toBeDefined();
    expect(Object.keys(pkg.dependencies ?? {})).not.toEqual(
      expect.arrayContaining(['grunt', 'grunt-cli', 'load-grunt-tasks', 'grunt-webfonts']),
    );
  });

  it('does not keep retired grunt references in the lockfile or build helpers', () => {
    const lockfile = readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8');
    const fontforgeScript = readFileSync(
      new URL('../scripts/font/fontforge-generate.py', import.meta.url),
      'utf8',
    );
    const buildFont = readFileSync(new URL('../scripts/build-font.ts', import.meta.url), 'utf8');
    const layerize = readFileSync(
      new URL('../scripts/layerize/layerize.ts', import.meta.url),
      'utf8',
    );

    expect(lockfile).not.toContain('grunt@1.6.2');
    expect(lockfile).not.toContain('grunt-cli@1.5.0');
    expect(lockfile).not.toContain('load-grunt-tasks@5.1.0');
    expect(lockfile).not.toContain('grunt-webfonts@5.1.0');
    expect(lockfile).not.toContain('grunt-webfonts:');
    expect(fontforgeScript).toContain('f.generate(filename)');
    expect(buildFont).not.toContain("'twe-svg.zip'");
    expect(buildFont).not.toContain("'twe-svg.zip.version.txt'");
    expect(layerize).toContain("from './normalize-svg.ts'");
    expect(layerize).toContain('normalizeSvgForLayerize');
  });

  it('keeps the raw-font handoff explicit', () => {
    const buildFont = readFileSync(new URL('../scripts/build-font.ts', import.meta.url), 'utf8');
    const buildRawFont = readFileSync(
      new URL('../scripts/font/build-raw-font.ts', import.meta.url),
      'utf8',
    );

    expect(buildFont).toContain("import { buildRawFont } from './font/build-raw-font.ts';");
    expect(buildFont).toContain('buildRawFont();');
    expect(buildRawFont).toContain("import { runFontforge } from './fontforge-runner.ts';");
    expect(buildRawFont).toContain('export function buildRawFont()');
    expect(buildRawFont).toContain('if (import.meta.main) {');
  });

  it('documents the owned font toolchain and keeps covered typescript files free of ts-check pragmas', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    const contribute = readFileSync(new URL('../CONTRIBUTE.md', import.meta.url), 'utf8');
    const license = readFileSync(new URL('../LICENSE.md', import.meta.url), 'utf8');
    const pyproject = readFileSync(new URL('../pyproject.toml', import.meta.url), 'utf8');
    const coveredFiles = [
      '../scripts/package/build-package.ts',
      '../scripts/upstream/check-upstream.ts',
      '../scripts/upstream/publish-prepare.ts',
      '../scripts/font/build-raw-font.ts',
      '../scripts/package/smoke-test-package.ts',
      './package.test.ts',
      './upstream.test.ts',
    ];

    expect(pyproject).toContain('fonttools[woff]');
    expect(pyproject).toContain('ttfautohint-py');
    expect(readme).toContain('FontForge');
    expect(readme).toContain('ttfautohint');
    expect(readme).toContain('Python wheel fallback');
    expect(readme).toContain('scripts/');
    expect(readme).toContain('vp install');
    expect(readme).toContain('vp run check');
    expect(readme).toContain('vp run test');
    expect(readme).toContain('vp env install');
    expect(readme).toContain('python -m pip install -e .');
    expect(readme).toContain('vp run verify');
    expect(readme).toContain('.cache/twemoji');
    expect(readme).toContain('knope document-change');
    expect(readme).toContain('release PR');
    expect(readme).not.toContain('@sableclient/twemoji-font/metadata');
    expect(readme).not.toContain('twe-svg.zip');
    expect(contribute).toContain('FontForge');
    expect(contribute).toContain('ttfautohint');
    expect(contribute).toContain('Python wheel fallback');
    expect(contribute).toContain('scripts/');
    expect(contribute).toContain('vp install');
    expect(contribute).toContain('vp run check');
    expect(contribute).toContain('vp run test');
    expect(contribute).toContain('vp run verify');
    expect(contribute).toContain('.cache/twemoji');
    expect(contribute).toContain('knope document-change');
    expect(contribute).toContain('.changeset');
    expect(contribute).not.toContain('twe-svg.zip');
    expect(license).toContain('https://github.com/jdecked/twemoji');
    expect(license).not.toContain('https://twitter.github.io/twemoji');
    expect(license).not.toContain('https://github.com/twitter/twemoji#license');

    for (const file of coveredFiles) {
      expect(readFileSync(new URL(file, import.meta.url), 'utf8')).not.toContain('// @ts-check');
    }
  });
});
