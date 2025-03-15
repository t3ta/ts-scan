# RecommendationGenerator テスト設計

## 概要

RecommendationGeneratorのテストケースを論理的に設計し、各推奨事項セクションの生成ロジックを検証します。

## テストケース設計

### 1. 推奨事項セクション全体のテスト

```typescript
it('推奨事項セクション全体を正しく生成する', () => {
  // このテストでは、mockResultをそのまま使用
  const recommendations = generator.generateRecommendationsSection(mockResult);

  // 各セクションのヘッダーが存在することを確認
  expect(recommendations).toContain('## 推奨事項と最適化提案');
  expect(recommendations).toContain('### APIパターン標準化');
  expect(recommendations).toContain('### エンドポイント設計の改善');
  expect(recommendations).toContain('### RTK Query移行計画');
  expect(recommendations).toContain('### 複雑性の高いエンドポイントの改善');
  expect(recommendations).toContain('### コード品質とテスト戦略');
});
```

### 2. APIパターン標準化の推奨事項テスト

```typescript
it('APIパターン標準化の推奨事項を正しく生成する', () => {
  // mockResultには3つのAPIパターン（axios, fetch, rtk-query）が含まれている
  const recommendations = generator.generateRecommendationsSection(mockResult);

  // APIクライアントの統一に関する推奨事項
  expect(recommendations).toContain('APIクライアントの統一');
  expect(recommendations).toContain('3種類の異なるAPIアクセスパターン');
  expect(recommendations).toContain('axios'); // 最も使用されているパターン

  // APIバージョンに関する推奨事項
  expect(recommendations).toContain('APIバージョン');
  expect(recommendations).toContain('v1');
  expect(recommendations).toContain('v2');
});
```

### 3. エンドポイント設計の推奨事項テスト

```typescript
it('エンドポイント設計の推奨事項を正しく生成する', () => {
  const recommendations = generator.generateRecommendationsSection(mockResult);

  // 動的パスパラメータに関する推奨事項
  expect(recommendations).toContain('動的パスパラメータの一貫した命名');
  expect(recommendations).toContain('2件の動的パスパラメータを持つエンドポイント');

  // RESTful設計原則に関する推奨事項
  expect(recommendations).toContain('RESTful設計原則の適用');
  expect(recommendations).toContain('GETとPOSTは使用されています');
});
```

### 4. RTK Query移行の推奨事項テスト

```typescript
it('RTK Query移行の推奨事項を正しく生成する', () => {
  const recommendations = generator.generateRecommendationsSection(mockResult);

  // 移行進捗状況
  expect(recommendations).toContain('移行進捗状況');
  expect(recommendations).toContain('20%'); // 1/5のエンドポイントがRTK Query

  // 移行手順
  expect(recommendations).toContain('推奨移行手順');
  expect(recommendations).toContain('類似エンドポイントのグループ化');
  expect(recommendations).toContain('優先順位付け');

  // 移行のメリット
  expect(recommendations).toContain('移行のメリット');
  expect(recommendations).toContain('状態管理の簡素化');
});
```

### 5. 複雑性の高いエンドポイントの改善推奨事項テスト

```typescript
it('複雑性の高いエンドポイントの改善推奨事項を正しく生成する', () => {
  const recommendations = generator.generateRecommendationsSection(mockResult);

  // 複雑なエンドポイントの情報
  expect(recommendations).toContain('/api/users/:id/transactions/:transactionId');
  expect(recommendations).toContain('複雑性スコア');

  // 複雑性の原因
  expect(recommendations).toContain('複雑性の原因');
  expect(recommendations).toContain('パラメータ数が多い');
  expect(recommendations).toContain('動的パスパラメータを使用している');

  // 改善提案
  expect(recommendations).toContain('改善提案');
  expect(recommendations).toContain('パラメータを整理し、関連するものをオブジェクトにグループ化');
});
```

### 6. コード品質向上の推奨事項テスト

```typescript
it('コード品質向上の推奨事項を正しく生成する', () => {
  const recommendations = generator.generateRecommendationsSection(mockResult);

  // 型安全性の強化
  expect(recommendations).toContain('型安全性の強化');
  expect(recommendations).toContain('API接続層では厳格な型定義を導入');

  // テスト戦略
  expect(recommendations).toContain('テスト戦略');
  expect(recommendations).toContain('各エンドポイント呼び出しに単体テスト');

  // ドキュメント整備
  expect(recommendations).toContain('ドキュメント整備');
  expect(recommendations).toContain('OpenAPI/Swagger');

  // エラーハンドリング
  expect(recommendations).toContain('エラーハンドリングの改善');

  // パフォーマンス監視
  expect(recommendations).toContain('パフォーマンス監視');
});
```

### 7. 条件付きセクション生成のテスト

```typescript
it('RTK Query移行の推奨事項を生成しない条件を確認する', () => {
  const noRtkResult = {
    ...mockResult,
    statistics: {
      ...mockResult.statistics,
      sourceDistribution: {
        ...mockResult.statistics.sourceDistribution,
        'rtk-query': 0
      },
      rtkQueryUsage: {
        totalEndpoints: 0,
        queries: 0,
        mutations: 0,
        transformResponseUsage: 0
      }
    }
  };

  const recommendations = generator.generateRecommendationsSection(noRtkResult);
  expect(recommendations).not.toContain('### RTK Query移行計画');
});

it('複雑性の高いエンドポイントの改善推奨事項を生成しない条件を確認する', () => {
  const noComplexResult = {
    ...mockResult,
    endpoints: mockResult.endpoints.slice(0, 3) // 複雑なエンドポイントを除去
  };

  const recommendations = generator.generateRecommendationsSection(noComplexResult);
  expect(recommendations).not.toContain('### 複雑性の高いエンドポイントの改善');
});
```

## テスト実装の注意点

1. 各テストケースは独立して実行できるようにする
2. モックデータは各テストケースの意図を明確に表現する
3. 期待値の検証は具体的な文字列や値を使用する
4. エッジケースや境界値のテストも含める

## 次のステップ

1. Codeモードに切り替えてテストを実装
2. 実装後、各テストケースが期待通り動作することを確認
3. 必要に応じてテストケースの追加や修正を行う
