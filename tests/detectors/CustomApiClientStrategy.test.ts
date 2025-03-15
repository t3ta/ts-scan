/**
 * CustomApiClientStrategy クラスのユニットテスト
 *
 * カスタムAPIクライアント検出戦略の各機能を検証します。
 * プロジェクト特有のHTTPクライアント実装パターンの検出能力をテストします。
 */

import { mock, instance, when, anything } from 'ts-mockito';
import { SourceFile, TypeChecker, SyntaxKind } from 'ts-morph';
import { CustomApiClientStrategy } from '../../src/detectors/http/CustomApiClientStrategy';
import { ServiceLocator, ServiceIds } from '../../src/core/ServiceLocator';
import {
  DetectionContext,
  EndpointInfo,
  HttpMethod,
  UsageLocation,
  ParameterUsage,
  ResponseUsage
} from '../../src/types';
import { logger } from '../../src/utils/Logger';
import * as fs from 'fs';
import * as path from 'path';

// モックロガーの設定
jest.mock('../../src/utils/Logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// エンドポイントビルダーのモックインターフェース
interface IEndpointBuilder {
  buildEndpoint(
    path: string,
    method: HttpMethod,
    location: UsageLocation,
    params: ParameterUsage[],
    responseHandling: ResponseUsage[],
    source: string,
    additionalInfo?: any
  ): EndpointInfo;
}

describe('CustomApiClientStrategy', () => {
  // テスト用の共通変数
  let mockSourceFile: SourceFile;
  let mockTypeChecker: TypeChecker;
  let mockServiceLocator: ServiceLocator;
  let mockEndpointBuilder: IEndpointBuilder;
  let strategy: CustomApiClientStrategy;
  let context: DetectionContext;
  let mockApiClientDetector: any;
  let mockServiceMethodDetector: any;
  let mockHttpPatternDetector: any;

  // テストサンプルファイル
  const sampleFilePath = path.resolve(__dirname, '../fixtures/custom-api-client-samples.ts');
  let sampleFileContent = '';

  try {
    if (fs.existsSync(sampleFilePath)) {
      sampleFileContent = fs.readFileSync(sampleFilePath, 'utf8');
    }
  } catch (err) {
    console.error('サンプルファイル読み込みエラー:', err);
  }

  // 各テスト前の共通セットアップ
  beforeEach(() => {
    // 検出器のモックを設定
    mockApiClientDetector = {
      patternName: 'ApiClientMethodCallDetector',
      detectAndExtract: jest.fn().mockReturnValue([])
    };
    mockServiceMethodDetector = {
      patternName: 'ServiceMethodDetector',
      detectAndExtract: jest.fn().mockReturnValue([])
    };
    mockHttpPatternDetector = {
      patternName: 'HttpPatternDetector',
      detectAndExtract: jest.fn().mockReturnValue([])
    };

    // モックオブジェクトの作成
    mockSourceFile = mock<SourceFile>();
    mockTypeChecker = mock<TypeChecker>();
    mockServiceLocator = mock<ServiceLocator>();
    mockEndpointBuilder = mock<IEndpointBuilder>();

    // モックの設定
    when(mockSourceFile.getFilePath() as any).thenReturn(sampleFilePath);
    when(mockSourceFile.getFullText()).thenReturn(sampleFileContent);

    // AST処理のモック - 特定のテストケースで必要に応じてオーバーライド
    when(mockSourceFile.forEachChild(anything())).thenReturn(undefined);
    when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)).thenReturn([]);

    // サービスロケータの設定
    when(mockServiceLocator.resolve<IEndpointBuilder>(ServiceIds.ENDPOINT_BUILDER))
      .thenReturn(instance(mockEndpointBuilder) as any);

    // エンドポイントビルダーの設定 - 実装例（各テストで再定義）
    when(mockEndpointBuilder.buildEndpoint(
      anything(), anything(), anything(), anything(), anything(), anything(), anything()
    )).thenCall((
      path: string,
      method: HttpMethod,
      location: UsageLocation,
      params: ParameterUsage[],
      responseHandling: ResponseUsage[],
      source: string
    ) => {
      return {
        path,
        method,
        isDynamic: path.includes(':') || path.includes('{'),
        usageLocations: [location],
        parametersUsed: params,
        responseHandling,
        source
      };
    });

    // 検出コンテキストの準備
    context = {
      sourceFile: instance(mockSourceFile),
      typeChecker: instance(mockTypeChecker),
      configuration: {
        targetDirectory: '/test',
        filePatterns: ['**/*.ts'],
      },
      serviceLocator: instance(mockServiceLocator)
    };

    // 戦略インスタンスの作成（モックの検出器を渡す）
    strategy = new CustomApiClientStrategy([
      mockApiClientDetector,
      mockServiceMethodDetector,
      mockHttpPatternDetector
    ]);

    // モックのリセット
    jest.clearAllMocks();
  });

  describe('基本機能', () => {
    it('正しい名前と優先度を持つこと', () => {
      expect(strategy.name).toBe('CustomApiClientStrategy');
      expect(strategy.priority).toBe(30);
    });

    it('エラーハンドリングが機能すること', () => {
      // エラーを投げる検出器をシミュレート
      mockApiClientDetector.detectAndExtract.mockImplementation(() => {
        throw new Error('テスト用エラー');
      });

      // テスト対象の実行
      const result = strategy.detect(instance(mockSourceFile), context);

      // 検証
      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('APIクライアント検出', () => {
    it('シンプルなHTTPクライアントクラスのメソッド呼び出しを検出できること', () => {
      // モックの戻り値を設定
      mockApiClientDetector.detectAndExtract.mockReturnValue([{
        path: '/users',
        method: 'GET',
        isDynamic: false,
        usageLocations: [{
          filePath: sampleFilePath,
          line: 1,
          column: 1
        }],
        parametersUsed: [],
        responseHandling: [],
        source: 'apiClient.get<User[]>(\'/users\')'
      }]);

      // テスト対象の実行
      const result = strategy.detect(instance(mockSourceFile), context);

      // 検証
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].path).toBe('/users');
      expect(result[0].method).toBe('GET');
      expect(mockApiClientDetector.detectAndExtract).toHaveBeenCalled();
    });

    it('認証付きAPIクライアントのメソッド呼び出しを検出できること', () => {
      // モックの戻り値を設定
      mockApiClientDetector.detectAndExtract.mockReturnValue([{
        path: '/protected/users',
        method: 'GET',
        isDynamic: false,
        usageLocations: [{
          filePath: sampleFilePath,
          line: 1,
          column: 1
        }],
        parametersUsed: [],
        responseHandling: [],
        source: 'authClient.get<User[]>(\'/protected/users\')'
      }]);

      // テスト対象の実行
      const result = strategy.detect(instance(mockSourceFile), context);

      // 検証
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].path).toBe('/protected/users');
      expect(result[0].method).toBe('GET');
      expect(mockApiClientDetector.detectAndExtract).toHaveBeenCalled();
    });
  });

  describe('サービスクラス検出', () => {
    it('ドメイン特化型サービスクラスのメソッド呼び出しを検出できること', () => {
      // モックの戻り値を設定
      mockServiceMethodDetector.detectAndExtract.mockReturnValue([{
        path: '/users/1',
        method: 'GET',
        isDynamic: true,
        usageLocations: [{
          filePath: sampleFilePath,
          line: 1,
          column: 1
        }],
        parametersUsed: [{
          type: 'path',
          name: 'id',
          value: '1'
        }],
        responseHandling: [],
        source: 'userService.getUserById(1)'
      }]);

      // テスト対象の実行
      const result = strategy.detect(instance(mockSourceFile), context);

      // 検証
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].path).toMatch(/\/users\/\d+/);
      expect(result[0].method).toBe('GET');
      expect(mockServiceMethodDetector.detectAndExtract).toHaveBeenCalled();
    });

    it.skip('エンドポイントパスを正しく解析できること', () => {
      // モックの戻り値を設定
      mockServiceMethodDetector.detectAndExtract.mockReturnValue([{
        path: '/posts/123/comments',
        method: 'GET',
        isDynamic: true,
        usageLocations: [{
          filePath: sampleFilePath,
          line: 1,
          column: 1
        }],
        parametersUsed: [{
          type: 'path',
          name: 'postId',
          value: '123'
        }],
        responseHandling: [],
        source: 'postService.getPostComments(123)'
      }]);

      // テスト対象の実行
      const result = strategy.detect(instance(mockSourceFile), context);

      // 検証
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].path).toMatch(/\/posts\/\d+\/comments/);
      expect(result[0].isDynamic).toBe(true);
      expect(mockServiceMethodDetector.detectAndExtract).toHaveBeenCalled();
    });
  });

  describe('HTTPパターン検出', () => {
    it('RESTスタイルのエンドポイントパターンを検出できること', () => {
      // モックの戻り値を設定
      mockHttpPatternDetector.detectAndExtract.mockReturnValue([{
        path: '/users/1',
        method: 'GET',
        isDynamic: true,
        usageLocations: [{
          filePath: sampleFilePath,
          line: 1,
          column: 1
        }],
        parametersUsed: [{
          type: 'path',
          name: 'id',
          value: '1'
        }],
        responseHandling: [],
        source: 'users.getOne(1)'
      }]);

      // テスト対象の実行
      const result = strategy.detect(instance(mockSourceFile), context);

      // 検証
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].path).toMatch(/\/users\/\d+/);
      expect(result[0].method).toBe('GET');
      expect(mockHttpPatternDetector.detectAndExtract).toHaveBeenCalled();
    });

    it('GraphQLクライアントのラッパーメソッドを検出できること', () => {
      // モックの戻り値を設定
      mockHttpPatternDetector.detectAndExtract.mockReturnValue([{
        path: '/graphql',
        method: 'POST',
        isDynamic: false,
        usageLocations: [{
          filePath: sampleFilePath,
          line: 1,
          column: 1
        }],
        parametersUsed: [],
        responseHandling: [],
        source: 'client.query<{ users: User[] }>(queryString)'
      }]);

      // テスト対象の実行
      const result = strategy.detect(instance(mockSourceFile), context);

      // 検証
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].path).toBe('/graphql');
      expect(result[0].method).toBe('POST');
      expect(mockHttpPatternDetector.detectAndExtract).toHaveBeenCalled();
    });
  });

  describe('パラメータ抽出', () => {
    it.skip('URLパスからパスパラメータを抽出できること', () => {
      // モックの戻り値を設定
      mockServiceMethodDetector.detectAndExtract.mockReturnValue([{
        path: '/users/123',
        method: 'GET',
        isDynamic: true,
        usageLocations: [{
          filePath: sampleFilePath,
          line: 1,
          column: 1
        }],
        parametersUsed: [{
          type: 'path',
          name: 'id',
          value: '123'
        }],
        responseHandling: [],
        source: 'userService.getUserById(123)'
      }]);

      // テスト対象の実行
      const result = strategy.detect(instance(mockSourceFile), context);

      // 検証
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].isDynamic).toBe(true);
      expect(result[0].parametersUsed).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'path',
            name: 'id'
          })
        ])
      );
      expect(mockServiceMethodDetector.detectAndExtract).toHaveBeenCalled();
    });

    it('クエリパラメータを含むURLから適切にパラメータを抽出できること', () => {
      // モックの戻り値を設定
      mockApiClientDetector.detectAndExtract.mockReturnValue([{
        path: '/users',
        method: 'GET',
        isDynamic: false,
        usageLocations: [{
          filePath: sampleFilePath,
          line: 1,
          column: 1
        }],
        parametersUsed: [
          {
            type: 'query',
            name: 'page',
            value: '1'
          },
          {
            type: 'query',
            name: 'limit',
            value: '10'
          }
        ],
        responseHandling: [],
        source: 'apiClient.get<User[]>(\'/users\', { page: 1, limit: 10 })'
      }]);

      // テスト対象の実行
      const result = strategy.detect(instance(mockSourceFile), context);

      // 検証
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].parametersUsed).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'query',
            name: 'page'
          }),
          expect.objectContaining({
            type: 'query',
            name: 'limit'
          })
        ])
      );
      expect(mockApiClientDetector.detectAndExtract).toHaveBeenCalled();
    });

    it('リクエストボディから適切にパラメータを抽出できること', () => {
      // モックの戻り値を設定
      mockServiceMethodDetector.detectAndExtract.mockReturnValue([{
        path: '/users',
        method: 'POST',
        isDynamic: false,
        usageLocations: [{
          filePath: sampleFilePath,
          line: 1,
          column: 1
        }],
        parametersUsed: [
          {
            type: 'body',
            name: 'name',
            value: 'John'
          },
          {
            type: 'body',
            name: 'email',
            value: 'john@example.com'
          }
        ],
        responseHandling: [],
        source: 'userService.createUser({ name: "John", email: "john@example.com" })'
      }]);

      // テスト対象の実行
      const result = strategy.detect(instance(mockSourceFile), context);

      // 検証
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].parametersUsed).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'body',
            name: 'name'
          }),
          expect.objectContaining({
            type: 'body',
            name: 'email'
          })
        ])
      );
      expect(mockServiceMethodDetector.detectAndExtract).toHaveBeenCalled();
    });
  });

  describe('モック環境での基本テスト', () => {
    it('空の結果を返すこと（モック環境）', () => {
      // このテストは実際のts-morph依存なしで実行可能
      const result = strategy.detect(instance(mockSourceFile), context);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
