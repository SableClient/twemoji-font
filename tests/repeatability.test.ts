import { describe, expect, it, vi } from 'vite-plus/test';
import {
  compareArtifactSets,
  getBuildCommand,
  runRepeatabilityHarness,
} from '../scripts/verify/check-build-repeatability.ts';

describe('build repeatability helpers', () => {
  it('flags changed artifacts when hashes or sizes differ', () => {
    expect(
      compareArtifactSets(
        {
          ttf: { hash: 'a', size: 1 },
          woff2: { hash: 'b', size: 2 },
        },
        {
          ttf: { hash: 'a', size: 1 },
          woff2: { hash: 'c', size: 3 },
        },
      ),
    ).toEqual({
      stable: false,
      changed: ['woff2'],
    });
  });

  it('selects the platform-specific build command', () => {
    expect(getBuildCommand('win32')).toEqual({
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'vp run build'],
    });

    expect(getBuildCommand('linux')).toEqual({
      command: 'vp',
      args: ['run', 'build'],
    });
  });

  it('runs the harness in-process and reports unstable output', () => {
    const writes: string[] = [];
    let exitCode: number | undefined;
    const result = runRepeatabilityHarness({
      runBuildStep: vi.fn(),
      readArtifacts: vi
        .fn()
        .mockReturnValueOnce({
          ttf: { hash: 'a', size: 1 },
          woff2: { hash: 'b', size: 2 },
        })
        .mockReturnValueOnce({
          ttf: { hash: 'a', size: 1 },
          woff2: { hash: 'c', size: 3 },
        }),
      compare: compareArtifactSets,
      writeOutput: (value) => {
        writes.push(value);
        return true;
      },
      setExitCode: (value) => {
        exitCode = value;
      },
    });

    expect(result).toEqual({
      first: {
        ttf: { hash: 'a', size: 1 },
        woff2: { hash: 'b', size: 2 },
      },
      second: {
        ttf: { hash: 'a', size: 1 },
        woff2: { hash: 'c', size: 3 },
      },
      stable: false,
      changed: ['woff2'],
    });
    expect(exitCode).toBe(1);
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0])).toEqual(result);
  });
});
