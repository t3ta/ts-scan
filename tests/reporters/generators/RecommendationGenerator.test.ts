/**
 * 推奨事項ジェネレーターのテスト
 * 
 * @description
 * マークダウンレポーターの推奨事項ジェネレーターコンポーネントを検証するテストスイート。
 * 解析結果に基づく推奨事項と最適化提案の生成ロジックを単体検証します。
 */

import { RecommendationGenerator } from '../../../src/reporters/markdown/generators/RecommendationGenerator';
import { AnalysisResult, EndpointInfo, HttpMethod, EndpointSource, ParameterType, ResponseHandlingType } from '../../../src/types';

// ランキング関数のモック
jest.mock('../../../src/utils/statistics', () => ({
  rankEndpointsByComplexity: jest.fn().mockImplementation((endpoints: EndpointInfo[], limit: number = 5) => {
    // エンドポイントの複雑性ランキングを計算するモック実装
    return endpoints
      .map((endpoint: EndpointInfo) => {
        // 複雑性スコアの簡易計算
        let complexity = 5; // ベース複雑性
        if (endpoint.isDynamic) complexity += 5;
        complexity += endpoint.parametersUsed.length * 3;
        complexity += Math.min(5, endpoint.usageLocations.length);
        
        // 複雑なレスポンス処理がある場合
        if (endpoint.responseHandling.some(h => h.type === 'transformation')) {
          complexity += 5;
        }
        
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
  })
}));

describe('RecommendationGenerator', () => {
  let generator: RecommendationGenerator;
  let mockResult: AnalysisResult;

  beforeEach(() => {
    // ジェネレーターインスタンスを作成
    generator = new RecommendationGenerator();
    
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
          source: 'fetch',
          featureCategory: '商品管理',
          apiVersion: 'v1'
        },
        {
          path: '/api/orders',
          method: 'POST' as HttpMethod,
          isDynamic: false,
          usageLocations: [
            { filePath: '/path/to/file7.ts', lineNumber: 40, columnNumber: 15 }
          ],
          parametersUsed: [
            {
              name: 'orderData',
              type: 'body' as ParameterType,
              locations: [{ filePath: '/path/to/file7.ts', lineNumber: 40, columnNumber: 25 }]
            }
          ],
          responseHandling: [],
          source: 'rtk-query',
          featureCategory: '注文管理',
          apiVersion: 'v1',
          rtkQuerySpecific: {
            isQuery: false,
            isMutation: true,
            transformResponseUsed: false,
            baseQueryUsed: true,
            apiName: 'orderApi'
          }
        },
        {
          path: '/api/users/:id/transactions/:transactionId',
          method: 'GET' as HttpMethod,
          isDynamic: true,
          usageLocations: [
            { filePath: '/path/to/file8.ts', lineNumber: 45, columnNumber: 10 },
            { filePath: '/path/to/file9.ts', lineNumber: 50, columnNumber: 15 },
            { filePath: '/path/to/file10.ts', lineNumber: 55, columnNumber: 20 }
          ],
          parametersUsed: [
            {
              name: 'id',
              type: 'path' as ParameterType,
              locations: [{ filePath: '/path/to/file8.ts', lineNumber: 45, columnNumber: 15 }]
            },
            {
              name: 'transactionId',
              type: 'path' as ParameterType,
              locations: [{ filePath: '/path/to/file8.ts', lineNumber: 45, columnNumber: 30 }]
            },
            {
              name: 'filter',
              type: 'query' as ParameterType,
              locations: [{ filePath: '/path/to/file8.ts', lineNumber: 45, columnNumber: 45 }]
            },
            {
              name: 'sort',
              type: 'query' as ParameterType,
              locations: [{ filePath: '/path/to/file8.ts', lineNumber: 45, columnNumber: 55 }]
            }
          ],
          responseHandling: [
            {
              type: 'transformation' as ResponseHandlingType,
              location: { filePath: '/path/to/file8.ts', lineNumber: 60, columnNumber: 10 }
            }
          ],
          source: 'axios',
          featureCategory: 'ユーザー管理',
          apiVersion: 'v2'
        }
      ],
      statistics: {
        totalEndpoints: 5,
        methodDistribution: { 
          GET: 3, 
          POST: 1,
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
        apiVersionDistribution: { 'v1': 4, 'v2': 1 },
        featureCategoryDistribution: { 'ユーザー管理': 3, '商品管理': 1, '注文管理': 1 },
        mostUsedEndpoints: [
          { path: '/api/users', count: 3 },
          { path: '/api/users/:id/transactions/:transactionId', count: 3 },
          { path: '/api/users/:id', count: 2 }
        ],
        pathParameterUsage: { 'id': 2, 'transactionId': 1 },
        dynamicEndpoints: 2,
        rtkQueryUsage: {
          totalEndpoints: 1,
          queries: 0,
          mutations: 1,
          transformResponseUsage: 0
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

  describe('generateRecommendationsSection', () => {
    it('推奨事項セクション全体を正しく生成する', () => {
      // Act
      const recommendations = generator.generateRecommendationsSection(mockResult);
      
      // Assert
      // マークダウン形式の確認
      expect(recommendations).toContain('## 推奨事項と最適化提案');
      
      // 各サブセクションの確認
      expect(recommendations).toContain('### APIパターン標準化');
      expect(recommendations).toContain('### エンドポイント設計の改善');
      expect(recommendations).toContain('### RTK Query移行計画');
      expect(recommendations).toContain('### 複雑性の高いエンドポイントの改善');
      expect(recommendations).toContain('### コード品質とテスト戦略');
    });
    
    it('APIパターン標準化の推奨事項を正しく生成する', () => {
      // Act
      const recommendations = generator.generateRecommendationsSection(mockResult);
      
      // Assert
      // APIパターンの混在に関する推奨事項
      expect(recommendations).toContain('APIクライアントの統一');
      expect(recommendations).toContain('3種類の異なるAPIアクセスパターン');
      
      // APIバージョンに関する推奨事項
      expect(recommendations).toContain('APIバージョン');
    });
    
    it('エンドポイント設計の推奨事項を正しく生成する', () => {
      // Act
      const recommendations = generator.generateRecommendationsSection(mockResult);
      
      // Assert
      // 動的パスパラメータに関する推奨事項
      expect(recommendations).toContain('動的パスパラメータの一貫した命名');
      expect(recommendations).toContain('2件の動的パスパラメータを持つエンドポイント');
      
      // RESTful設計原則に関する推奨事項
      expect(recommendations).toContain('RESTful設計原則の適用');
    });
    
    it('RTK Query移行の推奨事項を正しく生成する', () => {
      // Act
      const recommendations = generator.generateRecommendationsSection(mockResult);
      
      // Assert
      // 移行進捗状況
      expect(recommendations).toContain('移行進捗状況');
      
      // 移行手順
      expect(recommendations).toContain('推奨移行手順');
      expect(recommendations).toContain('類似エンドポイントのグループ化');
      expect(recommendations).toContain('優先順位付け');
      
      // 移行のメリット
      expect(recommendations).toContain('移行のメリット');
      expect(recommendations).toContain('状態管理の簡素化');
    });
    
    it('複雑性の高いエンドポイントの改善推奨事項を正しく生成する', () => {
      // Act
      const recommendations = generator.generateRecommendationsSection(mockResult);
      
      // Assert
      // 複雑なエンドポイントの情報
      expect(recommendations).toContain('/api/users/:id/transactions/:transactionId');
      expect(recommendations).toContain('複雑性スコア');
      
      // 複雑性の原因
      expect(recommendations).toContain('複雑性の原因');
      expect(recommendations).toContain('パラメータ数が多い');
      
      // 改善提案
      expect(recommendations).toContain('改善提案');
    });
    
    it('コード品質向上の推奨事項を正しく生成する', () => {
      // Act
      const recommendations = generator.generateRecommendationsSection(mockResult);
      
      // Assert
      // 型安全性の強化
      expect(recommendations).toContain('型安全性の強化');
      expect(recommendations).toContain('API接続層では厳格な型定義を導入');
      
      // テスト戦略
      expect(recommendations).toContain('テスト戦略');
      expect(recommendations).toContain('各エンドポイント呼び出しに単体テスト');
      
      // ドキュメント整備
      expect(recommendations).toContain('ドキュメント整備');
      
      // エラーハンドリング
      expect(recommendations).toContain('エラーハンドリングの改善');
      
      // パフォーマンス監視
      expect(recommendations).toContain('パフォーマンス監視');
    });
    
    it('RTK Query移行の推奨事項を生成しない条件を確認する', () => {
      // Arrange - RTK Queryが全く使用されていないケース
      const noRtkResult = {
        ...mockResult,
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
      const recommendations = generator.generateRecommendationsSection(noRtkResult);
      
      // Assert
      expect(recommendations).not.toContain('### RTK Query移行計画');
    });
    
    it('複雑性の高いエンドポイントの改善推奨事項を生成しない条件を確認する', () => {
      // Arrange - 複雑なエンドポイントがないケース
      const noComplexResult = {
        ...mockResult,
        endpoints: mockResult.endpoints.slice(0, 3) // 複雑なエンドポイントを除去
      };
      
      // Act
      const recommendations = generator.generateRecommendationsSection(noComplexResult);
      
      // Assert
      expect(recommendations).not.toContain('### 複雑性の高いエンドポイントの改善');
    });
  });
});
