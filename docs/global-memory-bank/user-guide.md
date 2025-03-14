# ユーザーガイド

tags: #user-guide #documentation #usage

## 概要

ts-scanは、フロントエンドコードベースからバックエンドAPIエンドポイントの使用状況を効率的に解析するツールです。このガイドでは、ツールのインストール、設定、基本的な使用方法について説明します。

## インストール

### 前提条件
- Node.js (16.x以上)
- npm (7.x以上)
- TypeScript (4.x以上)

### インストール手順

```bash
# リポジトリのクローン
git clone <repository-url>

# ツールディレクトリに移動
cd tools/endpoint-analyzer-2

# 依存パッケージのインストール
npm install

# ビルド
npm run build
```

## 基本的な使用方法

### コマンドライン実行

```bash
# 基本的な実行
npm run start -- --directory ../frontend/src

# 出力ファイルを指定して実行
npm run start -- --directory ../frontend/src --output-json ./output/api-analysis.json --output-md ./output/api-report.md

# 詳細ログを出力
npm run start -- --directory ../frontend/src --verbose
```

### コマンドラインオプション

| オプション | 説明 | デフォルト値 |
|------------|------|--------------|
| `-d, --directory <path>` | 解析対象のフロントエンドディレクトリ | `frontend/src` |
| `-p, --pattern <patterns...>` | 対象ファイルのグロブパターン | `["**/*.ts", "**/*.tsx"]` |
| `-i, --ignore <patterns...>` | 除外ファイルのパターン | `["**/*.test.ts", "**/*.spec.ts"]` |
| `-a, --api-prefix <regex>` | APIエンドポイント判定用の正規表現 | `(/api/\|/v[0-9]+/)` |
| `-j, --output-json <path>` | JSON形式の出力ファイルパス | `output/analysis-result.json` |
| `-m, --output-md <path>` | Markdown形式の出力ファイルパス | `output/endpoints-report.md` |
| `--tsconfig <path>` | カスタムtsconfig.jsonのパス | 自動検出 |
| `--fail-fast` | エラー発生時に即座に実行を中止 | `false` |
| `-v, --verbose` | 詳細なログ出力 | `false` |

## 設定

### tsconfig.jsonの設定

プロジェクトルートまたは解析対象ディレクトリに`tsconfig.json`が必要です。

```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.spec.ts", "**/*.test.ts"]
}
```

### カスタム設定

特定のニーズに合わせて以下の設定をカスタマイズできます：

- 解析対象ファイルパターン
- APIエンドポイントの判定ルール
- 出力フォーマット
- ログレベル

## レポート形式

### JSON形式

```json
{
  "summary": {
    "totalEndpoints": 42,
    "uniquePaths": 35,
    "methodDistribution": {
      "GET": 20,
      "POST": 15,
      "PUT": 5,
      "DELETE": 2
    }
  },
  "endpoints": [
    {
      "path": "/api/users",
      "method": "GET",
      "location": {
        "file": "src/services/userService.ts",
        "line": 42
      }
    }
  ]
}
```

### Markdown形式

```markdown
# API使用状況レポート

## 概要
- 総エンドポイント数: 42
- ユニークパス数: 35
- 最も使用されているメソッド: GET (20回)

## エンドポイント一覧
### /api/users
- メソッド: GET
- 使用箇所: src/services/userService.ts:42
- パターン: Axios
```

## トラブルシューティング

### よくある問題と解決策

1. **tsconfig.jsonが見つからない**
   ```bash
   npm run start -- --directory ../frontend/src --tsconfig ../tsconfig.json
   ```

2. **処理が遅い**
   ```bash
   # 対象を絞り込んで実行
   npm run start -- --directory ../frontend/src/features/specificFeature --pattern "**/*.ts"
   ```

3. **EISDIRエラー**
   ```bash
   # 絶対パスを使用
   npm run start -- --directory $(pwd)/../frontend/src
   ```

4. **RTKクエリの検出失敗**
   ```bash
   # 詳細ログを確認
   npm run start -- --directory ../frontend/src --verbose
   ```

## ベストプラクティス

### 効率的な使用方法

1. **適切な対象範囲の選択**
   - 必要な部分のみを解析
   - 不要なファイルは除外

2. **定期的な実行**
   - CI/CDパイプラインへの組み込み
   - 変更の追跡と監視

3. **出力の活用**
   - 統計情報の定期的なレビュー
   - 重複や非効率な呼び出しの特定

## 高度な使用法

### CI/CDパイプラインでの使用

```yaml
analyze-endpoints:
  script:
    - npm install
    - npm run build
    - npm run start -- --directory ./src --output-json ./artifacts/api-analysis.json
  artifacts:
    paths:
      - artifacts/api-analysis.json
```

### カスタムレポートの生成

```bash
# 複数フォーマットでの出力
npm run start -- \
  --directory ../frontend/src \
  --output-json ./output/analysis.json \
  --output-md ./output/report.md
