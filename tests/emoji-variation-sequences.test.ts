import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vite-plus/test';
import {
  getEmojiVariationSequenceMapping,
  isTextPresentationBase,
  shouldEncodeBaseCodepoint,
  shouldSkipTextPresentationSequence,
} from '../scripts/layerize/emoji-variation-sequences.ts';

describe('emoji variation sequence handling', () => {
  it('treats ©, ®, ™, and Ⓜ emoji forms as FE0F-only mappings', () => {
    expect(isTextPresentationBase('a9')).toBe(true);
    expect(isTextPresentationBase('ae')).toBe(true);
    expect(isTextPresentationBase('2122')).toBe(true);
    expect(isTextPresentationBase('24c2')).toBe(true);
    expect(shouldEncodeBaseCodepoint('a9')).toBe(false);
    expect(shouldEncodeBaseCodepoint('ae')).toBe(false);
    expect(shouldEncodeBaseCodepoint('2122')).toBe(false);
    expect(shouldEncodeBaseCodepoint('24c2')).toBe(false);

    expect(getEmojiVariationSequenceMapping(['a9', 'fe0f'])).toEqual({
      base: 'a9',
      selector: 'fe0f',
      glyphName: 'ua9_fe0f',
    });
    expect(getEmojiVariationSequenceMapping(['ae', 'fe0f'])).toEqual({
      base: 'ae',
      selector: 'fe0f',
      glyphName: 'uae_fe0f',
    });
    expect(getEmojiVariationSequenceMapping(['2122', 'fe0f'])).toEqual({
      base: '2122',
      selector: 'fe0f',
      glyphName: 'u2122_fe0f',
    });
    expect(getEmojiVariationSequenceMapping(['24c2', 'fe0f'])).toEqual({
      base: '24c2',
      selector: 'fe0f',
      glyphName: 'u24c2_fe0f',
    });
  });

  it('does not special-case normal emoji sequences', () => {
    expect(isTextPresentationBase('2764')).toBe(false);
    expect(shouldEncodeBaseCodepoint('2764')).toBe(true);
    expect(getEmojiVariationSequenceMapping(['2764', 'fe0f'])).toBeNull();
    expect(getEmojiVariationSequenceMapping(['a9'])).toBeNull();
    expect(getEmojiVariationSequenceMapping(['a9', 'fe0e'])).toBeNull();
  });

  it('drops nonstandard multi-codepoint sequences for text-presentation bases', () => {
    expect(shouldSkipTextPresentationSequence(['a9', '20e3'])).toBe(true);
    expect(shouldSkipTextPresentationSequence(['ae', '20e3'])).toBe(true);
    expect(shouldSkipTextPresentationSequence(['2122', '20e3'])).toBe(true);
    expect(shouldSkipTextPresentationSequence(['24c2', '20e3'])).toBe(true);
    expect(shouldSkipTextPresentationSequence(['a9', 'fe0f'])).toBe(false);
    expect(shouldSkipTextPresentationSequence(['2122', 'fe0f'])).toBe(false);
    expect(shouldSkipTextPresentationSequence(['2764', 'fe0f'])).toBe(false);
  });

  it('wires UVS data generation and post-processing into the build pipeline', () => {
    const layerize = readFileSync(new URL('../scripts/layerize/layerize.ts', import.meta.url), 'utf8');
    const buildFont = readFileSync(new URL('../scripts/build-font.ts', import.meta.url), 'utf8');

    expect(
      existsSync(new URL('../scripts/font/add-variation-selector-mappings.py', import.meta.url)),
    ).toBe(true);
    expect(layerize).toContain("from './emoji-variation-sequences.ts'");
    expect(layerize).toContain('uvs-mappings.json');
    expect(layerize).toContain('shouldSkipTextPresentationSequence');
    expect(buildFont).toContain('add-variation-selector-mappings.py');
    expect(buildFont).toContain('uvs-mappings.json');
  });
});
