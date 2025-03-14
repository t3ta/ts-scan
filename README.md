# ts-scan

フロントエンドコードベースからバックエンド API エンドポイントの使用状況を効率的に解析するツールです。リファクタリングされたアーキテクチャにより、高い拡張性と保守性を実現しています。

## アーキテクチャの特徴

このツールは以下のアーキテクチャ設計思想に基づいて実装されています：

- **責務指向設計**: 各コンポーネントが明確に定義された責務を持ち、単一責任の原則に従う
- **依存性注入**: サービスロケータパターンによる依存性の明示的な管理と疎結合化
- **戦略パターン**: 異なる API 検出戦略を柔軟に組み合わせ、優先度に基づいて実行
- **ファサードパターン**: 複雑な内部実装を隠蔽し、シンプルなインターフェースを提供
- **ビルダーパターン**: エンドポイント情報の段階的な構築と一貫性の確保

## 主な機能

- **多様な API 呼び出し検出**: Axios, Fetch API, RTK Query, カスタム API クライアントに対応
- **詳細な使用状況分析**: エンドポイントごとの使用箇所、パラメータ、レスポンス処理を可視化
- **統計情報の自動生成**: HTTP メソッド分布、最頻使用エンドポイント、API バージョン分析など
- **複数形式での出力**: JSON 形式と Markdown 形式のレポート生成
- **高い耐障害性**: 様々なプロジェクト構造や TypeScript 環境に柔軟に対応

## インストールと準備

```bash
# リポジトリのクローン後、ツールディレクトリに移動
cd tools/endpoint-analyzer-2

# 依存パッケージのインストール
npm install

# ビルド
npm run build
```

## 基本的な使用方法

```bash
# 基本的な実行（フロントエンドディレクトリを指定）
npm run start -- --directory ../frontend/src

# 出力ファイルを指定した実行
npm run start -- --directory ../frontend/src --output-json ./output/api-analysis.json --output-md ./output/api-report.md

# 詳細なログを出力（デバッグ目的）
npm run start -- --directory ../frontend/src --verbose
```

## コマンドラインオプション

| オプション                    | 説明                                 | デフォルト値                       |
| ----------------------------- | ------------------------------------ | ---------------------------------- |
| `-d, --directory <path>`      | 解析対象のフロントエンドディレクトリ | `frontend/src`                     |
| `-p, --pattern <patterns...>` | 対象ファイルのグロブパターン         | `["**/*.ts", "**/*.tsx"]`          |
| `-i, --ignore <patterns...>`  | 除外ファイルのパターン               | `["**/*.test.ts", "**/*.spec.ts"]` |
| `-a, --api-prefix <regex>`    | API エンドポイント判定用の正規表現   | `(/api/\|/v[0-9]+/)`               |
| `-j, --output-json <path>`    | JSON 形式の出力ファイルパス          | `output/analysis-result.json`      |
| `-m, --output-md <path>`      | Markdown 形式の出力ファイルパス      | `output/endpoints-report.md`       |
| `--tsconfig <path>`           | カスタム tsconfig.json のパス        | 自動検出                           |
| `--fail-fast`                 | エラー発生時に即座に実行を中止       | `false`                            |
| `-v, --verbose`               | 詳細なログ出力                       | `false`                            |

## 対応する API 利用パターン

ツールは以下のフレームワークや API 呼び出しパターンを検出できます：

### Axios

```typescript
// 標準的なAxiosリクエスト
axios.get("/api/resources");
axios.post("/api/resources", { data });

// Axiosインスタンスを使用したリクエスト
const client = axios.create({ baseURL: "/api" });
client.get("/resources");
```

### Fetch API

```typescript
// ネイティブfetchの使用
fetch("/api/resources");
fetch("/api/resources", { method: "POST", body: JSON.stringify(data) });

// パラメータ付きパスを持つURL
fetch(`/api/resources/${id}`);
```

### RTK Query

```typescript
// createApiでのエンドポイント定義
export const api = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: "/api/" }),
  endpoints: (builder) => ({
    getResources: builder.query({
      query: () => "resources",
    }),
    addResource: builder.mutation({
      query: (resource) => ({
        url: "resources",
        method: "POST",
        body: resource,
      }),
    }),
  }),
});

// injectEndpointsを使用した拡張
const extendedApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCustomResource: build.query({
      query: (id) => `resources/${id}`,
      providesTags: ["Resource"],
    }),
  }),
});
```

### カスタム API クライアント

```typescript
// カスタムAPIクライアントの使用
import { apiClient } from "../services/apiClient";

apiClient.get("/resources");
apiClient.post("/resources", data);
```

## トラブルシューティング

**Q: `tsconfig.json` が見つからないというエラーが表示される**
A: プロジェクトルートの tsconfig.json を明示的に指定してください：

```bash
npm run start -- --directory ../frontend/src --tsconfig ../tsconfig.json
```

**Q: ファイルが多すぎて処理が遅い**
A: 対象ディレクトリを絞り込み、必要なファイルパターンのみを指定してください：

```bash
npm run start -- --directory ../frontend/src/features/specificFeature --pattern "**/*.ts"
```

**Q: EISDIR エラーが発生する**
A: ディレクトリパスが正しいか確認し、絶対パスを使用してみてください：

```bash
npm run start -- --directory $(pwd)/../frontend/src
```

**Q: RTK クエリのエンドポイントが検出されない**
A: RTK クエリの定義が標準的なパターンから外れている可能性があります。verbose モードで詳細ログを確認してください：

```bash
npm run start -- --directory ../frontend/src --verbose
```

## ライセンス

社内利用向けのプロプライエタリソフトウェアです。

## 謝辞

本ツールは元のエンドポイント解析ツールのアーキテクチャを改善し、拡張性と保守性を高めたバージョンです。元のツールの開発者の貢献に感謝いたします。
