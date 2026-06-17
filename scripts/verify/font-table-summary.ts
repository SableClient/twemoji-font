import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface FontTableSummary {
  cmapCodepointCount: number;
  colrGlyphCount: number;
  cpalColorCount: number;
  has1f979Colr: boolean;
}

function findPythonCommand(): string | null {
  for (const command of ['python', 'python3', 'py']) {
    try {
      execFileSync(command, ['--version'], { stdio: 'ignore' });
      return command;
    } catch {
      // Try the next executable.
    }
  }

  return null;
}

export function readFontTableSummary(fontFile: string): FontTableSummary | null {
  if (!existsSync(fontFile)) {
    return null;
  }

  const python = findPythonCommand();
  if (!python) {
    return null;
  }

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
has_1f979 = False
if colr:
    for name in colr.ColorLayers:
        if name in ('u1f979', 'u1f979_fe0f'):
            has_1f979 = True
            break
print(f"{len(codes)}\\t{colr_count}\\t{cpal_count}\\t{1 if has_1f979 else 0}")
`;

  try {
    const output = execFileSync(python, ['-c', script], { encoding: 'utf8' }).trim();
    const [cmapCodepointCount, colrGlyphCount, cpalColorCount, has1f979Colr] = output
      .split('\t')
      .map((value) => Number(value));

    return {
      cmapCodepointCount,
      colrGlyphCount,
      cpalColorCount,
      has1f979Colr: has1f979Colr === 1,
    };
  } catch {
    return null;
  }
}

export function resolveBuiltFontPath(root = process.cwd()): string {
  return join(root, 'build', 'Twemoji Mozilla.ttf');
}

export function resolvePackagedWoff2Path(root = process.cwd()): string {
  return join(root, 'dist', 'files', 'twemoji.woff2');
}
