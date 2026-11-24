# かきじゅんずかん

ひらがな・カタカナ・数字・漢字の書き順動画を一覧・検索できるページ。

- `docs/index.html` … 一覧ページ(動画は `docs/videos/`)
- `tools/` … 動画の作成スクリプト(Python + PIL + numpy + ffmpeg)
  - `kana_data.py` … 各字の線のデータ
  - `gen.py` / `allspecs.py` / `renderall.py` … 動画の生成
  - `sheet.py` … 線を確認するための方眼シート

書き順は自作です。学校の見本と異なる場合があります。

## れんしゅう機能(なぞる・みないで かく)

漢字・ひらがな・カタカナ・数字の「どうが」のとなりに「れんしゅう」を追加しました。

- ① なぞる: うすい見本をなぞる。画ごとに書き順をチェック(まちがえたら赤く消えて、正しい画を光らせる)
- ② みないで かく: 見本を消した枠に書く。「みかえす」(押すと設定した秒数だけ見本を出す)、「ヒント」(次の1画だけ表示)
- 書き終えたら、見本の線を重ねて見くらべる
- よみあげ(ブラウザの読み上げ機能)・「こえに だして よんでみよう」
- 「せってい・きろくの ほぞん」: みかえす秒数・チェックの厳しさ・よみあげの切りかえ、きろくの書き出し/読み込み(JSON)

### ファイル
- `docs/check.js` … 書き順チェック(見本の線と、書いた線をくらべる)
- `docs/data.js` … きろくの書き出し・読み込み(形式のチェック、まぜる/おきかえる)
- `docs/practice.js` / `docs/practice.css` … れんしゅうの画面
- `docs/strokes.json` … 各字の線のデータ。`tools/export_strokes.py` で作る(動画と同じデータ)
- `tools/kanji_more.py` … 1年生の漢字の線のデータ(一二三十八力人入小)
- `tools/alpha_data.py` … 英語(A〜Z・a〜z)の線のデータと、ことば(絵文字つき)。動画は `tools/render_alpha.py` で `docs/videos/u_A.mp4` `l_a.mp4` を作る

### テスト
```
node --test tests/*.test.js
```

### 新しい字を足すとき
1. `tools/kanji_more.py`(またはkana_data.py)に線のデータを足す
2. `python3 tools/gen.py render <キー> docs/videos/<名前>.mp4` で動画を作る
3. `cd tools && python3 export_strokes.py` で `docs/strokes.json` を作りなおす
4. `docs/index.html` の `KANJI` に1行足す

### ブランチ
`feature/*` → `develop` → `main`(GitHub Pagesは `main` の `docs/` を公開)
