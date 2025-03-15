# テスト実装計画

## VisualizationGenerator.test.ts の修正

### パスプレフィックス集計のテスト修正

```typescript
it('パスプレフィックス分布の棒グラフを正しく生成する', () => {
  // Act
  const content = generator.generateVisualizationSection(mockResult);

  // Assert
  assertMarkdownSubSection(content, 'エンドポイントパス構造');
  expect(content).toContain('bar title トップ10パスプレフィックス');
  expect(content).toContain('"/api" : 2');
});
```

このテストでは、`/api/users`と`/api/products`のエンドポイントが共通のプレフィックス`/api`で集計されることを検証するのだ。

### 追加テストケース

```typescript
it('異なるプレフィックスを持つエンドポイントが正しく集計される', () => {
  // Arrange
  const mixedPrefixResult = {
    ...mockResult,
    endpoints: [
      createMockEndpoint({
        path: '/api/users',
        method: 'GET'
      }),
      createMockEndpoint({
        path: '/auth/login',
        method: 'POST'
      })
    ]
  };

  // Act
  const content = generator.generateVisualizationSection(mixedPrefixResult);

  // Assert
  assertMarkdownSubSection(content, 'エンドポイントパス構造');
  expect(content).toContain('"/api" : 1');
  expect(content).toContain('"/auth" : 1');
});
```

## AnalysisGenerator.test.ts の修正

### RTK Query分析のテスト修正

```typescript
it('変換処理を使用しないエンドポイントのみの場合も適切に処理する', () => {
  // Arrange
  const noTransformResult = {
    ...mockResult,
    endpoints: mockResult.endpoints.map(e => ({
      ...e,
      rtkQuerySpecific: e.rtkQuerySpecific ? {
        ...e.rtkQuerySpecific,
        transformResponseUsed: false
      } : undefined
    })),
    statistics: {
      ...mockResult.statistics,
      rtkQueryUsage: {
        ...mockResult.statistics.rtkQueryUsage,
        transformResponseUsage: 0
      }
    }
  };

  // Act
  const content = generator.generateRtkQueryAnalysis(noTransformResult);

  // Assert
  expect(content).toContain('**レスポンス変換使用:** 0 (0.0%)');
  expect(content.match(/-/g)?.length).toBeGreaterThan(0); // 変換処理なしを示す'-'が存在する
});
```

このテストでは、変換処理を使用しないエンドポイントのみの場合に、統計情報が正しく表示されることを検証するのだ。期待値は`**レスポンス変換使用:** 0 (0.0%)`のような形式になるべきなのだ。

## DetailGenerator.test.ts の修正

### エンドポイント数制限のテスト修正

```typescript
it('エンドポイント数が100件以上の場合は表示を制限する', () => {
  // Arrange
  const manyEndpoints = {
    ...mockResult,
    endpoints: Array(101).fill(mockResult.endpoints[0]).map((e, i) => ({
      ...e,
      path: `/api/endpoint${i}`
    })),
    statistics: {
      ...mockResult.statistics,
      totalEndpoints: 101
    }
  };

  // Act
  const content = generator.generateDetailedEndpoints(manyEndpoints);

  // Assert
  expect(content).toContain('注意: エンドポイント数が多いため、最初の50件のみ表示しています');
  // 表示件数の確認
  const endpointCount = (content.match(/### \`GET/g) || []).length;
  expect(endpointCount).toBe(50);
});
```

このテストでは、エンドポイント数が100件以上の場合に、表示が制限されることを検証するのだ。

## 共通のモックデータ改善

```typescript
// tests/helpers/mockData.ts

export function createMockEndpoint(overrides: Partial<EndpointInfo> = {}): EndpointInfo {
  return {
    path: '/api/test',
    method: 'GET',
    isDynamic: false,
    usageLocations: [],
    parametersUsed: [],
    responseHandling: [],
    source: 'axios',
    featureCategory: 'テスト',
    apiVersion: 'v1',
    ...overrides
  };
}

export function createMockAnalysisResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    endpoints: [],
    statistics: {
      totalEndpoints: 0,
      methodDistribution: { GET: 0, POST: 0, PUT: 0, DELETE: 0, PATCH: 0, OPTIONS: 0, HEAD: 0 },
      sourceDistribution: {
        'axios': 0,
        'rtk-query': 0,
        'fetch': 0,
        'custom-client': 0,
        'default': 0,
        'v2-endpoint': 0
      },
      apiVersionDistribution: {},
      featureCategoryDistribution: {},
      mostUsedEndpoints: [],
      pathParameterUsage: {},
      dynamicEndpoints: 0,
      rtkQueryUsage: {
        totalEndpoints: 0,
        queries: 0,
        mutations: 0,
        transformResponseUsage: 0
      }
    },
    analyzedAt: new Date('2023-01-01T00:00:00Z'),
    configuration: {
      targetDirectory: '/path/to/project'
    },
    analyzedFiles: [],
    errors: [],
    ...overrides
  };
}

export function assertMarkdownSection(content: string, sectionTitle: string): void {
  expect(content).toContain(`## ${sectionTitle}`);
}

export function assertMarkdownSubSection(content: string, sectionTitle: string): void {
  expect(content).toContain(`### ${sectionTitle}`);
}
```

これらの関数を使用することで、テストコードの重複を減らし、一貫性を確保するのだ。
