# StatisticsGenerator テスト分析

## 現状の問題

StatisticsGenerator.test.tsでは、以下の問題が発生しているのだ：

1. **パーセンテージ表示の不一致**
   - テストの期待値: `50%`, `40%`, `70%`
   - 実際の出力: `50.0%`, `40.0%`, `70.0%`

2. **RTK Query統計情報の表示形式の不一致**
   - テストの期待値: `RTK Query使用エンドポイント: 3 (30%)`
   - 実際の出力: `**RTK Query使用エンドポイント:** 3 (30.0%)`

## テストの目的

StatisticsGeneratorのテストは、以下を検証するべきなのだ：

1. 各種統計情報（HTTPメソッド分布、検出元分布、APIバージョン分布など）が正しく生成されること
2. パーセンテージが正確に計算され、適切な形式で表示されること
3. テーブル形式のデータが正しく整形されること
4. 特殊なケース（データがない場合など）が適切に処理されること

## 正しいテスト仕様

### HTTPメソッド分布のテスト

```typescript
it('HTTPメソッド分布を正しく生成する', () => {
  // Act
  const content = generator.generateHttpMethodDistribution(mockResult);

  // Assert
  assertMarkdownSubSection(content, 'HTTPメソッド分布');
  expect(content).toContain('| メソッド | エンドポイント数 | 割合 |');
  expect(content).toContain('| GET | 5 | 50.0% |');
  expect(content).toContain('| POST | 3 | 30.0% |');
  expect(content).toContain('| PUT | 2 | 20.0% |');
});
```

### 検出元分布のテスト

```typescript
it('検出元分布を正しく生成する', () => {
  // Act
  const content = generator.generateSourceDistribution(mockResult);

  // Assert
  assertMarkdownSubSection(content, '検出元分布');
  expect(content).toContain('| タイプ | エンドポイント数 | 割合 |');
  expect(content).toContain('| Axios | 4 | 40.0% |');
  expect(content).toContain('| RTK Query | 3 | 30.0% |');
  expect(content).toContain('| Fetch API | 2 | 20.0% |');
  expect(content).toContain('| カスタムAPIクライアント | 1 | 10.0% |');
});
```

### APIバージョン分布のテスト

```typescript
it('APIバージョン分布を正しく生成する', () => {
  // Act
  const content = generator.generateApiVersionDistribution(mockResult);

  // Assert
  assertMarkdownSubSection(content, 'APIバージョン分布');
  expect(content).toContain('| バージョン | エンドポイント数 | 割合 |');
  expect(content).toContain('| v1 | 7 | 70.0% |');
  expect(content).toContain('| v2 | 3 | 30.0% |');
});
```

### 機能カテゴリ分布のテスト

```typescript
it('機能カテゴリ分布を正しく生成する', () => {
  // Act
  const content = generator.generateFeatureCategoryDistribution(mockResult);

  // Assert
  assertMarkdownSubSection(content, '機能カテゴリ分布');
  expect(content).toContain('| カテゴリ | エンドポイント数 | 割合 |');
  expect(content).toContain('| ユーザー管理 | 4 | 40.0% |');
  expect(content).toContain('| 商品管理 | 3 | 30.0% |');
  expect(content).toContain('| 注文管理 | 3 | 30.0% |');
});
```

### RTK Query統計のテスト

```typescript
it('RTK Query統計情報を正しく生成する', () => {
  // Act
  const content = generator.generateRtkQueryStatistics(mockResult);

  // Assert
  assertMarkdownSubSection(content, 'RTK Query統計');
  expect(content).toContain('**RTK Query使用エンドポイント:** 3 (30.0%)');
  expect(content).toContain('**Query操作:** 2 (66.7% of RTK)');
  expect(content).toContain('**Mutation操作:** 1 (33.3% of RTK)');
  expect(content).toContain('**レスポンス変換使用:** 2 (66.7% of RTK)');
});
```

## 改善点

1. **期待値の正確性**
   - パーセンテージの表示形式を実際の出力に合わせる（小数点以下1桁まで表示）
   - RTK Query統計情報の表示形式を実際の出力に合わせる（マークダウンの強調表示を含む）

2. **テストの堅牢性**
   - 完全一致ではなく、必要な部分のみを検証する
   - 表示形式の細かな変更に影響されにくいテストにする

3. **ヘルパー関数の活用**
   - `assertMarkdownSection`や`assertMarkdownSubSection`などのヘルパー関数を使用
   - 複雑なアサーションをカプセル化する新しいヘルパー関数を追加

これらの改善により、テストの信頼性と保守性が向上するのだ。
