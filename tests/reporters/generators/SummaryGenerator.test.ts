/**
 * サマリージェネレーターのテスト
 *
 * @description
 * マークダウンレポーターのサマリージェネレーターコンポーネントを検証するテストスイート。
 * エグゼクティブサマリー情報の生成ロジックを単体検証します。
 */

import { SummaryGenerator } from '../../../src/reporters/markdown/generators/SummaryGenerator';
import { AnalysisResult, HttpMethod, EndpointSource, ParameterType } from '../../../src/types';

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
            { filePath: '/path/to/file3.ts', lineNumber: 20, columnNumber: 12 }
          ],
          parametersUsed: [
            {
              name: 'id',
              type: 'path' as ParameterType,
              required: true,
              locations: [{ filePath: '/path/to/file3.ts', lineNumber: 20, columnNumber: 30 }]
            }
          ],
          responseHandling: [],
          source: 'rtk-query' as EndpointSource,
          featureCategory: 'ユーザー管理',
          apiVersion: 'v1'
        }
      ],
      statistics: {
        totalEndpoints: 2,
        methodDistribution: {
          GET: 2,
          POST: 0,
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
        apiVersionDistribution: { 'v1': 2 },
        featureCategoryDistribution: { 'ユーザー管理': 2 },
        mostUsedEndpoints: [
          { path: '/api/users', count: 2 }
        ],
        pathParameterUsage: { 'id': 1 },
        dynamicEndpoints: 1,
        rtkQueryUsage: {
          totalEndpoints: 1,
          queries: 1,
          mutations: 0,
          transformResponseUsage: 0
        }
      },
      analyzedAt: new Date('2023-01-01T00:00:00Z'),
      configuration: {
        targetDirectory: '/path/to/project'
      },
      analyzedFiles: ['/path/to/file1.ts', '/path/to/file2.ts', '/path/to/file3.ts'],
      errors: []
    };
  });

  describe('generateExecutiveSummary', () => {
    it('基本的なエグゼクティブサマリーを正しく生成する', () => {
      // Act
      const content = generator.generateExecutiveSummary(mockResult);

      // Assert
      // セクションヘッダーの確認
      expect(content).toContain('## エグゼクティブサマリー');
      expect(content).toContain('### 主要指標');

      // 主要指標の確認
      expect(content).toContain('エンドポイント総数: 2');
      expect(content).toContain('最も多いHTTPメソッド: GET');
      expect(content).toContain('動的エンドポイント割合: 50%');
      expect(content).toContain('RTK Query採用率: 50%');

      // 最頻使用エンドポイントの確認
      expect(content).toContain('最も使用されているエンドポイント: `/api/users` (2回使用)');
    });

    it('エラーがある場合は警告を表示する', () => {
      // Arrange
      const resultWithErrors = {
        ...mockResult,
        errors: ['Error 1: テストエラー', 'Error 2: 解析エラー']
      };

      // Act
      const content = generator.generateExecutiveSummary(resultWithErrors);

      // Assert
      expect(content).toContain('⚠️ **注意:** 解析中に2件のエラーが発生しました');
    });

    it('複雑なエンドポイントを検出して表示する', () => {
      // Arrange
      const complexEndpoint = {
        path: '/api/complex',
        method: 'POST' as HttpMethod,
        isDynamic: true,
        usageLocations: Array(10).fill({ filePath: 'file.ts', lineNumber: 1, columnNumber: 1 }),
        parametersUsed: Array(5).fill({
          name: 'param',
          type: 'query' as ParameterType,
          required: true,
          locations: []
        }),
        responseHandling: [],
        source: 'axios' as EndpointSource,
        featureCategory: 'テスト',
        apiVersion: 'v1'
      };

      const resultWithComplex = {
        ...mockResult,
        endpoints: [...mockResult.endpoints, complexEndpoint]
      };

      // Act
      const content = generator.generateExecutiveSummary(resultWithComplex);

      // Assert
      expect(content).toContain('最も複雑なエンドポイント:');
      expect(content).toContain('POST /api/complex');
    });
  });

  describe('generateQuickRecommendations', () => {
    it('未使用エンドポイントがある場合の推奨事項を生成する', () => {
      // Arrange
      const unusedEndpoint = {
        ...mockResult.endpoints[0],
        usageLocations: []
      };

      const resultWithUnused = {
        ...mockResult,
        endpoints: [...mockResult.endpoints, unusedEndpoint]
      };

      // Act
      const content = generator.generateExecutiveSummary(resultWithUnused);

      // Assert
      expect(content).toContain('未使用エンドポイントの検証: 1件のエンドポイントが未使用の可能性があります');
    });

    it('RTK Query移行の推奨事項を生成する', () => {
      // Act
      const content = generator.generateExecutiveSummary(mockResult);

      // Assert
      expect(content).toContain('RTK Query移行の促進:');
      expect(content).toContain('現在の移行率: 50%');
    });

    it('複数のAPIバージョンが存在する場合の推奨事項を生成する', () => {
      // Arrange
      const resultWithMultipleVersions = {
        ...mockResult,
        statistics: {
          ...mockResult.statistics,
          apiVersionDistribution: { 'v1': 1, 'v2': 1, 'v3': 1 }
        }
      };

      // Act
      const content = generator.generateExecutiveSummary(resultWithMultipleVersions);

      // Assert
      expect(content).toContain('APIバージョンの統一: 3種類のAPIバージョンが混在しています');
    });

    it('複雑なエンドポイントがある場合のリファクタリング推奨を生成する', () => {
      // Arrange
      const complexEndpoint = {
        ...mockResult.endpoints[0],
        isDynamic: true,
        usageLocations: Array(30).fill({ filePath: 'file.ts', lineNumber: 1, columnNumber: 1 }),
        parametersUsed: Array(10).fill({
          name: 'param',
          type: 'query' as ParameterType,
          required: true,
          locations: []
        })
      };

      const resultWithComplex = {
        ...mockResult,
        endpoints: [...mockResult.endpoints, complexEndpoint]
      };

      // Act
      const content = generator.generateExecutiveSummary(resultWithComplex);

      // Assert
      expect(content).toContain('複雑エンドポイントのリファクタリング:');
    });
  });
});
