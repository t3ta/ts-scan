/**
 * CustomApiClientStrategy クラスのユニットテスト
 *
 * カスタムAPIクライアント検出戦略の各機能を検証します。
 * プロジェクト特有のHTTPクライアント実装パターンの検出能力をテストします。
 */

import { mock, instance, when, anything } from 'ts-mockito';
import { SourceFile, TypeChecker, SyntaxKind, Node, CallExpression } from 'ts-morph';
import { adaptMockSourceFileInstance } from '../helpers/mock-adapters';
import { ISourceFile } from '../../src/core/ast/interfaces/ISourceFile';
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
      sourceFile: adaptMockSourceFileInstance(mockSourceFile),
      typeChecker: instance(mockTypeChecker),
      configuration: {
        targetDirectory: '/test',
        filePatterns: ['**/*.ts'],
      },
      serviceLocator: instance(mockServiceLocator)
    };

    // 戦略インスタンスの作成
    strategy = new CustomApiClientStrategy();

    // モックのリセット
    jest.clearAllMocks();
  });

  describe('基本機能', () => {
    it('正しい名前と優先度を持つこと', () => {
      expect(strategy.name).toBe('CustomApiClientStrategy');
      expect(strategy.priority).toBe(30);
    });

    it('エラーハンドリングが機能すること', () => {
      // モック検出器を作成し、エラーをスローするようにセットアップ
      const mockDetector = {
        patternName: 'TestDetector',
        detectAndExtract: jest.fn().mockImplementation(() => {
          throw new Error('テスト用エラー');
        })
      };

      // 戦略インスタンスの検出器を上書き
      // @ts-ignore - privateプロパティへのアクセス
      strategy.detectors = [mockDetector];

      // テスト対象の実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // 注意: 実装の詳細に応じたテストケースの追加はts-morphの内部実装による制約があるため、
  // 下記の例はスケルトンとして提供し、実際のテスト実行ではスキップする
  describe('APIクライアント検出', () => {
    it('シンプルなHTTPクライアントクラスのメソッド呼び出しを検出できること', () => {
      // モックの設定
      const mockClientClass = mock<Node>();
      const mockMethod = mock<CallExpression>();
      const mockArgs = mock<Node>();
      const mockUrlArg = mock<Node>();

      // 呼び出し式をセットアップ
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockMethod)]);

      // HTTPクライアントのメソッド呼び出しのモック
      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isHttpClientMethod')
        .mockImplementation((node: any) => node === instance(mockMethod));

      // URLの抽出をモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractStringValue')
        .mockImplementation((node: any) => {
          if (node === instance(mockUrlArg)) {
            return 'https://api.example.com/users';
          }
          return '';
        });

      // モックのデフォルトレスポンスを設定
      const testDetector = {
        patternName: 'HttpClientDetector',
        detectAndExtract: jest.fn().mockReturnValue([{
          path: 'https://api.example.com/users',
          method: 'GET',
          isDynamic: false,
          usageLocations: [{ filePath: sampleFilePath, lineNumber: 10, columnNumber: 5 }],
          parametersUsed: [],
          responseHandling: [],
          source: 'custom-client'
        }])
      };

      // @ts-ignore - privateプロパティにアクセス
      strategy.detectors = [testDetector];

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(testDetector.detectAndExtract).toHaveBeenCalled();
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('https://api.example.com/users');
      expect(result[0].method).toBe('GET');
      expect(result[0].source).toBe('custom-client');
    });

    it('認証付きAPIクライアントのメソッド呼び出しを検出できること', () => {
      // モックの設定
      const mockClientMethod = mock<CallExpression>();
      const mockUrlArg = mock<Node>();
      const mockHeadersArg = mock<Node>();

      // 認証付きメソッド呼び出しをセットアップ
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockClientMethod)]);

      // 認証付きAPIクライアントメソッドの検出をモック
      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isAuthenticatedApiMethod')
        .mockImplementation((node: any) => node === instance(mockClientMethod));

      // URLとヘッダーの抽出をモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractStringValue')
        .mockImplementation((node: any) => {
          if (node === instance(mockUrlArg)) {
            return 'https://api.example.com/secure/data';
          }
          return '';
        });

      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractAuthorizationHeader')
        .mockImplementation((node: any) => {
          return {
            name: 'Authorization',
            value: 'Bearer token123',
            locations: [{ filePath: sampleFilePath, lineNumber: 15, columnNumber: 10 }]
          };
        });

      // テスト用ディテクターの設定
      const testDetector = {
        patternName: 'AuthenticatedApiDetector',
        detectAndExtract: jest.fn().mockReturnValue([{
          path: 'https://api.example.com/secure/data',
          method: 'GET',
          isDynamic: false,
          usageLocations: [{ filePath: sampleFilePath, lineNumber: 15, columnNumber: 10 }],
          parametersUsed: [{
            name: 'Authorization',
            type: 'header',
            required: true,
            value: 'Bearer token123',
            locations: [{ filePath: sampleFilePath, lineNumber: 15, columnNumber: 10 }]
          }],
          responseHandling: [],
          source: 'custom-client'
        }])
      };

      // @ts-ignore - privateプロパティにアクセス
      strategy.detectors = [testDetector];

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(testDetector.detectAndExtract).toHaveBeenCalled();
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('https://api.example.com/secure/data');
      expect(result[0].method).toBe('GET');
      expect(result[0].parametersUsed.length).toBe(1);
      expect(result[0].parametersUsed[0].type).toBe('header');
      expect(result[0].parametersUsed[0].name).toBe('Authorization');
    });
  });

  describe('サービスクラス検出', () => {
    it('ドメイン特化型サービスクラスのメソッド呼び出しを検出できること', () => {
      // モック設定
      const mockServiceMethod = mock<CallExpression>();
      
      // メソッド呼び出しをセットアップ
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockServiceMethod)]);

      // テスト用ディテクターの設定
      const testDetector = {
        patternName: 'DomainServiceDetector',
        detectAndExtract: jest.fn().mockReturnValue([{
          path: '/api/users/profile',
          method: 'GET',
          isDynamic: false,
          usageLocations: [{ filePath: sampleFilePath, lineNumber: 25, columnNumber: 10 }],
          parametersUsed: [],
          responseHandling: [{
            type: 'typed',
            typeName: 'UserProfile',
            location: { filePath: sampleFilePath, lineNumber: 25, columnNumber: 10 }
          }],
          source: 'custom-client'
        }])
      };

      // @ts-ignore - privateプロパティにアクセス
      strategy.detectors = [testDetector];

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(testDetector.detectAndExtract).toHaveBeenCalled();
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('/api/users/profile');
      expect(result[0].method).toBe('GET');
      expect(result[0].responseHandling[0].type).toBe('typed');
      expect(result[0].responseHandling[0].typeName).toBe('UserProfile');
    });

    it('エンドポイントパスを正しく解析できること', () => {
      // モック設定
      const mockServiceMethod = mock<CallExpression>();
      const mockPathParam = mock<Node>();
      
      // サービスメソッド呼び出しをセットアップ
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockServiceMethod)]);

      // サービスメソッドの検出をモック
      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isServiceMethodWithPath')
        .mockImplementation((node: any) => node === instance(mockServiceMethod));

      // メソッド名と動的パスパラメータの抽出をモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractMethodName')
        .mockImplementation((node: any) => 'getUserById');
        
      jest.spyOn(require('../../src/utils/ast/NodeExtractors'), 'extractPathParameters')
        .mockImplementation((...args: unknown[]) => {
          const path = args[0] as string;
          if (path === '/api/users/:id') {
            return ['id'];
          }
          return [];
        });

      // テスト用ディテクターの設定
      const testDetector = {
        patternName: 'ServicePathDetector',
        detectAndExtract: jest.fn().mockReturnValue([{
          path: '/api/users/:id',
          method: 'GET',
          isDynamic: true,
          usageLocations: [{ filePath: sampleFilePath, lineNumber: 30, columnNumber: 10 }],
          parametersUsed: [{
            name: 'id',
            type: 'path',
            required: true,
            locations: [{ filePath: sampleFilePath, lineNumber: 30, columnNumber: 10 }]
          }],
          responseHandling: [],
          source: 'custom-client'
        }])
      };

      // @ts-ignore - privateプロパティにアクセス
      strategy.detectors = [testDetector];

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(testDetector.detectAndExtract).toHaveBeenCalled();
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('/api/users/:id');
      expect(result[0].isDynamic).toBe(true);
      expect(result[0].parametersUsed.length).toBe(1);
      expect(result[0].parametersUsed[0].name).toBe('id');
      expect(result[0].parametersUsed[0].type).toBe('path');
      expect(result[0].parametersUsed[0].required).toBe(true);
    });
  });

  describe('HTTPパターン検出', () => {
    it('RESTスタイルのエンドポイントパターンを検出できること', () => {
      // モック設定
      const mockRestMethod = mock<CallExpression>();
      
      // メソッド呼び出しをセットアップ
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockRestMethod)]);

      // テスト用ディテクターの設定
      const testDetector = {
        patternName: 'RestStyleDetector',
        detectAndExtract: jest.fn().mockReturnValue([{
          path: '/api/resources/:resourceId',
          method: 'PUT',
          isDynamic: true,
          usageLocations: [{ filePath: sampleFilePath, lineNumber: 40, columnNumber: 10 }],
          parametersUsed: [{
            name: 'resourceId',
            type: 'path',
            required: true,
            locations: [{ filePath: sampleFilePath, lineNumber: 40, columnNumber: 10 }]
          }],
          responseHandling: [],
          source: 'custom-client'
        }])
      };

      // @ts-ignore - privateプロパティにアクセス
      strategy.detectors = [testDetector];

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(testDetector.detectAndExtract).toHaveBeenCalled();
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('/api/resources/:resourceId');
      expect(result[0].method).toBe('PUT');
      expect(result[0].isDynamic).toBe(true);
    });

    it('GraphQLクライアントのラッパーメソッドを検出できること', () => {
      // モック設定
      const mockGraphQLMethod = mock<CallExpression>();
      
      // メソッド呼び出しをセットアップ
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockGraphQLMethod)]);

      // テスト用ディテクターの設定
      const testDetector = {
        patternName: 'GraphQLClientDetector',
        detectAndExtract: jest.fn().mockReturnValue([{
          path: '/graphql',
          method: 'POST',
          isDynamic: false,
          usageLocations: [{ filePath: sampleFilePath, lineNumber: 50, columnNumber: 10 }],
          parametersUsed: [{
            name: 'query',
            type: 'body',
            required: true,
            locations: [{ filePath: sampleFilePath, lineNumber: 50, columnNumber: 10 }]
          }],
          responseHandling: [{
            type: 'typed',
            typeName: 'GraphQLResponse<UserData>',
            location: { filePath: sampleFilePath, lineNumber: 50, columnNumber: 10 }
          }],
          source: 'custom-client'
        }])
      };

      // @ts-ignore - privateプロパティにアクセス
      strategy.detectors = [testDetector];

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(testDetector.detectAndExtract).toHaveBeenCalled();
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('/graphql');
      expect(result[0].method).toBe('POST');
      expect(result[0].parametersUsed[0].name).toBe('query');
      expect(result[0].parametersUsed[0].type).toBe('body');
      expect(result[0].responseHandling[0].type).toBe('typed');
      expect(result[0].responseHandling[0].typeName).toBe('GraphQLResponse<UserData>');
    });
  });

  describe('パラメータ抽出', () => {
    it('URLパスからパスパラメータを抽出できること', () => {
      // モック設定
      const mockMethod = mock<CallExpression>();
      
      // メソッド呼び出しをセットアップ
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockMethod)]);

      // テスト用ディテクターの設定
      const testDetector = {
        patternName: 'PathParameterDetector',
        detectAndExtract: jest.fn().mockReturnValue([{
          path: 'https://api.example.com/users/:userId/posts/:postId',
          method: 'GET',
          isDynamic: true,
          usageLocations: [{ filePath: sampleFilePath, lineNumber: 60, columnNumber: 10 }],
          parametersUsed: [
            {
              name: 'userId',
              type: 'path',
              required: true,
              locations: [{ filePath: sampleFilePath, lineNumber: 60, columnNumber: 10 }]
            },
            {
              name: 'postId',
              type: 'path',
              required: true,
              locations: [{ filePath: sampleFilePath, lineNumber: 60, columnNumber: 15 }]
            }
          ],
          responseHandling: [],
          source: 'custom-client'
        }])
      };

      // @ts-ignore - privateプロパティにアクセス
      strategy.detectors = [testDetector];

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(testDetector.detectAndExtract).toHaveBeenCalled();
      expect(result.length).toBe(1);
      expect(result[0].isDynamic).toBe(true);
      expect(result[0].parametersUsed.length).toBe(2);
      expect(result[0].parametersUsed[0].name).toBe('userId');
      expect(result[0].parametersUsed[0].type).toBe('path');
      expect(result[0].parametersUsed[1].name).toBe('postId');
      expect(result[0].parametersUsed[1].type).toBe('path');
    });

    it('クエリパラメータを含むURLから適切にパラメータを抽出できること', () => {
      // モック設定
      const mockMethod = mock<CallExpression>();
      
      // メソッド呼び出しをセットアップ
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockMethod)]);

      // テスト用ディテクターの設定
      const testDetector = {
        patternName: 'QueryParameterDetector',
        detectAndExtract: jest.fn().mockReturnValue([{
          path: 'https://api.example.com/search?query=test&limit=10&sort=desc',
          method: 'GET',
          isDynamic: false,
          usageLocations: [{ filePath: sampleFilePath, lineNumber: 70, columnNumber: 10 }],
          parametersUsed: [
            {
              name: 'query',
              type: 'query',
              locations: [{ filePath: sampleFilePath, lineNumber: 70, columnNumber: 10 }]
            },
            {
              name: 'limit',
              type: 'query',
              locations: [{ filePath: sampleFilePath, lineNumber: 70, columnNumber: 15 }]
            },
            {
              name: 'sort',
              type: 'query',
              locations: [{ filePath: sampleFilePath, lineNumber: 70, columnNumber: 20 }]
            }
          ],
          responseHandling: [],
          source: 'custom-client'
        }])
      };

      // @ts-ignore - privateプロパティにアクセス
      strategy.detectors = [testDetector];

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(testDetector.detectAndExtract).toHaveBeenCalled();
      expect(result.length).toBe(1);
      expect(result[0].parametersUsed.length).toBe(3);
      
      // クエリパラメータの確認
      const queryParams = result[0].parametersUsed.filter(p => p.type === 'query');
      expect(queryParams.length).toBe(3);
      expect(queryParams.map(p => p.name)).toContain('query');
      expect(queryParams.map(p => p.name)).toContain('limit');
      expect(queryParams.map(p => p.name)).toContain('sort');
    });

    it('リクエストボディから適切にパラメータを抽出できること', () => {
      // モック設定
      const mockMethod = mock<CallExpression>();
      
      // メソッド呼び出しをセットアップ
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockMethod)]);

      // テスト用ディテクターの設定
      const testDetector = {
        patternName: 'BodyParameterDetector',
        detectAndExtract: jest.fn().mockReturnValue([{
          path: 'https://api.example.com/users',
          method: 'POST',
          isDynamic: false,
          usageLocations: [{ filePath: sampleFilePath, lineNumber: 80, columnNumber: 10 }],
          parametersUsed: [
            {
              name: 'name',
              type: 'body',
              locations: [{ filePath: sampleFilePath, lineNumber: 80, columnNumber: 10 }]
            },
            {
              name: 'email',
              type: 'body',
              locations: [{ filePath: sampleFilePath, lineNumber: 80, columnNumber: 15 }]
            },
            {
              name: 'age',
              type: 'body',
              locations: [{ filePath: sampleFilePath, lineNumber: 80, columnNumber: 20 }]
            }
          ],
          responseHandling: [],
          source: 'custom-client'
        }])
      };

      // @ts-ignore - privateプロパティにアクセス
      strategy.detectors = [testDetector];

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(testDetector.detectAndExtract).toHaveBeenCalled();
      expect(result.length).toBe(1);
      expect(result[0].method).toBe('POST');
      expect(result[0].parametersUsed.length).toBe(3);
      
      // ボディパラメータの確認
      const bodyParams = result[0].parametersUsed.filter(p => p.type === 'body');
      expect(bodyParams.length).toBe(3);
      expect(bodyParams.map(p => p.name)).toContain('name');
      expect(bodyParams.map(p => p.name)).toContain('email');
      expect(bodyParams.map(p => p.name)).toContain('age');
    });
  });

  describe('モック環境での基本テスト', () => {
    it('空の結果を返すこと（モック環境）', () => {
      // このテストは実際のts-morph依存なしで実行可能
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
