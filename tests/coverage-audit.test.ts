import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { runCoverageAudit } from '../scripts/verify/coverage-audit.ts';

describe('coverage audit', () => {
  it('reports healthy coverage against the warmed upstream cache', () => {
    if (!existsSync(join(process.cwd(), 'build', 'layer_info.json'))) {
      return;
    }

    const report = runCoverageAudit();

    expect(report.upstreamSvgCount).toBeGreaterThan(3800);
    expect(report.layerInfoGlyphCount).toBeGreaterThan(3800);
    expect(report.zeroLayerGlyphs).toEqual([]);
    expect(report.missingFromLayerInfo.length).toBeLessThan(10);
  });
});
