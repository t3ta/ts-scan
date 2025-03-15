# 次のステップ

## Codeモードへの切り替え

テスト分析と改善案の作成が完了したので、次はCodeモードに切り替えて実際にテストを修正するのだ。

## 実装計画の要約

### 1. DetailGenerator.test.ts

- エンドポイント数制限のテストを修正
  - 101件のエンドポイントを生成するテストケースに変更
  - 統計情報も適切に更新

### 2. VisualizationGenerator.test.ts

- パスプレフィックス集計のテストを修正
  - 期待値を`"/api" : 2"`に設定
  - 異なるプレフィックスを持つエンドポイントのテストケースを追加

### 3. StatisticsGenerator.test.ts

- パーセンテージ表示の期待値を修正
  - `50%`→`50.0%`のように小数点以下1桁まで表示
- RTK Query統計情報の表示形式を修正
  - マークダウンの強調表示を含めた期待値に変更

### 4. SummaryGenerator.test.ts

- 表示形式の期待値を修正
  - マークダウンの強調表示を含めた期待値に変更
  - パーセンテージの表示形式を修正

### 5. 共通のモックデータ改善

- `tests/helpers/mockData.ts`の拡充
  - `createMockEndpoint`関数の実装
  - `createMockAnalysisResult`関数の実装
  - `assertMarkdownSection`関数の実装
  - `assertMarkdownSubSection`関数の実装

## 実装の優先順位

1. まず共通のモックデータヘルパーを実装
2. 次に各テストファイルを修正
   - DetailGenerator.test.ts
   - VisualizationGenerator.test.ts
   - StatisticsGenerator.test.ts
   - SummaryGenerator.test.ts
3. テストを実行して検証

## 注意点

- テストの目的を常に意識する
- 実装の意図を正確に反映したテストにする
- 表示形式の細かな変更に影響されにくいテストにする
- ヘルパー関数を活用して一貫性と保守性を向上させる

これらの修正により、テストの信頼性と保守性が向上し、将来の変更にも対応しやすくなるのだ。
