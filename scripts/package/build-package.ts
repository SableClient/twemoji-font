import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const distDir = join(root, 'dist');
const distFilesDir = join(distDir, 'files');
const inputWoff2 = join(root, 'build', 'Twemoji Mozilla.ttf.woff2');
const distWoff2 = join(distFilesDir, 'twemoji.woff2');

function logStage(message: string): void {
  console.log(`[build:package] ${message}`);
}

function isCommand(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function findPythonCommand(): string {
  const candidates = [
    ...new Set([process.env.PYTHON, 'py', 'python3', 'python'].filter(isCommand)),
  ];

  for (const command of candidates) {
    try {
      execFileSync(command, ['--version'], { stdio: 'ignore' });
      return command;
    } catch {
      // Try the next available Python executable.
    }
  }

  throw new Error('No Python executable found for WOFF2 conversion');
}

function ensureWoff2(): string {
  if (existsSync(inputWoff2)) {
    logStage('reusing existing WOFF2 artifact from build/');
    return inputWoff2;
  }

  const inputTtf = join(root, 'build', 'Twemoji Mozilla.ttf');

  if (!existsSync(inputTtf)) {
    throw new Error(`Missing built font: ${inputWoff2} or ${inputTtf}`);
  }

  const python = findPythonCommand();

  logStage('compressing TTF into WOFF2');
  execFileSync(python, ['-m', 'fontTools.ttLib.woff2', 'compress', inputTtf, '-o', inputWoff2], {
    stdio: 'inherit',
  });

  if (!existsSync(inputWoff2)) {
    throw new Error(`WOFF2 conversion failed: ${inputWoff2}`);
  }

  return inputWoff2;
}

function createFontFaceCss(src: string): string {
  return [
    '@font-face {',
    "  font-family: 'Twemoji';",
    `  src: ${src};`,
    '  font-display: swap;',
    '}',
    '',
  ].join('\n');
}

logStage('resetting dist/');
rmSync(distDir, { force: true, recursive: true });
mkdirSync(distDir, { recursive: true });
mkdirSync(distFilesDir, { recursive: true });

logStage('copying packaged font files');
cpSync(ensureWoff2(), distWoff2);

logStage('writing CSS entrypoint');
writeFileSync(
  join(distDir, 'index.css'),
  createFontFaceCss("url('./files/twemoji.woff2') format('woff2')"),
);
logStage('dist package ready');
