import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vite-plus/test';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const lockfile = readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8');
const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');

describe('tooling surface', () => {
  it('uses a single root tsconfig for the canonical typecheck surface', () => {
    expect(existsSync(new URL('../vite.config.ts', import.meta.url))).toBe(true);
    expect(pkg.devDependencies?.['vite-plus']).toBeTruthy();
    expect(pkg.devDependencies?.tsx).toBeUndefined();
    expect(pkg.scripts).toMatchObject({
      'build:font': 'node scripts/build-font.ts',
      'build:package': 'node scripts/package/build-package.ts',
      'build:release-assets': 'node scripts/package/build-release-assets.ts',
      build: 'vp run build:font && vp run build:package',
      typecheck: 'tsc -p tsconfig.json',
      smoke: 'node scripts/package/smoke-test-package.ts',
      'check:upstream': 'node scripts/upstream/check-upstream.ts',
      'prepare:upstream': 'node scripts/upstream/publish-prepare.ts',
      'check:repeatability': 'node scripts/verify/check-build-repeatability.ts',
      'verify:ci': 'vp run typecheck && vp run smoke',
      test: 'vp test run',
      lint: 'vp lint',
      fmt: 'vp fmt',
      check: 'vp check',
      verify:
        'vp run build && vp run test && vp run typecheck && vp run smoke && vp run check:repeatability',
    });
    expect(lockfile).toContain('overrides:');
    expect(lockfile).toContain('vite: npm:@voidzero-dev/vite-plus-core@^0.1.18');
    expect(lockfile).toContain('vitest: npm:@voidzero-dev/vite-plus-test@^0.1.18');
    expect(viteConfig).toContain("import { defineConfig } from 'vite-plus';");
    expect(viteConfig).toMatch(/test:\s*\{\s*include:\s*\['tests\/\*\*\/\*\.test\.ts'\],?\s*\}/);
    expect(viteConfig).toContain('typeAware: true');
    expect(viteConfig).toContain('typeCheck: true');
    expect(viteConfig).not.toContain('run: {');
    expect(viteConfig).not.toContain('tasks: false');
    expect(existsSync(new URL('../tsconfig.json', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../tsconfig.node.json', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../scripts/tsconfig.json', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../tests/workflows.test.ts', import.meta.url))).toBe(true);
  });
});
