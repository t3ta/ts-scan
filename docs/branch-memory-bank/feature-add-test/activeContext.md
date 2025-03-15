# アクティブコンテキスト for feature/add-test

## 実装とテストの関係性における重要な考察

現在発生しているテスト失敗の状況については、以下の視点で捉えるべきなのだ：

1. **テスト優先の設計思想**
   - TDDではテストが仕様を定義する役割を担っている
   - テストの「失敗」は実装の「不備」ではなく、「実装が仕様に追いついていない状態」と捉えることが適切
   - テストが表現する期待値が本来のシステム要件を正確に反映しているかの検証が重要

2. **コンポーネント間契約としてのテスト**
   - テストはコンポーネント間のインターフェース契約を明示的に表現するもの
   - 契約の変更（出力フォーマットや構造の変化）がテスト失敗として現れている可能性がある
   - この観点から各失敗ケースを精査し、契約更新か実装修正かを判断することが必要

3. **アーキテクチャ進化におけるテストの役割**
   - システムの進化過程で仕様の詳細化・変更は自然に発生する
   - テスト失敗はこの進化プロセスのシグナルとして捉え、適切に対応する必要がある
   - ドメインの理解が深まるにつれて発生する「知識の更新」をテストと実装の両面に反映させるべき

今後のアプローチとしては、失敗ケースごとに「テストが表現する仕様」と「実装が実現する機能」のどちらが正しいかを判断し、適切に整合性を取っていくことが必要なのだ。

## 現在の作業内容

ts-scanプロジェクトにテスト環境を整備し、テスト駆動開発(TDD)のアプローチを導入する作業を進めているのだ。現在は以下の作業フェーズにあるのだ：

1. コアコンポーネント（`ServiceLocator`、`StrategyRegistry`）のユニットテスト実装完了
2. 検出器モジュールのテスト実装完了
   - `AxiosDetectionStrategy.test.ts` （一部スキップテストあり）
   - `FetchDetectionStrategy.test.ts` （実装完了）
   - `RTKQueryDetectionStrategy.test.ts` （実装完了）
   - `CustomApiClientStrategy.test.ts` （一部スキップテストあり）
3. レポーターモジュール（`JsonReporter`、`MarkdownReporter`）のテスト実装完了
4. 全レポータージェネレーターのテスト実装完了
   - `SummaryGenerator.test.ts`
   - `StatisticsGenerator.test.ts`
   - `DetailGenerator.test.ts`
   - `VisualizationGenerator.test.ts`
   - `EndpointListGenerator.test.ts`
   - `AnalysisGenerator.test.ts`
   - `RecommendationGenerator.test.ts`
5. 型エラーを修正し、テストの型安全性を向上
6. テスト実行時の一部テスト失敗があり、これらを今後修正予定

## 直近の変更点

- 全ての検出器モジュールのテスト実装を完了
  - `FetchDetectionStrategy.test.ts`の実装完了：Fetch APIを使用したHTTPリクエストの検出をテスト
  - `RTKQueryDetectionStrategy.test.ts`の実装完了：Redux Toolkit QueryのAPIエンドポイント検出をテスト
  - `CustomApiClientStrategy.test.ts`の実装完了：カスタムAPIクライアントの検出をテスト
  - 各テストに対応するフィクスチャデータも作成完了
    - `fetch-samples.ts`
    - `rtk-query-samples.ts`
    - `custom-api-client-samples.ts`
- 残りのジェネレーターモジュールのテスト実装
  - `VisualizationGenerator.test.ts`の実装完了：グラフ生成機能をテスト
  - `EndpointListGenerator.test.ts`の実装完了：エンドポイント一覧生成機能をテスト
  - `AnalysisGenerator.test.ts`の実装完了：解析情報生成機能をテスト
  - `RecommendationGenerator.test.ts`の実装完了：推奨事項生成機能をテスト
- テストの型エラー修正
  - ParameterType型とEndpointSource型に関する型エラーを修正
  - ResponseHandlingType型に関する型エラー修正
  - 暗黙的anyを明示的な型アノテーションで修正
  - locations → locationなどの型不一致を修正
- テスト実行と修正
  - テスト実行時の期待値と実際の出力の不一致を把握
  - より安定したテスト実装のための方針設定
  - ts-morphに依存するテストでは一部スキップテストを使用

## 今アクティブな決定事項

1. テストフレームワークアプローチ
   - ts-mockitoを活用した型安全なモック実装アプローチを採用
   - テスト用ヘルパー関数を集約して再利用性を高める
   - Jestモック機能とts-mockitoの適切な使い分け
   - AAA（Arrange-Act-Assert）パターンの一貫した適用
   - Typescriptの厳格な型チェックを活用した質の高いテスト実装

2. テストカバレッジの優先順位
   - コア機能（`ServiceLocator`、`StrategyRegistry`）の実装完了
   - レポーターモジュール（`JsonReporter`、`MarkdownReporter`）の実装完了
   - 全レポータージェネレーターの実装完了
   - 次のステップとして、検出器モジュールのテスト実装と期待値不一致の修正に着手予定

3. モック戦略
   - 外部依存性（ファイルシステム、ts-morph等）はJestのモック機能を使用
   - 内部コンポーネント間の依存はts-mockitoを使用した型安全なモックを採用
   - テスト用データとフィクスチャを`tests/fixtures`ディレクトリに集約
   - レポーターモジュールでは出力操作や内部ジェネレーターをモック化して分離テスト

## 今アクティブな考慮点

1. テスト期待値と実際の出力の不一致
   - 多くのジェネレーターテストで期待値と実際の出力が一致しない問題が発生
   - 実装の変更に追従していないテストの修正方針を検討
   - モックの実装と実際のクラス実装の整合性確保の手段

2. ts-morph依存性問題の対応
   - `AnalyzerEngine.test.ts` の ts-morph 依存性問題の解決策検討
   - 依存性の注入またはモックによる回避策の検討
   - テスト環境でのts-morphの初期化方法の最適化

3. 検出器モジュールのテスト追加考慮事項
    - 実際の実行環境でスキップされたテストケースの処理方針
    - 実際のts-morph ASTを使用した様々なケースの追加方法
    - 実入力に対するスナップショットテストの検討
    - CustomApiClientStrategyの動的パス判定に関する課題
      - エンドポイントパスの解析ロジックの改善
      - パスパラメータ抽出の実装方針の検討
      - 数値パラメータとUUIDパラメータの判定精度向上

## 次のステップ

1. 期待値と実際の出力の不一致修正
    - 失敗しているテスト（特にジェネレーター関連）の修正
    - 期待値を実際の出力に合わせて更新（出力フォーマットが変わっている場合）
    - モック実装の見直しと実際のクラス実装との整合性確保
    - CustomApiClientStrategyのスキップテストの対応
      - 動的パス判定ロジックの見直し
      - パスパラメータ抽出機能の実装
      - テストケースの期待値と実装の整合性確保

2. ts-morph依存問題の対応
   - `AnalyzerEngine.test.ts` の実装に向けたモック戦略の見直し
   - ts-morphの依存性を分離するテスト設計の検討
   - 環境依存の少ない実装アプローチの採用

3. 残りの検出器モジュールのテスト実装
   - `FetchDetectionStrategy.test.ts` の実装
   - `RTKQueryDetectionStrategy.test.ts` の実装
   - `CustomApiClientStrategy.test.ts` の実装
   - 検出器テスト用の共通モックとヘルパーの整備
