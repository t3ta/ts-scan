# 進捗状況 for feature/ts-morph-dep

## 現時点で動作している部分

- ブランチ `feature/ts-morph-dep` の作成完了
- AST操作の抽象インターフェース層の設計と実装
  - `IASTProvider` インターフェースの実装
  - `ISourceFile` インターフェースの実装
  - `INode` インターフェースの実装
  - 関連インターフェース（`IFunction`, `IClass`, `IInterface`, `IProperty`, `IVariable`, `IImportDeclaration`等）の実装
- アダプター層の実装
  - `TsMorphAdapter` - ts-morphをIASTProviderに適合させるアダプター
  - `TsMorphSourceFileAdapter` - ts-morphのSourceFileをISourceFileに適合させる
  - `TsMorphNodeAdapter` - ts-morphのNodeをINodeに適合させる
  - `TsMorphFunctionAdapter` - 関数宣言のアダプター
  - `TsMorphParameterAdapter` - パラメータのアダプター
  - `TsMorphTypeAdapter` - 型情報のアダプター
  - `TsMorphClassAdapter` - クラス宣言のアダプター
  - `TsMorphInterfaceAdapter` - インターフェース宣言のアダプター
  - `TsMorphVariableAdapter` - 変数宣言のアダプター
  - `TsMorphImportDeclarationAdapter` - インポート宣言のアダプター
- モックプロバイダーの実装
  - `MockProvider` クラスの実装
  - `MockSourceFile` クラスの実装
  - `MockNode` クラスの実装
  - スナップショットベースのモック機構の実装
- スナップショット機構の構築
  - スナップショット形式の設計と実装
  - スナップショット生成・読み込みユーティリティの実装
  - 基本的なスナップショットデータの作成（`basic-function.json`, `axios-client-usage.json`）
- DI機構の拡張
  - `ASTProviderFactory` の実装 - 環境に応じた適切なプロバイダーを生成
  - `ServiceLocator` にASTプロバイダー関連メソッドを追加
  - 環境検出と適切なプロバイダー選択ロジックの実装
- テストヘルパーの整備
  - `ast-helpers.ts` - ASTモック生成・操作ヘルパー
  - スナップショットロードユーティリティの実装
  - テスト用ファクトリー関数の実装
- `AnalyzerEngine` のリファクタリング
  - ts-morph直接参照から抽象インターフェース経由の操作に変更
  - DI機構を活用したプロバイダー取得・初期化プロセスの改善
- 型定義の更新
  - `types.ts` における `DetectionContext` や `EndpointDetectionStrategy` インターフェースの修正
  - 抽象インターフェースを活用した型定義の改善
- 検出器モジュールのリファクタリング
  - 主要な検出戦略クラスのts-morph直接依存を抽象インターフェース依存に変更完了
  - パターン検出器クラスの修正完了
    - `CreateApiCallDetector`
    - `EndpointDefinitionDetector`
    - `EnhancedEndpointDefinitionDetector`
    - `ApiInstanceUsageDetector`
    - `ApiClientMethodCallDetector`
    - `HttpPatternDetector`
    - `ServiceMethodDetector`
- AST操作ユーティリティクラスの修正
  - `NodeTraversal.ts` がINodeインターフェイスに対応
  - `NodePredicates.ts` がINodeインターフェイスに対応
  - `NodeExtractors.ts` をINodeインターフェースに完全対応
  - `NodeExtractorsExtended.ts` をINodeインターフェースに完全対応
  - 型ガード関数（isINode, isTsMorphNode）を導入
  - NodeKind列挙型にMethodDeclarationを追加
  - 型安全なノード変換処理の実装ダプター
  - `TsMorphSourceFileAdapter` - ts-morphのSourceFileをISourceFileに適合させる
  - `TsMorphNodeAdapter` - ts-morphのNodeをINodeに適合させる
  - `TsMorphFunctionAdapter` - 関数宣言のアダプター
  - `TsMorphParameterAdapter` - パラメータのアダプター
  - `TsMorphTypeAdapter` - 型情報のアダプター
  - `TsMorphClassAdapter` - クラス宣言のアダプター
  - `TsMorphInterfaceAdapter` - インターフェース宣言のアダプター
  - `TsMorphVariableAdapter` - 変数宣言のアダプター
  - `TsMorphImportDeclarationAdapter` - インポート宣言のアダプター
- モックプロバイダーの実装
  - `MockProvider` クラスの実装
  - `MockSourceFile` クラスの実装
  - `MockNode` クラスの実装
  - スナップショットベースのモック機構の実装
- スナップショット機構の構築
  - スナップショット形式の設計と実装
  - スナップショット生成・読み込みユーティリティの実装
  - 基本的なスナップショットデータの作成（`basic-function.json`, `axios-client-usage.json`）
- DI機構の拡張
  - `ASTProviderFactory` の実装 - 環境に応じた適切なプロバイダーを生成
  - `ServiceLocator` にASTプロバイダー関連メソッドを追加
  - 環境検出と適切なプロバイダー選択ロジックの実装
- テストヘルパーの整備
  - `ast-helpers.ts` - ASTモック生成・操作ヘルパー
  - スナップショットロードユーティリティの実装
  - テスト用ファクトリー関数の実装
- `AnalyzerEngine` のリファクタリング
  - ts-morph直接参照から抽象インターフェース経由の操作に変更
  - DI機構を活用したプロバイダー取得・初期化プロセスの改善
- 型定義の更新
  - `types.ts` における `DetectionContext` や `EndpointDetectionStrategy` インターフェースの修正
  - 抽象インターフェースを活用した型定義の改善
- 検出器モジュールのリファクタリング
  - 主要な検出戦略クラスのts-morph直接依存を抽象インターフェース依存に変更完了
  - パターン検出器クラスの修正完了
    - `CreateApiCallDetector`
    - `EndpointDefinitionDetector`
    - `EnhancedEndpointDefinitionDetector`
    - `ApiInstanceUsageDetector`
    - `ApiClientMethodCallDetector`
    - `HttpPatternDetector`
    - `ServiceMethodDetector`
- AST操作ユーティリティクラスの修正
  - `NodeTraversal.ts` がINodeインターフェイスに対応
  - `NodePredicates.ts` がINodeインターフェイスに対応

## 作業中の部分

- AST操作ユーティリティクラスの修正
  - `NodeExtractors.ts` をINodeインターフェイスに完全対応させる作業進行中
  - ~~`NodeExtractorsExtended.ts` をINodeインターフェイスに完全対応させる作業進行中~~（完了）
  - タイプチェッカー関連の型エラーを解消中

## 未実装の機能や残作業

## 高優先度

- [ ] AST操作ユーティリティの完全互換対応
  - [x] NodeTraversalのINode対応
  - [x] NodePredicatesのINode対応
  - [ ] NodeExtractorsの完全互換対応（タイプエラー解消）
  - [x] NodeExtractorsExtendedの完全互換対応（タイプエラー解消）

- [ ] 型互換性の問題解決
  - [ ] Node/INode混在の解消
  - [ ] TypeCheckerなどts-morph固有の型の扱い
  - [ ] 条件付きメソッドの安全な呼び出し（オプショナルチェイニングを活用）

- [ ] 一部テストの修正と実行
  - [x] MockNodeのfindDescendants機能の修正
  - [x] IFunctionインターフェースの実装追加
  - [x] NodeKind列挙体とスナップショットの整合
  - [x] ServiceLocatorテストの修正
  - [x] StrategyRegistryテストの修正
  - [x] AnalyzerEngineとServiceLocatorの互換性問題の解決
  - [x] AxiosDetectionStrategy.test.tsのISourceFile化への対応（部分的）
  - [x] インターフェース拡張
    - [x] INodeDiagnosticsインターフェースの追加
    - [x] MockNodeの実装拡張
    - [x] NodeExtractorsExtendedのインターフェース対応
    - [x] NodePredicatesのインターフェース対応
  - [ ] 残りのテストファイル修正

### 中優先度

- [ ] スキップテストの有効化と検証
  - [ ] `AnalyzerEngine.test.ts` のスキップ解除
  - [ ] 検出器テストのスキップ部分の有効化
  - [ ] テスト実行環境の安定性検証

- [ ] ドキュメントとガイドライン
  - [ ] 新アーキテクチャの設計ドキュメント
  - [ ] AST操作のベストプラクティスガイド
  - [ ] テスト記述パターンの文書化

### 低優先度

- [ ] パフォーマンス最適化
  - [ ] AST解析処理の効率化
  - [ ] スナップショットデータ構造の最適化
  - [ ] キャッシュ戦略の改善

## 現在のステータス

- 実装フェーズ: AST操作ユーティリティクラスの修正進行中
  - NodeTraversalをINodeインターフェースに対応完了
  - NodePredicatesをINodeインターフェースに対応完了
  - INodeインターフェースを拡張して必要なメソッドを追加
  - NodeExtractors/NodeExtractorsExtendedの修正作業中
  - 型互換性の問題に対処中

- 次のフェーズ: 残りのコンパイルエラー解決
  - 型の互換性問題の解決
  - ts-morph固有の型（TypeCheckerなど）の扱いの適正化
  - テスト環境の安定化

## 環境依存の課題

- ts-morphのAPIとの互換性確保
  - ts-morphのバージョンによる差異への対応
  - 一部メソッド（`isDotDotDot()` など）の有無に対する代替実装
  - 型の齟齬（`SyntaxKind` と文字列比較など）の修正

- テスト実行環境の安定化
  - ServiceLocatorのコンストラクタアクセス問題
  - スナップショットを用いたモックテストの実行方法の改善

## 今後の展開

1. AST操作ユーティリティクラスの完全修正
2. 残りのコンパイルエラーの解消
3. テスト実行環境の改善と全テストの検証
4. スキップテストの有効化と検証
5. 統合テストの実行とCI/CD環境での安定性確認
6. ドキュメントの整備と知見の共有

## 技術的リスクと緩和策

1. **依存置き換えに伴う機能損失リスク**
   - 緩和策: 各機能に対する単体テストの充実と機能検証

2. **抽象化によるパフォーマンス低下リスク**
   - 緩和策: 重要部分のパフォーマンス測定と最適化

3. **バージョン互換性問題**
   - 緩和策: ts-morphバージョン間の差異をアダプターで吸収する設計

4. **型互換性の問題**
   - 緩和策: 適切な型ガードとオプショナルチェイニングを使用
   - 緩和策: 部分的なany型の使用で型システムのエラーを回避
