"""英語(A〜Z・a〜z)の書き順動画を docs/videos/ に作る。
   実行: cd tools && python3 render_alpha.py [パート番号 パート数]   (例: 0 2 と 1 2 を同時に動かすと速い)"""
import os, sys
import gen, alpha_data
part, parts = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (0, 1)
os.makedirs('../docs/videos', exist_ok=True)
for i, key in enumerate(alpha_data.specs()):
    if i % parts != part:
        continue
    out = f'../docs/videos/{key}.mp4'
    if os.path.exists(out):
        continue
    gen.Maker(key).render(out)
