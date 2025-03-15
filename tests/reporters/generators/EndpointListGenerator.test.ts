/**
 * エンドポイント一覧ジェネレーターのテスト
 * 
 * @description
 * マークダウンレポーターのエンドポイント一覧ジェネレーターコンポーネントを検証するテストスイート。
 * カテゴリ別・メソッド別のエンドポイント一覧生成ロジックを単体検証します。
 */

import { EndpointListGenerator } from '../../../src/reporters/markdown/generators/EndpointListGenerator';
import { AnalysisResult, EndpointInfo, HttpMethod, EndpointSource, ParameterType } from '../../../src/types';

// モックユーティリティの統計関連関数
jest.mock('../../../src/utils/statistics', () => ({
  groupEndpointsByCategory: jest.fn().mockImplementation((endpoints) => {
    // 簡易的なカテゴリ分類のモック実装
    const categories: Record<string, any[]> = {
      'ユーザー管理': [],
      '商品管理': [],
      '認証': []
    };
    
    endpoints.forEach((endpoint: any) => {
      if (endpoint.path.includes('/users')) {
        categories['ユーザー管理'].push(endpoint);
      } else if (endpoint.path.includes('/products')) {
        categories['商品管理'].push(endpoint);
      } else if (endpoint.path.includes('/auth')) {
        categories['認証'].push(endpoint);
      }
    });
    
    return categories;
  }),
  calculateEndpointComplexity: jest.fn().mockImplementation((endpoint) => {
    // エンドポイントの複雑性を計算するモック実装
    let complexity = 5; // ベース複雑性
    
    // 動的エンドポイントは複雑性が高い
    if (endpoint.isDynamic) complexity += 5;
    
    // パラメータ数で複雑性を増加
    complexity += endpoint.parametersUsed.length * 3;
    
    // 使用箇所数で複雑性を増加
    complexity += Math.min(5, endpoint.usageLocations.length);
    
    return complexity;
  })
}));

describe('EndpointListGenerator', () => {
  let generator: EndpointListGenerator;
  let mockResult: AnalysisResult;

  beforeEach(() => {
    // ジェネレーターインスタンスを作成
    generator = new EndpointListGenerator();
    
    // モック解析結果データを作成
    mockResult = {
      endpoints: [
        {
          path: '/api/users',
          method: 'GET' as HttpMethod,
          isDynamic: false,
          usageLocations: [
            { filePath: '/path/to/file1.ts', lineNumber: 10, columnNumber: 5 },
            { filePath: '/path/to/file2.ts', lineNumber: 15, columnNumber: 8 }
          ],
          parametersUsed: [],
          responseHandling: [],
          source: 'axios' as EndpointSource,
          featureCategory: 'ユーザー管理',
          apiVersion: 'v1'
        },
        {
          path: '/api/users/:id',
          method: 'GET' as HttpMethod,
          isDynamic: true,
          usageLocations: [
            { filePath: '/path/to/file3.ts', lineNumber: 25, columnNumber: 12 }
          ],
          parametersUsed: [
            {
              name: 'id',
              type: 'path' as ParameterType,
              locations: [{ filePath: '/path/to/file3.ts', lineNumber: 25, columnNumber: 15 }]
            }
          ],
          responseHandling: [],
          source: 'axios',
          featureCategory: 'ユーザー管理',
          apiVersion: 'v1'
        },
        {
          path: '/api/users',
          method: 'POST' as HttpMethod,
          isDynamic: false,
          usageLocations: [
            { filePath: '/path/to/file4.ts', lineNumber: 30, columnNumber: 10 }
          ],
          parametersUsed: [
            {
              name: 'userData',
              type: 'body' as ParameterType,
              locations: [{ filePath: '/path/to/file4.ts', lineNumber: 30, columnNumber: 20 }]
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
            { filePath: '/path/to/file5.ts', lineNumber: 40, columnNumber: 5 }
          ],
          parametersUsed: [],
          responseHandling: [],
          source: 'rtk-query' as EndpointSource,
          featureCategory: '商品管理',
          apiVersion: 'v1',
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
          usageLocations: [
            { filePath: '/path/to/file6.ts', lineNumber: 50, columnNumber: 8 }
          ],
          parametersUsed: [
            {
              name: 'username',
              type: 'body' as ParameterType,
              locations: [{ filePath: '/path/to/file6.ts', lineNumber: 50, columnNumber: 20 }]
            },
            {
              name: 'password',
              type: 'body' as ParameterType,
              locations: [{ filePath: '/path/to/file6.ts', lineNumber: 50, columnNumber: 40 }]
            }
          ],
          responseHandling: [],
          source: 'fetch' as EndpointSource,
          featureCategory: '認証',
          apiVersion: 'v1'
        }
      ],
      statistics: {
        totalEndpoints: 5,
        methodDistribution: { 
          GET: 2, 
          POST: 2,
          PUT: 0,
          DELETE: 0,
          PATCH: 1,
          OPTIONS: 0,
          HEAD: 0
        } as Record<HttpMethod, number>,
        sourceDistribution: {
          'axios': 3,
          'rtk-query': 1,
          'fetch': 1,
          'custom-client': 0,
          'default': 0,
          'v2-endpoint': 0
        } as Record<EndpointSource, number>,
        apiVersionDistribution: { 'v1': 5 },
        featureCategoryDistribution: { 'ユーザー管理': 3, '商品管理': 1, '認証': 1 },
        mostUsedEndpoints: [{ path: '/api/users', count: 3 }],
        pathParameterUsage: { 'id': 1 },
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

  describe('generateCategorizedEndpoints', () => {
    it('解析結果からカテゴリ別エンドポイント一覧を正しく生成する', () => {
      // Act
      const categorizedList = generator.generateCategorizedEndpoints(mockResult);
      
      // Assert
      // マークダウン形式の確認
      expect(categorizedList).toContain('## カテゴリ別エンドポイント一覧');
      
      // 各カテゴリセクションの確認
      expect(categorizedList).toContain('### ユーザー管理');
      expect(categorizedList).toContain('### 商品管理');
      expect(categorizedList).toContain('### 認証');
      
      // テーブル形式の確認
      expect(categorizedList).toContain('| メソッド | エンドポイント | 使用箇所数 | 動的パラメータ | 検出元 |');
      
      // コンテンツの確認
      expect(categorizedList).toContain('| GET | `/api/users` |');
      expect(categorizedList).toContain('| GET | `/api/users/:id` |');
      expect(categorizedList).toContain('| POST | `/api/users` |');
      expect(categorizedList).toContain('| GET | `/api/products` |');
      expect(categorizedList).toContain('| POST | `/api/auth/login` |');
      
      // 動的パラメータのチェック
      expect(categorizedList).toContain('| GET | `/api/users/:id` | 1 | ✓ |');
    });
    
    it('複雑なエンドポイントがある場合は複雑性情報を表示する', () => {
      // モックを拡張して複雑なエンドポイントを含める
      const complexResult = {
        ...mockResult,
        endpoints: [
          ...mockResult.endpoints,
          {
            path: '/api/users/:id/transactions/:transactionId',
            method: 'GET' as HttpMethod,
            isDynamic: true,
            usageLocations: [
              { filePath: '/path/to/file7.ts', lineNumber: 60, columnNumber: 5 },
              { filePath: '/path/to/file8.ts', lineNumber: 70, columnNumber: 8 },
              { filePath: '/path/to/file9.ts', lineNumber: 80, columnNumber: 12 }
            ],
            parametersUsed: [
              {
                name: 'id',
                type: 'path' as ParameterType,
                locations: [{ filePath: '/path/to/file7.ts', lineNumber: 60, columnNumber: 15 }]
              },
              {
                name: 'transactionId',
                type: 'path' as ParameterType,
                locations: [{ filePath: '/path/to/file7.ts', lineNumber: 60, columnNumber: 30 }]
              },
              {
                name: 'filter',
                type: 'query' as ParameterType,
                locations: [{ filePath: '/path/to/file7.ts', lineNumber: 60, columnNumber: 45 }]
              },
              {
                name: 'sort',
                type: 'query' as ParameterType,
                locations: [{ filePath: '/path/to/file7.ts', lineNumber: 60, columnNumber: 55 }]
              }
            ],
            responseHandling: [],
            source: 'axios' as EndpointSource,
            featureCategory: 'ユーザー管理',
            apiVersion: 'v1'
          }
        ]
      };
      
      // Act
      const categorizedList = generator.generateCategorizedEndpoints(complexResult);
      
      // Assert
      expect(categorizedList).toContain('#### カテゴリ内の複雑なエンドポイント');
      expect(categorizedList).toContain('| エンドポイント | 複雑性スコア | 使用箇所数 | パラメータ数 |');
      expect(categorizedList).toContain('| `GET /api/users/:id/transactions/:transactionId` |');
    });
  });

  describe('generateMethodBasedEndpoints', () => {
    it('解析結果からHTTPメソッド別エンドポイント一覧を正しく生成する', () => {
      // Act
      const methodBasedList = generator.generateMethodBasedEndpoints(mockResult);
      
      // Assert
      // マークダウン形式の確認
      expect(methodBasedList).toContain('## HTTPメソッド別エンドポイント一覧');
      
      // 各メソッドセクションの確認
      expect(methodBasedList).toContain('### GET エンドポイント (2)');
      expect(methodBasedList).toContain('### POST エンドポイント (2)');
      
      // 存在しないメソッドは表示されないことを確認
      expect(methodBasedList).not.toContain('### PUT エンドポイント');
      expect(methodBasedList).not.toContain('### DELETE エンドポイント');
      
      // テーブル形式の確認
      expect(methodBasedList).toContain('| エンドポイント | カテゴリ | 使用箇所数 | 動的パラメータ | APIバージョン |');
      
      // コンテンツの確認
      expect(methodBasedList).toContain('| `/api/users` | ユーザー管理 | 2 | - | v1 |');
      expect(methodBasedList).toContain('| `/api/users/:id` | ユーザー管理 | 1 | ✓ | v1 |');
      expect(methodBasedList).toContain('| `/api/auth/login` | 認証 | 1 | - | v1 |');
    });
    
    it('APIバージョンが指定されていない場合はデフォルト表示にする', () => {
      // Arrange
      const noVersionResult = {
        ...mockResult,
        endpoints: mockResult.endpoints.map(endpoint => ({
          ...endpoint,
          apiVersion: undefined
        }))
      };
      
      // Act
      const methodBasedList = generator.generateMethodBasedEndpoints(noVersionResult);
      
      // Assert
      expect(methodBasedList).toContain('| デフォルト |');
    });
  });
});
