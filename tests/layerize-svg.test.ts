import { describe, expect, it } from 'vite-plus/test';
import { readFileSync } from 'node:fs';
import { createLayerSvg } from '../scripts/layerize/layerize-svg.ts';

describe('layerize svg helpers', () => {
  it('keeps referenced clipPath defs in emitted layer SVGs', () => {
    const svg = createLayerSvg(
      { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 36 36' },
      [
        {
          '#name': 'path',
          $: {
            d: 'M0 0L1 1',
            'clip-path': 'url(#a)',
            fill: '#000',
          },
        },
      ],
      {
        '#a': {
          '#name': 'clipPath',
          $: { id: 'a', clipPathUnits: 'userSpaceOnUse' },
          $$: [{ '#name': 'path', $: { d: 'M-1 -1H1V1H-1Z' } }],
        },
      },
    );

    expect(svg).toContain('<defs>');
    expect(svg).toContain('<clipPath id="a" clipPathUnits="userSpaceOnUse">');
    expect(svg).toContain('<path d="M-1 -1H1V1H-1Z"/>');
    expect(svg).toContain('clip-path="url(#a)"');
  });

  it('does not treat defs blocks as drawable layers', () => {
    const layerize = readFileSync(
      new URL('../scripts/layerize/layerize.ts', import.meta.url),
      'utf8',
    );
    const defsBlockStart = layerize.indexOf("if (e['#name'] === 'defs') {");
    const defsBlockEnd = layerize.indexOf("if (e['$'] === undefined) {");
    const defsBlock = layerize.slice(defsBlockStart, defsBlockEnd);

    expect(defsBlockStart).toBeGreaterThan(-1);
    expect(defsBlockEnd).toBeGreaterThan(defsBlockStart);
    expect(defsBlock).toContain("e['$$'].forEach");
    expect(defsBlock).toContain('return;');
  });
});
