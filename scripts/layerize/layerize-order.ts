export interface GlyphRecord {
  fileName: string;
}

export interface LigatureRecord {
  unicodes: string[];
}

export function sortGlyphRecords<T extends GlyphRecord>(records: readonly T[]): T[] {
  return [...records].sort((a, b) => a.fileName.localeCompare(b.fileName, 'en'));
}

export function sortLigatures<T extends LigatureRecord>(ligatures: readonly T[]): T[] {
  return [...ligatures].sort((a, b) =>
    a.unicodes.join('-').localeCompare(b.unicodes.join('-'), 'en'),
  );
}

export function sortPalette(colors: readonly string[]): string[] {
  return [...colors].sort((a, b) => a.localeCompare(b, 'en'));
}

export function sortCodepointEntries(entries: readonly string[]): string[] {
  return [...entries].sort((a, b) => a.localeCompare(b, 'en'));
}
