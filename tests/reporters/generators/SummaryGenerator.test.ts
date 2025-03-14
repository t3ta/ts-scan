/**
 * サマリージェネレーターのテスト
 * 
 * @description
 * マークダウンレポーターのサマリージェネレーターコンポーネントを検証するテストスイート。
 * エグゼクティブサマリー生成ロジックを単体検証します。
 */

import { SummaryGenerator } from '../../../src/reporters/markdown/generators/SummaryGenerator';
import { AnalysisResult, EndpointInfo, HttpMethod, EndpointSource } from '../../../src/types';

describe('SummaryGenerator', () => {
  let generator: SummaryGenerator;
  let mockResult: AnalysisResult;

  beforeEach(() => {
    // ジェネレーターインスタンスを作成
    generator = new SummaryGenerator();
    
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
          usageLocations: [{ filePath: '/path/to/file.ts', lineNumber: 1, columnNumber: 1 }],
          parametersUsed: [],
          responseHandling: [],
          source: 'axios'
        },
        {
          path: '/api/products',
          method: 'GET' as HttpMethod,
          isDynamic: false,
          usageLocations: [{ filePath: '/path/to/file.ts', lineNumber: 1, columnNumber: 1 }],
          parametersUsed: [],
          responseHandling: [],
          source: 'rtk-query',
          rtkQuerySpecific: {
            isQuery: true,
            isMutation: false,
            transformResponseUsed: true,
            baseQueryUsed: true
          }
        }
      ],
      statistics: {
        totalEndpoints: 3,
        methodDistribution: { GET: 2, POST: 1 } as Record<HttpMethod, number>,
        sourceDistribution: {
          'axios': 2,
          'rtk-query': 1,
          'fetch': 0,
          'custom-client': 0,
          'default': 0,
          'v2-endpoint': 0
        } as Record<EndpointSource, number>,
        apiVersionDistribution: { 'v1': 2, 'v2': 1 },
        featureCategoryDistribution: { 'user': 2, 'product': 1 },
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

  describe('generateExecutiveSummary', () => {
    it('解析結果から正しいサマリーを生成する', () => {
      // Act
      const summary = generator.generateExecutiveSummary(mockResult);
      
      // Assert
      // マークダウン形式の確認
      expect(summary).toContain('## エグゼクティブサマリー');
      
      // 統計情報の確認
      expect(summary).toContain('エンドポイント総数: 3');
      expect(summary).toContain('GET: 2, POST: 1');
      
      // ソース分布の確認
      expect(summary).toContain('axios: 2');
      expect(summary).toContain('rtk-query: 1');
      
      // RTK Query情報の確認
      expect(summary).toContain('RTK Query利用: 1件');
    });
    
    it('エラーがある場合はエラー情報を含む', () => {
      // Arrange
      const resultWithErrors = {
        ...mockResult,
        errors: ['テストエラー1', 'テストエラー2']
      };
      
      // Act
      const summary = generator.generateExecutiveSummary(resultWithErrors);
      
      // Assert
      expect(summary).toContain('注意: 解析中に2件のエラーが発生しました');
    });
    
    it('動的エンドポイントがある場合はその情報を含む', () => {
      // Arrange
      const resultWithDynamicEndpoints = {
        ...mockResult,
        endpoints: [
          ...mockResult.endpoints,
          {
            path: '/api/users/:id',
            method: 'GET' as HttpMethod,
            isDynamic: true,
            usageLocations: [{ filePath: '/path/to/file.ts', lineNumber: 1, columnNumber: 1 }],
            parametersUsed: [
              {
                name: 'id',
                type: 'path',
                locations: [{ filePath: '/path/to/file.ts', lineNumber: 1, columnNumber: 1 }]
              }
            ],
            responseHandling: [],
            source: 'axios'
          }
        ],
        statistics: {
          ...mockResult.statistics,
          totalEndpoints: 4,
          dynamicEndpoints: 1,
          pathParameterUsage: { 'id': 1 },
          methodDistribution: { 
            GET: 3, 
            POST: 1 
          } as Record<HttpMethod, number>,
          sourceDistribution: {
            'axios': 3,
            'rtk-query': 1,
            'fetch': 0,
            'custom-client': 0,
            'default': 0,
            'v2-endpoint': 0
          } as Record<EndpointSource, number>
        }
      };
      
      // Act
      const summary = generator.generateExecutiveSummary(resultWithDynamicEndpoints);
      
      // Assert
      expect(summary).toContain('動的パスパラメータを含むエンドポイント: 1件');
    });
    
    it('エンドポイントが存在しない場合は適切なメッセージを表示する', () => {
      // Arrange
      const emptyResult = {
        ...mockResult,
        endpoints: [],
        statistics: {
          ...mockResult.statistics,
          totalEndpoints: 0,
          methodDistribution: {
            GET: 0,
            POST: 0,
            PUT: 0,
            DELETE: 0,
            PATCH: 0,
            OPTIONS: 0,
            HEAD: 0
          } as Record<HttpMethod, number>,
          sourceDistribution: {
            'axios': 0,
            'rtk-query': 0,
            'fetch': 0,
            'custom-client': 0,
            'default': 0,
            'v2-endpoint': 0
          } as Record<EndpointSource, number>
        }
      };
      
      // Act
      const summary = generator.generateExecutiveSummary(emptyResult);
      
      // Assert
      expect(summary).toContain('エンドポイントは検出されませんでした');
    });
  });
});
