# アクティブコンテキスト for feature/ts-morph-dep

## AST抽象化アーキテクチャの実装と課題

feature/ts-morph-dep ブランチにおいて、ts-morphへの直接依存を抽象化レイヤーで分離するための設計・実装が進行中である。本アプローチは、ヘキサゴナルアーキテクチャ（ポート・アンド・アダプターパターン）の考え方に基づき、以下の階層構造を実装している：

1. **ドメインレイヤー**（インターフェース層）
   - IASTProvider, ISourceFile, INode等の抽象インターフェース
   - ドメインロジックと外部技術との境界を明確に定義
   - テスト容易性と実装の入れ替え可能性を確保

2. **インフラストラクチャレイヤー**（アダプター層）
   - TsMorphAdapter等のts-morph実装アダプター
   - MockProvider等のテスト用モック実装
   - 異なる実行環境（本番/テスト）に対応する実装の提供

3. **アプリケーションレイヤー**（ファクトリー・DI）
   - ASTProviderFactory - 環境検出と適切な実装の選択
   - ServiceLocator拡張 - アプリケーション全体でのインスタンス管理
   - スナップショット機構 - テスト環境でのAST構造の再現

## 現在の実装状況

現在、以下の実装が完了している：

- インターフェース層の定義
- ts-morphアダプター群の基本実装
- モックプロバイダーの実装
- スナップショット機構の基本実装
- ServiceLocator拡張とファクトリークラスの実装
- AnalyzerEngineクラスのリファクタリング
- ServiceLocatorテストの修正と成功確認
- StrategyRegistryテストの修正と成功確認
- PatternDetectorのインターフェース修正
- AxiosDetectionStrategy.test.ts のインターフェース変更（部分的に完了）

テスト実行を開始したところ、以下の課題が発見されている：

1. **型の互換性問題**
   - SourceFileとISourceFileの混在
   - NodeとINodeの参照不整合
   - ts-morphの型とインターフェース層の型の変換処理
   - NodeExtractorsExtendedの`getExpression`、`getArguments`メソッドがINodeに実装されていない問題

2. **ts-morphバージョン依存の問題**
   - 一部メソッド（isDotDotDot()等）の有無による互換性問題
   - SyntaxKindとの比較方法の違い
   - コンパイルエラーの解消

3. **テスト環境の課題**
   - ServiceLocatorのコンストラクタアクセス問題
   - スナップショットを用いたモックテストの実行方法

## 直近の変更点

- 全インターフェース層の実装完了
- アダプター層実装の基本部分完成
- モックプロバイダー、スナップショット機構の実装
- MockNodeのfindDescendants機能の大幅改良（自己参照問題の解決）
- NodeKind列挙体の値をスナップショットと整合させる修正
- IFunctionインターフェース実装のMockNodeへの追加
- ServiceLocatorとASTProviderFactoryのテスト成功
- インターフェース拡張と実装
  - INodeDiagnosticsインターフェースの追加とINodeへの継承
  - MockNodeへのgetExpression、getArgumentsメソッドの実装追加
  - NodeExtractorsExtendedとNodePredicatesをINode対応に修正
- `AxiosDetectionStrategy.ts` からts-morphの直接参照を排除し、抽象インターフェースで置き換え完了
- NodePredicates.isMethodCallの使用箇所を修正し、適切な代替実装を導入

## 今アクティブな決定事項

1. **インターフェース設計**
   - シンプルかつ柔軟性の高いインターフェース定義を維持
   - 必要最小限のメソッドでDomain/InfrastructureのDecoupling実現

2. **アダプターパターン実装**
   - ts-morphの挙動をインターフェースに適合させる変換処理を集約
   - バージョン差異を吸収する実装の導入

3. **モックとスナップショット戦略**
   - 実際のASTをシリアライズ可能な形式でスナップショット保存
   - テスト時にスナップショットからモック再構築

4. **依存性注入アプローチ**
   - ServiceLocatorへのASTProvider登録機能追加
   - 環境検出によるプロバイダー自動選択

## 今アクティブな課題

1. **インターフェース層の完成実装**
   - ts-morphのNodeとINodeの間の互換性まだ完全ではない
   - 一部のNode特有メソッドへの対応が必要

2. **検出器モジュールの継続リファクタリング**
   - `FetchDetectionStrategy`、`RTKQueryDetectionStrategy`、`CustomApiClientStrategy` の改修

3. **テストスキップを解消するための調整**

## 次のステップ

1. **残りの検出器モジュールのリファクタリング**
   - `FetchDetectionStrategy` の修正
   - `RTKQueryDetectionStrategy` の修正
   - `CustomApiClientStrategy` の修正
   
2. **テストの修正と実行**
   - `AxiosDetectionStrategy.test.ts` のスキップ解除
   - 残りのテストファイルの修正

3. **テストの安定化とカバレッジ向上**
   - 全テストの実行確認
   - テスト環境の安定化