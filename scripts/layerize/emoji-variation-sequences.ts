export interface EmojiVariationSequenceMapping {
  base: string;
  selector: string;
  glyphName: string;
}

const textPresentationBases = new Set(['a9', 'ae', '2122', '24c2']);

function normalizeCodepoint(unicode: string): string {
  const normalized = unicode.toLowerCase().replace(/^0+/, '');
  return normalized === '' ? '0' : normalized;
}

export function isTextPresentationBase(unicode: string): boolean {
  return textPresentationBases.has(normalizeCodepoint(unicode));
}

export function shouldEncodeBaseCodepoint(unicode: string): boolean {
  return !isTextPresentationBase(unicode);
}

export function shouldSkipTextPresentationSequence(unicodes: readonly string[]): boolean {
  if (unicodes.length === 0) {
    return false;
  }

  const normalized = unicodes.map(normalizeCodepoint);
  if (!textPresentationBases.has(normalized[0])) {
    return false;
  }

  return !(normalized.length === 2 && normalized[1] === 'fe0f');
}

export function getEmojiVariationSequenceMapping(
  unicodes: readonly string[],
): EmojiVariationSequenceMapping | null {
  if (unicodes.length !== 2) {
    return null;
  }

  const base = normalizeCodepoint(unicodes[0]);
  const selector = normalizeCodepoint(unicodes[1]);
  if (!textPresentationBases.has(base) || selector !== 'fe0f') {
    return null;
  }

  return {
    base,
    selector,
    glyphName: `u${base}_${selector}`,
  };
}
