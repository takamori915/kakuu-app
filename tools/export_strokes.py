"""練習機能(なぞる・書き順チェック)用に、各字の線のデータを docs/strokes.json に書き出す。
   動画を作るときの線のデータ(gen.py / kanji_more.py / kana_data.py)をそのまま使う。
   実行: cd tools && python3 export_strokes.py"""
import json
import gen
import allspecs
import alpha_data

out = {}
for spec in list(gen.SPECS.values()) + list(allspecs.all_specs().values()) + list(alpha_data.specs().values()):
    ch = spec.get('glyph') and spec['ch'] or spec['ch']
    out[ch] = {
        'paths': [[[round(x), round(y)] for x, y in p] for p in spec['paths']],
        'rows': list(spec['rows']),
    }
with open('../docs/strokes.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print(len(out), 'chars')
