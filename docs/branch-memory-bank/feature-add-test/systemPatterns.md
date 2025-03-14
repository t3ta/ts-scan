# システムパターン for feature/add-test

## 主要な技術的判断

### テスト構造

1. **ディレクトリ構造**
   - `tests/` がルートテストディレクトリ
   - ソースコードと同様の構造でサブディレクトリを配置（例: `tests/core`, `tests/detectors`など）
   - 各テストファイルは対応するソースファイルと同じ名前の`*.test.ts`とする

2. **テストパターン**
   - AAA (Arrange-Act-Assert) パターンを採用
   - ユニットテストは個々の関数や小さなコンポーネントに焦点を当てる
   - インテグレーションテストは複数コンポーネントの連携を検証

3. **モックとスタブ**
   - `jest.mock()`を使用して外部依存をモック
   - テスト用のヘルパー関数は`tests/helpers/`に配置
   - 複雑なモックデータは`tests/fixtures/`に配置

### テストツールチェーン

1. **Jest 設定**
   - `jest.config.js`は既存のものを使用（ts-jestプリセット）
   - `<rootDir>/tests`をテストルートとして設定済み

2. **TypeScript連携**
   - `ts-jest`を使用してTypeScriptファイルを直接テスト可能
   - 型定義は`src/types`から利用

3. **CIワークフロー**
   - GitHub Actionsを使用してPRごとにテストを実行（予定）
   - カバレッジレポートを生成して結果を可視化

## 関連するファイルやディレクトリ構造

```
ts-scan/
├── src/                  # ソースコード
│   ├── core/             # コア機能
│   ├── detectors/        # 検出器
│   ├── reporters/        # レポーター
│   ├── types/            # 型定義
│   └── utils/            # ユーティリティ
│
├── tests/                # テストコード（新規作成）
│   ├── core/             # コア機能のテスト
│   ├── detectors/        # 検出器のテスト
│   ├── reporters/        # レポーターのテスト
│   ├── utils/            # ユーティリティのテスト
│   ├── fixtures/         # テスト用データ
│   └── helpers/          # テスト用ヘルパー
│
├── jest.config.js        # Jestの設定ファイル（既存）
├── package.json          # npm設定
└── tsconfig.json         # TypeScript設定
```

## テスト記述スタイル

テストは明確で読みやすいように以下のパターンで記述するのだ：

```typescript
// 1. インポート
import { someFunction } from '../src/path/to/file';

// 2. テスト対象の説明（describeブロック）
describe('someFunction', () => {
  
  // 3. テストケース（切り分けられた機能や条件）
  describe('when given valid input', () => {
    
    // 4. 個別テスト（期待される動作）
    it('should return the expected result', () => {
      // Arrange（テストデータの準備）
      const input = { /* ... */ };
      const expected = { /* ... */ };
      
      // Act（テスト対象の実行）
      const result = someFunction(input);
      
      // Assert（結果の検証）
      expect(result).toEqual(expected);
    });
  });
  
  // 別のテストケース
  describe('when given invalid input', () => {
    it('should throw an error', () => {
      // ...
    });
  });
});
```

## モック利用パターン

外部依存を持つコンポーネントのテスト例：

```typescript
// ファイルシステムのモック
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('mocked content')
}));

// APIクライアントのモック
jest.mock('../src/utils/api-client', () => ({
  fetchData: jest.fn().mockResolvedValue({
    data: [/* モックデータ */]
  })
}));
```
