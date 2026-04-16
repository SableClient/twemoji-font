# Based on https://github.com/FontCustom/fontcustom/blob/master/lib/fontcustom/scripts/generate.py

import fontforge
import os
import sys
import json
import re
from xml.etree import ElementTree

args = json.load(sys.stdin)
progress_interval = 500

f = fontforge.font()
f.encoding = 'UnicodeFull'
f.copyright = ''
f.design_size = 16
f.em = args['fontHeight']
f.descent = args['descent']
f.ascent = args['fontHeight'] - args['descent']
if args['version']:
    f.version = args['version']
if args['normalize']:
    f.autoWidth(0, 0, args['fontHeight'])

KERNING = 15


def create_empty_char(f, c):
    f.createChar(ord(c), c).glyphPen().moveTo((0, 0))


def local_name(tag):
    return tag.rsplit('}', 1)[-1]


def svg_has_visible_content(svgtext):
    try:
        root = ElementTree.fromstring(svgtext)
    except ElementTree.ParseError:
        return True

    non_rendering = {'svg', 'defs', 'metadata', 'title', 'desc'}
    for element in root.iter():
        if local_name(element.tag) not in non_rendering:
            return True
    return False


def log_progress(message):
    print('[fontforge] ' + message)
    sys.stdout.flush()


if args['addLigatures']:
    f.addLookup('liga', 'gsub_ligature', (), (('liga', (('latn', ('dflt')),)),))
    f.addLookupSubtable('liga', 'liga')

svg_files = []
for dirname, dirnames, filenames in os.walk(args['inputDir']):
    for filename in sorted(filenames):
        if os.path.splitext(filename)[1] in ['.svg']:
            svg_files.append((dirname, filename))

log_progress('processing ' + str(len(svg_files)) + ' SVG glyphs')

for index, (dirname, filename) in enumerate(svg_files, start=1):
        name, ext = os.path.splitext(filename)
        filePath = os.path.join(dirname, filename)

        if ext in ['.svg']:
            with open(filePath, 'r', encoding='utf-8') as svgfile:
                svgtext = svgfile.read()

            # Replace the <switch> </switch> tags with nothing
            svgtext = svgtext.replace('<switch>', '')
            svgtext = svgtext.replace('</switch>', '')

            if args['normalize']:
                # Replace the width and the height
                svgtext = re.sub(r'(<svg[^>]*)width="[^"]*"([^>]*>)', r'\1\2', svgtext)
                svgtext = re.sub(r'(<svg[^>]*)height="[^"]*"([^>]*>)', r'\1\2', svgtext)

            cp = args['codepoints'][name]

            if args['addLigatures']:
                name = str(name)  # Convert Unicode to a regular string because addPosSub doesn't work with Unicode
                for char in name:
                    create_empty_char(f, char)
                glyph = f.createChar(cp, name)
                glyph.addPosSub('liga', tuple(name))
            else:
                glyph = f.createChar(cp, str(name))
            if svg_has_visible_content(svgtext):
                glyph.importOutlines(filePath)

            if args['normalize']:
                glyph.left_side_bearing = glyph.right_side_bearing = 0
            elif name[1:] in args['zerowidth']:
                glyph.left_side_bearing = glyph.right_side_bearing = 0
                glyph.width = 0
            else:
                glyph.width = args['fontHeight']

            if args['round']:
                glyph.round(int(args['round']))

            if index == 1 or index % progress_interval == 0 or index == len(svg_files):
                log_progress('processed ' + str(index) + '/' + str(len(svg_files)) + ' glyphs')

fontfile = args['dest'] + os.path.sep + args['fontFilename']

f.fontname = args['fontFilename']
f.familyname = args['fontFamilyName']
f.fullname = args['fontFamilyName']

if args['addLigatures']:
    def generate(filename):
        f.generate(filename, flags=('opentype'))
else:
    def generate(filename):
        f.generate(filename)

# TTF
log_progress('generating TTF')
generate(fontfile + '.ttf')
log_progress('TTF generated')

print(json.dumps({'file': fontfile}))
