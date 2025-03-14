# System Patterns

## 主要な技術的判断

### 1. Node型の構造
- TypeScriptのAST（抽象構文木）解析に使用
- ts.Node型をベースにした独自の拡張が必要

### 2. NodeExtractorsExtended クラスの設計
- 静的メソッドを提供するユーティリティクラス
- AST解析のための共通機能を提供
- 以下のメソッドが必要：
  - extractStringValue
  - extractQueryParameters
  - inferNodeContext（旧: inferContext）

### 3. メソッド名の統一性
- `inferContext` → `inferNodeContext` への統一
- 呼び出し側のコードも更新が必要

## 関連するファイルと構造

### コア実装
- src/utils/ast/NodeExtractorsExtended.ts (主要な修正対象)

### 依存ファイル
1. src/detectors/DefaultDetectionStrategy.ts
2. src/detectors/http/AxiosDetectionStrategy.ts
3. src/detectors/http/custom/ApiClientMethodCallDetector.ts
4. src/detectors/http/custom/HttpPatternDetector.ts
5. src/detectors/http/custom/ServiceMethodDetector.ts
6. src/detectors/http/FetchDetectionStrategy.ts
7. その他RTKクエリ関連ファイル
