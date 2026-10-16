# 安全衛生モニター（株式会社 東近江製作所）

工場の安全衛生活動（ヒヤリハット報告・設備点検・安全巡視・教育訓練・各種掲示）をスマホ・タブレット・PC で扱う Web アプリです。GitHub Pages で公開しています（`index.html` 1ファイル構成、ビルド不要）。

- 画面仕様: [docs/ui-spec.md](docs/ui-spec.md)
- データ保存: 端末の localStorage と Firebase（Firestore / Storage）

## 使い方（運用）

### 休憩所の TV に掲示する（掲示モード）

1. TV につないだ端末のブラウザで、公開 URL の末尾に `?kiosk=1` を付けて開く。
   例: `https://<公開先>/safety-monitor/?kiosk=1`
2. 一度開くと端末が掲示モードを覚えます。次回からは普通の URL でも掲示モードで開きます。
3. 掲示モードをやめるときは、画面右上の「掲示モードを終了」を押すか、URL の末尾に `?kiosk=0` を付けて開きます。

> v177 までは誰が開いても自動切り替え表示でした。v178 からは通常は操作できるアプリとして開くため、**今 TV で表示している端末は、更新後に一度だけ `?kiosk=1` を付けて開いてください。**

### 管理画面の PIN を忘れたとき

PIN は誤操作を防ぐための簡易的なロックです。忘れた場合は、管理者が Firebase コンソールで次の操作をすると、PIN 未設定（誰でも開ける状態）に戻ります。

1. Firebase コンソール → Firestore Database → `safety` コレクション → `main` ドキュメントを開く。
2. フィールド `adminPin` を削除する。
3. アプリを開き直し、管理画面の「PINの設定」から新しい PIN を設定する。

## 開発

```bash
npm install
npm test          # Vitest + jsdom のテスト
```

- テストは `tests/` にあります。`tests/helpers/loadApp.js` が `index.html` を jsdom で読み込みます（Firebase は読み込まれません）。
- 新しい版を公開するときは、次の3か所のバージョンを同じ値に上げてください（テストで一致を確認しています）。
  - `index.html` の `APP_VERSION`
  - `version.json` の `version`
  - `sw.js` の `VERSION`
