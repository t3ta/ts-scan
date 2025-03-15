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
          usageLocations: Array.from({ length: 12 }, (_, i) => ({
            filePath: `/path/to/file${i + 8}.ts`,
            lineNumber: 45 + i * 5,
            columnNumber: 10 + i * 5
          })),
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
          PATCH: 0,
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
      // 基本構造の検証
      expect(recommendations).toContain('## 推奨事項と最適化提案');

      // 各サブセクションの存在確認
      expect(recommendations).toContain('### APIパターン標準化');
      expect(recommendations).toContain('### エンドポイント設計の改善');
      expect(recommendations).toContain('### RTK Query移行計画');
      expect(recommendations).toContain('### 複雑性の高いエンドポイントの改善');
      expect(recommendations).toContain('### コード品質とテスト戦略');

      // フォーマットとインデントの検証
      expect(recommendations).toMatch(/\n\n- /); // 箇条書きの前に空行
      expect(recommendations).toMatch(/\n  - /); // サブ項目の適切なインデント
    });

    describe('APIパターン標準化の推奨事項', () => {
      it('複数のAPIパターンが存在する場合の推奨事項を生成する', () => {
        const recommendations = generator.generateRecommendationsSection(mockResult);

        // パターン混在の警告
        expect(recommendations).toContain('3種類の異なるAPIアクセスパターン');
        expect(recommendations).toContain('Axios、RTK Query、Fetch API');

        // 最も使用されているパターンの推奨
        expect(recommendations).toContain('Axiosを主要なAPIアクセスパターンとして標準化');
      });

      it('APIバージョンの混在がある場合の推奨事項を生成する', () => {
        const recommendations = generator.generateRecommendationsSection(mockResult);

        expect(recommendations).toContain('APIバージョンの統一');
        expect(recommendations).toContain('v1、v2');
        expect(recommendations).toContain('最新バージョンへの統一');
      });

      it('APIバージョンが1つしかない場合は統一推奨を生成しない', () => {
        const singleVersionResult = {
          ...mockResult,
          statistics: {
            ...mockResult.statistics,
            apiVersionDistribution: { 'v1': 5 }
          }
        };

        const recommendations = generator.generateRecommendationsSection(singleVersionResult);
        expect(recommendations).not.toContain('APIバージョンの統一');
      });

      it('未使用エンドポイントがある場合の推奨事項を生成する', () => {
        const resultWithUnusedEndpoints = {
          ...mockResult,
          endpoints: [
            ...mockResult.endpoints,
            {
              ...mockResult.endpoints[0],
              path: '/api/unused',
              usageLocations: []
            }
          ]
        };

        const recommendations = generator.generateRecommendationsSection(resultWithUnusedEndpoints);
        expect(recommendations).toContain('未使用エンドポイントの検証');
        expect(recommendations).toContain('不要なコードを削除');
      });
    });

    describe('エンドポイント設計の推奨事項', () => {
      it('動的パスパラメータを持つエンドポイントの推奨事項を生成する', () => {
        const recommendations = generator.generateRecommendationsSection(mockResult);

        expect(recommendations).toContain('動的パスパラメータの一貫した命名');
        expect(recommendations).toContain('2件の動的パスパラメータを持つエンドポイント');
        expect(recommendations).toContain('型安全性を向上');
      });

      it('動的パスパラメータがない場合は関連推奨事項を生成しない', () => {
        const noParamsResult = {
          ...mockResult,
          statistics: {
            ...mockResult.statistics,
            dynamicEndpoints: 0
          }
        };

        const recommendations = generator.generateRecommendationsSection(noParamsResult);
        expect(recommendations).not.toContain('動的パスパラメータの一貫した命名');
      });

      it('使用頻度の高いエンドポイントの推奨事項を生成する', () => {
        const resultWithHighUsage = {
          ...mockResult,
          statistics: {
            ...mockResult.statistics,
            mostUsedEndpoints: [
              { path: '/api/users', count: 25 }
            ]
          }
        };

        const recommendations = generator.generateRecommendationsSection(resultWithHighUsage);
        expect(recommendations).toContain('高頻度使用エンドポイント');
        expect(recommendations).toContain('キャッシュ戦略の実装');
        expect(recommendations).toContain('パフォーマンスモニタリング');
      });

      it('使用頻度が低い場合は最適化推奨を生成しない', () => {
        const lowUsageResult = {
          ...mockResult,
          statistics: {
            ...mockResult.statistics,
            mostUsedEndpoints: [
              { path: '/api/users', count: 5 }
            ]
          }
        };

        const recommendations = generator.generateRecommendationsSection(lowUsageResult);
        expect(recommendations).not.toContain('高頻度使用エンドポイント');
      });

      it('RESTful設計原則に関する推奨事項を生成する', () => {
        const recommendations = generator.generateRecommendationsSection(mockResult);

        expect(recommendations).toContain('RESTful設計原則の適用');
        expect(recommendations).toContain('GETとPOSTは使用されています');
        expect(recommendations).toContain('PUT');
        expect(recommendations).toContain('DELETE');
      });

      it('すべてのHTTPメソッドが使用されている場合はRESTful推奨を生成しない', () => {
        const allMethodsResult = {
          ...mockResult,
          statistics: {
            ...mockResult.statistics,
            methodDistribution: {
              GET: 1,
              POST: 1,
              PUT: 1,
              DELETE: 1,
              PATCH: 1,
              OPTIONS: 0,
              HEAD: 0
            }
          }
        };

        const recommendations = generator.generateRecommendationsSection(allMethodsResult);
        expect(recommendations).not.toContain('RESTful設計原則の適用');
      });
    });

    describe('RTK Query移行の推奨事項', () => {
      it('RTK Query移行が必要な場合の推奨事項を生成する', () => {
        const recommendations = generator.generateRecommendationsSection(mockResult);

        expect(recommendations).toContain('RTK Query移行計画');
        expect(recommendations).toContain('移行進捗状況');
        expect(recommendations).toContain('20.0%のエンドポイントがRTK Queryに移行済み');

        // 移行手順の確認
        expect(recommendations).toContain('類似エンドポイントのグループ化');
        expect(recommendations).toContain('優先順位付け');
        expect(recommendations).toContain('段階的導入');

        // メリットの確認
        expect(recommendations).toContain('状態管理の簡素化');
        expect(recommendations).toContain('キャッシュの自動最適化');
      });

      it('RTK Queryが全く使用されていない場合は移行セクションを生成しない', () => {
        const noRtkResult = {
          ...mockResult,
          statistics: {
            ...mockResult.statistics,
            sourceDistribution: {
              ...mockResult.statistics.sourceDistribution,
              'rtk-query': 0
            }
          }
        };

        const recommendations = generator.generateRecommendationsSection(noRtkResult);
        expect(recommendations).not.toContain('### RTK Query移行計画');
      });

      it('RTK Query移行が80%以上完了している場合は移行セクションを生成しない', () => {
        const mostlyRtkResult = {
          ...mockResult,
          statistics: {
            ...mockResult.statistics,
            sourceDistribution: {
              ...mockResult.statistics.sourceDistribution,
              'rtk-query': 4,
              'axios': 1
            }
          }
        };

        const recommendations = generator.generateRecommendationsSection(mostlyRtkResult);
        expect(recommendations).not.toContain('### RTK Query移行計画');
      });
    });

    describe('複雑性の高いエンドポイントの改善推奨事項', () => {
      it('複雑なエンドポイントがある場合の推奨事項を生成する', () => {
        const recommendations = generator.generateRecommendationsSection(mockResult);

        expect(recommendations).toContain('複雑性の高いエンドポイントの改善');
        expect(recommendations).toContain('/api/users/:id/transactions/:transactionId');
        expect(recommendations).toContain('複雑性スコア');
      });

      it('複雑性の原因を正しく特定する', () => {
        const recommendations = generator.generateRecommendationsSection(mockResult);

        expect(recommendations).toContain('複雑性の原因');
        expect(recommendations).toContain('パラメータ数が多い');
        expect(recommendations).toContain('使用箇所が広範囲に散らばっている');
        expect(recommendations).toContain('動的パスパラメータを使用している');
        expect(recommendations).toContain('複雑なレスポンス変換処理がある');
      });

      it('複雑なエンドポイントがない場合は改善セクションを生成しない', () => {
        const noComplexResult = {
          ...mockResult,
          endpoints: mockResult.endpoints.slice(0, 3)
        };

        const recommendations = generator.generateRecommendationsSection(noComplexResult);
        expect(recommendations).not.toContain('### 複雑性の高いエンドポイントの改善');
      });

      it('複雑性スコアが閾値以下の場合は改善提案を生成しない', () => {
        // モックの実装を一時的に変更
        const originalMock = jest.requireMock('../../../src/utils/statistics').rankEndpointsByComplexity;
        jest.requireMock('../../../src/utils/statistics').rankEndpointsByComplexity = jest.fn().mockReturnValue([]);

        const recommendations = generator.generateRecommendationsSection(mockResult);
        expect(recommendations).not.toContain('### 複雑性の高いエンドポイントの改善');

        // モックを元に戻す
        jest.requireMock('../../../src/utils/statistics').rankEndpointsByComplexity = originalMock;
      });
    });

    describe('コード品質向上の推奨事項', () => {
      it('型安全性の推奨事項を生成する', () => {
        const recommendations = generator.generateRecommendationsSection(mockResult);

        expect(recommendations).toContain('型安全性の強化');
        expect(recommendations).toContain('API接続層では厳格な型定義を導入');
        expect(recommendations).toContain('unknown" 型を活用');
        expect(recommendations).toContain('ジェネリクスを活用');
      });

      it('テスト戦略の推奨事項を生成する', () => {
        const recommendations = generator.generateRecommendationsSection(mockResult);

        expect(recommendations).toContain('テスト戦略');
        expect(recommendations).toContain('各エンドポイント呼び出しに単体テスト');
        expect(recommendations).toContain('MSW（Mock Service Worker）');
        expect(recommendations).toContain('CI/CDパイプライン');
      });

      it('ドキュメント整備の推奨事項を生成する', () => {
        const recommendations = generator.generateRecommendationsSection(mockResult);

        expect(recommendations).toContain('ドキュメント整備');
        expect(recommendations).toContain('OpenAPI/Swagger');
        expect(recommendations).toContain('エンドポイント分析レポート');
        expect(recommendations).toContain('コードコメント');
      });

      it('エラーハンドリングの推奨事項を生成する', () => {
        const recommendations = generator.generateRecommendationsSection(mockResult);

        expect(recommendations).toContain('エラーハンドリングの改善');
        expect(recommendations).toContain('一貫したエラー構造');
        expect(recommendations).toContain('エラー状態のUI表示');
        expect(recommendations).toContain('ユーザーフレンドリーなエラーメッセージ');
      });

      it('パフォーマンス監視の推奨事項を生成する', () => {
        const recommendations = generator.generateRecommendationsSection(mockResult);

        expect(recommendations).toContain('パフォーマンス監視');
        expect(recommendations).toContain('API呼び出しの処理時間計測');
        expect(recommendations).toContain('エラー率の追跡');
        expect(recommendations).toContain('パフォーマンスメトリクスのダッシュボード');
      });
    });
  });
});
