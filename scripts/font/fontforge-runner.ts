import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const generateScript = fileURLToPath(new URL('./fontforge-generate.py', import.meta.url));

interface RunFontforgeOptions {
  fontName: string;
  version: string;
  glyphDir: string;
  outputDir: string;
  codepointsFile: string;
}

interface Runnable {
  command: string;
  args: string[];
}

interface CommandProbe {
  command: string;
  probeArgs: string[];
  execArgs: string[];
}

interface SpawnSyncResult {
  error?: Error;
  signal: NodeJS.Signals | null;
  status: number | null;
}

function logStage(message: string): void {
  console.log(`[raw-font] ${message}`);
}

function assertSpawnSuccess(result: SpawnSyncResult, label: string): void {
  if (result.error) {
    throw result.error;
  }
  if (result.signal) {
    throw new Error(`${label} exited from signal ${result.signal}`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} exited with status ${result.status}`);
  }
}

function isCommand(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function findRunnable(candidates: readonly Runnable[]): Runnable | null {
  for (const candidate of candidates) {
    try {
      execFileSync(candidate.command, candidate.args, { stdio: 'ignore' });
      return candidate;
    } catch {
      // Continue probing.
    }
  }

  return null;
}

function findCommand(candidates: readonly CommandProbe[]): CommandProbe | null {
  for (const candidate of candidates) {
    try {
      execFileSync(candidate.command, candidate.probeArgs, { stdio: 'ignore' });
      return candidate;
    } catch {
      // Continue probing.
    }
  }

  return null;
}

function fontForgeCandidates(): string[] {
  return [
    process.env.FONTFORGE,
    'fontforge',
    join(
      process.env.ProgramFiles ?? 'C:\\Program Files',
      'FontForgeBuilds',
      'bin',
      'fontforge.exe',
    ),
    join(
      process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
      'FontForgeBuilds',
      'bin',
      'fontforge.exe',
    ),
  ].filter(isCommand);
}

function pythonCandidates(): string[] {
  return [process.env.PYTHON, 'python', 'python3', 'py'].filter(isCommand);
}

function ttfautohintCandidates(): CommandProbe[] {
  const executables = [process.env.TTFAUTOHINT, 'ttfautohint'].filter(isCommand).map((command) => ({
    command,
    execArgs: ['--symbol', '--fallback-script=latn', '--no-info'],
    probeArgs: ['--version'],
  }));
  const pythonModules = pythonCandidates().map((command) => ({
    command,
    execArgs: ['-m', 'ttfautohint', '--symbol', '--fallback-script=latn', '--no-info'],
    probeArgs: ['-m', 'ttfautohint', '--version'],
  }));
  return [...executables, ...pythonModules];
}

function stageFontForgeConfig(): string {
  const appDataRoot = mkdtempSync(join(tmpdir(), 'twemoji-fontforge-'));
  mkdirSync(join(appDataRoot, 'FontForge', 'plugin'), { recursive: true });
  return appDataRoot;
}

function mergePythonWarnings(currentWarnings: string | undefined): string {
  const targetedWarning = 'ignore:pkg_resources is deprecated as an API:UserWarning';
  return [currentWarnings, targetedWarning].filter(isCommand).join(',');
}

export function runFontforge({
  fontName,
  version,
  glyphDir,
  outputDir,
  codepointsFile,
}: RunFontforgeOptions): void {
  const fontforge = findRunnable(
    fontForgeCandidates().map((command) => ({ command, args: ['-version'] })),
  );
  const ttfautohint = findCommand(ttfautohintCandidates());

  if (!fontforge) {
    throw new Error('FontForge executable not found');
  }

  if (!ttfautohint) {
    throw new Error(
      'ttfautohint not found; install ttfautohint-py with python -m pip install -e . or set TTFAUTOHINT',
    );
  }

  if (!existsSync(codepointsFile)) {
    throw new Error(`Codepoints file not found: ${codepointsFile}`);
  }

  const stagedAppData = stageFontForgeConfig();
  const codepoints = JSON.parse(readFileSync(codepointsFile, 'utf8'));
  const env = {
    ...process.env,
    APPDATA: stagedAppData,
    PATH: `${dirname(fontforge.command)}${delimiter}${process.env.PATH ?? ''}`,
    PYTHONWARNINGS: mergePythonWarnings(process.env.PYTHONWARNINGS),
  };
  const outputFont = join(outputDir, `${fontName}.ttf`);
  const hintedFont = join(outputDir, `${fontName}.hinted.ttf`);

  try {
    mkdirSync(outputDir, { recursive: true });
    logStage('running FontForge');
    const fontforgeResult = spawnSync(fontforge.command, ['-script', generateScript], {
      env,
      input: JSON.stringify({
        addLigatures: false,
        autoHint: false,
        codepoints,
        descent: 64,
        dest: outputDir,
        fontFamilyName: fontName,
        fontFilename: fontName,
        fontHeight: 512,
        inputDir: glyphDir,
        normalize: false,
        round: 10e12,
        types: ['ttf'],
        version,
        zerowidth: ['20e3'],
      }),
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    assertSpawnSuccess(fontforgeResult, 'FontForge');

    if (!existsSync(outputFont)) {
      throw new Error(`FontForge did not emit the expected TTF: ${outputFont}`);
    }

    logStage('running ttfautohint');
    rmSync(hintedFont, { force: true });
    execFileSync(ttfautohint.command, [...ttfautohint.execArgs, outputFont, hintedFont], {
      env,
      stdio: 'inherit',
    });

    if (!existsSync(hintedFont)) {
      throw new Error(`ttfautohint did not emit the expected TTF: ${hintedFont}`);
    }

    rmSync(outputFont, { force: true });
    renameSync(hintedFont, outputFont);
    logStage('raw TTF ready');
  } finally {
    rmSync(stagedAppData, { recursive: true, force: true });
    rmSync(hintedFont, { force: true });
  }
}
