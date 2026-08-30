#!/usr/bin/env python3
"""
tools/make-icons.py
بيولّد أيقونات PWA بدون أي مكتبة خارجية (zlib + struct بس).
شغّله من جوه فولدر المشروع:  python tools/make-icons.py
النتيجة: public/icons/icon-192.png, icon-512.png, icon-maskable-512.png
"""
import os
import struct
import zlib

BG = (0x07, 0x09, 0x0C)
ACCENT = (0x00, 0xE0, 0x8A)
INK = (0x04, 0x12, 0x0C)

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "icons")


def rounded_rect(x, y, x0, y0, x1, y1, r):
    """هل النقطة (x, y) جوه مستطيل بزوايا مدوّرة؟"""
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= r * r


def in_circle(x, y, cx, cy, r):
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= r * r


def in_tail(x, y, size, scale):
    """ذيل البالونة تحت على الشمال (اتجاه عربي RTL)"""
    tx = 0.30 * size
    ty0 = (0.30 + 0.36 * scale) * size
    h = 0.10 * scale * size
    w = 0.11 * scale * size
    if y < ty0 or y > ty0 + h:
        return False
    t = (y - ty0) / h
    return tx - w * (1 - t) <= x <= tx


def build(size, scale, pad_bg):
    """بيرجع صفوف البكسل. scale = قد إيه الرسمة تاخد من المربع (للـ maskable أصغر)."""
    rows = []
    plate_r = 0.22 * size
    cx, cy = size / 2.0, size / 2.0

    bx0 = cx - 0.28 * scale * size
    bx1 = cx + 0.28 * scale * size
    by0 = 0.30 * size
    by1 = by0 + 0.36 * scale * size
    br = 0.09 * scale * size

    dot_r = 0.033 * scale * size
    dot_y = (by0 + by1) / 2.0
    gap = 0.13 * scale * size

    for y in range(size):
        row = bytearray()
        for x in range(size):
            px = BG
            inside_plate = pad_bg or rounded_rect(x, y, 0, 0, size - 1, size - 1, plate_r)
            if inside_plate:
                px = BG
                if rounded_rect(x, y, bx0, by0, bx1, by1, br) or in_tail(x, y, size, scale):
                    px = ACCENT
                    for k in (-1, 0, 1):
                        if in_circle(x, y, cx + k * gap, dot_y, dot_r):
                            px = INK
                            break
            else:
                px = (0, 0, 0)
            row += bytes(px)
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b"".join(b"\x00" + r for r in rows)
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path, len(png), "bytes")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    write_png(os.path.join(OUT_DIR, "icon-192.png"), 192, build(192, 1.0, False))
    write_png(os.path.join(OUT_DIR, "icon-512.png"), 512, build(512, 1.0, False))
    # maskable: الرسمة أصغر عشان تفضل جوه المنطقة الآمنة لما الأندرويد يقصّها دايرة
    write_png(os.path.join(OUT_DIR, "icon-maskable-512.png"), 512, build(512, 0.72, True))


if __name__ == "__main__":
    main()
