# 技術スタック

tags: #tech-stack #dependencies #typescript

## 主要技術

### 言語とランタイム
- TypeScript: 静的型付けとモダンな言語機能を活用
- Node.js: スクリプト実行環境として使用

### 主要ライブラリ
- ts-morph: TypeScriptソースコードの解析と操作
- glob: ファイルパターンマッチング
- commander: コマンドライン引数の解析

## 対応するフレームワークとライブラリ

### HTTP クライアント
1. **Axios**
   - インスタンス作成パターン
   - 直接呼び出しパターン
   - インターセプター設定

2. **Fetch API**
   - ネイティブfetch呼び出し
   - カスタムラッパー

3. **RTK Query**
   - createApi定義
   - injectEndpoints拡張
   - エンドポイントビルダー

4. **カスタムAPIクライアント**
   - メソッドベースの呼び出し
   - サービスクラスパターン

## 開発ツール

### コード品質
- ESLint: コード品質とスタイルの統一
- Prettier: コードフォーマット
- Jest: ユニットテスト

### ビルドツール
- TypeScript Compiler: コードのトランスパイル
- ts-node: 開発時の直接実行
- npm-scripts: タスク自動化

## 出力フォーマット

1. **JSON**
   - 構造化されたデータ形式
   - 外部ツールとの連携用
   - カスタム解析用

2. **Markdown**
   - 人間可読な形式
   - 階層的な情報構造
   - リッチテキストフォーマット

## 開発環境の要件

### 必要条件
- Node.js: 16.x以上
- npm: 7.x以上
- TypeScript: 4.x以上

### 推奨IDE設定
- VSCode
  - TypeScript and JavaScript Language Features
  - ESLint
  - Prettier
  - Jest Runner

## パフォーマンス最適化

### メモリ使用量
- ストリーミング処理の活用
- 不要なオブジェクトの解放
- キャッシュの適切な管理

### 実行速度
- 並列処理の活用
- インクリメンタル解析
- 効率的なAST走査

## 将来の技術検討事項

1. **新規フレームワーク対応**
   - GraphQLクライアント
   - tRPC
   - OpenAPI/Swagger

2. **解析機能の拡張**
   - 型情報の詳細解析
   - コールグラフ生成
   - データフロー解析

3. **パフォーマンス改善**
   - WebAssembly活用
   - ワーカースレッド導入
   - キャッシュ戦略の改善
