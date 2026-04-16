import {
  buildVersionFileText,
  prepareTwemojiUpstream,
  resolveVersionArgument,
} from './twemoji-source.ts';

function logStage(message: string): void {
  console.log('[prepare:upstream] ' + message);
}

export { buildVersionFileText, resolveVersionArgument } from './twemoji-source.ts';

export async function prepareUpstream(
  version: string,
): Promise<{ version: string; commit: string; source: string }> {
  return prepareTwemojiUpstream(version, process.cwd(), logStage);
}

if (import.meta.main) {
  const version = resolveVersionArgument(process.argv);

  if (!version) {
    throw new Error('Expected a Twemoji version argument');
  }

  const prepared = await prepareUpstream(version);
  process.stdout.write(`${JSON.stringify(prepared, null, 2)}\n`);
}
