import json
import sys

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._c_m_a_p import CmapSubtable


def main():
    if len(sys.argv) != 3:
        print(
            "Usage: python add-variation-selector-mappings.py <font-path> <uvs-mappings.json>",
            file=sys.stderr,
        )
        raise SystemExit(1)

    font_path = sys.argv[1]
    mappings_path = sys.argv[2]

    with open(mappings_path, "r", encoding="utf-8") as handle:
        mappings = json.load(handle)

    font = TTFont(font_path)
    font.recalcTimestamp = False
    cmap_table = font["cmap"]

    uvs_subtable = None
    for table in cmap_table.tables:
        if table.format == 14 and table.platformID == 0 and table.platEncID == 5:
            uvs_subtable = table
            break

    if uvs_subtable is None:
        uvs_subtable = CmapSubtable.newSubtable(14)
        uvs_subtable.platformID = 0
        uvs_subtable.platEncID = 5
        uvs_subtable.language = 0
        uvs_subtable.cmap = {}
        uvs_subtable.uvsDict = {}
        cmap_table.tables.insert(0, uvs_subtable)

    uvs_dict = {}
    for mapping in mappings:
        variation_selector = mapping["variationSelector"]
        unicode_value = mapping["unicode"]
        glyph_name = mapping["glyphName"]
        uvs_dict.setdefault(variation_selector, []).append((unicode_value, glyph_name))

    uvs_subtable.uvsDict = {
        variation_selector: sorted(entries, key=lambda item: item[0])
        for variation_selector, entries in sorted(uvs_dict.items())
    }

    font.save(font_path, reorderTables=False)


if __name__ == "__main__":
    main()
