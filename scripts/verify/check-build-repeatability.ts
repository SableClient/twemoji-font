import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const artifacts = {
  ttf: join(root, 'build', 'Twemoji Mozilla.ttf'),
  woff2: join(root, 'dist', 'twemoji.woff2'),
};

export interface ArtifactInfo {
  hash: string;
  size: number;
}

export type ArtifactSet = Record<string, ArtifactInfo>;

export interface ArtifactComparison {
  stable: boolean;
  changed: string[];
}

export interface BuildCommand {
  command: string;
  args: string[];
}

export interface RepeatabilityHarnessResult extends ArtifactComparison {
  first: ArtifactSet;
  second: ArtifactSet;
}

export interface RepeatabilityHarnessOptions {
  runBuildStep?: () => void;
  readArtifacts?: () => ArtifactSet;
  compare?: (first: ArtifactSet, second: ArtifactSet) => ArtifactComparison;
  writeOutput?: (chunk: string) => boolean;
  setExitCode?: (value: number) => void;
}

export function compareArtifactSets(first: ArtifactSet, second: ArtifactSet): ArtifactComparison {
  const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
  const changed = [...keys].filter((key) => {
    return first[key]?.hash !== second[key]?.hash || first[key]?.size !== second[key]?.size;
  });

  return {
    stable: changed.length === 0,
    changed,
  };
}

export function getBuildCommand(platform: NodeJS.Platform = process.platform): BuildCommand {
  if (platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'vp run build'],
    };
  }

  return {
    command: 'vp',
    args: ['run', 'build'],
  };
}

function readArtifactSet(): ArtifactSet {
  return Object.fromEntries(
    Object.entries(artifacts).map(([name, file]) => {
      const buffer = readFileSync(file);
      return [
        name,
        {
          hash: createHash('sha256').update(buffer).digest('hex'),
          size: statSync(file).size,
        },
      ];
    }),
  );
}

function runBuild(): void {
  const { command, args } = getBuildCommand();
  execFileSync(command, args, { stdio: 'inherit' });
}

export function runRepeatabilityHarness({
  runBuildStep = runBuild,
  readArtifacts = readArtifactSet,
  compare = compareArtifactSets,
  writeOutput = process.stdout.write.bind(process.stdout),
  setExitCode = (value) => {
    process.exitCode = value;
  },
}: RepeatabilityHarnessOptions = {}): RepeatabilityHarnessResult {
  runBuildStep();
  const first = readArtifacts();
  runBuildStep();
  const second = readArtifacts();
  const result = compare(first, second);
  writeOutput(`${JSON.stringify({ first, second, ...result }, null, 2)}\n`);

  if (!result.stable) {
    setExitCode(1);
  }

  return { first, second, ...result };
}

if (import.meta.main) {
  runRepeatabilityHarness();
}
