/**
 * 可視化ジェネレーターのテスト
 *
 * @description
 * マークダウンレポーターの可視化ジェネレーターコンポーネントを検証するテストスイート。
 * エンドポイント解析結果の視覚的表現生成ロジックを単体検証します。
 */

import { VisualizationGenerator } from '../../../src/reporters/markdown/generators/VisualizationGenerator';
import { AnalysisResult, HttpMethod, EndpointSource, ParameterType } from '../../../src/types';
import { createMockAnalysisResult, createMockEndpoint, assertMarkdownSection, assertMarkdownSubSection } from '../../helpers/mockData';

// Mermaidグラフ生成関数のモック
interface ChartData {
  label: string;
  value: number;
}

jest.mock('../../../src/utils/statistics/graphs', () => ({
  generateMermaidPieChart: jest.fn().mockImplementation((data: ChartData[], title: string) => {
    return `\`\`\`mermaid\npie title ${title}\n${data.map(d => `  "${d.label}" : ${d.value}`).join('\n')}\n\`\`\`\n`;
  }),
  generateMermaidBarChart: jest.fn().mockImplementation((data: ChartData[], title: string, xLabel?: string, yLabel?: string) => {
    return `\`\`\`mermaid\nbar title ${title}\n${data.map(d => `  "${d.label}" : ${d.value}`).join('\n')}\n\`\`\`\n`;
  })
}));

describe('VisualizationGenerator', () => {
  let generator: VisualizationGenerator;
  let mockResult: AnalysisResult;

  beforeEach(() => {
    // ジェネレーターインスタンスを作成
    generator = new VisualizationGenerator();

    // モック解析結果データを作成
    mockResult = createMockAnalysisResult({
      endpoints: [
        createMockEndpoint({
          path: '/api/users',
          method: 'GET' as HttpMethod,
          source: 'axios' as EndpointSource,
          featureCategory: 'ユーザー管理',
          apiVersion: 'v1'
        }),
        createMockEndpoint({
          path: '/api/products',
          method: 'POST' as HttpMethod,
          source: 'rtk-query' as EndpointSource,
          featureCategory: '商品管理',
          apiVersion: 'v2'
        })
      ],
      statistics: {
        totalEndpoints: 2,
        methodDistribution: {
          GET: 1,
          POST: 1,
          PUT: 0,
          DELETE: 0,
          PATCH: 0,
          OPTIONS: 0,
          HEAD: 0
        },
        sourceDistribution: {
          'axios': 1,
          'rtk-query': 1,
          'fetch': 0,
          'custom-client': 0,
          'default': 0,
          'v2-endpoint': 0
        },
        apiVersionDistribution: {
          'v1': 1,
          'v2': 1
        },
        featureCategoryDistribution: {
          'ユーザー管理': 1,
          '商品管理': 1
        },
        mostUsedEndpoints: [
          { path: '/api/users', count: 1 },
          { path: '/api/products', count: 1 }
        ],
        pathParameterUsage: {},
        dynamicEndpoints: 0,
        rtkQueryUsage: {
          totalEndpoints: 1,
          queries: 0,
          mutations: 1,
          transformResponseUsage: 0
        }
      }
    });
  });

  describe('generateVisualizationSection', () => {
    it('基本的な可視化セクションを正しく生成する', () => {
      // Act
      const content = generator.generateVisualizationSection(mockResult);

      // Assert
      assertMarkdownSection(content, 'エンドポイント分析ビジュアライゼーション');
      assertMarkdownSubSection(content, 'HTTPメソッド分布');
      assertMarkdownSubSection(content, 'API実装パターン分布');
      assertMarkdownSubSection(content, 'APIバージョン分布');
      assertMarkdownSubSection(content, 'エンドポイントパス構造');
      assertMarkdownSubSection(content, '機能カテゴリ分布');
    });
  });

  describe('generateHttpMethodChart', () => {
    it('HTTPメソッド分布の円グラフを正しく生成する', () => {
      // Act
      const content = generator.generateVisualizationSection(mockResult);

      // Assert
      expect(content).toContain('```mermaid');
      expect(content).toContain('pie title HTTPメソッド分布');
      expect(content).toContain('"GET" : 1');
      expect(content).toContain('"POST" : 1');
      // 使用されていないメソッドは表示されない
      expect(content).not.toContain('"PUT" : 0');
    });

    it('使用されているメソッドのみを表示する', () => {
      // Arrange
      const resultWithSingleMethod = {
        ...mockResult,
        statistics: {
          ...mockResult.statistics,
          methodDistribution: {
            GET: 1,
            POST: 0,
            PUT: 0,
            DELETE: 0,
            PATCH: 0,
            OPTIONS: 0,
            HEAD: 0
          }
        }
      };

      // Act
      const content = generator.generateVisualizationSection(resultWithSingleMethod);

      // Assert
      expect(content).toContain('"GET" : 1');
      expect(content).not.toContain('"POST"');
    });
  });

  describe('generateSourcePatternChart', () => {
    it('API実装パターン分布の棒グラフを正しく生成する', () => {
      // Act
      const content = generator.generateVisualizationSection(mockResult);

      // Assert
      expect(content).toContain('```mermaid');
      expect(content).toContain('bar title API実装パターン分布');
      expect(content).toContain('"Axios" : 1');
      expect(content).toContain('"RTK Query" : 1');
      // 使用されていないパターンは表示されない
      expect(content).not.toContain('"Fetch API"');
    });
  });

  describe('generateApiVersionChart', () => {
    it('複数のAPIバージョンがある場合は円グラフを生成する', () => {
      // Act
      const content = generator.generateVisualizationSection(mockResult);

      // Assert
      assertMarkdownSubSection(content, 'APIバージョン分布');
      expect(content).toContain('"v1" : 1');
      expect(content).toContain('"v2" : 1');
    });

    it('APIバージョンが1つしかない場合はグラフを生成しない', () => {
      // Arrange
      const resultWithSingleVersion = {
        ...mockResult,
        statistics: {
          ...mockResult.statistics,
          apiVersionDistribution: { 'v1': 2 }
        }
      };

      // Act
      const content = generator.generateVisualizationSection(resultWithSingleVersion);

      // Assert
      expect(content).not.toContain('### APIバージョン分布');
    });
  });

  describe('generatePathPrefixChart', () => {
    it('パスプレフィックス分布の棒グラフを正しく生成する', () => {
      // Act
      const content = generator.generateVisualizationSection(mockResult);

      // Assert
      assertMarkdownSubSection(content, 'エンドポイントパス構造');
      expect(content).toContain('bar title トップ10パスプレフィックス');
      expect(content).toContain('"/api" : 2');
    });

    it('パスプレフィックスが10個以上ある場合は上位10件のみ表示する', () => {
      // Arrange
      const manyEndpoints = Array.from({ length: 15 }, (_, i) => ({
        ...mockResult.endpoints[0],
        path: `/api${i}/test`
      }));

      const resultWithManyPrefixes = {
        ...mockResult,
        endpoints: manyEndpoints
      };

      // Act
      const content = generator.generateVisualizationSection(resultWithManyPrefixes);

      // Assert
      const matches = content.match(/\/api\d+/g) || [];
      expect(matches.length).toBeLessThanOrEqual(10);
    });
  });

  describe('generateFeatureCategoryChart', () => {
    it('機能カテゴリ分布の円グラフを正しく生成する', () => {
      // Act
      const content = generator.generateVisualizationSection(mockResult);

      // Assert
      assertMarkdownSubSection(content, '機能カテゴリ分布');
      expect(content).toContain('"ユーザー管理" : 1');
      expect(content).toContain('"商品管理" : 1');
    });

    it('カテゴリが1つしかない場合はグラフを生成しない', () => {
      // Arrange
      const resultWithSingleCategory = {
        ...mockResult,
        statistics: {
          ...mockResult.statistics,
          featureCategoryDistribution: { 'ユーザー管理': 2 }
        }
      };

      // Act
      const content = generator.generateVisualizationSection(resultWithSingleCategory);

      // Assert
      expect(content).not.toContain('### 機能カテゴリ分布');
    });

    it('未分類カテゴリのみの場合はグラフを生成しない', () => {
      // Arrange
      const resultWithUncategorized = {
        ...mockResult,
        statistics: {
          ...mockResult.statistics,
          featureCategoryDistribution: { '未分類': 2 }
        }
      };

      // Act
      const content = generator.generateVisualizationSection(resultWithUncategorized);

      // Assert
      expect(content).not.toContain('### 機能カテゴリ分布');
    });
  });
});
