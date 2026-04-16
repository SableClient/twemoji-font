import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vite-plus/test';

describe('fontforge runner', () => {
  it('keeps hinting in typescript and generation in python', () => {
    const driver = readFileSync(
      new URL('../scripts/font/fontforge-runner.ts', import.meta.url),
      'utf8',
    );
    const generator = readFileSync(
      new URL('../scripts/font/fontforge-generate.py', import.meta.url),
      'utf8',
    );

    expect(driver).toContain('fontforge-generate.py');
    expect(driver).toContain('ttfautohint');
    expect(driver).toContain("'-m', 'ttfautohint', '--version'");
    expect(driver).toContain('python -m pip install -e .');
    expect(driver).toContain('renameSync');
    expect(driver).toContain('APPDATA: stagedAppData');
    expect(driver).toContain('PYTHONWARNINGS');
    expect(driver).toContain('pkg_resources is deprecated as an API');
    expect(driver).toContain("join(appDataRoot, 'FontForge', 'plugin')");
    expect(driver).toContain("['-version']");
    expect(driver).toContain("spawnSync(fontforge.command, ['-script', generateScript]");
    expect(generator).not.toContain('ttfautohint');
    expect(generator).not.toContain('&& mv');
    expect(generator).not.toContain('find_executable');
    expect(generator).not.toContain('call(');
  });

  it('keeps the approved fast path read-only and non-staging', () => {
    const driver = readFileSync(
      new URL('../scripts/font/fontforge-runner.ts', import.meta.url),
      'utf8',
    );
    const generator = readFileSync(
      new URL('../scripts/font/fontforge-generate.py', import.meta.url),
      'utf8',
    );

    expect(driver).toContain('inputDir: glyphDir');
    expect(driver).not.toContain('const stagedGlyphDir');
    expect(driver).not.toContain('cpSync(sourceDir, tempRoot');
    expect(driver).not.toContain('stageGlyphs(sourceDir)');
    expect(driver).not.toContain('stagedGlyphDir');
    expect(generator).toContain("open(filePath, 'r', encoding='utf-8')");
    expect(generator).not.toContain("open(filePath, 'r+')");
    expect(generator).not.toContain('svgfile.truncate()');
    expect(generator).not.toContain('svgfile.write(svgtext)');
  });

  it('skips importing empty placeholder glyph outlines', () => {
    const generator = readFileSync(
      new URL('../scripts/font/fontforge-generate.py', import.meta.url),
      'utf8',
    );

    expect(generator).toContain('def svg_has_visible_content');
    expect(generator).toContain('if svg_has_visible_content(svgtext):');
    expect(generator).toContain('glyph.importOutlines(filePath)');
  });

  it('emits sparse FontForge progress markers', () => {
    const generator = readFileSync(
      new URL('../scripts/font/fontforge-generate.py', import.meta.url),
      'utf8',
    );

    expect(generator).toContain('[fontforge]');
    expect(generator).toContain('processing');
    expect(generator).toContain('generating TTF');
    expect(generator).toContain('TTF generated');
  });

  it('keeps deterministic valid timestamps in normalized fonts', () => {
    const buildFont = readFileSync(new URL('../scripts/build-font.ts', import.meta.url), 'utf8');
    const normalizeScript = readFileSync(
      new URL('../scripts/font/normalize-font-metadata.py', import.meta.url),
      'utf8',
    );

    expect(buildFont).toContain('--no-recalc-timestamp');
    expect(normalizeScript).toContain('MAC_EPOCH_1970');
    expect(normalizeScript).not.toContain('head.created = 0');
    expect(normalizeScript).not.toContain('head.modified = 0');
  });
});
