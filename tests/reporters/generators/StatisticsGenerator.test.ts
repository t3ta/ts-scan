/**
 * 統計情報ジェネレーターのテスト
 *
 * @description
 * マークダウンレポーターの統計情報ジェネレーターコンポーネントを検証するテストスイート。
 * 詳細な統計情報セクションの生成ロジックを単体検証します。
 */

import { StatisticsGenerator } from '../../../src/reporters/markdown/generators/StatisticsGenerator';
import { AnalysisResult, HttpMethod, EndpointSource } from '../../../src/types';

describe('StatisticsGenerator', () => {
  let generator: StatisticsGenerator;
  let mockResult: AnalysisResult;

  beforeEach(() => {
    // ジェネレーターインスタンスを作成
    generator = new StatisticsGenerator();

    // モック解析結果データを作成
    mockResult = {
      endpoints: [],
      statistics: {
        totalEndpoints: 10,
        methodDistribution: {
          GET: 5,
          POST: 3,
          PUT: 2,
          DELETE: 0,
          PATCH: 0,
          OPTIONS: 0,
          HEAD: 0
        } as Record<HttpMethod, number>,
        sourceDistribution: {
          'axios': 4,
          'rtk-query': 3,
          'fetch': 2,
          'custom-client': 1,
          'default': 0,
          'v2-endpoint': 0
        } as Record<EndpointSource, number>,
        apiVersionDistribution: {
          'v1': 7,
          'v2': 3
        },
        featureCategoryDistribution: {
          'ユーザー管理': 4,
          '商品管理': 3,
          '注文管理': 3
        },
        mostUsedEndpoints: [],
        pathParameterUsage: {
          'id': 5,
          'userId': 3,
          'productId': 2
        },
        dynamicEndpoints: 5,
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
      analyzedFiles: [],
      errors: []
    };
  });

  describe('generateStatisticsSection', () => {
    it('すべての統計情報セクションを正しく生成する', () => {
      // Act
      const content = generator.generateStatisticsSection(mockResult);

      // Assert
      expect(content).toContain('## 詳細統計情報');
      expect(content).toContain('### HTTPメソッド分布');
      expect(content).toContain('### 検出元分布');
      expect(content).toContain('### APIバージョン分布');
      expect(content).toContain('### 機能カテゴリ分布');
      expect(content).toContain('### 最も使用されているパスパラメータ');
      expect(content).toContain('### RTK Query統計');
    });
  });

  describe('generateHttpMethodDistribution', () => {
    it('HTTPメソッド分布を正しく生成する', () => {
      // Act
      const content = generator.generateStatisticsSection(mockResult);

      // Assert
      expect(content).toContain('| GET | 5 | 50% |');
      expect(content).toContain('| POST | 3 | 30% |');
      expect(content).toContain('| PUT | 2 | 20% |');
      // 使用されていないメソッドは表示されない
      expect(content).not.toContain('| DELETE |');
      expect(content).not.toContain('| PATCH |');
    });

    it('使用されているメソッドのみを表示する', () => {
      // Arrange
      const resultWithLimitedMethods = {
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
      const content = generator.generateStatisticsSection(resultWithLimitedMethods);

      // Assert
      expect(content).toContain('| GET | 1 | 100% |');
      expect(content).not.toContain('| POST |');
    });
  });

  describe('generateSourceDistribution', () => {
    it('検出元分布を正しく生成する', () => {
      // Act
      const content = generator.generateStatisticsSection(mockResult);

      // Assert
      expect(content).toContain('| Axios | 4 | 40% |');
      expect(content).toContain('| RTK Query | 3 | 30% |');
      expect(content).toContain('| Fetch API | 2 | 20% |');
      expect(content).toContain('| カスタムクライアント | 1 | 10% |');
    });
  });

  describe('generateApiVersionDistribution', () => {
    it('APIバージョン分布を正しく生成する', () => {
      // Act
      const content = generator.generateStatisticsSection(mockResult);

      // Assert
      expect(content).toContain('| v1 | 7 | 70% |');
      expect(content).toContain('| v2 | 3 | 30% |');
    });
  });

  describe('generateFeatureCategoryDistribution', () => {
    it('機能カテゴリ分布を正しく生成する', () => {
      // Act
      const content = generator.generateStatisticsSection(mockResult);

      // Assert
      expect(content).toContain('| ユーザー管理 | 4 | 40% |');
      expect(content).toContain('| 商品管理 | 3 | 30% |');
      expect(content).toContain('| 注文管理 | 3 | 30% |');
    });

    it('カテゴリがない場合はセクションを生成しない', () => {
      // Arrange
      const resultWithNoCategories = {
        ...mockResult,
        statistics: {
          ...mockResult.statistics,
          featureCategoryDistribution: {}
        }
      };

      // Act
      const content = generator.generateStatisticsSection(resultWithNoCategories);

      // Assert
      expect(content).not.toContain('### 機能カテゴリ分布');
    });
  });

  describe('generatePathParameterUsage', () => {
    it('パスパラメータ使用状況を正しく生成する', () => {
      // Act
      const content = generator.generateStatisticsSection(mockResult);

      // Assert
      expect(content).toContain('| id | 5 |');
      expect(content).toContain('| userId | 3 |');
      expect(content).toContain('| productId | 2 |');
    });

    it('パスパラメータがない場合はセクションを生成しない', () => {
      // Arrange
      const resultWithNoParams = {
        ...mockResult,
        statistics: {
          ...mockResult.statistics,
          pathParameterUsage: {}
        }
      };

      // Act
      const content = generator.generateStatisticsSection(resultWithNoParams);

      // Assert
      expect(content).not.toContain('### 最も使用されているパスパラメータ');
    });

    it('パスパラメータが10個以上ある場合は上位10件のみ表示する', () => {
      // Arrange
      const manyParams = Array.from({ length: 15 }, (_, i) => [`param${i + 1}`, 1]);
      const resultWithManyParams = {
        ...mockResult,
        statistics: {
          ...mockResult.statistics,
          pathParameterUsage: Object.fromEntries(manyParams)
        }
      };

      // Act
      const content = generator.generateStatisticsSection(resultWithManyParams);

      // Assert
      const paramRows = content.match(/\| param\d+ \| 1 \|/g);
      expect(paramRows?.length).toBe(10);
    });
  });

  describe('generateRtkQueryStatistics', () => {
    it('RTK Query統計情報を正しく生成する', () => {
      // Act
      const content = generator.generateStatisticsSection(mockResult);

      // Assert
      expect(content).toContain('RTK Query使用エンドポイント: 3 (30%)');
      expect(content).toContain('Query操作: 2 (67% of RTK)');
      expect(content).toContain('Mutation操作: 1 (33% of RTK)');
      expect(content).toContain('レスポンス変換使用: 2 (67% of RTK)');
    });

    it('RTK Queryエンドポイントがない場合は簡略化したメッセージを表示する', () => {
      // Arrange
      const resultWithNoRtk = {
        ...mockResult,
        statistics: {
          ...mockResult.statistics,
          rtkQueryUsage: {
            totalEndpoints: 0,
            queries: 0,
            mutations: 0,
            transformResponseUsage: 0
          }
        }
      };

      // Act
      const content = generator.generateStatisticsSection(resultWithNoRtk);

      // Assert
      expect(content).toContain('RTK Queryを使用したエンドポイントは検出されませんでした。');
    });
  });
});
