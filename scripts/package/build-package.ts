import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const distDir = join(root, 'dist');
const inputTtf = join(root, 'build', 'Twemoji Mozilla.ttf');
const inputWoff2 = join(root, 'build', 'Twemoji Mozilla.ttf.woff2');
const distWoff2 = join(distDir, 'twemoji.woff2');
const cssSource = join(root, 'src', 'index.css');

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

logStage('resetting dist/');
rmSync(distDir, { force: true, recursive: true });
mkdirSync(distDir, { recursive: true });

logStage('copying packaged font and stylesheet');
cpSync(ensureWoff2(), distWoff2);
cpSync(cssSource, join(distDir, 'index.css'));
logStage('dist package ready');
