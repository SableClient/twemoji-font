import { execFileSync } from 'node:child_process';
import type { ExecFileSyncOptions } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { buildRawFont } from './font/build-raw-font.ts';
import { ensureTwemojiSvgDir } from './upstream/twemoji-source.ts';

const root = process.cwd();
const fontName = 'Twemoji Mozilla';
const buildDir = join(root, 'build');
const rawFont = join(buildDir, 'raw-font', `${fontName}.ttf`);
const rawFontNames = `${rawFont}.names`;
const rawFontTemporary = join(buildDir, 'raw-font', `${fontName}.temporary.ttf`);
const finalTarget = join(buildDir, `${fontName}.ttf`);
const otSource = join(buildDir, `${fontName}.ttx`);
const layerizeScript = join(root, 'scripts', 'layerize', 'layerize.ts');
const fixDirectionScript = join(root, 'scripts', 'font', 'fix-direction.py');
const normalizeFontMetadataScript = join(root, 'scripts', 'font', 'normalize-font-metadata.py');

function logStage(message: string): void {
  console.log(`[build:font] ${message}`);
}

function isCommand(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function run(command: string, args: readonly string[], options: ExecFileSyncOptions = {}): void {
  execFileSync(command, args, { stdio: 'inherit', ...options });
}

function requireCommand(command: string | null, message: string): string {
  if (!command) {
    throw new Error(message);
  }

  return command;
}

function findRunnable(
  candidates: readonly (string | null | undefined)[],
  versionArgs: readonly string[],
): string | null {
  for (const candidate of candidates.filter(isCommand)) {
    try {
      run(candidate, versionArgs, { stdio: 'ignore' });
      return candidate;
    } catch {
      // Continue probing.
    }
  }

  return null;
}

function fontForgeCandidates(binary: 'fontforge.exe' | 'ffpython.exe'): Array<string | undefined> {
  return [
    process.env[binary === 'fontforge.exe' ? 'FONTFORGE' : 'FFPYTHON'],
    binary === 'fontforge.exe' ? 'fontforge' : 'ffpython',
    join(process.env.ProgramFiles ?? 'C:\\Program Files', 'FontForgeBuilds', 'bin', binary),
    join(
      process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
      'FontForgeBuilds',
      'bin',
      binary,
    ),
  ];
}

function pythonCandidates(): Array<string | undefined> {
  return [process.env.PYTHON, 'py', 'python3', 'python'];
}

const fontforge = requireCommand(
  findRunnable(fontForgeCandidates('fontforge.exe'), ['-version']),
  'FontForge executable not found',
);
const ffpython = requireCommand(
  findRunnable(fontForgeCandidates('ffpython.exe'), ['-V']),
  'FontForge Python runtime not found',
);
const python = requireCommand(
  findRunnable(pythonCandidates(), ['--version']),
  'Python executable not found',
);

const fontForgeBinDir = dirname(fontforge);
const env = { ...process.env, PATH: `${fontForgeBinDir}${delimiter}${process.env.PATH ?? ''}` };

export async function buildFont(): Promise<void> {
  logStage('ensuring pinned upstream SVG cache');
  const sourceSvgDir = await ensureTwemojiSvgDir(root, logStage);
  logStage('layerizing SVG inputs');
  run('node', [layerizeScript, sourceSvgDir, 'overrides', 'extras', 'build', fontName], { env });
  logStage('building raw TTF with FontForge');
  buildRawFont();

  if (!existsSync(rawFont) || !existsSync(otSource)) {
    throw new Error('Build pipeline did not emit the expected TTF and TTX outputs');
  }

  logStage('normalizing raw font metadata');
  run(python, [normalizeFontMetadataScript, rawFont], { env });

  logStage('resetting intermediate artifacts');
  rmSync(rawFontNames, { force: true });
  rmSync(rawFontTemporary, { force: true });
  rmSync(finalTarget, { force: true });

  logStage('dumping name table');
  run(python, ['-m', 'fontTools.ttx', '-f', '-t', 'name', '-o', rawFontNames, rawFont], { env });

  logStage('rewriting PostScript name records');
  const namesXml = readFileSync(rawFontNames, 'utf8').replace(
    /(<namerecord\b[^>]*nameID="6"[^>]*>)([^<]*)(<\/namerecord>)/g,
    (_, start, value, end) =>
      `${start}${value.replaceAll('Twemoji Mozilla', 'TwemojiMozilla')}${end}`,
  );
  writeFileSync(rawFontNames, namesXml);

  logStage('rebuilding temporary TTF with normalized names');
  run(
    python,
    [
      '-m',
      'fontTools.ttx',
      '-f',
      '--no-recalc-timestamp',
      '-m',
      rawFont,
      '-o',
      rawFontTemporary,
      rawFontNames,
    ],
    {
      env,
    },
  );
  logStage('fixing glyph contour direction');
  run(ffpython, [fixDirectionScript, rawFontTemporary], { env });
  logStage('normalizing temporary font metadata');
  run(python, [normalizeFontMetadataScript, rawFontTemporary], { env });
  logStage('merging OpenType tables into final TTF');
  run(
    python,
    [
      '-m',
      'fontTools.ttx',
      '-f',
      '--no-recalc-timestamp',
      '-m',
      rawFontTemporary,
      '-o',
      finalTarget,
      otSource,
    ],
    {
      env,
    },
  );
  logStage('final TTF ready');
}

if (import.meta.main) {
  await buildFont();
}
