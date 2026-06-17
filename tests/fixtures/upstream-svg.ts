import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function readUpstreamSvgFixture(fileName: string): string {
  return readFileSync(
    fileURLToPath(new URL(`./upstream-svg/${fileName}.svg`, import.meta.url)),
    'utf8',
  );
}
