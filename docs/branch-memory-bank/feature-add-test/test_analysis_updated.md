# RecommendationGenerator テスト分析（更新版）

## テストの基本方針

1. 各推奨事項セクションを独立してテスト
2. 条件付きコンテンツの生成ロジックを明確に検証
3. エッジケースと特殊条件の網羅的なテスト
4. モックデータの適切な構造化

## テストケース詳細設計

### 1. 推奨事項セクション全体のテスト

```typescript
it('推奨事項セクション全体を正しく生成する', () => {
  const recommendations = generator.generateRecommendationsSection(mockResult);

  // 基本構造の検証
  expect(recommendations).toContain('## 推奨事項と最適化提案');

  // 各サブセクションの存在確認
  expect(recommendations).toContain('### APIパターン標準化');
  expect(recommendations).toContain('### エンドポイント設計の改善');
  expect(recommendations).toContain('### RTK Query移行計画');
  expect(recommendations).toContain('### 複雑性の高いエンドポイントの改善');
  expect(recommendations).toContain('### コード品質とテスト戦略');

  // フォーマットとインデントの検証
  expect(recommendations).toMatch(/\n\n- /); // 箇条書きの前に空行
  expect(recommendations).toMatch(/\n  - /); // サブ項目の適切なインデント
});
```

### 2. APIパターン標準化の推奨事項テスト

```typescript
describe('APIパターン標準化の推奨事項', () => {
  it('複数のAPIパターンが存在する場合の推奨事項を生成する', () => {
    const recommendations = generator.generateRecommendationsSection(mockResult);

    // パターン混在の警告
    expect(recommendations).toContain('3種類の異なるAPIアクセスパターン');
    expect(recommendations).toContain('axios、fetch、rtk-query');

    // 最も使用されているパターンの推奨
    expect(recommendations).toContain('axiosを主要なAPIアクセスパターンとして標準化');
  });

  it('APIバージョンの混在がある場合の推奨事項を生成する', () => {
    const recommendations = generator.generateRecommendationsSection(mockResult);

    expect(recommendations).toContain('APIバージョンの統一');
    expect(recommendations).toContain('v1、v2');
    expect(recommendations).toContain('最新バージョンへの統一');
  });

  it('未使用エンドポイントがある場合の推奨事項を生成する', () => {
    const recommendations = generator.generateRecommendationsSection(mockResult);

    expect(recommendations).toContain('未使用エンドポイントの検証');
    expect(recommendations).toContain('不要なコードを削除');
  });
});
```

### 3. エンドポイント設計の推奨事項テスト

```typescript
describe('エンドポイント設計の推奨事項', () => {
  it('動的パスパラメータを持つエンドポイントの推奨事項を生成する', () => {
    const recommendations = generator.generateRecommendationsSection(mockResult);

    expect(recommendations).toContain('動的パスパラメータの一貫した命名');
    expect(recommendations).toContain('2件の動的パスパラメータを持つエンドポイント');
    expect(recommendations).toContain('型安全性を向上');
  });

  it('使用頻度の高いエンドポイントの推奨事項を生成する', () => {
    const recommendations = generator.generateRecommendationsSection(mockResult);

    expect(recommendations).toContain('高頻度使用エンドポイント');
    expect(recommendations).toContain('キャッシュ戦略の実装');
    expect(recommendations).toContain('パフォーマンスモニタリング');
  });

  it('RESTful設計原則に関する推奨事項を生成する', () => {
    const recommendations = generator.generateRecommendationsSection(mockResult);

    expect(recommendations).toContain('RESTful設計原則の適用');
    expect(recommendations).toContain('GETとPOSTは使用されています');
    expect(recommendations).toContain('PUT');
    expect(recommendations).toContain('DELETE');
  });
});
```

### 4. RTK Query移行の推奨事項テスト

```typescript
describe('RTK Query移行の推奨事項', () => {
  it('RTK Query移行が必要な場合の推奨事項を生成する', () => {
    const recommendations = generator.generateRecommendationsSection(mockResult);

    expect(recommendations).toContain('RTK Query移行計画');
    expect(recommendations).toContain('移行進捗状況');
    expect(recommendations).toContain('20%のエンドポイントがRTK Queryに移行済み');
  });

  it('RTK Queryが全く使用されていない場合は移行セクションを生成しない', () => {
    const noRtkResult = {
      ...mockResult,
      statistics: {
        ...mockResult.statistics,
        sourceDistribution: {
          ...mockResult.statistics.sourceDistribution,
          'rtk-query': 0
        }
      }
    };

    const recommendations = generator.generateRecommendationsSection(noRtkResult);
    expect(recommendations).not.toContain('### RTK Query移行計画');
  });

  it('RTK Query移行が80%以上完了している場合は移行セクションを生成しない', () => {
    const mostlyRtkResult = {
      ...mockResult,
      statistics: {
        ...mockResult.statistics,
        sourceDistribution: {
          ...mockResult.statistics.sourceDistribution,
          'rtk-query': 4,
          'axios': 1
        }
      }
    };

    const recommendations = generator.generateRecommendationsSection(mostlyRtkResult);
    expect(recommendations).not.toContain('### RTK Query移行計画');
  });
});
```

### 5. 複雑性の高いエンドポイントの改善推奨事項テスト

```typescript
describe('複雑性の高いエンドポイントの改善推奨事項', () => {
  it('複雑なエンドポイントがある場合の推奨事項を生成する', () => {
    const recommendations = generator.generateRecommendationsSection(mockResult);

    expect(recommendations).toContain('複雑性の高いエンドポイントの改善');
    expect(recommendations).toContain('/api/users/:id/transactions/:transactionId');
    expect(recommendations).toContain('複雑性スコア');
  });

  it('複雑性の原因を正しく特定する', () => {
    const recommendations = generator.generateRecommendationsSection(mockResult);

    expect(recommendations).toContain('複雑性の原因');
    expect(recommendations).toContain('パラメータ数が多い');
    expect(recommendations).toContain('使用箇所が広範囲に散らばっている');
    expect(recommendations).toContain('動的パスパラメータを使用している');
  });

  it('複雑なエンドポイントがない場合は改善セクションを生成しない', () => {
    const noComplexResult = {
      ...mockResult,
      endpoints: mockResult.endpoints.slice(0, 3)
    };

    const recommendations = generator.generateRecommendationsSection(noComplexResult);
    expect(recommendations).not.toContain('### 複雑性の高いエンドポイントの改善');
  });
});
```

### 6. コード品質向上の推奨事項テスト

```typescript
describe('コード品質向上の推奨事項', () => {
  it('型安全性の推奨事項を生成する', () => {
    const recommendations = generator.generateRecommendationsSection(mockResult);

    expect(recommendations).toContain('型安全性の強化');
    expect(recommendations).toContain('API接続層では厳格な型定義を導入');
    expect(recommendations).toContain('unknown" 型を活用');
  });

  it('テスト戦略の推奨事項を生成する', () => {
    const recommendations = generator.generateRecommendationsSection(mockResult);

    expect(recommendations).toContain('テスト戦略');
    expect(recommendations).toContain('各エンドポイント呼び出しに単体テスト');
    expect(recommendations).toContain('MSW（Mock Service Worker）');
  });

  it('ドキュメント整備の推奨事項を生成する', () => {
    const recommendations = generator.generateRecommendationsSection(mockResult);

    expect(recommendations).toContain('ドキュメント整備');
    expect(recommendations).toContain('OpenAPI/Swagger');
    expect(recommendations).toContain('エンドポイント分析レポート');
  });

  it('エラーハンドリングの推奨事項を生成する', () => {
    const recommendations = generator.generateRecommendationsSection(mockResult);

    expect(recommendations).toContain('エラーハンドリングの改善');
    expect(recommendations).toContain('一貫したエラー構造');
    expect(recommendations).toContain('ユーザーフレンドリーなエラーメッセージ');
  });

  it('パフォーマンス監視の推奨事項を生成する', () => {
    const recommendations = generator.generateRecommendationsSection(mockResult);

    expect(recommendations).toContain('パフォーマンス監視');
    expect(recommendations).toContain('API呼び出しの処理時間計測');
    expect(recommendations).toContain('エラー率の追跡');
  });
});
```

## テスト実装の注意点

1. 各テストケースは独立して実行できるようにする
2. モックデータは各テストの意図を明確に表現する
3. 期待値の検証は具体的な文字列を使用する
4. エッジケースと境界値のテストを含める
5. テストの可読性と保守性を重視する

## 次のステップ

1. Codeモードに切り替えてテストを実装
2. 実装後、各テストケースが期待通り動作することを確認
3. 必要に応じてテストケースの追加や修正を行う
4. テストカバレッジを確認し、必要に応じて追加のテストを作成

## 特記事項

- 各テストケースは独立して実行可能
- モックデータは再利用可能な形で構造化
- エッジケースと特殊条件を網羅的にカバー
- テストの意図が明確に理解できる命名と構造
