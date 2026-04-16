import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { runFontforge } from './fontforge-runner.ts';

const root = process.cwd();
const packageJSON = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);

export function buildRawFont(): void {
  runFontforge({
    fontName: 'Twemoji Mozilla',
    version: packageJSON.version,
    glyphDir: join(root, 'build', 'glyphs'),
    outputDir: join(root, 'build', 'raw-font'),
    codepointsFile: join(root, 'build', 'codepoints.js'),
  });
}

if (import.meta.main) {
  buildRawFont();
}
