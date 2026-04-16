import sys
from fontTools.ttLib import TTFont

MAC_EPOCH_1970 = 0x7C259DC0


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: normalize-font-metadata.py <font.ttf>", file=sys.stderr)
        return 1

    font_path = sys.argv[1]
    font = TTFont(font_path, recalcTimestamp=False)
    head = font["head"]
    head.created = MAC_EPOCH_1970
    head.modified = MAC_EPOCH_1970

    if "FFTM" in font:
        del font["FFTM"]

    font.save(font_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
