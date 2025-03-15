/**
 * 詳細ジェネレーターのテスト
 *
 * @description
 * マークダウンレポーターの詳細ジェネレーターコンポーネントを検証するテストスイート。
 * エンドポイントの詳細情報とエラー情報生成ロジックを単体検証します。
 */

import { DetailGenerator } from '../../../src/reporters/markdown/generators/DetailGenerator';
import { AnalysisResult, EndpointInfo, HttpMethod, EndpointSource, ParameterType } from '../../../src/types';
import { createMockAnalysisResult, createMockEndpoint, assertMarkdownSection, assertMarkdownSubSection } from '../../helpers/mockData';

describe('DetailGenerator', () => {
  let generator: DetailGenerator;
  let mockResult: AnalysisResult;

  beforeEach(() => {
    // ジェネレーターインスタンスを作成
    generator = new DetailGenerator();

    // モック解析結果データを作成
    mockResult = createMockAnalysisResult({
      endpoints: [
        createMockEndpoint({
          path: '/api/users',
          method: 'GET' as HttpMethod,
          isDynamic: false,
          usageLocations: [
            { filePath: '/path/to/file1.ts', lineNumber: 10, columnNumber: 5, context: 'ユーザー一覧取得' },
            { filePath: '/path/to/file2.ts', lineNumber: 15, columnNumber: 8, context: 'ダッシュボード表示' }
          ],
          parametersUsed: [
            {
              name: 'page',
              type: 'query' as ParameterType,
              required: true,
              locations: [{ filePath: '/path/to/file1.ts', lineNumber: 10, columnNumber: 25 }]
            }
          ],
          source: 'axios' as EndpointSource,
          featureCategory: 'ユーザー管理',
          apiVersion: 'v1'
        }),
        createMockEndpoint({
          path: '/api/products/:id',
          method: 'GET' as HttpMethod,
          isDynamic: true,
          usageLocations: [
            { filePath: '/path/to/file3.ts', lineNumber: 20, columnNumber: 12, context: '商品詳細取得' }
          ],
          parametersUsed: [
            {
              name: 'id',
              type: 'path' as ParameterType,
              required: true,
              locations: [{ filePath: '/path/to/file3.ts', lineNumber: 20, columnNumber: 30 }]
            }
          ],
          source: 'rtk-query' as EndpointSource,
          featureCategory: '商品管理',
          apiVersion: 'v1',
          rtkQuerySpecific: {
            isQuery: true,
            isMutation: false,
            transformResponseUsed: true,
            baseQueryUsed: true,
            apiName: 'productApi',
            builderName: 'getProduct'
          }
        })
      ],
      statistics: {
        totalEndpoints: 2,
        methodDistribution: { GET: 2, POST: 0, PUT: 0, DELETE: 0, PATCH: 0, OPTIONS: 0, HEAD: 0 },
        sourceDistribution: {
          'axios': 1,
          'rtk-query': 1,
          'fetch': 0,
          'custom-client': 0,
          'default': 0,
          'v2-endpoint': 0
        },
        apiVersionDistribution: { 'v1': 2 },
        featureCategoryDistribution: { 'ユーザー管理': 1, '商品管理': 1 },
        mostUsedEndpoints: [
          { path: '/api/users', count: 2 },
          { path: '/api/products/:id', count: 1 }
        ],
        pathParameterUsage: { 'id': 1 },
        dynamicEndpoints: 1,
        rtkQueryUsage: {
          totalEndpoints: 1,
          queries: 1,
          mutations: 0,
          transformResponseUsage: 1
        }
      },
      errors: ['Error 1: 解析エラー', 'Error 2: 型情報不足']
    });
  });

  describe('generateDetailedEndpoints', () => {
    it('基本的なエンドポイント詳細情報を正しく生成する', () => {
      // Act
      const content = generator.generateDetailedEndpoints(mockResult);

      // Assert
      // セクションヘッダーの確認
      assertMarkdownSection(content, 'エンドポイント詳細情報');

      // エンドポイント情報の確認
      expect(content).toContain('### `GET /api/users`');
      expect(content).toContain('### `GET /api/products/:id`');

      // 基本情報の確認
      expect(content).toContain('**使用箇所数:** 2');
      expect(content).toContain('**カテゴリ:** ユーザー管理');
      expect(content).toContain('**APIバージョン:** v1');
      expect(content).toContain('**動的パス:** いいえ');
      expect(content).toContain('**検出元:** Axios');
    });

    it('エンドポイント数が100件以上の場合は表示を制限する', () => {
      // Arrange
      const manyEndpoints = {
        ...mockResult,
        endpoints: Array(101).fill(mockResult.endpoints[0]).map((e, i) => ({
          ...e,
          path: `/api/endpoint${i}`
        })),
        statistics: {
          ...mockResult.statistics,
          totalEndpoints: 101
        }
      };

      // Act
      const content = generator.generateDetailedEndpoints(manyEndpoints);

      // Assert
      expect(content).toContain('注意: エンドポイント数が多いため、最初の50件のみ表示しています');
      // 表示件数の確認
      const endpointCount = (content.match(/### \`GET/g) || []).length;
      expect(endpointCount).toBe(50);
    });
  });

  describe('generateRtkSpecificInfo', () => {
    it('RTK Query固有の情報を正しく生成する', () => {
      // Act
      const content = generator.generateDetailedEndpoints(mockResult);

      // Assert
      expect(content).toContain('#### RTK Query固有情報');
      expect(content).toContain('**タイプ:** クエリ');
      expect(content).toContain('**ビルダー名:** getProduct');
      expect(content).toContain('**API定義名:** productApi');
      expect(content).toContain('**レスポンス変換:** あり');
      expect(content).toContain('**baseQuery使用:** あり');
    });

    it('RTK Query情報がない場合はセクションを生成しない', () => {
      // Arrange
      const noRtkResult = {
        ...mockResult,
        endpoints: [mockResult.endpoints[0]] // RTK Queryエンドポイントを除外
      };

      // Act
      const content = generator.generateDetailedEndpoints(noRtkResult);

      // Assert
      expect(content).not.toContain('#### RTK Query固有情報');
    });
  });

  describe('generateParameterInfo', () => {
    it('パラメータ情報を正しく生成する', () => {
      // Act
      const content = generator.generateDetailedEndpoints(mockResult);

      // Assert
      expect(content).toContain('#### 使用パラメータ');
      expect(content).toContain('| パラメータ名 | 種別 | 必須 | 使用箇所数 |');
      expect(content).toContain('| page | クエリ | ✓ | 1 |');
      expect(content).toContain('| id | パス | ✓ | 1 |');
    });

    it('パラメータがない場合はセクションを生成しない', () => {
      // Arrange
      const noParamsResult = {
        ...mockResult,
        endpoints: [{
          ...mockResult.endpoints[0],
          parametersUsed: []
        }]
      };

      // Act
      const content = generator.generateDetailedEndpoints(noParamsResult);

      // Assert
      expect(content).not.toMatch(/#### 使用パラメータ[\s\S]*\| パラメータ名/);
    });
  });

  describe('generateUsageLocationInfo', () => {
    it('使用箇所情報を正しく生成する', () => {
      // Act
      const content = generator.generateDetailedEndpoints(mockResult);

      // Assert
      expect(content).toContain('#### 使用箇所');
      expect(content).toContain('file1.ts');
      expect(content).toContain('行 10');
      expect(content).toContain('ユーザー一覧取得');
    });

    it('使用箇所が多い場合は表示を制限する', () => {
      // Arrange
      const manyLocationsResult = {
        ...mockResult,
        endpoints: [{
          ...mockResult.endpoints[0],
          usageLocations: Array(10).fill(mockResult.endpoints[0].usageLocations[0])
        }]
      };

      // Act
      const content = generator.generateDetailedEndpoints(manyLocationsResult);

      // Assert
      expect(content).toContain('他');
      // 表示件数の制限を確認
      const locationCount = (content.match(/行 \d+/g) || []).length;
      expect(locationCount).toBeLessThanOrEqual(3);
    });
  });

  describe('generateErrorSection', () => {
    it('エラーセクションを正しく生成する', () => {
      // Act
      const content = generator.generateErrorSection(mockResult);

      // Assert
      expect(content).toContain('## 解析中のエラー (2件)');
      expect(content).toContain('Error 1: 解析エラー');
      expect(content).toContain('Error 2: 型情報不足');
      expect(content).toContain('これらのエラーは主に以下の理由で発生している可能性があります');
    });

    it('エラーが20件以上ある場合は表示を制限する', () => {
      // Arrange
      const manyErrorsResult = {
        ...mockResult,
        errors: Array(30).fill('Error: テストエラー')
      };

      // Act
      const content = generator.generateErrorSection(manyErrorsResult);

      // Assert
      expect(content).toContain('他 10 件のエラー');
      // 表示件数の制限を確認
      const errorCount = (content.match(/Error/g) || []).length;
      expect(errorCount).toBe(20);
    });

    it('エラーがない場合も適切に処理する', () => {
      // Arrange
      const noErrorsResult = {
        ...mockResult,
        errors: []
      };

      // Act
      const content = generator.generateErrorSection(noErrorsResult);

      // Assert
      expect(content).toContain('## 解析中のエラー (0件)');
      expect(content).not.toContain('他');
    });
  });
});
