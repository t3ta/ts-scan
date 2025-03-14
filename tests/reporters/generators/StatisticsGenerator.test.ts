/**
 * 統計情報ジェネレーターのテスト
 * 
 * @description
 * マークダウンレポーターの統計情報ジェネレーターコンポーネントを検証するテストスイート。
 * 統計情報のマークダウン表現生成ロジックを単体検証します。
 */

import { StatisticsGenerator } from '../../../src/reporters/markdown/generators/StatisticsGenerator';
import { AnalysisResult, EndpointInfo, HttpMethod, EndpointSource } from '../../../src/types';

describe('StatisticsGenerator', () => {
  let generator: StatisticsGenerator;
  let mockResult: AnalysisResult;

  beforeEach(() => {
    // ジェネレーターインスタンスを作成
    generator = new StatisticsGenerator();
    
    // モック解析結果データを作成
    mockResult = {
      endpoints: [
        // GETエンドポイント (axios)
        {
          path: '/api/users',
          method: 'GET' as HttpMethod,
          isDynamic: false,
          usageLocations: [{ filePath: '/path/to/file.ts', lineNumber: 1, columnNumber: 1 }],
          parametersUsed: [
            {
              name: 'limit',
              type: 'query',
              locations: [{ filePath: '/path/to/file.ts', lineNumber: 1, columnNumber: 1 }]
            }
          ],
          responseHandling: [
            {
              type: 'typed',
              typeName: 'User[]',
              location: { filePath: '/path/to/file.ts', lineNumber: 1, columnNumber: 1 }
            }
          ],
          source: 'axios',
          apiVersion: 'v1',
          featureCategory: 'user-management'
        },
        // POSTエンドポイント (axios)
        {
          path: '/api/users',
          method: 'POST' as HttpMethod,
          isDynamic: false,
          usageLocations: [{ filePath: '/path/to/file.ts', lineNumber: 1, columnNumber: 1 }],
          parametersUsed: [
            {
              name: 'userData',
              type: 'body',
              locations: [{ filePath: '/path/to/file.ts', lineNumber: 1, columnNumber: 1 }]
            }
          ],
          responseHandling: [
            {
              type: 'direct',
              location: { filePath: '/path/to/file.ts', lineNumber: 1, columnNumber: 1 }
            }
          ],
          source: 'axios',
          apiVersion: 'v1',
          featureCategory: 'user-management'
        },
        // GETエンドポイント (rtk-query)
        {
          path: '/api/products',
          method: 'GET' as HttpMethod,
          isDynamic: false,
          usageLocations: [{ filePath: '/path/to/file.ts', lineNumber: 1, columnNumber: 1 }],
          parametersUsed: [],
          responseHandling: [
            {
              type: 'transformation',
              location: { filePath: '/path/to/file.ts', lineNumber: 1, columnNumber: 1 }
            }
          ],
          source: 'rtk-query',
          apiVersion: 'v2',
          featureCategory: 'catalog',
          rtkQuerySpecific: {
            isQuery: true,
            isMutation: false,
            transformResponseUsed: true,
            baseQueryUsed: true
          }
        },
        // 動的パスパラメータを持つGETエンドポイント
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
          source: 'fetch',
          apiVersion: 'v1',
          featureCategory: 'user-management'
        }
      ],
      statistics: {
        totalEndpoints: 4,
        methodDistribution: { 
          GET: 3, 
          POST: 1,
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
        apiVersionDistribution: { 
          'v1': 3, 
          'v2': 1 
        },
        featureCategoryDistribution: { 
          'user-management': 3, 
          'catalog': 1 
        },
        mostUsedEndpoints: [
          { path: '/api/users', count: 2 },
          { path: '/api/products', count: 1 },
          { path: '/api/users/:id', count: 1 }
        ],
        pathParameterUsage: {
          'id': 1
        },
        dynamicEndpoints: 1,
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

  describe('generateStatisticsSection', () => {
    it('HTTPメソッド分布を含むテーブルを生成する', () => {
      // Act
      const statistics = generator.generateStatisticsSection(mockResult);
      
      // Assert
      expect(statistics).toContain('### HTTPメソッド分布');
      expect(statistics).toContain('| メソッド | エンドポイント数 | 割合 |');
      expect(statistics).toContain('| GET | 3 | 75% |');
      expect(statistics).toContain('| POST | 1 | 25% |');
    });
    
    it('API技術分布を含むテーブルを生成する', () => {
      // Act
      const statistics = generator.generateStatisticsSection(mockResult);
      
      // Assert
      expect(statistics).toContain('### API技術分布');
      expect(statistics).toContain('| 技術 | エンドポイント数 | 割合 |');
      expect(statistics).toContain('| axios | 2 | 50% |');
      expect(statistics).toContain('| rtk-query | 1 | 25% |');
      expect(statistics).toContain('| fetch | 1 | 25% |');
    });
    
    it('APIバージョン分布を含むテーブルを生成する', () => {
      // Act
      const statistics = generator.generateStatisticsSection(mockResult);
      
      // Assert
      expect(statistics).toContain('### APIバージョン分布');
      expect(statistics).toContain('| バージョン | エンドポイント数 | 割合 |');
      expect(statistics).toContain('| v1 | 3 | 75% |');
      expect(statistics).toContain('| v2 | 1 | 25% |');
    });
    
    it('機能カテゴリ分布を含むテーブルを生成する', () => {
      // Act
      const statistics = generator.generateStatisticsSection(mockResult);
      
      // Assert
      expect(statistics).toContain('### 機能カテゴリ分布');
      expect(statistics).toContain('| カテゴリ | エンドポイント数 | 割合 |');
      expect(statistics).toContain('| user-management | 3 | 75% |');
      expect(statistics).toContain('| catalog | 1 | 25% |');
    });
    
    it('頻出エンドポイントリストを生成する', () => {
      // Act
      const statistics = generator.generateStatisticsSection(mockResult);
      
      // Assert
      expect(statistics).toContain('### 頻出エンドポイント');
      expect(statistics).toContain('| エンドポイント | 使用回数 |');
      expect(statistics).toContain('| /api/users | 2 |');
      expect(statistics).toContain('| /api/products | 1 |');
      expect(statistics).toContain('| /api/users/:id | 1 |');
    });
    
    it('RTK Query統計情報を含む場合、その詳細を表示する', () => {
      // Act
      const statistics = generator.generateStatisticsSection(mockResult);
      
      // Assert
      expect(statistics).toContain('### RTK Query利用状況');
      expect(statistics).toContain('総エンドポイント数: 1');
      expect(statistics).toContain('クエリ操作: 1');
      expect(statistics).toContain('ミューテーション操作: 0');
      expect(statistics).toContain('レスポンス変換使用: 1');
    });
    
    it('動的エンドポイント情報を含む', () => {
      // Act
      const statistics = generator.generateStatisticsSection(mockResult);
      
      // Assert
      expect(statistics).toContain('### パスパラメータ');
      expect(statistics).toContain('動的エンドポイント数: 1');
      expect(statistics).toContain('| パラメータ名 | 使用回数 |');
      expect(statistics).toContain('| id | 1 |');
    });
    
    it('統計情報が空の場合は適切なメッセージを表示する', () => {
      // Arrange
      const emptyResult = {
        ...mockResult,
        endpoints: [],
        statistics: {
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
          } as Record<EndpointSource, number>,
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
        }
      };
      
      // Act
      const statistics = generator.generateStatisticsSection(emptyResult);
      
      // Assert
      expect(statistics).toContain('## 統計情報');
      expect(statistics).toContain('エンドポイントは検出されませんでした。');
    });
    
    it('割合が正しく計算されることを確認する', () => {
      // Arrange
      const customResult = {
        ...mockResult,
        statistics: {
          ...mockResult.statistics,
          totalEndpoints: 10,
          methodDistribution: { 
            GET: 5, 
            POST: 3,
            PUT: 2,
            DELETE: 0,
            PATCH: 0,
            OPTIONS: 0,
            HEAD: 0
          } as Record<HttpMethod, number>
        }
      };
      
      // Act
      const statistics = generator.generateStatisticsSection(customResult);
      
      // Assert
      expect(statistics).toContain('| GET | 5 | 50% |');
      expect(statistics).toContain('| POST | 3 | 30% |');
      expect(statistics).toContain('| PUT | 2 | 20% |');
    });
  });
});
