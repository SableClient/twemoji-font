import fs from 'node:fs';
import xmlbuilder from 'xmlbuilder';
import xml2js from 'xml2js';
import { createLayerSvg, type SvgNode } from './layerize-svg.ts';
import {
  sortCodepointEntries,
  type GlyphRecord,
  type LigatureRecord as OrderedLigatureRecord,
  sortGlyphRecords,
  sortLigatures,
  sortPalette,
} from './layerize-order.ts';

type SvgAttributes = NonNullable<SvgNode['$']>;
type Point = [number, number];
type BoundingBox = [number, number, number, number];
type PartialBoundingBox = [
  number | undefined,
  number | undefined,
  number | undefined,
  number | undefined,
];
type LayerPathGroup = { color: string; paths: SvgNode[] };
type LayerComponent = { color: string; glyphName: string };
type CharRecord = { unicode: string; components: LayerComponent[] };
type LigatureRecord = OrderedLigatureRecord & { components: LayerComponent[]; glyphName?: string };
type ExtraLigature = OrderedLigatureRecord & { glyphName?: string };
type SvgDefs = Record<string, SvgNode>;
type ComponentMap = Record<string, string>;
type ColorIdMap = Record<string, number>;
type LayerInfoMap = Record<string, string[]>;
type HexcodeAliases = Record<string, Record<string, unknown>>;
type LigatureSetEntry = { components: string; glyph: string };
type ParsedSvgDocument = { svg: SvgNode & { $?: SvgAttributes; $$?: SvgNode[] } };

interface SvgRecord extends GlyphRecord {
  data: string;
}

const sourceSvgDir = process.argv[2]!;
const overridesDir = process.argv[3]!;
const extrasDir = process.argv[4]!;
const targetDir = process.argv[5]!;
const fontName = process.argv[6];
const progressInterval = 500;

function logStage(message: string): void {
  console.log('[layerize] ' + message);
}

if (fontName === undefined) {
  console.error('### Missing font name.');
  console.error(
    '### Usage: node ' +
      process.argv[1] +
      ' source-SVG-dir overrides-dir extras-dir build-dir font-name',
  );
  process.exit(1);
}

// Extra ligature rules to support ZWJ sequences that already exist as individual characters
const extraLigatures = JSON.parse(
  fs.readFileSync(extrasDir + '/ligatures.json', 'utf8'),
) as ExtraLigature[];

// partially qualified and unqualified sequences
const hexcodes = JSON.parse(
  fs.readFileSync(`./node_modules/emojibase-data/meta/hexcodes.json`, 'utf8'),
) as HexcodeAliases;

const components: ComponentMap = {};
// maps svg-data -> glyphName

let chars: CharRecord[] = [];
// unicode -> components[]
//              color
//              glyphName

let ligatures: LigatureRecord[] = [];
// [unicode1, unicode2] -> components[]

let colors: string[] = [];
let colorToId: ColorIdMap = {};

let codepoints: string[] = [];

function cloneSvgNode(node: SvgNode): SvgNode {
  return JSON.parse(JSON.stringify(node)) as SvgNode;
}

function expandColor(c: string | undefined): string | undefined {
  if (c === undefined) {
    return c;
  }
  c = c.toLowerCase();
  if (c === 'none') {
    return c;
  }
  if (c === 'red') {
    c = '#f00';
  } else if (c === 'green') {
    c = '#008000';
  } else if (c === 'blue') {
    c = '#00f';
  } else if (c === 'navy') {
    c = '#000080';
  }
  // c is a hex color that might be shorthand (3 instead of 6 digits)
  if (c.substr(0, 1) === '#' && c.length === 4) {
    c =
      '#' +
      c.substr(1, 1) +
      c.substr(1, 1) +
      c.substr(2, 1) +
      c.substr(2, 1) +
      c.substr(3, 1) +
      c.substr(3, 1);
  }
  if (c) {
    return c + 'ff';
  }
  return undefined;
}

function applyOpacity(c: string | undefined, o: number): string | undefined {
  if (c === undefined || c === 'none') {
    return c;
  }
  var opacity = (o * parseInt(c.substr(7), 16)) / 255;
  opacity = Math.round(opacity * 255);
  var opacityHex = opacity.toString(16);
  if (opacityHex.length === 1) {
    opacityHex = '0' + opacityHex;
  }
  return c.substr(0, 7) + opacityHex;
}

function decodePath(d: string): Point[] {
  var x = 0;
  var y = 0;
  var result: Point[] = [];
  var segStart: Point | undefined = [0, 0];
  while (d !== '') {
    var matches = d.match('^s*([MmLlHhVvCcZzSsTtQqAa])');
    if (!matches) {
      break;
    }
    var len = matches[0].length;
    d = d.substr(len);
    var op = matches[1];
    var coords: RegExpMatchArray | null;
    var c = '\\s*(-?(?:[0-9]*\\.[0-9]+|[0-9]+)),?';
    if (op === 'M') {
      segStart = undefined;
      while ((coords = d.match('^' + c + c))) {
        d = d.substr(coords[0].length);
        x = Number(coords[1]);
        y = Number(coords[2]);
        if (segStart === undefined) {
          segStart = [x, y];
        }
        result.push([x, y]);
      }
    } else if (op === 'L') {
      while ((coords = d.match('^' + c + c))) {
        d = d.substr(coords[0].length);
        x = Number(coords[1]);
        y = Number(coords[2]);
        result.push([x, y]);
      }
    } else if (op === 'm') {
      segStart = undefined;
      while ((coords = d.match('^' + c + c))) {
        d = d.substr(coords[0].length);
        x += Number(coords[1]);
        y += Number(coords[2]);
        if (segStart === undefined) {
          segStart = [x, y];
        }
        result.push([x, y]);
      }
    } else if (op === 'l') {
      while ((coords = d.match('^' + c + c))) {
        d = d.substr(coords[0].length);
        x += Number(coords[1]);
        y += Number(coords[2]);
        result.push([x, y]);
      }
    } else if (op === 'H') {
      while ((coords = d.match('^' + c))) {
        d = d.substr(coords[0].length);
        x = Number(coords[1]);
        result.push([x, y]);
      }
    } else if (op === 'h') {
      while ((coords = d.match('^' + c))) {
        d = d.substr(coords[0].length);
        x += Number(coords[1]);
        result.push([x, y]);
      }
    } else if (op === 'V') {
      while ((coords = d.match('^' + c))) {
        d = d.substr(coords[0].length);
        y = Number(coords[1]);
        result.push([x, y]);
      }
    } else if (op === 'v') {
      while ((coords = d.match('^' + c))) {
        d = d.substr(coords[0].length);
        y += Number(coords[1]);
        result.push([x, y]);
      }
    } else if (op === 'C') {
      while ((coords = d.match('^' + c + c + c + c + c + c))) {
        d = d.substr(coords[0].length);
        x = Number(coords[1]);
        y = Number(coords[2]);
        result.push([x, y]);
        x = Number(coords[3]);
        y = Number(coords[4]);
        result.push([x, y]);
        x = Number(coords[5]);
        y = Number(coords[6]);
        result.push([x, y]);
      }
    } else if (op === 'c') {
      while ((coords = d.match('^' + c + c + c + c + c + c))) {
        d = d.substr(coords[0].length);
        result.push([x + Number(coords[1]), y + Number(coords[2])]);
        result.push([x + Number(coords[3]), y + Number(coords[4])]);
        x += Number(coords[5]);
        y += Number(coords[6]);
        result.push([x, y]);
      }
    } else if (op === 'S') {
      while ((coords = d.match('^' + c + c + c + c))) {
        d = d.substr(coords[0].length);
        x = Number(coords[1]);
        y = Number(coords[2]);
        result.push([x, y]);
        x = Number(coords[3]);
        y = Number(coords[4]);
        result.push([x, y]);
      }
    } else if (op === 's') {
      while ((coords = d.match('^' + c + c + c + c))) {
        d = d.substr(coords[0].length);
        result.push([x + Number(coords[1]), y + Number(coords[2])]);
        x += Number(coords[3]);
        y += Number(coords[4]);
        result.push([x, y]);
      }
    } else if (op === 'Q') {
      while ((coords = d.match('^' + c + c + c + c))) {
        d = d.substr(coords[0].length);
        result.push([x + Number(coords[1]), y + Number(coords[2])]);
        x = Number(coords[3]);
        y = Number(coords[4]);
        result.push([x, y]);
      }
    } else if (op === 'q') {
      while ((coords = d.match('^' + c + c + c + c))) {
        d = d.substr(coords[0].length);
        result.push([x + Number(coords[1]), y + Number(coords[2])]);
        x += Number(coords[3]);
        y += Number(coords[4]);
        result.push([x, y]);
      }
    } else if (op === 'T') {
      while ((coords = d.match('^' + c + c))) {
        d = d.substr(coords[0].length);
        x = Number(coords[1]);
        y = Number(coords[2]);
        result.push([x, y]);
      }
    } else if (op === 't') {
      while ((coords = d.match('^' + c + c))) {
        d = d.substr(coords[0].length);
        x += Number(coords[1]);
        y += Number(coords[2]);
        result.push([x, y]);
      }
    } else if (op === 'A') {
      // we don't fully handle arc, just grab the endpoint
      while ((coords = d.match('^' + c + c + c + c + c + c + c))) {
        d = d.substr(coords[0].length);
        x = Number(coords[6]);
        y = Number(coords[7]);
        result.push([x, y]);
      }
    } else if (op === 'a') {
      while ((coords = d.match('^' + c + c + c + c + c + c + c))) {
        d = d.substr(coords[0].length);
        x += Number(coords[6]);
        y += Number(coords[7]);
        result.push([x, y]);
      }
    } else if ((op === 'Z' || op === 'z') && segStart !== undefined) {
      x = segStart[0];
      y = segStart[1];
      result.push([x, y]);
    }
  }
  return result;
}

function getBBox(p: SvgNode): BoundingBox {
  if (p['#name'] === 'path') {
    var pathData = p.$?.d;
    if (!pathData) {
      return [0, 0, 0, 0];
    }
    var points = decodePath(pathData);
    var result: PartialBoundingBox = [undefined, undefined, undefined, undefined];
    points.forEach(function (pt) {
      if (result[0] === undefined || pt[0] < result[0]) {
        result[0] = pt[0];
      }
      if (result[1] === undefined || pt[1] < result[1]) {
        result[1] = pt[1];
      }
      if (result[2] === undefined || pt[0] > result[2]) {
        result[2] = pt[0];
      }
      if (result[3] === undefined || pt[1] > result[3]) {
        result[3] = pt[1];
      }
    });
    if (
      result[0] === undefined ||
      result[1] === undefined ||
      result[2] === undefined ||
      result[3] === undefined
    ) {
      return [0, 0, 0, 0];
    }
    return [result[0], result[1], result[2], result[3]];
  } else if (p['#name'] === 'circle') {
    var cx = Number(p.$?.cx ?? 0);
    var cy = Number(p.$?.cy ?? 0);
    var r = Number(p.$?.r ?? 0);
    return [cx - r, cy - r, cx + r, cy + r];
  } else if (p['#name'] === 'ellipse') {
    var cx = Number(p.$?.cx ?? 0);
    var cy = Number(p.$?.cy ?? 0);
    var rx = Number(p.$?.rx ?? 0);
    var ry = Number(p.$?.ry ?? 0);
    return [cx - rx, cy - ry, cx + rx, cy + ry];
  }
  return [0, 0, 0, 0];
}

function overlap(a: BoundingBox, b: BoundingBox): boolean {
  if (a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1]) {
    return false;
  } else {
    return true;
  }
}

function hasTransform(p: SvgNode): boolean {
  return p.$?.transform !== undefined;
}

function addOrMerge(paths: LayerPathGroup[], p: SvgNode, color: string): void {
  var i = -1;
  if (!hasTransform(p)) {
    i = paths.length - 1;
    var bbox = getBBox(p);
    while (i >= 0) {
      var hasOverlap = false;
      paths[i].paths.forEach(function (pp) {
        if (hasTransform(pp) || overlap(bbox, getBBox(pp))) {
          hasOverlap = true;
        }
      });
      if (hasOverlap) {
        i = -1;
        break;
      }
      if (paths[i].color === color) {
        break;
      }
      --i;
    }
  }
  if (i >= 0) {
    paths[i].paths.push(p);
  } else {
    paths.push({ color: color, paths: [p] });
  }
}

function processFile(fileName: string, data: string | Buffer, withAliases = true): void {
  // strip .svg extension off the name
  var baseName = fileName.replace('.svg', '');
  if (withAliases) {
    // Twitter doesn't include the VS16 in the keycap filenames
    if (/^[23][0-9a]-20e3$/.test(baseName)) {
      var orig = baseName;
      baseName = baseName.replace('-20e3', '-fe0f-20e3');
      console.log(`found mis-named keycap ${orig}, renamed to ${baseName}`);
    } else if (baseName === '1f441-200d-1f5e8') {
      // ...or in the "eye in speech bubble"'s
      baseName = '1f441-fe0f-200d-1f5e8-fe0f';
      console.log(`found mis-named 1f441-200d-1f5e8, renamed to ${baseName}`);
    }

    // make duplicate entries for all aliases
    // this includes both partially-qualified and unqualified
    var codePt = baseName.toUpperCase();
    while (codePt.length < 4 || (codePt.indexOf('-') > -1 && codePt.indexOf('-') < 4))
      codePt = '0' + codePt;
    var aliases = hexcodes[codePt];
    if (aliases !== undefined) {
      for (var alias in aliases) {
        if (!Object.prototype.hasOwnProperty.call(aliases, alias)) continue;
        if (alias.slice(-5) === '-FE0E') continue;
        if (alias === codePt) continue;
        var aFile = alias.toLowerCase();
        while (aFile.slice(0, 1) === '0') aFile = aFile.slice(1);
        processFile(aFile + '.svg', data, false);
      }
    }
  }

  // skip (C), (R), (TM), and (M) characters, but not their aliases
  if (baseName === 'a9' || baseName === 'ae' || baseName === '2122' || baseName === '24c2') return;

  var parser = new xml2js.Parser({
    preserveChildrenOrder: true,
    explicitChildren: true,
    explicitArray: true,
  });

  // Save the original file also for visual comparison
  fs.writeFileSync(targetDir + '/colorGlyphs/u' + baseName + '.svg', data);

  // split name of glyph that corresponds to multi-char ligature
  var unicodes = baseName.split('-');

  parser.parseString(data, function (err: Error | null, rawResult: unknown) {
    if (err) {
      throw err;
    }

    var result = rawResult as ParsedSvgDocument;
    var svgRoot = result.svg;
    var svgAttributes = svgRoot.$ ?? {};
    var svgChildren = svgRoot.$$ ?? [];
    var paths: LayerPathGroup[] = [];
    var defs: SvgDefs = {};

    var addToPaths = function (
      defaultFill: string | undefined,
      defaultStroke: string | undefined,
      defaultOpacity: number,
      defaultStrokeWidth: string,
      xform: string | undefined,
      elems: SvgNode[],
    ) {
      elems.forEach(function (e: SvgNode) {
        if (e['#name'] === 'metadata') {
          return;
        }

        if (e['#name'] === 'defs') {
          if (e['$$'] === undefined) {
            return;
          }
          e['$$'].forEach(function (def: SvgNode) {
            var defId = def.$?.id;
            if (defId) {
              defs['#' + defId] = def;
            }
          });
          return;
        }

        if (e['$'] === undefined) {
          e['$'] = {};
        }
        var attrs = e['$'];

        var fill: string | undefined = attrs.fill;
        var stroke: string | undefined = attrs.stroke;
        var strokeWidth = attrs['stroke-width'] || defaultStrokeWidth;

        // any path with an 'id' might get re-used, so remember it
        if (attrs.id) {
          defs['#' + attrs.id] = cloneSvgNode(e);
        }

        var t = attrs.transform;
        if (t) {
          // fontforge import doesn't understand 3-argument 'rotate',
          // so we decompose it into translate..rotate..untranslate
          var c = '(-?(?:[0-9]*\\.[0-9]+|[0-9]+))';
          while (true) {
            var m = t.match('rotate\\(' + c + '\\s+' + c + '\\s' + c + '\\)');
            if (!m) {
              break;
            }
            var a = Number(m[1]);
            var x = Number(m[2]);
            var y = Number(m[3]);
            var rep =
              'translate(' +
              x +
              ' ' +
              y +
              ') ' +
              'rotate(' +
              a +
              ') ' +
              'translate(' +
              -x +
              ' ' +
              -y +
              ')';
            t = t.replace(m[0], rep);
          }
          attrs.transform = t;
        }

        fill = expandColor(fill) || defaultFill;
        stroke = expandColor(stroke) || defaultStroke;

        var opacity = Number(attrs.opacity || attrs['fill-opacity'] || 1.0) * defaultOpacity;

        if (e['#name'] === 'g') {
          if (e['$$'] !== undefined) {
            addToPaths(fill, stroke, opacity, strokeWidth, attrs.transform || xform, e['$$']);
          }
        } else if (e['#name'] === 'use') {
          var href = attrs['xlink:href'];
          var target = href ? defs[href] : undefined;
          if (target) {
            addToPaths(fill, stroke, opacity, strokeWidth, attrs.transform || xform, [
              cloneSvgNode(target),
            ]);
          }
        } else {
          if (!attrs.transform && xform) {
            attrs.transform = xform;
          }
          if (fill !== undefined && fill !== 'none') {
            var f = cloneSvgNode(e);
            var fillAttrs = (f.$ ??= {});
            fillAttrs.stroke = 'none';
            fillAttrs['stroke-width'] = '0';
            fillAttrs.fill = '#000';
            var fillColor = fill;
            if (opacity !== 1.0) {
              fillColor = applyOpacity(fill, opacity) ?? fill;
            }
            // Insert a Closepath before any Move commands within the path data,
            // as fontforge import doesn't handle unclosed paths reliably.
            if (f['#name'] === 'path') {
              var d = fillAttrs.d ?? '';
              d = d.replace(/M/g, 'zM').replace(/m/g, 'zm').replace(/^z/, '').replace(/zz/gi, 'z');
              if (fillAttrs.d !== d) {
                fillAttrs.d = d;
              }
            }
            addOrMerge(paths, f, fillColor);
          }

          // fontforge seems to hang on really complex thin strokes
          // so we arbitrarily discard them for now :(
          // Also skip stroking the zodiac-sign glyphs to work around
          // conversion problems with those outlines; we'll just have
          // slightly thinner symbols (fill only, no stroke)
          function skipStrokeOnZodiacSign(u: string): boolean {
            var unicode = parseInt(u, 16);
            return unicode >= 0x2648 && unicode <= 0x2653;
          }

          if (stroke !== undefined && stroke !== 'none' && !skipStrokeOnZodiacSign(unicodes[0])) {
            if (
              e['#name'] !== 'path' ||
              Number(strokeWidth) > 0.25 ||
              ((attrs.d ?? '').length < 500 && Number(strokeWidth) > 0.1)
            ) {
              var s = cloneSvgNode(e);
              var strokeAttrs = (s.$ ??= {});
              strokeAttrs.fill = 'none';
              strokeAttrs.stroke = '#000';
              strokeAttrs['stroke-width'] = strokeWidth;
              var strokeColor = stroke;
              if (opacity) {
                strokeColor = applyOpacity(stroke, opacity) ?? stroke;
              }
              addOrMerge(paths, s, strokeColor);
            } else {
              //console.log("Skipping stroke in " + baseName + ", color " + stroke + " width " + strokeWidth);
              //console.log(e['$']);
            }
          }
        }
      });
    };

    addToPaths('#000000ff', 'none', 1.0, '1', undefined, svgChildren);

    var layerIndex = 0;
    var layers: LayerComponent[] = [];
    paths.forEach(function (path: LayerPathGroup) {
      var svgString = createLayerSvg(svgAttributes, path.paths, defs);

      // see if there's an already-defined component that matches this shape
      var glyphName = components[svgString];

      // if not, create a new component glyph for this layer
      if (glyphName === undefined) {
        glyphName = baseName + '_layer' + layerIndex;
        components[svgString] = glyphName;
        codepoints.push('"u' + glyphName + '": -1');
        fs.writeFileSync(targetDir + '/glyphs/u' + glyphName + '.svg', svgString);
      }

      // add to the glyph's list of color layers
      layers.push({ color: path.color, glyphName: glyphName });

      // if we haven't seen this color before, add it to the palette
      if (colorToId[path.color] === undefined) {
        colorToId[path.color] = colors.length;
        colors.push(path.color);
      }
      layerIndex = layerIndex + 1;
    });

    if (unicodes.length === 1) {
      // simple character (single codepoint)
      chars.push({ unicode: unicodes[0], components: layers });
    } else {
      ligatures.push({ unicodes: unicodes, components: layers });
      // create the placeholder glyph for the ligature (to be mapped to a set of color layers)
      fs.writeFileSync(
        targetDir + '/glyphs/u' + unicodes.join('_') + '.svg',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" enable-background="new 0 0 64 64"></svg>',
      );
      codepoints.push('"u' + unicodes.join('_') + '": -1');
    }
    unicodes.forEach(function (u: string) {
      // make sure we have a placeholder glyph for the individual character, or for each component of the ligature
      fs.writeFileSync(
        targetDir + '/glyphs/u' + u + '.svg',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" enable-background="new 0 0 64 64"></svg>',
      );
      codepoints.push('"u' + u + '": ' + parseInt(u, 16));
    });
  });
}

function generateTTX() {
  // After we've processed all the source SVGs, we'll generate the auxiliary
  // files needed for OpenType font creation.
  // We also save the color-layer info in a separate JSON file, for the convenience
  // of the test script.

  var layerInfo: LayerInfoMap = {};

  chars = [...chars].sort(function (a, b) {
    return a.unicode.localeCompare(b.unicode, 'en');
  });
  ligatures = sortLigatures(ligatures);
  colors = sortPalette(colors);
  colorToId = {};
  colors.forEach(function (color, index) {
    colorToId[color] = index;
  });

  var ttFont = xmlbuilder.create('ttFont');
  ttFont.att('sfntVersion', '\\x00\\x01\\x00\\x00');
  ttFont.att('ttLibVersion', '3.0');

  // COLR table records the color layers that make up each colored glyph
  var COLR = ttFont.ele('COLR');
  COLR.ele('version', { value: 0 });
  chars.forEach(function (ch) {
    var colorGlyph = COLR.ele('ColorGlyph', { name: 'u' + ch.unicode });
    ch.components.forEach(function (cmp) {
      colorGlyph.ele('layer', { colorID: colorToId[cmp.color], name: 'u' + cmp.glyphName });
    });
    layerInfo[ch.unicode] = ch.components.map(function (cmp) {
      return 'u' + cmp.glyphName;
    });
  });
  ligatures.forEach(function (lig) {
    var colorGlyph = COLR.ele('ColorGlyph', { name: 'u' + lig.unicodes.join('_') });
    lig.components.forEach(function (cmp) {
      colorGlyph.ele('layer', { colorID: colorToId[cmp.color], name: 'u' + cmp.glyphName });
    });
    layerInfo[lig.unicodes.join('_')] = lig.components.map(function (cmp) {
      return 'u' + cmp.glyphName;
    });
  });
  var orderedLayerInfo: LayerInfoMap = {};
  Object.keys(layerInfo)
    .sort(function (a, b) {
      return a.localeCompare(b, 'en');
    })
    .forEach(function (key) {
      orderedLayerInfo[key] = layerInfo[key];
    });
  fs.writeFileSync(targetDir + '/layer_info.json', JSON.stringify(orderedLayerInfo, null, 2));

  // CPAL table maps color index values to RGB colors
  var CPAL = ttFont.ele('CPAL');
  CPAL.ele('version', { value: 0 });
  CPAL.ele('numPaletteEntries', { value: colors.length });
  var palette = CPAL.ele('palette', { index: 0 });
  var index = 0;
  colors.forEach(function (c) {
    if (c.substr(0, 3) === 'url') {
      console.log('unexpected color: ' + c);
      c = '#000000ff';
    }
    palette.ele('color', { index: index, value: c });
    index = index + 1;
  });

  // GSUB table implements the ligature rules for Regional Indicator pairs and emoji-ZWJ sequences
  var GSUB = ttFont.ele('GSUB');
  GSUB.ele('Version', { value: '0x00010000' });

  var scriptRecord = GSUB.ele('ScriptList').ele('ScriptRecord', { index: 0 });
  scriptRecord.ele('ScriptTag', { value: 'DFLT' });

  var defaultLangSys = scriptRecord.ele('Script').ele('DefaultLangSys');
  defaultLangSys.ele('ReqFeatureIndex', { value: 65535 });
  defaultLangSys.ele('FeatureIndex', { index: 0, value: 0 });

  // The ligature rules are assigned to the "ccmp" feature (*not* "liga"),
  // as they should not be disabled in contexts such as letter-spacing or
  // inter-character justification, where "normal" ligatures are turned off.
  var featureRecord = GSUB.ele('FeatureList').ele('FeatureRecord', { index: 0 });
  featureRecord.ele('FeatureTag', { value: 'ccmp' });
  featureRecord.ele('Feature').ele('LookupListIndex', { index: 0, value: 0 });

  var lookup = GSUB.ele('LookupList').ele('Lookup', { index: 0 });
  lookup.ele('LookupType', { value: 4 });
  lookup.ele('LookupFlag', { value: 0 });
  var ligatureSubst = lookup.ele('LigatureSubst', { index: 0, Format: 1 });
  var ligatureSets: Record<string, LigatureSetEntry[]> = {};
  var ligatureSetKeys: string[] = [];
  var addLigToSet = function (lig: LigatureRecord | ExtraLigature) {
    var startGlyph = 'u' + lig.unicodes[0];
    var components = 'u' + lig.unicodes.slice(1).join(',u');
    var glyphName = lig.glyphName || 'u' + lig.unicodes.join('_');
    if (ligatureSets[startGlyph] === undefined) {
      ligatureSetKeys.push(startGlyph);
      ligatureSets[startGlyph] = [];
    }
    ligatureSets[startGlyph].push({ components: components, glyph: glyphName });
  };
  ligatures.forEach(addLigToSet);
  extraLigatures.forEach(addLigToSet);
  ligatureSetKeys.sort();
  ligatureSetKeys.forEach(function (glyph) {
    var ligatureSet = ligatureSubst.ele('LigatureSet', { glyph: glyph });
    var set = ligatureSets[glyph] ?? [];
    // sort ligatures with more components first
    set.sort(function (a: LigatureSetEntry, b: LigatureSetEntry) {
      return b.components.length - a.components.length;
    });
    set.forEach(function (lig: LigatureSetEntry) {
      ligatureSet.ele('Ligature', { components: lig.components, glyph: lig.glyph });
    });
  });

  var ttx = fs.createWriteStream(targetDir + '/' + fontName + '.ttx');
  ttx.write('<?xml version="1.0" encoding="UTF-8"?>\n');
  ttx.write(ttFont.toString());
  ttx.end();

  // Write out the codepoints file to control character code assignments by grunt-webfont
  codepoints = sortCodepointEntries(codepoints);
  fs.writeFileSync(targetDir + '/codepoints.js', '{\n' + codepoints.join(',\n') + '\n}\n');
}

function collectSvgRecords(sourceDir: string): SvgRecord[] {
  const records: SvgRecord[] = [];
  const stack = [sourceDir];

  while (stack.length > 0) {
    const currentDir = stack.pop()!;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    entries.forEach((entry) => {
      const fullPath = currentDir + '/' + entry.name;

      if (entry.isDirectory()) {
        stack.push(fullPath);
        return;
      }

      if (entry.isFile() && entry.name.endsWith('.svg')) {
        records.push({ fileName: entry.name, data: fs.readFileSync(fullPath, 'utf8') });
      }
    });
  }

  return sortGlyphRecords(records);
}

async function main() {
  logStage('preparing build directories');
  fs.mkdirSync(targetDir);
  fs.mkdirSync(targetDir + '/glyphs');
  fs.mkdirSync(targetDir + '/colorGlyphs');

  // Read glyphs from the "extras" directory
  var extras = fs.readdirSync(extrasDir).sort();
  logStage('processing ' + extras.filter((f) => f.endsWith('.svg')).length + ' extra SVGs');
  extras.forEach(function (f) {
    if (f.endsWith('.svg')) {
      var data = fs.readFileSync(extrasDir + '/' + f);
      processFile(f, data);
    }
  });

  // Get list of glyphs in the "overrides" directory, which will be used to replace
  // same-named glyphs from the main source archive
  var overrides = fs.readdirSync(overridesDir).sort();
  logStage('discovered ' + overrides.length + ' override files');

  // Finally, we're ready to process the images from the pinned source directory:
  logStage('reading source SVG directory');
  var svgRecords = collectSvgRecords(sourceSvgDir);
  logStage('processing ' + svgRecords.length + ' upstream SVGs');
  svgRecords.forEach(function (record, index) {
    if (index === 0 || (index + 1) % progressInterval === 0 || index + 1 === svgRecords.length) {
      logStage('processed ' + (index + 1) + '/' + svgRecords.length + ' upstream SVGs');
    }
    var o = overrides.indexOf(record.fileName);
    if (o >= 0) {
      console.log('overriding ' + record.fileName + ' with local copy');
      processFile(record.fileName, fs.readFileSync(overridesDir + '/' + record.fileName));
      overrides.splice(o, 1);
    } else {
      processFile(record.fileName, record.data);
    }
  });

  logStage('writing auxiliary font tables');
  generateTTX();
  logStage('layerization complete');
}

// Delete and re-create target directory, to remove any pre-existing junk
fs.rm(targetDir, { recursive: true, force: true }, function () {
  main().catch(function (err) {
    console.error(err);
    process.exit(1);
  });
});
