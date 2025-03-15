/**
 * エンドポイント一覧ジェネレーターのテスト
 *
 * @description
 * マークダウンレポーターのエンドポイント一覧ジェネレーターコンポーネントを検証するテストスイート。
 * カテゴリ別・メソッド別のエンドポイント一覧生成ロジックを単体検証します。
 */

import { EndpointListGenerator } from '../../../src/reporters/markdown/generators/EndpointListGenerator';
import { AnalysisResult, HttpMethod, EndpointSource, ParameterType } from '../../../src/types';

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
          source: 'axios' as EndpointSource,
          featureCategory: 'ユーザー管理',
          apiVersion: 'v1'
        },
        {
          path: '/api/products',
          method: 'POST' as HttpMethod,
          isDynamic: false,
          usageLocations: [
            { filePath: '/path/to/file4.ts', lineNumber: 25, columnNumber: 15 }
          ],
          parametersUsed: [
            {
              name: 'data',
              type: 'body' as ParameterType,
              required: true,
              locations: [{ filePath: '/path/to/file4.ts', lineNumber: 25, columnNumber: 35 }]
            }
          ],
          responseHandling: [],
          source: 'rtk-query' as EndpointSource,
          featureCategory: '商品管理',
          apiVersion: 'v1'
        }
      ],
      statistics: {
        totalEndpoints: 3,
        methodDistribution: { GET: 2, POST: 1, PUT: 0, DELETE: 0, PATCH: 0, OPTIONS: 0, HEAD: 0 },
        sourceDistribution: {
          'axios': 2,
          'rtk-query': 1,
          'fetch': 0,
          'custom-client': 0,
          'default': 0,
          'v2-endpoint': 0
        },
        apiVersionDistribution: { 'v1': 3 },
        featureCategoryDistribution: { 'ユーザー管理': 2, '商品管理': 1 },
        mostUsedEndpoints: [],
        pathParameterUsage: { 'id': 1 },
        dynamicEndpoints: 1,
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
      analyzedFiles: ['/path/to/file1.ts', '/path/to/file2.ts', '/path/to/file3.ts', '/path/to/file4.ts'],
      errors: []
    };
  });

  describe('generateCategorizedEndpoints', () => {
    it('カテゴリ別のエンドポイント一覧を正しく生成する', () => {
      // Act
      const content = generator.generateCategorizedEndpoints(mockResult);

      // Assert
      // セクションヘッダーの確認
      expect(content).toContain('## カテゴリ別エンドポイント一覧');

      // カテゴリの確認
      expect(content).toContain('### ユーザー管理');
      expect(content).toContain('### 商品管理');

      // テーブルヘッダーの確認
      expect(content).toContain('| メソッド | エンドポイント | 使用箇所数 | 動的パラメータ | 検出元 |');

      // エンドポイント情報の確認
      expect(content).toContain('| GET | `/api/users` | 2 | - | Axios |');
      expect(content).toContain('| GET | `/api/users/:id` | 1 | ✓ | Axios |');
      expect(content).toContain('| POST | `/api/products` | 1 | - | RTK Query |');
    });

    it('複雑なエンドポイントをハイライトする', () => {
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
      const content = generator.generateCategorizedEndpoints(resultWithComplex);

      // Assert
      expect(content).toContain('#### カテゴリ内の複雑なエンドポイント');
      expect(content).toContain('| エンドポイント | 複雑性スコア | 使用箇所数 | パラメータ数 |');
      expect(content).toContain('| `POST /api/complex`');
    });

    it('カテゴリがないエンドポイントも適切に処理する', () => {
      // Arrange
      const noCategoryEndpoint = {
        ...mockResult.endpoints[0],
        featureCategory: undefined
      };

      const resultWithNoCategory = {
        ...mockResult,
        endpoints: [noCategoryEndpoint]
      };

      // Act
      const content = generator.generateCategorizedEndpoints(resultWithNoCategory);

      // Assert
      expect(content).toContain('### 未分類');
      expect(content).toContain('| GET | `/api/users` |');
    });
  });

  describe('generateMethodBasedEndpoints', () => {
    it('メソッド別のエンドポイント一覧を正しく生成する', () => {
      // Act
      const content = generator.generateMethodBasedEndpoints(mockResult);

      // Assert
      // セクションヘッダーの確認
      expect(content).toContain('## HTTPメソッド別エンドポイント一覧');

      // メソッドセクションの確認
      expect(content).toContain('### GET エンドポイント (2)');
      expect(content).toContain('### POST エンドポイント (1)');

      // テーブルヘッダーの確認
      expect(content).toContain('| エンドポイント | カテゴリ | 使用箇所数 | 動的パラメータ | APIバージョン |');

      // エンドポイント情報の確認
      expect(content).toContain('| `/api/users` | ユーザー管理 | 2 | - | v1 |');
      expect(content).toContain('| `/api/products` | 商品管理 | 1 | - | v1 |');
    });

    it('使用されていないメソッドのセクションは生成しない', () => {
      // Act
      const content = generator.generateMethodBasedEndpoints(mockResult);

      // Assert
      expect(content).not.toContain('### PUT エンドポイント');
      expect(content).not.toContain('### DELETE エンドポイント');
      expect(content).not.toContain('### PATCH エンドポイント');
    });

    it('エンドポイントをパスでソートして表示する', () => {
      // Arrange
      const additionalEndpoint = {
        ...mockResult.endpoints[0],
        path: '/api/admin'
      };

      const resultWithAdditional = {
        ...mockResult,
        endpoints: [...mockResult.endpoints, additionalEndpoint]
      };

      // Act
      const content = generator.generateMethodBasedEndpoints(resultWithAdditional);

      // Assert
      const getSection = content.split('### GET エンドポイント')[1].split('###')[0];
      const adminIndex = getSection.indexOf('/api/admin');
      const usersIndex = getSection.indexOf('/api/users');
      expect(adminIndex).toBeLessThan(usersIndex);
    });

    it('APIバージョンが未指定の場合はデフォルトと表示する', () => {
      // Arrange
      const noVersionEndpoint = {
        ...mockResult.endpoints[0],
        apiVersion: undefined
      };

      const resultWithNoVersion = {
        ...mockResult,
        endpoints: [noVersionEndpoint]
      };

      // Act
      const content = generator.generateMethodBasedEndpoints(resultWithNoVersion);

      // Assert
      expect(content).toContain('デフォルト');
    });
  });
});
