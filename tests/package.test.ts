import { describe, expect, it } from 'vite-plus/test';
import pkg from '../package.json' with { type: 'json' };

describe('package output', () => {
  it('exposes the expected public package surface and pinned upstream source metadata', () => {
    expect(pkg.name).toBe('@sableclient/twemoji-font');
    expect(pkg.type).toBe('module');
    expect(pkg.files).toEqual(['dist']);
    expect(pkg.exports['.']).toEqual({
      sass: './dist/index.css',
      default: './dist/index.css',
    });
    expect(pkg.exports['./*']).toEqual({
      sass: './dist/*.css',
      default: './dist/*.css',
    });
    expect(pkg.exports['./*.css']).toEqual({
      sass: './dist/*.css',
      default: './dist/*.css',
    });
    expect(pkg.exports['./files/*']).toEqual({
      sass: './dist/files/*',
      default: './dist/files/*',
    });
    expect(pkg.exports['./files/*.woff2']).toEqual({
      sass: './dist/files/*.woff2',
      default: './dist/files/*.woff2',
    });
    expect(pkg.exports['./package.json']).toBe('./package.json');
    expect('engines' in pkg).toBe(false);
    expect('./font' in pkg.exports).toBe(false);
    expect('./metadata' in pkg.exports).toBe(false);
    expect(pkg.twemoji).toMatchObject({
      version: expect.any(String),
      commit: expect.stringMatching(/^[0-9a-f]{40}$/),
      source: expect.stringMatching(/\/v\/[0-9]+\.[0-9]+\.[0-9]+\/svg$/),
    });
  });
});
