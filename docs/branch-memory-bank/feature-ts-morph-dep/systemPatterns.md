# システムパターン for feature/ts-morph-dep

## 主要な技術的判断

### アーキテクチャパターン

1. **抽象化とインターフェース分離の原則**
   - ts-morphへの依存を明示的なインターフェースで抽象化
   - 実装の詳細を隠蔽し、テスト容易性を向上
   - クリーンアーキテクチャの考え方に基づく層の分離

2. **アダプターパターン**
   - ts-morph操作をアダプターレイヤーでラップ
   - 外部依存とドメインロジックの明確な分離
   - テスト時に置き換え可能なコンポーネント構造

3. **依存性注入（DI）**
   - ServiceLocatorを拡張したDIコンテナの活用
   - インターフェースベースの疎結合設計
   - テスト・本番環境で異なる実装の注入が可能

4. **ファクトリパターン**
   - 環境に応じた適切な実装を生成するファクトリの導入
   - 実行時コンテキストに基づくインスタンス生成ロジックの集約
   - 条件分岐の複雑性を低減

### スナップショットテスト戦略

1. **AST構造のスナップショット化**
   - 実際のts-morph生成ASTをJSONとして保存
   - スナップショットからモックASTを再構築
   - 環境依存なしでASTベースのテストを実現

2. **サンプルケースの多様化**
   - 一般的なTypeScriptパターンに対するスナップショットを網羅
   - エッジケースを含むテストシナリオのカバレッジ

3. **スナップショット更新メカニズム**
   - スナップショット生成用のユーティリティツール
   - バージョン管理と変更検知の仕組み

### テスト戦略

1. **モックアーキテクチャ**
   - インターフェースに準拠したモック実装
   - スナップショットを活用したリアルなモック動作
   - テスト環境特有の振る舞いを制御可能

2. **コンポーネントテスト**
   - アダプターのみを対象とした単体テスト
   - モックプロバイダーを使用したビジネスロジックのテスト
   - 依存性の少ないテスト環境構築

3. **統合テスト**
   - 実際のts-morphを使用したケースの最小化
   - CI/CD環境でも安定して実行可能なテスト構成

## 関連するファイルやディレクトリ構造

```
ts-scan/
├── src/
│   ├── core/
│   │   ├── ast/                     # 新規: AST操作の抽象化レイヤー
│   │   │   ├── interfaces/          # インターフェース定義
│   │   │   │   ├── IASTProvider.ts  # ASTプロバイダーインターフェース
│   │   │   │   ├── ISourceFile.ts   # ソースファイル抽象化
│   │   │   │   └── INode.ts         # ノード抽象化
│   │   │   ├── implementations/     # 実装クラス
│   │   │   │   ├── TsMorphProvider.ts  # ts-morph実装
│   │   │   │   └── MockProvider.ts     # モック実装
│   │   │   ├── adapters/            # アダプタークラス
│   │   │   │   └── TsMorphAdapter.ts   # ts-morphアダプター
│   │   │   └── factories/           # ファクトリークラス
│   │   │       └── ASTProviderFactory.ts  # プロバイダー生成ファクトリー
│   │   ├── ServiceLocator.ts        # 拡張: ASTプロバイダー登録対応
│   │   └── AnalyzerEngine.ts        # 改修: 直接依存→インターフェース利用
│   │
│   ├── detectors/                   # 改修: インターフェース経由のAST操作
│   │   ├── common/
│   │   ├── http/
│   │   └── rtk-query/
│   │
│   └── utils/
│       └── ast/                     # AST操作ユーティリティ
│
├── tests/
│   ├── core/
│   │   ├── ast/                     # 新規: AST抽象化レイヤーのテスト
│   │   │   ├── TsMorphAdapter.test.ts
│   │   │   └── ASTProviderFactory.test.ts
│   │   └── AnalyzerEngine.test.ts   # 改修: モックASTプロバイダー利用
│   │
│   ├── fixtures/
│   │   └── ast-snapshots/           # 新規: AST構造スナップショット
│   │       ├── basic-function.json
│   │       ├── class-declaration.json
│   │       ├── http-client-usage.json
│   │       └── ...
│   │
│   ├── helpers/
│   │   └── ast-helpers.ts           # 新規: ASTテスト用ヘルパー
│   │
│   └── detectors/                   # 改修: モックAST利用のテスト
│
├── docs/
│   └── branch-memory-bank/
│       └── feature-ts-morph-dep/
│           ├── branchContext.md
│           ├── systemPatterns.md
│           ├── activeContext.md
│           └── progress.md
│
└── jest.config.js                   # 必要に応じて設定調整
```

## テスト記述パターン

### ASTプロバイダーのモックパターン

```typescript
// テスト内でのモックASTプロバイダーの利用
import { IASTProvider } from '../../../src/core/ast/interfaces/IASTProvider';
import { createMockASTProvider } from '../../helpers/ast-helpers';
import { loadASTSnapshot } from '../../helpers/ast-helpers';

describe('AxiosDetectionStrategy with Mocked AST', () => {
  let mockASTProvider: IASTProvider;
  let strategy: AxiosDetectionStrategy;
  
  beforeEach(() => {
    // スナップショットからモックASTプロバイダーを作成
    const astSnapshot = loadASTSnapshot('axios-client-usage');
    mockASTProvider = createMockASTProvider(astSnapshot);
    
    // DIコンテナ経由でモックプロバイダーを注入
    const serviceLocator = new ServiceLocator();
    serviceLocator.registerASTProvider(mockASTProvider);
    
    // テスト対象の初期化（DIを使用）
    strategy = new AxiosDetectionStrategy();
    strategy.initialize(serviceLocator);
  });
  
  it('correctly detects axios API calls', () => {
    // テスト実装...
  });
});
```

### アダプターのテストパターン

```typescript
// ts-morphアダプターの単体テスト
import { TsMorphAdapter } from '../../../src/core/ast/adapters/TsMorphAdapter';

describe('TsMorphAdapter', () => {
  let adapter: TsMorphAdapter;
  
  beforeEach(() => {
    adapter = new TsMorphAdapter();
  });
  
  it('correctly parses TypeScript code', () => {
    // 単純なTypeScriptコード
    const code = `
      function hello(name: string): string {
        return \`Hello, \${name}!\`;
      }
    `;
    
    const sourceFile = adapter.parseCode(code);
    
    // アダプターのインターフェースを通じてASTを検証
    expect(sourceFile).toBeDefined();
    expect(sourceFile.getFunctions().length).toBe(1);
    
    const func = sourceFile.getFunctions()[0];
    expect(func.getName()).toBe('hello');
    expect(func.getParameters().length).toBe(1);
  });
});
```

### スナップショット生成パターン

```typescript
// AST構造のスナップショット生成ユーティリティ
import { Project } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

function generateASTSnapshot(code: string, outputName: string): void {
  const project = new Project();
  const sourceFile = project.createSourceFile('temp.ts', code);
  
  // AST構造を再帰的にシリアライズ可能なオブジェクトに変換
  const serializableAST = serializeNode(sourceFile);
  
  // スナップショットを保存
  const outputPath = path.resolve(__dirname, '../../fixtures/ast-snapshots', `${outputName}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(serializableAST, null, 2));
}

// 使用例
generateASTSnapshot(`
  import axios from 'axios';
  
  async function fetchData() {
    return axios.get('/api/data');
  }
`, 'axios-get-request');
```

## 実装手順と優先順位

1. **フェーズ1: インターフェース定義とアダプター基盤**
   - 抽象インターフェースの設計と実装
   - TsMorphAdapterの基本実装
   - ServiceLocatorの拡張

2. **フェーズ2: モックプロバイダーとスナップショット機構**
   - AST構造スナップショットの取得方法確立
   - MockASTProviderの実装
   - テスト用ヘルパーの整備

3. **フェーズ3: 依存コードのリファクタリング**
   - AnalyzerEngineのリファクタリング
   - 検出器の依存性修正
   - テストの更新

4. **フェーズ4: 検証とドキュメント化**
   - スキップテストの有効化と検証
   - リファクタリングの影響範囲確認
   - パターンとアプローチのドキュメント化
