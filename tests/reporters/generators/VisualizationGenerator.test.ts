/**
 * 可視化ジェネレーターのテスト
 * 
 * @description
 * マークダウンレポーターの可視化ジェネレーターコンポーネントを検証するテストスイート。
 * Mermaid.jsを利用したグラフ生成ロジックを単体検証します。
 */

import { VisualizationGenerator } from '../../../src/reporters/markdown/generators/VisualizationGenerator';
import { AnalysisResult, EndpointInfo, HttpMethod, EndpointSource } from '../../../src/types';

// モックユーティリティのインポート -統計関連関数のモック化
jest.mock('../../../src/utils/statistics', () => ({
  classifyByPathPrefix: jest.fn().mockReturnValue({
    '/api/users': 4,
    '/api/products': 3,
    '/api/orders': 2,
    '/api/auth': 2,
    '/api/admin': 1
  })
}));

// データ型を明示的に定義
interface ChartData {
  label: string;
  value: number;
}

// グラフ生成関数のモック化
jest.mock('../../../src/utils/statistics/graphs', () => ({
  generateMermaidPieChart: jest.fn().mockImplementation((data: ChartData[], title: string) => 
    `\`\`\`mermaid\npie title ${title}\n${data.map((d: ChartData) => `    "${d.label}" : ${d.value}`).join('\n')}\n\`\`\`\n`
  ),
  generateMermaidBarChart: jest.fn().mockImplementation((data: ChartData[], title: string, xLabel: string, yLabel: string) => 
    `\`\`\`mermaid\nbar title ${title}\n    x-axis [${xLabel}]\n    y-axis [${yLabel}]\n${data.map((d: ChartData) => `    "${d.label}" : ${d.value}`).join('\n')}\n\`\`\`\n`
  )
}));

describe('VisualizationGenerator', () => {
  let generator: VisualizationGenerator;
  let mockResult: AnalysisResult;

  beforeEach(() => {
    // ジェネレーターインスタンスを作成
    generator = new VisualizationGenerator();
    
    // モック解析結果データを作成
    mockResult = {
      endpoints: [
        {
          path: '/api/users',
          method: 'GET' as HttpMethod,
          isDynamic: false,
          usageLocations: [{ filePath: '/path/to/file.ts', lineNumber: 1, columnNumber: 1 }],
          parametersUsed: [],
          responseHandling: [],
          source: 'axios'
        },
        {
          path: '/api/users',
          method: 'POST' as HttpMethod,
          isDynamic: false,
          usageLocations: [{ filePath: '/path/to/file.ts', lineNumber: 10, columnNumber: 5 }],
          parametersUsed: [],
          responseHandling: [],
          source: 'axios'
        },
        {
          path: '/api/products',
          method: 'GET' as HttpMethod,
          isDynamic: false,
          usageLocations: [{ filePath: '/path/to/other.ts', lineNumber: 5, columnNumber: 1 }],
          parametersUsed: [],
          responseHandling: [],
          source: 'rtk-query',
          rtkQuerySpecific: {
            isQuery: true,
            isMutation: false,
            transformResponseUsed: true,
            baseQueryUsed: true
          }
        },
        {
          path: '/api/auth/login',
          method: 'POST' as HttpMethod,
          isDynamic: false,
          usageLocations: [{ filePath: '/path/to/auth.ts', lineNumber: 15, columnNumber: 3 }],
          parametersUsed: [],
          responseHandling: [],
          source: 'fetch'
        }
      ],
      statistics: {
        totalEndpoints: 4,
        methodDistribution: { 
          GET: 2, 
          POST: 2,
          PUT: 0,
          DELETE: 0,
          PATCH: 0,
          OPTIONS: 0,
          HEAD: 0
        } as Record<HttpMethod, number>,
        sourceDistribution: {
          'axios': 2,
          'rtk-query': 1,
          'fetch': 1,
          'custom-client': 0,
          'default': 0,
          'v2-endpoint': 0
        } as Record<EndpointSource, number>,
        apiVersionDistribution: { 'v1': 3, 'v2': 1 },
        featureCategoryDistribution: { 'user': 2, 'product': 1, 'auth': 1 },
        mostUsedEndpoints: [{ path: '/api/users', count: 2 }],
        pathParameterUsage: {},
        dynamicEndpoints: 0,
        rtkQueryUsage: {
          totalEndpoints: 1,
          queries: 1,
          mutations: 0,
          transformResponseUsage: 1
        }
      },
      analyzedAt: new Date('2023-01-01T00:00:00Z'),
      configuration: {
        targetDirectory: '/path/to/project'
      },
      analyzedFiles: ['/path/to/file1.ts', '/path/to/file2.ts'],
      errors: []
    };
  });

  describe('generateVisualizationSection', () => {
    it('解析結果から正しい可視化セクションを生成する', () => {
      // Act
      const visualization = generator.generateVisualizationSection(mockResult);
      
      // Assert
      // マークダウン形式の確認
      expect(visualization).toContain('## エンドポイント分析ビジュアライゼーション');
      
      // 各チャートセクションの確認
      expect(visualization).toContain('### HTTPメソッド分布');
      expect(visualization).toContain('### API実装パターン分布');
      expect(visualization).toContain('### APIバージョン分布');
      expect(visualization).toContain('### エンドポイントパス構造');
      expect(visualization).toContain('### 機能カテゴリ分布');
      
      // Mermaidブロックの存在確認
      expect(visualization).toContain('```mermaid');
      
      // データの内容確認
      expect(visualization).toContain('"GET" : 2');
      expect(visualization).toContain('"POST" : 2');
      expect(visualization).toContain('"Axios" : 2');
      expect(visualization).toContain('"RTK Query" : 1');
      expect(visualization).toContain('"Fetch API" : 1');
      expect(visualization).toContain('"v1" : 3');
      expect(visualization).toContain('"v2" : 1');
    });
    
    it('APIバージョンが1つしかない場合はAPIバージョン分布グラフを生成しない', () => {
      // Arrange
      const singleVersionResult = {
        ...mockResult,
        statistics: {
          ...mockResult.statistics,
          apiVersionDistribution: { 'v1': 4 }
        }
      };
      
      // Act
      const visualization = generator.generateVisualizationSection(singleVersionResult);
      
      // Assert
      expect(visualization).not.toContain('### APIバージョン分布');
    });
    
    it('機能カテゴリが存在しない場合は機能カテゴリ分布グラフを生成しない', () => {
      // Arrange
      const noCategoryResult = {
        ...mockResult,
        statistics: {
          ...mockResult.statistics,
          featureCategoryDistribution: {}
        }
      };
      
      // Act
      const visualization = generator.generateVisualizationSection(noCategoryResult);
      
      // Assert
      expect(visualization).not.toContain('### 機能カテゴリ分布');
    });
    
    it('機能カテゴリが「未分類」のみの場合は機能カテゴリ分布グラフを生成しない', () => {
      // Arrange
      const onlyUncategorizedResult = {
        ...mockResult,
        statistics: {
          ...mockResult.statistics,
          featureCategoryDistribution: { '未分類': 4 }
        }
      };
      
      // Act
      const visualization = generator.generateVisualizationSection(onlyUncategorizedResult);
      
      // Assert
      expect(visualization).not.toContain('### 機能カテゴリ分布');
    });
  });
});