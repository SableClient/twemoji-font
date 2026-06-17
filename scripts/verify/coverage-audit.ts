import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTwemojiSvgDir, readTwemojiMetadata } from '../upstream/twemoji-source.ts';
import { isTextPresentationBase } from '../layerize/emoji-variation-sequences.ts';

const root = process.cwd();
const buildDir = join(root, 'build');
const layerInfoPath = join(buildDir, 'layer_info.json');
const fontPath = join(buildDir, 'Twemoji Mozilla.ttf');
const reportJsonPath = join(buildDir, 'coverage-audit.json');
const reportTextPath = join(buildDir, 'coverage-audit.txt');

export interface CoverageAuditReport {
  upstreamSvgCount: number;
  expectedSourceCount: number;
  layerInfoGlyphCount: number;
  zeroLayerGlyphs: string[];
  missingFromLayerInfo: string[];
  extrasOnlyGlyphs: string[];
  cmapCodepointCount: number;
  colrGlyphCount: number;
  cpalColorCount: number;
  issues: string[];
}

function collectSvgFilenames(dir: string): string[] {
  const files: string[] = [];
  const stack = [dir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.svg')) {
        files.push(entry.name.replace(/\.svg$/, ''));
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b, 'en'));
}

function readLayerInfo(): Record<string, string[]> {
  if (!existsSync(layerInfoPath)) {
    throw new Error(`Missing layer info: ${layerInfoPath}. Run build:font first.`);
  }

  return JSON.parse(readFileSync(layerInfoPath, 'utf8')) as Record<string, string[]>;
}

function findPythonCommand(): string {
  const candidates = ['python', 'python3', 'py'].filter((command) => {
    try {
      execFileSync(command, ['--version'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  });

  if (candidates.length === 0) {
    throw new Error('Python executable not found for coverage audit');
  }

  return candidates[0]!;
}

function readFontTableCounts(fontFile: string): {
  cmapCodepointCount: number;
  colrGlyphCount: number;
  cpalColorCount: number;
} {
  const python = findPythonCommand();
  const script = `
from fontTools.ttLib import TTFont
font = TTFont(${JSON.stringify(fontFile)})
cmap = font.get('cmap')
codes = set()
if cmap:
    for table in cmap.tables:
        codes.update(table.cmap.keys())
colr = font.get('COLR')
cpal = font.get('CPAL')
colr_count = len(colr.ColorLayers) if colr else 0
cpal_count = cpal.numPaletteEntries if cpal else 0
print(f"{len(codes)}\\t{colr_count}\\t{cpal_count}")
`;
  const output = execFileSync(python, ['-c', script], { encoding: 'utf8' }).trim();
  const [cmapCodepointCount, colrGlyphCount, cpalColorCount] = output
    .split('\t')
    .map((value) => Number(value));

  return { cmapCodepointCount, colrGlyphCount, cpalColorCount };
}

function normalizeBaseName(baseName: string): string {
  return baseName.toLowerCase().replace(/^0+/, '') || '0';
}

function expectedLayerKeyFromSourceName(baseName: string): string {
  if (isTextPresentationBase(baseName)) {
    return '';
  }

  if (!baseName.includes('-')) {
    return normalizeBaseName(baseName);
  }

  return baseName.split('-').map(normalizeBaseName).join('_');
}

function expectedLayerInfoKeys(sourceNames: readonly string[]): Set<string> {
  const keys = new Set<string>();

  for (const name of sourceNames) {
    const key = expectedLayerKeyFromSourceName(name);
    if (key) {
      keys.add(key);
    }
  }

  return keys;
}

export function runCoverageAudit(): CoverageAuditReport {
  const metadata = readTwemojiMetadata(root);
  const upstreamSvgDir = buildTwemojiSvgDir(metadata.commit, root);

  if (!existsSync(upstreamSvgDir)) {
    throw new Error(
      `Missing upstream SVG cache at ${upstreamSvgDir}. Run build:font or prepare:upstream first.`,
    );
  }

  const upstreamNames = collectSvgFilenames(upstreamSvgDir);
  const extrasNames = collectSvgFilenames(join(root, 'extras')).filter(
    (name) => name !== 'ligatures',
  );
  const expectedSource = [...new Set([...upstreamNames, ...extrasNames])];
  const layerInfo = readLayerInfo();
  const layerKeys = new Set(Object.keys(layerInfo));
  const expectedKeys = expectedLayerInfoKeys(expectedSource);

  const zeroLayerGlyphs = Object.entries(layerInfo)
    .filter(([, layers]) => layers.length === 0)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b, 'en'));

  const missingFromLayerInfo = [...expectedKeys]
    .filter((name) => !layerKeys.has(name))
    .sort((a, b) => a.localeCompare(b, 'en'));

  const extrasOnlyGlyphs = [...layerKeys]
    .filter((name) => !expectedKeys.has(name) && name.includes('_'))
    .sort((a, b) => a.localeCompare(b, 'en'));

  const fontCounts = existsSync(fontPath)
    ? readFontTableCounts(fontPath)
    : { cmapCodepointCount: 0, colrGlyphCount: 0, cpalColorCount: 0 };

  const issues: string[] = [];

  if (missingFromLayerInfo.length > 0) {
    issues.push(`${missingFromLayerInfo.length} upstream SVGs missing from layer_info.json`);
  }

  if (zeroLayerGlyphs.length > 0) {
    issues.push(`${zeroLayerGlyphs.length} COLR glyphs have zero layers`);
  }

  if (fontCounts.colrGlyphCount > 0 && fontCounts.colrGlyphCount < layerKeys.size) {
    issues.push(
      `COLR table has ${fontCounts.colrGlyphCount} glyphs but layer_info.json has ${layerKeys.size}`,
    );
  }

  return {
    upstreamSvgCount: upstreamNames.length,
    expectedSourceCount: expectedSource.length,
    layerInfoGlyphCount: layerKeys.size,
    zeroLayerGlyphs,
    missingFromLayerInfo,
    extrasOnlyGlyphs,
    ...fontCounts,
    issues,
  };
}

function formatReport(report: CoverageAuditReport): string {
  const lines = [
    'Twemoji COLR coverage audit',
    '===========================',
    `Upstream SVG count: ${report.upstreamSvgCount}`,
    `Expected processed sources (upstream + extras): ${report.expectedSourceCount}`,
    `layer_info.json glyph count: ${report.layerInfoGlyphCount}`,
    `cmap codepoints: ${report.cmapCodepointCount}`,
    `COLR glyphs: ${report.colrGlyphCount}`,
    `CPAL colors: ${report.cpalColorCount}`,
    '',
  ];

  if (report.missingFromLayerInfo.length > 0) {
    lines.push(`Missing from layer_info (${report.missingFromLayerInfo.length}):`);
    lines.push(...report.missingFromLayerInfo.slice(0, 50).map((name) => `  - ${name}`));
    if (report.missingFromLayerInfo.length > 50) {
      lines.push(`  ... and ${report.missingFromLayerInfo.length - 50} more`);
    }
    lines.push('');
  }

  if (report.zeroLayerGlyphs.length > 0) {
    lines.push(`Zero-layer COLR glyphs (${report.zeroLayerGlyphs.length}):`);
    lines.push(...report.zeroLayerGlyphs.slice(0, 50).map((name) => `  - ${name}`));
    if (report.zeroLayerGlyphs.length > 50) {
      lines.push(`  ... and ${report.zeroLayerGlyphs.length - 50} more`);
    }
    lines.push('');
  }

  if (report.issues.length === 0) {
    lines.push('No coverage issues detected.');
  } else {
    lines.push('Issues:');
    lines.push(...report.issues.map((issue) => `  - ${issue}`));
  }

  return `${lines.join('\n')}\n`;
}

export function writeCoverageAuditReports(report: CoverageAuditReport): void {
  writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(reportTextPath, formatReport(report));
}

if (import.meta.main) {
  try {
    const report = runCoverageAudit();
    writeCoverageAuditReports(report);
    console.log(readFileSync(reportTextPath, 'utf8'));

    if (report.issues.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
