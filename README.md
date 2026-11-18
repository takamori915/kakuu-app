# かきじゅんずかん

ひらがな・カタカナ・数字・漢字の書き順動画を一覧・検索できるページ。

- `site/index.html` … 一覧ページ(動画は `site/videos/`)
- `tools/` … 動画の作成スクリプト(Python + PIL + numpy + ffmpeg)
  - `kana_data.py` … 各字の線のデータ
  - `gen.py` / `allspecs.py` / `renderall.py` … 動画の生成
  - `sheet.py` … 線を確認するための方眼シート

書き順は自作です。学校の見本と異なる場合があります。
