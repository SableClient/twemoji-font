import type { SvgNode } from './layerize-svg.ts';

const numberPattern = '\\s*(-?(?:[0-9]*\\.[0-9]+|[0-9]+)),?';

type PenPosition = { x: number; y: number };

function walkPath(pathData: string, endIndex = pathData.length): PenPosition {
  let x = 0;
  let y = 0;
  let segStart: PenPosition | undefined;
  let d = pathData.slice(0, endIndex);

  while (d !== '') {
    const matches = d.match('^\\s*([MmLlHhVvCcZzSsTtQqAa])');
    if (!matches) {
      break;
    }
    const len = matches[0].length;
    d = d.substr(len);
    const op = matches[1];
    let coords: RegExpMatchArray | null;
    const c = numberPattern;

    if (op === 'M') {
      let first = true;
      while ((coords = d.match('^' + c + c))) {
        d = d.substr(coords[0].length);
        x = Number(coords[1]);
        y = Number(coords[2]);
        if (first) {
          segStart = { x, y };
        }
        first = false;
      }
      if (first) {
        break;
      }
    } else if (op === 'm') {
      let first = true;
      while ((coords = d.match('^' + c + c))) {
        d = d.substr(coords[0].length);
        x += Number(coords[1]);
        y += Number(coords[2]);
        if (first) {
          segStart = { x, y };
        }
        first = false;
      }
      if (first) {
        break;
      }
    } else if (op === 'L') {
      while ((coords = d.match('^' + c + c))) {
        d = d.substr(coords[0].length);
        x = Number(coords[1]);
        y = Number(coords[2]);
      }
    } else if (op === 'l') {
      while ((coords = d.match('^' + c + c))) {
        d = d.substr(coords[0].length);
        x += Number(coords[1]);
        y += Number(coords[2]);
      }
    } else if (op === 'H') {
      while ((coords = d.match('^' + c))) {
        d = d.substr(coords[0].length);
        x = Number(coords[1]);
      }
    } else if (op === 'h') {
      while ((coords = d.match('^' + c))) {
        d = d.substr(coords[0].length);
        x += Number(coords[1]);
      }
    } else if (op === 'V') {
      while ((coords = d.match('^' + c))) {
        d = d.substr(coords[0].length);
        y = Number(coords[1]);
      }
    } else if (op === 'v') {
      while ((coords = d.match('^' + c))) {
        d = d.substr(coords[0].length);
        y += Number(coords[1]);
      }
    } else if (op === 'C') {
      while ((coords = d.match('^' + c + c + c + c + c + c))) {
        d = d.substr(coords[0].length);
        x = Number(coords[5]);
        y = Number(coords[6]);
      }
    } else if (op === 'c') {
      while ((coords = d.match('^' + c + c + c + c + c + c))) {
        d = d.substr(coords[0].length);
        x += Number(coords[5]);
        y += Number(coords[6]);
      }
    } else if (op === 'S') {
      while ((coords = d.match('^' + c + c + c + c))) {
        d = d.substr(coords[0].length);
        x = Number(coords[3]);
        y = Number(coords[4]);
      }
    } else if (op === 's') {
      while ((coords = d.match('^' + c + c + c + c))) {
        d = d.substr(coords[0].length);
        x += Number(coords[3]);
        y += Number(coords[4]);
      }
    } else if (op === 'Q') {
      while ((coords = d.match('^' + c + c + c + c))) {
        d = d.substr(coords[0].length);
        x = Number(coords[3]);
        y = Number(coords[4]);
      }
    } else if (op === 'q') {
      while ((coords = d.match('^' + c + c + c + c))) {
        d = d.substr(coords[0].length);
        x += Number(coords[3]);
        y += Number(coords[4]);
      }
    } else if (op === 'T') {
      while ((coords = d.match('^' + c + c))) {
        d = d.substr(coords[0].length);
        x = Number(coords[1]);
        y = Number(coords[2]);
      }
    } else if (op === 't') {
      while ((coords = d.match('^' + c + c))) {
        d = d.substr(coords[0].length);
        x += Number(coords[1]);
        y += Number(coords[2]);
      }
    } else if (op === 'A') {
      while ((coords = d.match('^' + c + c + c + c + c + c + c))) {
        d = d.substr(coords[0].length);
        x = Number(coords[6]);
        y = Number(coords[7]);
      }
    } else if (op === 'a') {
      while ((coords = d.match('^' + c + c + c + c + c + c + c))) {
        d = d.substr(coords[0].length);
        x += Number(coords[6]);
        y += Number(coords[7]);
      }
    } else if (op === 'Z' || op === 'z') {
      if (segStart !== undefined) {
        x = segStart.x;
        y = segStart.y;
      }
    }
  }

  return { x, y };
}

function findSubpathBoundaries(pathData: string): number[] {
  const boundaries = new Set<number>();

  for (const match of pathData.matchAll(/(?<=[Zz])\s*(?=[Mm])/g)) {
    if (match.index === undefined) {
      continue;
    }

    const tail = pathData.slice(match.index);
    const moveto = tail.match(/[Mm]/);
    if (moveto?.index !== undefined) {
      boundaries.add(match.index + moveto.index);
    }
  }

  for (const match of pathData.matchAll(/(?<=[\d.])\s*(?=m(?=[-+\d.]))/g)) {
    if (match.index !== undefined) {
      boundaries.add(match.index + match[0].length);
    }
  }

  return [...boundaries].sort((a, b) => a - b);
}

function splitAtBoundaries(pathData: string, boundaries: number[]): string[] {
  if (boundaries.length === 0) {
    return [pathData];
  }

  const segments: string[] = [];
  let start = 0;
  for (const boundary of boundaries) {
    segments.push(pathData.slice(start, boundary).trim());
    start = boundary;
  }
  segments.push(pathData.slice(start).trim());
  return segments.filter((segment) => segment.length > 0);
}

function absolutizeSubpathStart(segment: string, pen: PenPosition): string {
  const trimmed = segment.trim();
  const moveto = trimmed.match(
    /^([Mm])\s*(-?(?:[0-9]*\.[0-9]+|[0-9]+))(?:\s*,?\s*(-?(?:[0-9]*\.[0-9]+|[0-9]+)))?/,
  );
  if (!moveto) {
    return trimmed;
  }

  const dx = Number(moveto[2]);
  const dy = moveto[3] !== undefined ? Number(moveto[3]) : 0;
  const absX = moveto[1] === 'm' ? pen.x + dx : dx;
  const absY = moveto[1] === 'm' ? pen.y + dy : dy;
  let rest = trimmed.slice(moveto[0].length);
  if (/^\s*[-\d.]/.test(rest)) {
    const lineCommand = moveto[1] === 'm' ? 'l' : 'L';
    rest = `${lineCommand}${rest.trim()}`;
  }

  return `M${absX} ${absY}${rest}`;
}

export function normalizeLeadingMoveto(
  pathData: string,
  pen: PenPosition = { x: 0, y: 0 },
): string {
  const trimmed = pathData.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }

  if (trimmed.startsWith('m')) {
    return absolutizeSubpathStart(trimmed, pen);
  }

  return trimmed;
}

function absolutizeSplitSegments(
  pathData: string,
  segments: string[],
  boundaries: number[],
): string[] {
  if (segments.length <= 1) {
    return segments;
  }

  const result: string[] = [normalizeLeadingMoveto(segments[0])];

  for (let index = 1; index < segments.length; index += 1) {
    const pen = walkPath(pathData, boundaries[index - 1]);
    result.push(absolutizeSubpathStart(segments[index], pen));
  }

  return result;
}

export function splitCompoundPathData(pathData: string): string[] {
  const normalized = normalizeLeadingMoveto(pathData);
  const boundaries = findSubpathBoundaries(normalized);
  if (boundaries.length === 0) {
    return [normalized];
  }

  const segments = splitAtBoundaries(normalized, boundaries);
  return absolutizeSplitSegments(normalized, segments, boundaries);
}

export function preparePathDataForFontForge(pathData: string): string {
  return ensureClosedPathForFontForge(normalizeLeadingMoveto(pathData));
}

export function splitCompoundPathElement(pathElement: SvgNode): SvgNode[] {
  if (pathElement['#name'] !== 'path') {
    return [pathElement];
  }

  const pathData = pathElement.$?.d;
  if (!pathData) {
    return [pathElement];
  }

  const segments = splitCompoundPathData(pathData);
  if (segments.length <= 1) {
    return [pathElement];
  }

  return segments.map((segment) => ({
    ...pathElement,
    $: {
      ...pathElement.$,
      d: segment,
    },
  }));
}

export function ensureClosedPathForFontForge(pathData: string): string {
  const trimmed = pathData.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }

  if (/[Zz]\s*$/.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}z`;
}
