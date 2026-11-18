import numpy as np
import gen, kana_data
from kana_data import G, DIGITS
SC = 1 / 0.8     # sheet-cell px -> 600-space
def pl(pts): return [(x * SC, y * SC) for x, y in pts]
def length(pts):
    a = np.array(pts, float); return float(np.hypot(*np.diff(a, axis=0).T).sum()) if len(a) > 1 else 0
def mk(ch, strokes, **extra):
    paths = [pl(p) for _, p in strokes]
    write = [float(np.clip(0.7 + length(p) / 900, 0.8, 2.2)) for p in paths]
    spec = dict(ch=ch, paths=paths, rows=[l for l, _ in strokes], write=write, cross=[], badge={}, quick=True)
    spec.update(extra)
    return spec
def all_specs():
    out = {}
    for ch, st in G.items():
        out[ch] = mk(ch, st)
    for ch, st in DIGITS.items():
        out[ch] = mk(ch, st, font=gen.UI, glyph=chr(0xFF10 + int(ch)))
    return out
