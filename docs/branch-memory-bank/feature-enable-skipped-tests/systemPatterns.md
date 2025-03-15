# システムパターン

## 主要な技術的判断

### テスト戦略
プロジェクトでは Jest をテストフレームワークとして使用しています。テストは `describe` ブロックでグループ化され、`it` で個別のテストケースを定義しています。スキップされたテストは `describe.skip` や `it.skip` として実装されています。

### モックの使用
テストでは ts-mockito を使用してモックオブジェクトを作成しています。特に外部依存関係（ファイルシステム、ロガーなど）はモック化されています。

### ファイル構造
テストファイルは以下のディレクトリに整理されています：
- `/tests/core` - コアコンポーネントのテスト
- `/tests/detectors` - API検出戦略のテスト
- `/tests/fixtures` - テスト用のサンプルデータ
- `/tests/helpers` - テスト用のヘルパー関数
- `/tests/reporters` - レポート生成機能のテスト
- `/tests/utils` - ユーティリティ関数のテスト

## 関連するファイルやディレクトリ構造

### スキップされたテストを含む主要なファイル
1. `/tests/core/AnalyzerEngine.test.ts` - 解析エンジンのテスト（抽象化リファクタリング中）
2. `/tests/detectors/FetchDetectionStrategy.test.ts` - Fetch API検出のテスト
3. `/tests/detectors/RTKQueryDetectionStrategy.test.ts` - RTK Query検出のテスト
4. `/tests/detectors/CustomApiClientStrategy.test.ts` - カスタムAPIクライアント検出のテスト
5. `/tests/reporters/generators/VisualizationGenerator.test.ts` - 型エラーのあるテスト
6. `/tests/reporters/generators/StatisticsGenerator.test.ts` - 保留中のテストを含む

### テストフィクスチャとヘルパーファイル
- `/tests/fixtures` - テスト用のサンプルコードを含む
- `/tests/helpers/mock-adapters.ts` - モックオブジェクトのアダプター関数

### テスト設定ファイル
- `/jest.config.js` - Jestの設定ファイル
