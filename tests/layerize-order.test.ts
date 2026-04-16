import { describe, expect, it } from 'vite-plus/test';
import {
  sortGlyphRecords,
  sortLigatures,
  sortPalette,
  sortCodepointEntries,
} from '../scripts/layerize/layerize-order.ts';

describe('layerize ordering helpers', () => {
  it('sorts glyph records by filename', () => {
    expect(
      sortGlyphRecords([{ fileName: 'u1f600.svg' }, { fileName: 'u1f44d.svg' }]).map(
        (entry) => entry.fileName,
      ),
    ).toEqual(['u1f44d.svg', 'u1f600.svg']);
  });

  it('sorts ligatures by unicode sequence', () => {
    expect(
      sortLigatures([
        { unicodes: ['1f469', '200d', '1f4bb'] },
        { unicodes: ['1f1e6', '1f1fa'] },
      ]).map((entry) => entry.unicodes.join('-')),
    ).toEqual(['1f1e6-1f1fa', '1f469-200d-1f4bb']);
  });

  it('sorts palette colors and codepoint entries stably', () => {
    expect(sortPalette(['#ffffff00', '#000000ff'])).toEqual(['#000000ff', '#ffffff00']);
    expect(sortCodepointEntries(['"u1f600": -1', '"u1f44d": -1'])).toEqual([
      '"u1f44d": -1',
      '"u1f600": -1',
    ]);
  });
});
