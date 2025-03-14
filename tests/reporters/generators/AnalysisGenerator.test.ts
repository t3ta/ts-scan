/**
 * 分析ジェネレーターのテスト
 * 
 * @description
 * マークダウンレポーターの分析ジェネレーターコンポーネントを検証するテストスイート。
 * 使用頻度、複雑性、RTK Query分析などの洞察情報生成ロジックを単体検証します。
 */

import { AnalysisGenerator } from '../../../src/reporters/markdown/generators/AnalysisGenerator';
import { AnalysisResult, EndpointInfo, HttpMethod, EndpointSource, ParameterType } from '../../../src/types';

// ランキング関数のモック
jest.mock('../../../src/utils/statistics', () => ({
  rankEndpointsByUsage: jest.fn().mockImplementation((endpoints: EndpointInfo[]) => {
    // エンドポイントの使用頻度ランキングを計算するモック実装
    return endpoints
      .map((endpoint: EndpointInfo) => ({
        endpoint,
        usageCount: endpoint.usageLocations.length,
        rank: 0 // 初期値
      }))
      .sort((a: { usageCount: number }, b: { usageCount: number }) => b.usageCount - a.usageCount)
      .map((item: { endpoint: EndpointInfo; usageCount: number; rank: number }, index: number) => ({
        ...item,
        rank: index + 1
      }));
  }),
  rankEndpointsByComplexity: jest.fn().mockImplementation((endpoints: EndpointInfo[], limit: number = 15) => {
    // エンドポイントの複雑性ランキングを計算するモック実装
    return endpoints
      .map((endpoint: EndpointInfo) => {
        // 複雑性スコアの簡易計算
        let complexity = 5; // ベース複雑性
        if (endpoint.isDynamic) complexity += 5;
        complexity += endpoint.parametersUsed.length * 3;
        complexity += Math.min(5, endpoint.usageLocations.length);
        
        return {
          endpoint,
          complexity,
          rank: 0 // 初期値
        };
      })
      .sort((a: { complexity: number }, b: { complexity: number }) => b.complexity - a.complexity)
      .slice(0, limit)
      .map((item: { endpoint: EndpointInfo; complexity: number; rank: number }, index: number) => ({
        ...item,
        rank: index + 1
      }));
  }),
  calculateEndpointComplexity: jest.fn().mockImplementation((endpoint: EndpointInfo) => {
    // 複雑性スコアの簡易計算
    let complexity = 5; // ベース複雑性
    if (endpoint.isDynamic) complexity += 5;
    complexity += endpoint.parametersUsed.length * 3;
    complexity += Math.min(5, endpoint.usageLocations.length);
    
    return complexity;
  })
}));

// グラフ生成関数のモック
jest.mock('../../../src/utils/statistics/graphs', () => ({
  generateAsciiBarGraph: jest.fn().mockImplementation((data: { label: string; value: number }[]) => {
    // ASCII表現のバーグラフを生成するモック実装
    let graph = '';
    
    data.forEach((item: { label: string; value: number }) => {
      const bar = '#'.repeat(Math.min(20, Math.ceil(item.value / 2)));
      graph += `${item.label.padEnd(15)} | ${bar} (${item.value})\n`;
    });
    
    return graph;
  })
}));

describe('AnalysisGenerator', () => {
  let generator: AnalysisGenerator;
  let mockResult: AnalysisResult;

  beforeEach(() => {
    // ジェネレーターインスタンスを作成
    generator = new AnalysisGenerator();
    
    // モック解析結果データを作成
    mockResult = {
      endpoints: [
        {
          path: '/api/users',
          method: 'GET' as HttpMethod,
          isDynamic: false,
          usageLocations: [
            { filePath: '/path/to/file1.ts', lineNumber: 10, columnNumber: 5 },
            { filePath: '/path/to/file2.ts', lineNumber: 15, columnNumber: 8 },
            { filePath: '/path/to/file3.ts', lineNumber: 20, columnNumber: 12 }
          ],
          parametersUsed: [],
          responseHandling: [],
          source: 'axios',
          featureCategory: 'ユーザー管理',
          apiVersion: 'v1'
        },
        {
          path: '/api/users/:id',
          method: 'GET' as HttpMethod,
          isDynamic: true,
          usageLocations: [
            { filePath: '/path/to/file4.ts', lineNumber: 25, columnNumber: 15 },
            { filePath: '/path/to/file5.ts', lineNumber: 30, columnNumber: 20 }
          ],
          parametersUsed: [
            {
              name: 'id',
              type: 'path' as ParameterType,
              locations: [{ filePath: '/path/to/file4.ts', lineNumber: 25, columnNumber: 25 }]
            }
          ],
          responseHandling: [],
          source: 'axios',
          featureCategory: 'ユーザー管理',
          apiVersion: 'v1'
        },
        {
          path: '/api/products',
          method: 'GET' as HttpMethod,
          isDynamic: false,
          usageLocations: [
            { filePath: '/path/to/file6.ts', lineNumber: 35, columnNumber: 10 }
          ],
          parametersUsed: [],
          responseHandling: [],
          source: 'rtk-query',
          featureCategory: '商品管理',
          apiVersion: 'v1',
          rtkQuerySpecific: {
            isQuery: true,
            isMutation: false,
            transformResponseUsed: true,
            baseQueryUsed: true,
            apiName: 'productApi'
          }
        },
        {
          path: '/api/products/:id',
          method: 'GET' as HttpMethod,
          isDynamic: true,
          usageLocations: [
            { filePath: '/path/to/file7.ts', lineNumber: 40, columnNumber: 15 }
          ],
          parametersUsed: [
            {
              name: 'id',
              type: 'path',
              locations: [{ filePath: '/path/to/file7.ts', lineNumber: 40, columnNumber: 25 }]
            }
          ],
          responseHandling: [],
          source: 'rtk-query',
          featureCategory: '商品管理',
          apiVersion: 'v1',
          rtkQuerySpecific: {
            isQuery: true,
            isMutation: false,
            transformResponseUsed: true,
            baseQueryUsed: true,
            apiName: 'productApi'
          }
        },
        {
          path: '/api/products',
          method: 'POST' as HttpMethod,
          isDynamic: false,
          usageLocations: [
            { filePath: '/path/to/file8.ts', lineNumber: 45, columnNumber: 10 }
          ],
          parametersUsed: [
            {
              name: 'productData',
              type: 'body' as ParameterType,
              locations: [{ filePath: '/path/to/file8.ts', lineNumber: 45, columnNumber: 20 }]
            }
          ],
          responseHandling: [],
          source: 'rtk-query',
          featureCategory: '商品管理',
          apiVersion: 'v1',
          rtkQuerySpecific: {
            isQuery: false,
            isMutation: true,
            transformResponseUsed: false,
            baseQueryUsed: true,
            apiName: 'productApi'
          }
        }
      ],
      statistics: {
        totalEndpoints: 5,
        methodDistribution: { 
          GET: 4, 
          POST: 1,
          PUT: 0,
          DELETE: 0,
          PATCH: 0,
          OPTIONS: 0,
          HEAD: 0
        } as Record<HttpMethod, number>,
        sourceDistribution: {
          'axios': 2,
          'rtk-query': 3,
          'fetch': 0,
          'custom-client': 0,
          'default': 0,
          'v2-endpoint': 0
        } as Record<EndpointSource, number>,
        apiVersionDistribution: { 'v1': 5 },
        featureCategoryDistribution: { 'ユーザー管理': 2, '商品管理': 3 },
        mostUsedEndpoints: [
          { path: '/api/users', count: 3 },
          { path: '/api/users/:id', count: 2 }
        ],
        pathParameterUsage: { 'id': 2 },
        dynamicEndpoints: 2,
        rtkQueryUsage: {
          totalEndpoints: 3,
          queries: 2,
          mutations: 1,
          transformResponseUsage: 2
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

  describe('generateMostUsedEndpoints', () => {
    it('使用頻度の高いエンドポイント情報を正しく生成する', () => {
      // Act
      const mostUsedContent = generator.generateMostUsedEndpoints(mockResult);
      
      // Assert
      // マークダウン形式の確認
      expect(mostUsedContent).toContain('## 使用頻度の高いエンドポイント');
      
      // テーブル形式の確認
      expect(mostUsedContent).toContain('| 順位 | メソッド | エンドポイント | 使用箇所数 | カテゴリ | APIバージョン |');
      
      // ランキングデータの確認
      expect(mostUsedContent).toContain('| 1 | GET | `/api/users` | 3 | ユーザー管理 | v1 |');
      expect(mostUsedContent).toContain('| 2 | GET | `/api/users/:id` | 2 | ユーザー管理 | v1 |');
      
      // 使用頻度分布の確認
      expect(mostUsedContent).toContain('### 使用頻度分布');
    });
  });

  describe('generateComplexityAnalysis', () => {
    it('エンドポイント複雑性分析情報を正しく生成する', () => {
      // Act
      const complexityContent = generator.generateComplexityAnalysis(mockResult);
      
      // Assert
      // マークダウン形式の確認
      expect(complexityContent).toContain('## エンドポイント複雑性分析');
      expect(complexityContent).toContain('### 最も複雑なエンドポイント');
      
      // テーブル形式の確認
      expect(complexityContent).toContain('| 順位 | メソッド | エンドポイント | 複雑性スコア | パラメータ数 | 使用箇所数 | 動的パス |');
      
      // 動的パスの情報が正しく表示されていることを確認
      expect(complexityContent).toContain('✓'); // 動的パスの記号
      
      // 複雑性分布の確認
      expect(complexityContent).toContain('### 複雑性分布');
    });
  });

  describe('generateRtkQueryAnalysis', () => {
    it('RTK Query分析情報を正しく生成する', () => {
      // Act
      const rtkQueryContent = generator.generateRtkQueryAnalysis(mockResult);
      
      // Assert
      // マークダウン形式の確認
      expect(rtkQueryContent).toContain('## RTK Query分析');
      expect(rtkQueryContent).toContain('### RTK Query統計概要');
      
      // 統計情報の確認
      expect(rtkQueryContent).toContain('**総エンドポイント数:** 3');
      expect(rtkQueryContent).toContain('**Query操作:** 2');
      expect(rtkQueryContent).toContain('**Mutation操作:** 1');
      
      // API一覧の確認
      expect(rtkQueryContent).toContain('### 検出されたRTK Query API');
      expect(rtkQueryContent).toContain('| productApi | 3 |');
      
      // エンドポイント一覧の確認
      expect(rtkQueryContent).toContain('### RTK Queryエンドポイント一覧');
      expect(rtkQueryContent).toContain('| メソッド | エンドポイント | タイプ | API名 | 変換処理 |');
      expect(rtkQueryContent).toContain('| GET | `/api/products` | Query | productApi | ✓ |');
      expect(rtkQueryContent).toContain('| POST | `/api/products` | Mutation | productApi | - |');
    });
    
    it('RTK Queryエンドポイントがない場合は空の文字列を返す', () => {
      // Arrange
      const noRtkResult = {
        ...mockResult,
        endpoints: mockResult.endpoints.filter(e => e.source !== 'rtk-query'),
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
      
      // Act
      const rtkQueryContent = generator.generateRtkQueryAnalysis(noRtkResult);
      
      // Assert
      expect(rtkQueryContent).toBe('');
    });
  });
});
