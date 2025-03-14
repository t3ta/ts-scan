# ブランチコンテキスト：feature/fix-runtime-error

## 目的
このブランチは、エンドポイント解析ツール（ts-scan）で発生しているランタイムエラーを修正することを目的としています。

## 課題
ツールを実行すると以下のエラーが発生しています：

```
Error: Cannot find module './reporters/MarkdownReporter'
Require stack:
- /Users/t3ta/workspace/ts-scan/dist/index.js
```

これは`index.ts`ファイル内でマークダウンレポーター（MarkdownReporter）へのインポートパスが誤っていることが原因です。

## ユーザーストーリー
- エンドポイント解析ツールを実行するユーザーとして
- エラーなく解析を完了させたい
- それによって、APIエンドポイントの使用状況を正確に把握できるようにしたい

## 期待される動作
- ツールを実行すると、モジュールが正しく読み込まれる
- JSON形式とMarkdown形式の両方でレポートが正常に生成される
- 「モジュールが見つからない」というランタイムエラーが発生しない
