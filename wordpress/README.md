# ささエール サービスページ（WordPressプラグイン）

`https://officeplata.com/sasayell/` に、パラメータで各サービスページを表示します。

| サービス | URL |
|---|---|
| やとエール | https://officeplata.com/sasayell/?service=yatoeiru |
| まなベール | https://officeplata.com/sasayell/?service=manaberu |
| まかセール | https://officeplata.com/sasayell/?service=makaseru |
| しらベール | https://officeplata.com/sasayell/?service=shiraberu |

- やとエール / まなベール / しらベール … このリポジトリ直下の `*.html` を同梱して表示
- まかセール … 既存の固定ページ `/makaseru/` の本文を、テーマを通さずそのまま表示
- 未知の値（`?service=xxx`）はささエールトップを表示
- トップ（`/sasayell/`）の「選べるサービス一覧」の末尾に、4サービスへのカード（サービス別ページ）を自動で差し込みます
- 既存の `sasayell-lp` プラグインには手を入れません（併用）

## 導入

WordPress管理画面 → プラグイン → 新規追加 → プラグインのアップロード →
`sasayell-services.zip` → 今すぐインストール → 有効化

## 更新

ルートの HTML / 画像を直したら `./wordpress/build.sh` で zip を作り直し、
同じ手順でアップロード（「現在のものをアップロードしたもので置き換える」）。
