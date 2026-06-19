import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface UnicodeRange {
  start: number;
  end: number;
}

const INTERNAL_CMAP_CODEPOINTS = new Set([0x0000, 0x0008, 0x0009, 0x000d, 0x001d]);

export function resolveCodepointsPath(root = process.cwd()): string {
  return join(root, 'build', 'codepoints.js');
}

export function filterUnicodeRangeCodepoints(codepoints: readonly number[]): number[] {
  return codepoints.filter((codepoint) => !INTERNAL_CMAP_CODEPOINTS.has(codepoint));
}

export function readCodepointsFromBuildFile(codepointsFile: string): number[] {
  if (!existsSync(codepointsFile)) {
    throw new Error(`Missing codepoints mapping: ${codepointsFile}. Run build:font first.`);
  }

  const entries = JSON.parse(readFileSync(codepointsFile, 'utf8')) as Record<string, number>;
  const codepoints: number[] = [];

  for (const value of Object.values(entries)) {
    if (typeof value === 'number' && value >= 0) {
      codepoints.push(value);
    }
  }

  return codepoints;
}

export function compressCodepointsToRanges(codepoints: readonly number[]): UnicodeRange[] {
  const sorted = [...new Set(codepoints)].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return [];
  }

  const ranges: UnicodeRange[] = [];
  let start = sorted[0]!;
  let end = start;

  for (const codepoint of sorted.slice(1)) {
    if (codepoint === end + 1) {
      end = codepoint;
      continue;
    }

    ranges.push({ start, end });
    start = codepoint;
    end = codepoint;
  }

  ranges.push({ start, end });
  return ranges;
}

export function formatUnicodeRangeEntry(range: UnicodeRange): string {
  const start = range.start.toString(16).toUpperCase();
  if (range.start === range.end) {
    return `U+${start}`;
  }

  const end = range.end.toString(16).toUpperCase();
  return `U+${start}-${end}`;
}

export function formatUnicodeRangeCss(ranges: readonly UnicodeRange[]): string {
  return ranges.map((range) => `    ${formatUnicodeRangeEntry(range)},`).join('\n');
}

export function parseUnicodeRangeCss(css: string): UnicodeRange[] {
  const ranges: UnicodeRange[] = [];
  const pattern = /U\+([0-9A-F]+)(?:-([0-9A-F]+))?/gi;

  for (const match of css.matchAll(pattern)) {
    const start = Number.parseInt(match[1]!, 16);
    const end = match[2] ? Number.parseInt(match[2], 16) : start;
    ranges.push({ start, end });
  }

  return ranges;
}

export function isCodepointCovered(codepoint: number, ranges: readonly UnicodeRange[]): boolean {
  return ranges.some((range) => range.start <= codepoint && codepoint <= range.end);
}

export function findUncoveredCodepoints(
  codepoints: readonly number[],
  ranges: readonly UnicodeRange[],
): number[] {
  return [...new Set(codepoints)]
    .filter((codepoint) => !isCodepointCovered(codepoint, ranges))
    .sort((a, b) => a - b);
}

export function buildUnicodeRangeCssFromCodepointsFile(codepointsFile: string): string {
  const codepoints = filterUnicodeRangeCodepoints(readCodepointsFromBuildFile(codepointsFile));
  const ranges = compressCodepointsToRanges(codepoints);
  return formatUnicodeRangeCss(ranges);
}
