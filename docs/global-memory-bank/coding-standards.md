# コーディング規約

tags: #coding-standards #best-practices #typescript

## TypeScriptコーディング規約

### 1. 型定義

#### 基本方針
- 明示的な型定義を優先
- any型の使用を避ける
- unknown型を使用して型安全性を確保
- Utility Typesの積極的な活用

```typescript
// Good
type UserId = string;
type UserData = {
  id: UserId;
  createdAt: Date;
};

// Bad
type Data = any;
```

#### ジェネリクス
- 意味のある型パラメータ名を使用
- 制約は必要最小限に
- デフォルト型の適切な設定

```typescript
// Good
interface Repository<T extends { id: string }> {
  findById(id: string): Promise<T | null>;
}

// Bad
interface Repository<T> {
  find(query: any): Promise<T[]>;
}
```

### 2. 関数定義

#### 命名規則
- 動詞で開始
- 具体的な操作を表す
- 単一責任の原則に従う

```typescript
// Good
function validateUserInput(input: UserInput): ValidationResult {
  // ...
}

// Bad
function process(data: any): void {
  // ...
}
```

#### 戻り値
- 明示的な戻り値の型定義
- Promise型の一貫した使用
- エラーハンドリングの統一

### 3. インターフェース設計

#### 基本原則
- ISP (Interface Segregation Principle) の遵守
- 実装の詳細を含めない
- プラットフォーム固有の型を避ける

```typescript
// Good
interface Logger {
  log(message: string, level: LogLevel): void;
}

// Bad
interface DatabaseService {
  connection: MongoClient;
  query(sql: string): any[];
}
```

### 4. エラー処理

#### 基本方針
- 型付きエラーの使用
- エラーチェーンの維持
- 意味のあるエラーメッセージ

```typescript
// Good
class ValidationError extends Error {
  constructor(message: string, public readonly field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Bad
throw new Error('Something went wrong');
```

### 5. 非同期処理

#### Promise処理
- async/awaitの一貫した使用
- エラーハンドリングの徹底
- Promise.allの適切な活用

```typescript
// Good
async function fetchUserData(id: string): Promise<UserData> {
  try {
    const response = await api.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    throw new ApiError('Failed to fetch user data', { cause: error });
  }
}

// Bad
function fetchUserData(id: string) {
  return api.get('/users/' + id).then(res => res.data);
}
```

### 6. モジュール構造

#### ファイル構成
- 関連する機能をグループ化
- 明確な依存関係の方向
- インデックスファイルの適切な使用

```typescript
src/
  ├── core/
  │   ├── types.ts
  │   └── index.ts
  ├── features/
  │   ├── user/
  │   │   ├── types.ts
  │   │   ├── service.ts
  │   │   └── index.ts
  │   └── index.ts
  └── utils/
      ├── validation.ts
      └── index.ts
```

### 7. コメント規約

#### 必須コメント
- 公開APIの説明
- 複雑なロジックの説明
- 型定義の目的説明

```typescript
/**
 * ユーザー入力を検証し、結果を返却する
 * @param input - 検証対象のユーザー入力
 * @returns 検証結果と詳細メッセージ
 * @throws {ValidationError} 入力が無効な場合
 */
function validateUserInput(input: UserInput): ValidationResult {
  // ...
}
```

### 8. テストコード規約

#### テスト構造
- Arrange-Act-Assert パターンの使用
- 意味のあるテスト名
- テストケースの独立性確保

```typescript
describe('UserService', () => {
  it('should return user data when valid ID is provided', async () => {
    // Arrange
    const userId = 'valid-id';
    const mockData = { id: userId, name: 'Test User' };

    // Act
    const result = await userService.findById(userId);

    // Assert
    expect(result).toEqual(mockData);
  });
});
```

### 9. 命名規則

#### 変数・関数名
- キャメルケース (camelCase)
- 明確な意図を反映
- 一時変数は最小限に

#### 型・インターフェース名
- パスカルケース (PascalCase)
- 名詞または形容詞で開始
- 目的を明確に表現

#### 定数名
- 大文字のスネークケース (UPPER_SNAKE_CASE)
- スコープに応じた適切な配置
- 意味のある名前付け

### 10. パフォーマンス考慮事項

#### メモリ管理
- 大きなオブジェクトの適切な解放
- メモリリークの防止
- 循環参照の回避

#### 計算効率
- 不要な再計算の防止
- 適切なキャッシュ戦略
- 効率的なデータ構造の選択
