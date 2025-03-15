# SummaryGenerator テスト分析

## 現状の問題

SummaryGenerator.test.tsでは、以下の問題が発生しているのだ：

1. **表示形式の不一致**
   - テストの期待値: `エンドポイント総数: 2`
   - 実際の出力: `**エンドポイント総数:** 2`（マークダウンの強調表示を含む）

2. **パーセンテージ表示の不一致**
   - テストの期待値: `現在の移行率: 50%`
   - 実際の出力: `現在の移行率: 50.0%`

3. **推奨事項の表示形式の不一致**
   - テストの期待値: `未使用エンドポイントの検証: 1件のエンドポイント...`
   - 実際の出力: `**未使用エンドポイントの検証:** 1件のエンドポイント...`

## テストの目的

SummaryGeneratorのテストは、以下を検証するべきなのだ：

1. エグゼクティブサマリーが正しく生成されること
2. 主要指標が適切に表示されること
3. 推奨事項が条件に応じて正しく生成されること
4. 特殊なケース（データがない場合など）が適切に処理されること

## 正しいテスト仕様

### エグゼクティブサマリーのテスト

```typescript
it('基本的なエグゼクティブサマリーを正しく生成する', () => {
  // Act
  const content = generator.generateExecutiveSummary(mockResult);

  // Assert
  assertMarkdownSection(content, 'エグゼクティブサマリー');
  assertMarkdownSubSection(content, '主要指標');

  // 主要指標の確認
  expect(content).toContain('**エンドポイント総数:** 2');
  expect(content).toContain('**最も多いHTTPメソッド:** GET');
  expect(content).toContain('**動的エンドポイント割合:** 50.0%');
  expect(content).toContain('**RTK Query採用率:** 50.0%');
});
```

### 推奨事項のテスト

```typescript
it('未使用エンドポイントがある場合の推奨事項を生成する', () => {
  // Arrange
  const resultWithUnused = {
    ...mockResult,
    statistics: {
      ...mockResult.statistics,
      potentiallyUnusedEndpoints: 1
    }
  };

  // Act
  const content = generator.generateExecutiveSummary(resultWithUnused);

  // Assert
  assertMarkdownSubSection(content, '推奨事項の概要');
  expect(content).toContain('**未使用エンドポイントの検証:** 1件のエンドポイントが未使用の可能性があります');
});

it('RTK Query移行の推奨事項を生成する', () => {
  // Arrange
  const resultWithRtkQuery = {
    ...mockResult,
    statistics: {
      ...mockResult.statistics,
      sourceDistribution: {
        ...mockResult.statistics.sourceDistribution,
        'rtk-query': 1,
        'axios': 1
      }
    }
  };

  // Act
  const content = generator.generateExecutiveSummary(resultWithRtkQuery);

  // Assert
  assertMarkdownSubSection(content, '推奨事項の概要');
  expect(content).toContain('**RTK Query移行の促進:** 従来のAPI呼び出しからRTK Queryへの移行を継続してください (現在の移行率: 50.0%)');
});

it('複数のAPIバージョンが存在する場合の推奨事項を生成する', () => {
  // Arrange
  const resultWithMultipleVersions = {
    ...mockResult,
    statistics: {
      ...mockResult.statistics,
      apiVersionDistribution: {
        'v1': 1,
        'v2': 1,
        'v3': 1
      }
    }
  };

  // Act
  const content = generator.generateExecutiveSummary(resultWithMultipleVersions);

  // Assert
  assertMarkdownSubSection(content, '推奨事項の概要');
  expect(content).toContain('**APIバージョンの統一:** 3種類のAPIバージョンが混在しています');
});
```

## 改善点

1. **期待値の正確性**
   - マークダウンの強調表示（`**`）を含めた期待値にする
   - パーセンテージの表示形式を実際の出力に合わせる（小数点以下1桁まで表示）

2. **テストの堅牢性**
   - 完全一致ではなく、必要な部分のみを検証する
   - 表示形式の細かな変更に影響されにくいテストにする

3. **ヘルパー関数の活用**
   - `assertMarkdownSection`や`assertMarkdownSubSection`などのヘルパー関数を使用
   - 複雑なアサーションをカプセル化する新しいヘルパー関数を追加

これらの改善により、テストの信頼性と保守性が向上するのだ。
