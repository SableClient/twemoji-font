import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

export function readUpstreamSvgFixture(fileName: string): string {
  return readFileSync(
    fileURLToPath(new URL(`./upstream-svg/${fileName}.svg`, import.meta.url)),
    'utf8',
  );
}
