# システムパターン for feature/add-test

## 主要な技術的判断

### テスト構造

1. **ディレクトリ構造**
   - `tests/` がルートテストディレクトリ
   - ソースコードと同様の構造でサブディレクトリを配置（例: `tests/core`, `tests/detectors`など）
   - 各テストファイルは対応するソースファイルと同じ名前の`*.test.ts`とする
   - 複合的なテスト（統合テストなど）は`*.integration.test.ts`の命名規則を採用

2. **テストパターン**
   - AAA (Arrange-Act-Assert) パターンを採用し、各セクションを明確に分離
   - ユニットテストは個々の関数や小さなコンポーネントに焦点を当てる
   - インテグレーションテストは複数コンポーネントの連携を検証
   - 各テストケースは単一の機能的側面または条件に焦点を当てる

3. **モックと型安全性**
   - `ts-mockito`を導入して型安全なモックオブジェクトを実現
   - 外部依存性は`jest.mock()`でモック化
   - 内部コンポーネント間の依存は`ts-mockito`を活用
   - ファイルシステム操作などの副作用を持つ操作は特に注意深くモック化

### モックフレームワーク選定

1. **ts-mockitoの採用理由**
   - 型安全性: TypeScriptの型システムと連携して型安全なモックを提供
   - 直感的API: when/thenパターンによる読みやすく保守性の高いテストコード
   - 検証機能: verify()メソッドによる関数呼び出しの詳細な検証が可能
   - 柔軟なマッチャー: 引数の部分一致やワイルドカードマッチングのサポート

2. **モックアプローチの使い分け**
   - 複雑なオブジェクト/クラス: ts-mockitoを使用して型安全にモック化
   - モジュール全体: Jestのモック機能を使用（`jest.mock()`）
   - 単純な関数/戻り値: Jestのスパイ機能（`jest.fn()`）
   - ファイルシステム/外部依存: Jestのモジュールモック機能を利用

3. **モック再利用戦略**
   - 汎用的なモックは`tests/helpers/mocks.ts`に集約
   - コンテキスト特有のモックはテストファイル内に定義
   - 複雑なモックデータは`tests/fixtures/`ディレクトリに配置
   - モック関数の引数検証はts-mockitoの`verify()`メソッドを活用

### テストユーティリティ設計

1. **ヘルパー関数**
   - `createMockSourceFile()`: ts-morphのSourceFileモック生成
   - `createMockTypeChecker()`: 型チェッカーのモック生成
   - `createMockDetectionContext()`: 検出コンテキストの構築
   - `createMockEndpointInfo()`: エンドポイント情報のモック生成

2. **フィクスチャ管理**
   - JSON形式でモックデータを管理
   - TypeScriptファイルのモックコンテンツを`fixtures/`に配置
   - 想定される解析結果データのスナップショットを保持
   - 複雑なオブジェクト生成用のファクトリ関数を実装

3. **レポーターテスト特有のパターン**
   - ファイル出力操作のモック化: `fs.writeFileSync`のモック実装
   - 出力データの捕捉: 書き込み関数のモック実装で出力内容を変数に保存
   - ジェネレーターのモジュール化: 各コンポーネントを独立してテスト
   - 統合テストによる連携検証: 複数のレポーターの相互作用をテスト

## 関連するファイルやディレクトリ構造

```
ts-scan/
├── src/                  # ソースコード
│   ├── core/             # コア機能
│   │   ├── AnalyzerEngine.ts
│   │   ├── ServiceLocator.ts
│   │   └── StrategyRegistry.ts
│   ├── detectors/        # 検出器
│   │   ├── AxiosDetectionStrategy.ts
│   │   ├── FetchDetectionStrategy.ts
│   │   ├── RTKQueryDetectionStrategy.ts
│   │   └── CustomApiClientStrategy.ts
│   ├── reporters/        # レポーター
│   │   ├── JsonReporter.ts
│   │   └── markdown/
│   │       ├── MarkdownReporter.ts
│   │       └── generators/
│   │           ├── SummaryGenerator.ts
│   │           ├── StatisticsGenerator.ts
│   │           ├── DetailGenerator.ts
│   │           ├── VisualizationGenerator.ts
│   │           ├── EndpointListGenerator.ts
│   │           ├── AnalysisGenerator.ts
│   │           └── RecommendationGenerator.ts
│   └── utils/            # ユーティリティ
│
├── tests/                # テストコード
│   ├── core/             # コア機能のテスト
│   │   ├── AnalyzerEngine.test.ts
│   │   ├── ServiceLocator.test.ts
│   │   └── StrategyRegistry.test.ts
│   ├── detectors/        # 検出器のテスト
│   │   └── AxiosDetectionStrategy.test.ts
│   ├── reporters/        # レポーターのテスト
│   │   ├── JsonReporter.test.ts
│   │   ├── MarkdownReporter.test.ts
│   │   ├── reporters.integration.test.ts
│   │   └── generators/
│   │       ├── SummaryGenerator.test.ts
│   │       ├── StatisticsGenerator.test.ts
│   │       └── DetailGenerator.test.ts
│   ├── fixtures/         # テスト用データ
│   │   └── axios-samples.ts
│   ├── helpers/          # テスト用ヘルパー
│   │   └── mocks.ts
│   └── utils/            # ユーティリティのテスト（予定）
│
├── jest.config.js        # Jestの設定ファイル
├── package.json          # npm設定（ts-mockito依存を含む）
└── tsconfig.json         # TypeScript設定
```

## テスト記述パターン

### 基本的なテスト構造（ts-mockitoを活用）

```typescript
// 1. インポート
import { mock, instance, when, verify, anything } from 'ts-mockito';
import { TestedClass } from '../../src/path/to/file';
import { Dependency } from '../../src/path/to/dependency';

describe('TestedClass', () => {
  
  // 2. テスト共通のセットアップ
  let mockedDependency: Dependency;
  let testedClass: TestedClass;
  
  beforeEach(() => {
    // Arrange - ts-mockitoを使用したモック作成
    mockedDependency = mock<Dependency>();
    when(mockedDependency.someMethod(anything())).thenReturn('mocked-result');
    
    // テスト対象クラスの初期化
    testedClass = new TestedClass(instance(mockedDependency));
  });
  
  // 3. テストケース（切り分けられた機能や条件）
  describe('when methodA is called with valid input', () => {
    
    // 4. 個別テスト（期待される動作）
    it('should return the expected result', () => {
      // Arrange
      const input = { /* ... */ };
      const expected = { /* ... */ };
      
      // Act
      const result = testedClass.methodA(input);
      
      // Assert
      expect(result).toEqual(expected);
      
      // モックの呼び出し検証
      verify(mockedDependency.someMethod(anything())).once();
    });
  });
});
```

### レポーターモジュールのテストパターン

```typescript
// レポーターテスト特有のモックパターン
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));

jest.mock('path', () => ({
  dirname: jest.fn().mockReturnValue('/mock/output/dir'),
  basename: jest.fn().mockReturnValue('target-dir'),
  relative: jest.fn().mockImplementation((from, to) => 'relative/path')
}));

describe('Reporter', () => {
  let reporter: Reporter;
  let mockResult: AnalysisResult;
  
  beforeEach(() => {
    jest.clearAllMocks();
    reporter = new Reporter();
    mockResult = /* ... */;
  });
  
  it('generates output with expected content', async () => {
    // Arrange - 出力捕捉用のモック実装
    let capturedOutput: string;
    (fs.writeFileSync as jest.Mock).mockImplementation((path, data) => {
      capturedOutput = data;
    });
    
    // Act
    await reporter.generateReport(mockResult);
    
    // Assert - 出力内容の検証
    const parsedOutput = JSON.parse(capturedOutput!);
    expect(parsedOutput).toHaveProperty('endpoints');
    // ...他の検証...
  });
});
```

### ジェネレーターコンポーネントのテストパターン

```typescript
describe('Generator', () => {
  let generator: Generator;
  let mockResult: AnalysisResult;
  
  beforeEach(() => {
    generator = new Generator();
    mockResult = /* ... */;
  });
  
  it('generates expected markdown content', () => {
    // Act
    const content = generator.generateSection(mockResult);
    
    // Assert - テキスト内容の検証
    expect(content).toContain('## セクションタイトル');
    expect(content).toContain('期待される内容');
    // ...他の検証...
  });
  
  it('handles edge cases appropriately', () => {
    // Arrange - エッジケース用のデータ
    const emptyResult = { ...mockResult, endpoints: [] };
    
    // Act
    const content = generator.generateSection(emptyResult);
    
    // Assert - エッジケース処理の検証
    expect(content).toContain('データがありません');
  });
});
```

## テスト実行と検証戦略

1. **単体テスト実行**
   - 個別テスト実行: `npm test -- -t "テスト名"`
   - 特定ファイルのテスト: `npm test -- path/to/file.test.ts`
   - 全テスト実行: `npm test`

2. **継続的フィードバック**
   - ウォッチモード: `npm run test:watch`
   - 変更検知による自動再実行
   - ファイル単位のテスト選択実行

3. **カバレッジ検証**
   - カバレッジレポート生成: `npm run test:coverage`
   - レポート出力先: `coverage/`ディレクトリ
   - ステートメント、ブランチ、関数カバレッジの確認

4. **CI連携計画**
   - GitHub Actionsワークフロー設定予定
   - PRごとのテスト自動実行
   - カバレッジレポートの保存とビジュアライズ
   - 型チェックとテスト実行の連携
