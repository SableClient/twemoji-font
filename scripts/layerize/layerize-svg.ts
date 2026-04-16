type SvgAttributes = Record<string, string>;

export interface SvgNode {
  '#name': string;
  $?: SvgAttributes;
  $$?: SvgNode[];
}

type SvgDefs = Record<string, SvgNode>;

const urlReferencePattern = /^url\(#(.+)\)$/;

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function serializeAttributes(attributes: SvgAttributes | undefined): string {
  if (!attributes) {
    return '';
  }

  return Object.entries(attributes)
    .map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`)
    .join('');
}

function serializeNode(node: SvgNode): string {
  const attributes = serializeAttributes(node.$);
  if (!node.$$ || node.$$.length === 0) {
    return `<${node['#name']}${attributes}/>`;
  }

  return `<${node['#name']}${attributes}>${node.$$.map(serializeNode).join('')}</${node['#name']}>`;
}

function extractReferencedIds(node: SvgNode): string[] {
  const direct = Object.values(node.$ ?? {}).flatMap((value) => {
    const urlMatch = value.match(urlReferencePattern);
    if (urlMatch) {
      return [urlMatch[1]];
    }
    if (value.startsWith('#')) {
      return [value.slice(1)];
    }
    return [];
  });

  return [...direct, ...(node.$$?.flatMap(extractReferencedIds) ?? [])];
}

function collectReferencedDefs(nodes: readonly SvgNode[], defs: SvgDefs): SvgNode[] {
  const queue = nodes.flatMap(extractReferencedIds);
  const seen = new Set<string>();
  const ordered: SvgNode[] = [];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);

    const def = defs[`#${id}`];
    if (!def) {
      continue;
    }

    ordered.push(def);
    queue.push(...extractReferencedIds(def));
  }

  return ordered;
}

export function createLayerSvg(
  svgAttributes: SvgAttributes,
  nodes: readonly SvgNode[],
  defs: SvgDefs,
): string {
  const referencedDefs = collectReferencedDefs(nodes, defs);
  const defsMarkup =
    referencedDefs.length > 0 ? `<defs>${referencedDefs.map(serializeNode).join('')}</defs>` : '';

  return `<svg${serializeAttributes(svgAttributes)}>${defsMarkup}${nodes
    .map(serializeNode)
    .join('')}</svg>`;
}
