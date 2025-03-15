/**
 * RTKQueryDetectionStrategy クラスのユニットテスト
 *
 * Redux Toolkit Query検出戦略の各機能を検証します。
 * 様々なRTK Queryパターンの検出能力をテストします。
 */

import { mock, instance, when, anything, verify } from 'ts-mockito';
import { SourceFile, TypeChecker, SyntaxKind, Node, CallExpression } from 'ts-morph';
import { adaptMockSourceFileInstance } from '../helpers/mock-adapters';
import { ISourceFile } from '../../src/core/ast/interfaces/ISourceFile';
import { RTKQueryDetectionStrategy } from '../../src/detectors/rtk-query/RTKQueryDetectionStrategy';
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
import { RtkQueryApiParser } from '../../src/detectors/rtk-query/parsers/RtkQueryApiParser';
import { RtkQueryTypeDetector } from '../../src/detectors/rtk-query/parsers/RtkQueryTypeDetector';
import { EndpointType } from '../../src/detectors/rtk-query/parsers/RtkQueryTypeDefinitions';

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

describe('RTKQueryDetectionStrategy', () => {
  // テスト用の共通変数
  let mockSourceFile: SourceFile;
  let mockTypeChecker: TypeChecker;
  let mockServiceLocator: ServiceLocator;
  let mockEndpointBuilder: IEndpointBuilder;
  let strategy: RTKQueryDetectionStrategy;
  let context: DetectionContext;

  // テストサンプルファイル
  const sampleFilePath = path.resolve(__dirname, '../fixtures/rtk-query-samples.ts');
  let sampleFileContent = '';

  try {
    if (fs.existsSync(sampleFilePath)) {
      sampleFileContent = fs.readFileSync(sampleFilePath, 'utf8');
    }
  } catch (err) {
    console.error('サンプルファイル読み込みエラー:', err);
  }

  // RtkQueryApiParserのモックを追加
  let mockApiParser: RtkQueryApiParser;
  let mockTypeDetector: RtkQueryTypeDetector;

  // 各テスト前の共通セットアップ
  beforeEach(() => {
    // モックオブジェクトの作成
    mockSourceFile = mock<SourceFile>();
    mockTypeChecker = mock<TypeChecker>();
    mockServiceLocator = mock<ServiceLocator>();
    mockEndpointBuilder = mock<IEndpointBuilder>();
    mockApiParser = mock<RtkQueryApiParser>();
    mockTypeDetector = mock<RtkQueryTypeDetector>();

    // モックの設定
    when(mockSourceFile.getFilePath() as any).thenReturn(sampleFilePath);
    when(mockSourceFile.getFullText()).thenReturn(sampleFileContent);

    // AST処理のモック - 特定のテストケースで必要に応じてオーバーライド
    when(mockSourceFile.forEachChild(anything())).thenReturn(undefined);
    when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)).thenReturn([]);
    when(mockSourceFile.forEachDescendant(anything())).thenCall((callback) => {
      // シンプルなモック実装 - 実際のテストでは必要に応じて拡張
      return;
    });

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
      source: string,
      additionalInfo: any
    ) => {
      return {
        path,
        method,
        isDynamic: path.includes(':') || path.includes('{'),
        usageLocations: [location],
        parametersUsed: params,
        responseHandling,
        source,
        rtkQuerySpecific: {
          isQuery: method === 'GET',
          isMutation: method !== 'GET',
          transformResponseUsed: false,
          baseQueryUsed: true
        }
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

    // 戦略インスタンスの作成とモックの注入
    strategy = new RTKQueryDetectionStrategy();

    // モックのリセット
    jest.clearAllMocks();
  });

  describe('基本機能', () => {
    it('正しい名前と優先度を持つこと', () => {
      expect(strategy.name).toBe('RTKQueryDetectionStrategy');
      expect(strategy.priority).toBe(20);
    });

    it('エラーハンドリングが機能すること', () => {
      // エラーを投げる検出器をシミュレート
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenThrow(new Error('テスト用エラー'));

      // テスト対象の実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('createApi検出', () => {
    it('createApi呼び出しを検出できること', () => {
      // モックのセットアップ
      const mockCallExpr = mock<CallExpression>();
      const mockExpression = mock<Node>();

      // createApi呼び出し式のセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockExpression));
      when(mockExpression.getText()).thenReturn('createApi');

      // 引数のセットアップ (オブジェクトリテラル)
      const mockOptions = mock<Node>();
      when(mockOptions.isKind(SyntaxKind.ObjectLiteralExpression)).thenReturn(true);
      when(mockCallExpr.getArguments()).thenReturn([instance(mockOptions)]);

      // NodePredicatesのモック - createApi呼び出しの検出
      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isCreateApiCallExpression')
        .mockImplementation((node: any) => {
          return node === instance(mockCallExpr);
        });

      // NodeTraversalのモック - createApi呼び出しの検索
      jest.spyOn(require('../../src/utils/ast/NodeTraversal'), 'findNodes')
        .mockImplementation((sourceFile: any, predicate: any) => {
          if (predicate === require('../../src/utils/ast/NodePredicates').isCreateApiCallExpression) {
            return [instance(mockCallExpr)];
          }
          return [];
        });

      // パーサーの模擬返却値を設定
      const mockEndpoint = {
        path: '/users',
        method: 'GET' as HttpMethod,
        isDynamic: false,
        usageLocations: [{
          filePath: sampleFilePath,
          lineNumber: 10,
          columnNumber: 1,
          context: 'apiSlice',
          codeSnippet: 'endpoints: (builder) => ({ getUsers: builder.query({ ... }) })'
        }],
        parametersUsed: [],
        responseHandling: [{
          type: 'typed',
          typeName: 'User[]',
          location: {
            filePath: sampleFilePath,
            lineNumber: 10,
            columnNumber: 1
          }
        }],
        source: 'rtkquery',
        rtkQuerySpecific: {
          isQuery: true,
          isMutation: false,
          transformResponseUsed: false,
          baseQueryUsed: true
        }
      };

      // モックの設定
      const createApiCallDetector = {
        detectAndExtract: jest.fn().mockReturnValue([mockEndpoint])
      };
      // @ts-ignore - テスト用にクラスのプライベートメソッドと内部変数を書き換え
      strategy.detectors = [createApiCallDetector];

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(createApiCallDetector.detectAndExtract).toHaveBeenCalled();
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('/users');
      expect(result[0].method).toBe('GET');
      expect(result[0].rtkQuerySpecific.isQuery).toBe(true);
      expect(result[0].rtkQuerySpecific.isMutation).toBe(false);
      expect(result[0].responseHandling.length).toBe(1);
      expect(result[0].responseHandling[0].type).toBe('typed');
      expect(result[0].responseHandling[0].typeName).toBe('User[]');
    });

    it('builder.mutationエンドポイントを検出できること', () => {
      // モックのセットアップ
      const mockCallExpr = mock<CallExpression>();
      const mockPropAccess = mock<Node>();
      const mockBuilderExpr = mock<Node>();

      // builder.mutation呼び出し式のセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockPropAccess));

      when(mockPropAccess.isKind(SyntaxKind.PropertyAccessExpression)).thenReturn(true);
      when(mockPropAccess.getExpression()).thenReturn(instance(mockBuilderExpr));
      when(mockBuilderExpr.getText()).thenReturn('builder');
      when((mockPropAccess as any).getName()).thenReturn('mutation');

      // 引数のセットアップ (オブジェクトリテラル)
      const mockOptions = mock<Node>();
      when(mockOptions.isKind(SyntaxKind.ObjectLiteralExpression)).thenReturn(true);
      when(mockCallExpr.getArguments()).thenReturn([instance(mockOptions)]);

      // エンドポイント定義の検索のためのモック
      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isEndpointDefinition')
        .mockImplementation((node: any) => {
          return node === instance(mockCallExpr);
        });

      // NodeTraversalのモック - エンドポイント定義の検索
      jest.spyOn(require('../../src/utils/ast/NodeTraversal'), 'findNodes')
        .mockImplementation((sourceFile: any, predicate: any) => {
          if (typeof predicate === 'function') {
            if (predicate === require('../../src/utils/ast/NodePredicates').isCreateApiCallExpression) {
              return [];
            }
            if (predicate(instance(mockCallExpr))) {
              return [instance(mockCallExpr)];
            }
          }
          return [];
        });

      // 型検出器のモック
      // @ts-ignore
      strategy.typeDetector = {
        detectEndpointType: jest.fn().mockReturnValue(EndpointType.Mutation)
      };

      // モックエンドポイント情報
      const mockEndpoint = {
        path: '/users',
        method: 'POST' as HttpMethod,
        isDynamic: false,
        usageLocations: [{
          filePath: sampleFilePath,
          lineNumber: 30,
          columnNumber: 1,
          context: 'createUserMutation',
          codeSnippet: 'const createUserMutation = builder.mutation({ query: (userData) => ({ url: "/users", method: "POST", body: userData }) })'
        }],
        parametersUsed: [{
          name: 'userData',
          type: 'body',
          locations: [{
            filePath: sampleFilePath,
            lineNumber: 30,
            columnNumber: 1
          }]
        }],
        responseHandling: [{
          type: 'typed',
          typeName: 'User',
          location: {
            filePath: sampleFilePath,
            lineNumber: 30,
            columnNumber: 1
          }
        }],
        source: 'rtkquery',
        rtkQuerySpecific: {
          isQuery: false,
          isMutation: true,
          transformResponseUsed: false,
          baseQueryUsed: true
        }
      };

      // エンドポイント解析のモック
      const parseEndpointDefinitionSpy = jest.fn().mockReturnValue(mockEndpoint);
      // @ts-ignore - テスト用にクラスのプライベートメソッドを書き換え
      strategy.apiParser = {
        ...strategy.apiParser,
        parseEndpointDefinition: parseEndpointDefinitionSpy
      };

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(parseEndpointDefinitionSpy).toHaveBeenCalledWith(instance(mockCallExpr), context);
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('/users');
      expect(result[0].method).toBe('POST');
      expect(result[0].rtkQuerySpecific.isQuery).toBe(false);
      expect(result[0].rtkQuerySpecific.isMutation).toBe(true);
      expect(result[0].parametersUsed.length).toBe(1);
      expect(result[0].parametersUsed[0].name).toBe('userData');
      expect(result[0].parametersUsed[0].type).toBe('body');
    });
  });

  describe('エンドポイント使用検出', () => {
    it('useQueryフックの使用を検出できること', () => {
      // モックのセットアップ
      const mockCallExpr = mock<CallExpression>();
      const mockExpression = mock<Node>();

      // useQuery呼び出し式のセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockExpression));
      when(mockExpression.getText()).thenReturn('useGetUsersQuery');

      // 引数のセットアップ（空または引数あり）
      when(mockCallExpr.getArguments()).thenReturn([]);

      // エンドポイント使用の検索のためのモック
      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isRtkQueryHookUsage')
        .mockImplementation((node: any) => {
          return node === instance(mockCallExpr);
        });

      // NodeTraversalのモック
      jest.spyOn(require('../../src/utils/ast/NodeTraversal'), 'findNodes')
        .mockImplementation((sourceFile: any, predicate: any) => {
          if (typeof predicate === 'function') {
            if (predicate === require('../../src/utils/ast/NodePredicates').isCreateApiCallExpression) {
              return [];
            }
            if (predicate === require('../../src/utils/ast/NodePredicates').isEndpointDefinition) {
              return [];
            }
            if (predicate(instance(mockCallExpr))) {
              return [instance(mockCallExpr)];
            }
          }
          return [];
        });

      // モックエンドポイント情報
      const mockEndpoint = {
        path: '/users',
        method: 'GET' as HttpMethod,
        isDynamic: false,
        usageLocations: [{
          filePath: sampleFilePath,
          lineNumber: 40,
          columnNumber: 1,
          context: 'UsersList',
          codeSnippet: 'const { data: users, isLoading } = useGetUsersQuery()'
        }],
        parametersUsed: [],
        responseHandling: [{
          type: 'typed',
          typeName: 'User[]',
          location: {
            filePath: sampleFilePath,
            lineNumber: 40,
            columnNumber: 1
          }
        }],
        source: 'rtkquery',
        rtkQuerySpecific: {
          isQuery: true,
          isMutation: false,
          transformResponseUsed: false,
          baseQueryUsed: true
        }
      };

      // フック使用解析のモック
      const parseHookUsageSpy = jest.fn().mockReturnValue(mockEndpoint);
      // @ts-ignore - テスト用にクラスのプライベートメソッドを書き換え
      strategy.apiParser = {
        ...strategy.apiParser,
        parseHookUsage: parseHookUsageSpy
      };

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(parseHookUsageSpy).toHaveBeenCalledWith(instance(mockCallExpr), context);
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('/users');
      expect(result[0].method).toBe('GET');
      expect(result[0].rtkQuerySpecific.isQuery).toBe(true);
      expect(result[0].rtkQuerySpecific.isMutation).toBe(false);
    });

    it('useMutationフックの使用を検出できること', () => {
      // モックのセットアップ
      const mockCallExpr = mock<CallExpression>();
      const mockExpression = mock<Node>();

      // useMutation呼び出し式のセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockExpression));
      when(mockExpression.getText()).thenReturn('useCreateUserMutation');

      // 引数のセットアップ（空）
      when(mockCallExpr.getArguments()).thenReturn([]);

      // エンドポイント使用の検索のためのモック
      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isRtkQueryHookUsage')
        .mockImplementation((node: any) => {
          return node === instance(mockCallExpr);
        });

      // NodeTraversalのモック
      jest.spyOn(require('../../src/utils/ast/NodeTraversal'), 'findNodes')
        .mockImplementation((sourceFile: any, predicate: any) => {
          if (typeof predicate === 'function') {
            if (predicate === require('../../src/utils/ast/NodePredicates').isCreateApiCallExpression) {
              return [];
            }
            if (predicate === require('../../src/utils/ast/NodePredicates').isEndpointDefinition) {
              return [];
            }
            if (predicate(instance(mockCallExpr))) {
              return [instance(mockCallExpr)];
            }
          }
          return [];
        });

      // モックエンドポイント情報
      const mockEndpoint = {
        path: '/users',
        method: 'POST' as HttpMethod,
        isDynamic: false,
        usageLocations: [{
          filePath: sampleFilePath,
          lineNumber: 50,
          columnNumber: 1,
          context: 'UserForm',
          codeSnippet: 'const [createUser, { isLoading }] = useCreateUserMutation()'
        }],
        parametersUsed: [{
          name: 'userData',
          type: 'body',
          locations: [{
            filePath: sampleFilePath,
            lineNumber: 50,
            columnNumber: 1
          }]
        }],
        responseHandling: [{
          type: 'typed',
          typeName: 'User',
          location: {
            filePath: sampleFilePath,
            lineNumber: 50,
            columnNumber: 1
          }
        }],
        source: 'rtkquery',
        rtkQuerySpecific: {
          isQuery: false,
          isMutation: true,
          transformResponseUsed: false,
          baseQueryUsed: true
        }
      };

      // フック使用解析のモック
      const parseHookUsageSpy = jest.fn().mockReturnValue(mockEndpoint);
      // @ts-ignore - テスト用にクラスのプライベートメソッドを書き換え
      strategy.apiParser = {
        ...strategy.apiParser,
        parseHookUsage: parseHookUsageSpy
      };

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(parseHookUsageSpy).toHaveBeenCalledWith(instance(mockCallExpr), context);
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('/users');
      expect(result[0].method).toBe('POST');
      expect(result[0].rtkQuerySpecific.isQuery).toBe(false);
      expect(result[0].rtkQuerySpecific.isMutation).toBe(true);
    });
  });

  describe('パラメータとURLパス検出', () => {
    it('文字列リテラルURLを正しく解析できること', () => {
      // モックのセットアップ - builder.queryの呼び出し
      const mockCallExpr = mock<Node>();
      const mockPropAccess = mock<Node>();
      const mockBuilderExpr = mock<Node>();

      // builder.query呼び出し式のセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockPropAccess));

      when(mockPropAccess.isKind(SyntaxKind.PropertyAccessExpression)).thenReturn(true);
      when(mockPropAccess.getExpression()).thenReturn(instance(mockBuilderExpr));
      when(mockBuilderExpr.getText()).thenReturn('builder');
      when((mockPropAccess as any).getName()).thenReturn('query');

      // 引数のセットアップ (オブジェクトリテラル)
      const mockOptions = mock<Node>();
      when(mockOptions.isKind(SyntaxKind.ObjectLiteralExpression)).thenReturn(true);
      when(mockCallExpr.getArguments()).thenReturn([instance(mockOptions)]);

      // クエリオプションの設定 - 文字列リテラルURL
      const mockQueryProp = mock<Node>();
      const mockQueryFn = mock<Node>();
      const mockReturnValue = mock<Node>();

      when(mockQueryProp.isKind(SyntaxKind.PropertyAssignment)).thenReturn(true);
      when((mockQueryProp as any).getName()).thenReturn('query');
      when(mockQueryProp.getInitializer()).thenReturn(instance(mockQueryFn));

      // モック返り値の設定
      when(mockReturnValue.getText()).thenReturn('"/api/users"');

      // NodeExtractorsExtendedのモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractStringValue')
        .mockImplementation((node: any) => {
          if (node === instance(mockReturnValue)) {
            return '/api/users';
          }
          return '';
        });

      // エンドポイント定義の検索のためのモック
      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isEndpointDefinition')
        .mockImplementation((node: any) => {
          return node === instance(mockCallExpr);
        });

      // NodeTraversalのモック
      jest.spyOn(require('../../src/utils/ast/NodeTraversal'), 'findNodes')
        .mockImplementation((sourceFile: any, predicate: any) => {
          if (typeof predicate === 'function') {
            if (predicate === require('../../src/utils/ast/NodePredicates').isCreateApiCallExpression) {
              return [];
            }
            if (predicate(instance(mockCallExpr))) {
              return [instance(mockCallExpr)];
            }
          }
          return [];
        });

      // 型検出器のモック
      // @ts-ignore
      strategy.typeDetector = {
        detectEndpointType: jest.fn().mockReturnValue(EndpointType.Query)
      };

      // モックエンドポイント情報
      const mockEndpoint = {
        path: '/api/users',
        method: 'GET' as HttpMethod,
        isDynamic: false,
        usageLocations: [{
          filePath: sampleFilePath,
          lineNumber: 60,
          columnNumber: 1,
          context: 'apiSlice',
          codeSnippet: 'getUsers: builder.query({ query: () => "/api/users" })'
        }],
        parametersUsed: [],
        responseHandling: [],
        source: 'rtkquery',
        rtkQuerySpecific: {
          isQuery: true,
          isMutation: false,
          transformResponseUsed: false,
          baseQueryUsed: true
        }
      };

      // エンドポイント解析のモック
      const parseEndpointDefinitionSpy = jest.fn().mockReturnValue(mockEndpoint);
      // @ts-ignore - テスト用にクラスのプライベートメソッドを書き換え
      strategy.apiParser = {
        ...strategy.apiParser,
        parseEndpointDefinition: parseEndpointDefinitionSpy
      };

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(parseEndpointDefinitionSpy).toHaveBeenCalledWith(instance(mockCallExpr), context);
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('/api/users');
      expect(result[0].method).toBe('GET');
    });

    it('URLオブジェクト定義を正しく解析できること', () => {
      // モックのセットアップ - builder.mutationの呼び出し
      const mockCallExpr = mock<Node>();
      const mockPropAccess = mock<Node>();
      const mockBuilderExpr = mock<Node>();

      // builder.mutation呼び出し式のセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockPropAccess));

      when(mockPropAccess.isKind(SyntaxKind.PropertyAccessExpression)).thenReturn(true);
      when(mockPropAccess.getExpression()).thenReturn(instance(mockBuilderExpr));
      when(mockBuilderExpr.getText()).thenReturn('builder');
      when((mockPropAccess as any).getName()).thenReturn('mutation');

      // 引数のセットアップ (オブジェクトリテラル)
      const mockOptions = mock<Node>();
      when(mockOptions.isKind(SyntaxKind.ObjectLiteralExpression)).thenReturn(true);
      when(mockCallExpr.getArguments()).thenReturn([instance(mockOptions)]);

      // クエリオプションの設定 - URLオブジェクト定義
      const mockQueryProp = mock<Node>();
      const mockQueryFn = mock<Node>();
      const mockReturnObj = mock<Node>();

      when(mockQueryProp.isKind(SyntaxKind.PropertyAssignment)).thenReturn(true);
      when((mockQueryProp as any).getName()).thenReturn('query');
      when(mockQueryProp.getInitializer()).thenReturn(instance(mockQueryFn));

      // モック返り値の設定 (オブジェクト)
      const mockUrlProp = mock<Node>();
      const mockMethodProp = mock<Node>();
      const mockBodyProp = mock<Node>();

      when(mockUrlProp.isKind(SyntaxKind.PropertyAssignment)).thenReturn(true);
      when((mockUrlProp as any).getName()).thenReturn('url');
      when(mockUrlProp.getInitializer()).thenReturn(mock<Node>());

      when(mockMethodProp.isKind(SyntaxKind.PropertyAssignment)).thenReturn(true);
      when((mockMethodProp as any).getName()).thenReturn('method');
      when(mockMethodProp.getInitializer()).thenReturn(mock<Node>());

      when(mockBodyProp.isKind(SyntaxKind.PropertyAssignment)).thenReturn(true);
      when((mockBodyProp as any).getName()).thenReturn('body');
      when(mockBodyProp.getInitializer()).thenReturn(mock<Node>());

      // エンドポイント定義の検索のためのモック
      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isEndpointDefinition')
        .mockImplementation((node: any) => {
          return node === instance(mockCallExpr);
        });

      // NodeTraversalのモック
      jest.spyOn(require('../../src/utils/ast/NodeTraversal'), 'findNodes')
        .mockImplementation((sourceFile: any, predicate: any) => {
          if (typeof predicate === 'function') {
            if (predicate === require('../../src/utils/ast/NodePredicates').isCreateApiCallExpression) {
              return [];
            }
            if (predicate(instance(mockCallExpr))) {
              return [instance(mockCallExpr)];
            }
          }
          return [];
        });

      // 型検出器のモック
      // @ts-ignore
      strategy.typeDetector = {
        detectEndpointType: jest.fn().mockReturnValue(EndpointType.Mutation)
      };

      // モックエンドポイント情報
      const mockEndpoint = {
        path: '/users/search',
        method: 'POST' as HttpMethod,
        isDynamic: false,
        usageLocations: [{
          filePath: sampleFilePath,
          lineNumber: 70,
          columnNumber: 1,
          context: 'apiSlice',
          codeSnippet: 'searchUsers: builder.mutation({ query: (searchParams) => ({ url: "/users/search", method: "POST", body: searchParams }) })'
        }],
        parametersUsed: [
          { name: 'query', type: 'query', locations: [] },
          { name: 'limit', type: 'query', locations: [] },
          { name: 'searchParams', type: 'body', locations: [] }
        ],
        responseHandling: [],
        source: 'rtkquery',
        rtkQuerySpecific: {
          isQuery: false,
          isMutation: true,
          transformResponseUsed: false,
          baseQueryUsed: true
        }
      };

      // エンドポイント解析のモック
      const parseEndpointDefinitionSpy = jest.fn().mockReturnValue(mockEndpoint);
      // @ts-ignore - テスト用にクラスのプライベートメソッドを書き換え
      strategy.apiParser = {
        ...strategy.apiParser,
        parseEndpointDefinition: parseEndpointDefinitionSpy
      };

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(parseEndpointDefinitionSpy).toHaveBeenCalledWith(instance(mockCallExpr), context);
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('/users/search');
      expect(result[0].method).toBe('POST');
      expect(result[0].parametersUsed.length).toBe(3);

      // パラメータ検証
      const queryParams = result[0].parametersUsed.filter(p => p.type === 'query');
      expect(queryParams.length).toBe(2);

      const bodyParams = result[0].parametersUsed.filter(p => p.type === 'body');
      expect(bodyParams.length).toBe(1);
      expect(bodyParams[0].name).toBe('searchParams');
    });

    it('動的パスパラメータを抽出できること', () => {
      // モックのセットアップ - builder.queryの呼び出し
      const mockCallExpr = mock<Node>();
      const mockPropAccess = mock<Node>();
      const mockBuilderExpr = mock<Node>();

      // builder.query呼び出し式のセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockPropAccess));

      when(mockPropAccess.isKind(SyntaxKind.PropertyAccessExpression)).thenReturn(true);
      when(mockPropAccess.getExpression()).thenReturn(instance(mockBuilderExpr));
      when(mockBuilderExpr.getText()).thenReturn('builder');
      when((mockPropAccess as any).getName()).thenReturn('query');

      // 引数のセットアップ (オブジェクトリテラル)
      const mockOptions = mock<Node>();
      when(mockOptions.isKind(SyntaxKind.ObjectLiteralExpression)).thenReturn(true);
      when(mockCallExpr.getArguments()).thenReturn([instance(mockOptions)]);

      // エンドポイント定義の検索のためのモック
      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isEndpointDefinition')
        .mockImplementation((node: any) => {
          return node === instance(mockCallExpr);
        });

      // NodeTraversalのモック
      jest.spyOn(require('../../src/utils/ast/NodeTraversal'), 'findNodes')
        .mockImplementation((sourceFile: any, predicate: any) => {
          if (typeof predicate === 'function') {
            if (predicate === require('../../src/utils/ast/NodePredicates').isCreateApiCallExpression) {
              return [];
            }
            if (predicate(instance(mockCallExpr))) {
              return [instance(mockCallExpr)];
            }
          }
          return [];
        });

      // 型検出器のモック
      // @ts-ignore
      strategy.typeDetector = {
        detectEndpointType: jest.fn().mockReturnValue(EndpointType.Query)
      };

      // モックエンドポイント情報 - 動的パスパラメータを含む
      const mockEndpoint = {
        path: '/users/:id',
        method: 'GET' as HttpMethod,
        isDynamic: true,
        usageLocations: [{
          filePath: sampleFilePath,
          lineNumber: 80,
          columnNumber: 1,
          context: 'apiSlice',
          codeSnippet: 'getUserById: builder.query({ query: (id) => `/users/${id}` })'
        }],
        parametersUsed: [
          { name: 'id', type: 'path', required: true, locations: [] }
        ],
        responseHandling: [],
        source: 'rtkquery',
        rtkQuerySpecific: {
          isQuery: true,
          isMutation: false,
          transformResponseUsed: false,
          baseQueryUsed: true
        }
      };

      // エンドポイント解析のモック
      const parseEndpointDefinitionSpy = jest.fn().mockReturnValue(mockEndpoint);
      // @ts-ignore - テスト用にクラスのプライベートメソッドを書き換え
      strategy.apiParser = {
        ...strategy.apiParser,
        parseEndpointDefinition: parseEndpointDefinitionSpy
      };

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(parseEndpointDefinitionSpy).toHaveBeenCalledWith(instance(mockCallExpr), context);
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('/users/:id');
      expect(result[0].method).toBe('GET');
      expect(result[0].isDynamic).toBe(true);

      // パスパラメータの検証
      expect(result[0].parametersUsed.length).toBe(1);
      expect(result[0].parametersUsed[0].name).toBe('id');
      expect(result[0].parametersUsed[0].type).toBe('path');
      expect(result[0].parametersUsed[0].required).toBe(true);
    });
  });

  describe('型情報を活用した検出', () => {
    it('ジェネリック型情報からレスポンス型を抽出できること', () => {
      // モックのセットアップ
      const mockCallExpr = mock<Node>();
      const mockPropAccess = mock<Node>();
      const mockBuilderExpr = mock<Node>();

      // builder.query呼び出し式のセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockPropAccess));

      when(mockPropAccess.isKind(SyntaxKind.PropertyAccessExpression)).thenReturn(true);
      when(mockPropAccess.getExpression()).thenReturn(instance(mockBuilderExpr));
      when(mockBuilderExpr.getText()).thenReturn('builder');
      when((mockPropAccess as any).getName()).thenReturn('query');

      // 引数のセットアップ（オブジェクトリテラル）
      const mockOptions = mock<Node>();
      when(mockOptions.isKind(SyntaxKind.ObjectLiteralExpression)).thenReturn(true);
      when(mockCallExpr.getArguments()).thenReturn([instance(mockOptions)]);

      // 型検出器のモック
      // @ts-ignore
      strategy.typeDetector = {
        detectEndpointType: jest.fn().mockReturnValue(EndpointType.Query),
        detectResponseType: jest.fn().mockReturnValue('User[]')
      };

      // タイプチェッカーのモック
      const mockType = mock<Node>();
      when(mockTypeChecker.getTypeAtLocation(anything())).thenReturn(instance(mockType) as any);

      // エンドポイント定義の検索のためのモック
      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isEndpointDefinition')
        .mockImplementation((node: any) => {
          return node === instance(mockCallExpr);
        });

      // NodeTraversalのモック
      jest.spyOn(require('../../src/utils/ast/NodeTraversal'), 'findNodes')
        .mockImplementation((sourceFile: any, predicate: any) => {
          if (typeof predicate === 'function') {
            if (predicate === require('../../src/utils/ast/NodePredicates').isCreateApiCallExpression) {
              return [];
            }
            if (predicate(instance(mockCallExpr))) {
              return [instance(mockCallExpr)];
            }
          }
          return [];
        });

      // モックエンドポイント情報 - 型情報を含む
      const mockEndpoint = {
        path: '/api/users',
        method: 'GET' as HttpMethod,
        isDynamic: false,
        usageLocations: [{
          filePath: sampleFilePath,
          lineNumber: 90,
          columnNumber: 1,
          context: 'apiSlice',
          codeSnippet: 'getUsers: builder.query<User[], void>({ query: () => "/api/users" })'
        }],
        parametersUsed: [],
        responseHandling: [{
          type: 'typed',
          typeName: 'User[]',
          location: {
            filePath: sampleFilePath,
            lineNumber: 90,
            columnNumber: 1
          }
        }],
        source: 'rtkquery',
        rtkQuerySpecific: {
          isQuery: true,
          isMutation: false,
          transformResponseUsed: false,
          baseQueryUsed: true
        }
      };

      // エンドポイント解析のモック
      const parseEndpointDefinitionSpy = jest.fn().mockReturnValue(mockEndpoint);
      // @ts-ignore - テスト用にクラスのプライベートメソッドを書き換え
      strategy.apiParser = {
        ...strategy.apiParser,
        parseEndpointDefinition: parseEndpointDefinitionSpy
      };

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(parseEndpointDefinitionSpy).toHaveBeenCalledWith(instance(mockCallExpr), context);
      expect(result.length).toBe(1);
      expect(result[0].responseHandling[0].type).toBe('typed');
      expect(result[0].responseHandling[0].typeName).toBe('User[]');
    });

    it('transformResponse使用を検出できること', () => {
      // モックのセットアップ
      const mockCallExpr = mock<Node>();
      const mockPropAccess = mock<Node>();
      const mockBuilderExpr = mock<Node>();

      // builder.query呼び出し式のセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockPropAccess));

      when(mockPropAccess.isKind(SyntaxKind.PropertyAccessExpression)).thenReturn(true);
      when(mockPropAccess.getExpression()).thenReturn(instance(mockBuilderExpr));
      when(mockBuilderExpr.getText()).thenReturn('builder');
      when((mockPropAccess as any).getName()).thenReturn('query');

      // 引数のセットアップ（オブジェクトリテラル）
      const mockOptions = mock<Node>();
      when(mockOptions.isKind(SyntaxKind.ObjectLiteralExpression)).thenReturn(true);
      when(mockCallExpr.getArguments()).thenReturn([instance(mockOptions)]);

      // transformResponseプロパティの設定
      const mockTransformResponseProp = mock<Node>();
      when(mockTransformResponseProp.isKind(SyntaxKind.PropertyAssignment)).thenReturn(true);
      when((mockTransformResponseProp as any).getName()).thenReturn('transformResponse');

      // NodeExtractorsExtendedのモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractPropertyValue')
        .mockImplementation((node: any, propName: string) => {
          if (propName === 'transformResponse' && node === instance(mockOptions)) {
            return instance(mockTransformResponseProp);
          }
          return null;
        });

      // エンドポイント定義の検索のためのモック
      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isEndpointDefinition')
        .mockImplementation((node: any) => {
          return node === instance(mockCallExpr);
        });

      // NodeTraversalのモック
      jest.spyOn(require('../../src/utils/ast/NodeTraversal'), 'findNodes')
        .mockImplementation((sourceFile: any, predicate: any) => {
          if (typeof predicate === 'function') {
            if (predicate === require('../../src/utils/ast/NodePredicates').isCreateApiCallExpression) {
              return [];
            }
            if (predicate(instance(mockCallExpr))) {
              return [instance(mockCallExpr)];
            }
          }
          return [];
        });

      // 型検出器のモック
      // @ts-ignore
      strategy.typeDetector = {
        detectEndpointType: jest.fn().mockReturnValue(EndpointType.Query)
      };

      // モックエンドポイント情報 - transformResponse使用を含む
      const mockEndpoint = {
        path: '/api/users',
        method: 'GET' as HttpMethod,
        isDynamic: false,
        usageLocations: [{
          filePath: sampleFilePath,
          lineNumber: 100,
          columnNumber: 1,
          context: 'apiSlice',
          codeSnippet: 'getUsers: builder.query({ query: () => "/api/users", transformResponse: (response) => response.data })'
        }],
        parametersUsed: [],
        responseHandling: [{
          type: 'transformation',
          location: {
            filePath: sampleFilePath,
            lineNumber: 100,
            columnNumber: 1
          }
        }],
        source: 'rtkquery',
        rtkQuerySpecific: {
          isQuery: true,
          isMutation: false,
          transformResponseUsed: true,
          baseQueryUsed: true
        }
      };

      // エンドポイント解析のモック
      const parseEndpointDefinitionSpy = jest.fn().mockReturnValue(mockEndpoint);
      // @ts-ignore - テスト用にクラスのプライベートメソッドを書き換え
      strategy.apiParser = {
        ...strategy.apiParser,
        parseEndpointDefinition: parseEndpointDefinitionSpy
      };

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(parseEndpointDefinitionSpy).toHaveBeenCalledWith(instance(mockCallExpr), context);
      expect(result.length).toBe(1);
      expect(result[0].responseHandling[0].type).toBe('transformation');
      expect(result[0].rtkQuerySpecific.transformResponseUsed).toBe(true);
    });
  });

  describe('エンドポイント種別の分類', () => {
    it('クエリとミューテーションを正しく分類できること', () => {
      // モックのセットアップ
      const mockQueryCallExpr = mock<Node>();
      const mockQueryPropAccess = mock<Node>();
      const mockMutationCallExpr = mock<Node>();
      const mockMutationPropAccess = mock<Node>();
      const mockBuilderExpr = mock<Node>();

      // builder.query呼び出し式のセットアップ
      when(mockQueryCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockQueryCallExpr.getExpression()).thenReturn(instance(mockQueryPropAccess));
      when(mockQueryPropAccess.isKind(SyntaxKind.PropertyAccessExpression)).thenReturn(true);
      when(mockQueryPropAccess.getExpression()).thenReturn(instance(mockBuilderExpr));
      when(mockBuilderExpr.getText()).thenReturn('builder');
      when((mockQueryPropAccess as any).getName()).thenReturn('query');

      // builder.mutation呼び出し式のセットアップ
      when(mockMutationCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockMutationCallExpr.getExpression()).thenReturn(instance(mockMutationPropAccess));
      when(mockMutationPropAccess.isKind(SyntaxKind.PropertyAccessExpression)).thenReturn(true);
      when(mockMutationPropAccess.getExpression()).thenReturn(instance(mockBuilderExpr));
      when((mockMutationPropAccess as any).getName()).thenReturn('mutation');

      // 引数のセットアップ
      const mockOptions = mock<Node>();
      when(mockOptions.isKind(SyntaxKind.ObjectLiteralExpression)).thenReturn(true);
      when(mockQueryCallExpr.getArguments()).thenReturn([instance(mockOptions)]);
      when(mockMutationCallExpr.getArguments()).thenReturn([instance(mockOptions)]);

      // エンドポイント定義の検索のためのモック
      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isEndpointDefinition')
        .mockImplementation((node: any) => {
          return node === instance(mockQueryCallExpr) || node === instance(mockMutationCallExpr);
        });

      // NodeTraversalのモック
      jest.spyOn(require('../../src/utils/ast/NodeTraversal'), 'findNodes')
        .mockImplementation((sourceFile: any, predicate: any) => {
          if (typeof predicate === 'function') {
            if (predicate === require('../../src/utils/ast/NodePredicates').isCreateApiCallExpression) {
              return [];
            }

            const result = [];
            if (predicate(instance(mockQueryCallExpr))) {
              result.push(instance(mockQueryCallExpr));
            }
            if (predicate(instance(mockMutationCallExpr))) {
              result.push(instance(mockMutationCallExpr));
            }
            return result;
          }
          return [];
        });

      // 型検出器のモック
      // @ts-ignore
      strategy.typeDetector = {
        detectEndpointType: jest.fn((node) => {
          if (node === instance(mockQueryCallExpr)) {
            return EndpointType.Query;
          }
          if (node === instance(mockMutationCallExpr)) {
            return EndpointType.Mutation;
          }
          return null;
        })
      };

      // モックエンドポイント情報 - Query
      const mockQueryEndpoint = {
        path: '/api/users',
        method: 'GET' as HttpMethod,
        isDynamic: false,
        usageLocations: [{
          filePath: sampleFilePath,
          lineNumber: 110,
          columnNumber: 1,
          context: 'apiSlice',
          codeSnippet: 'getUsers: builder.query({ query: () => "/api/users" })'
        }],
        parametersUsed: [],
        responseHandling: [],
        source: 'rtkquery',
        rtkQuerySpecific: {
          isQuery: true,
          isMutation: false,
          transformResponseUsed: false,
          baseQueryUsed: true
        }
      };

      // モックエンドポイント情報 - Mutation
      const mockMutationEndpoint = {
        path: '/api/users',
        method: 'POST' as HttpMethod,
        isDynamic: false,
        usageLocations: [{
          filePath: sampleFilePath,
          lineNumber: 120,
          columnNumber: 1,
          context: 'apiSlice',
          codeSnippet: 'createUser: builder.mutation({ query: (user) => ({ url: "/api/users", method: "POST", body: user }) })'
        }],
        parametersUsed: [{
          name: 'user',
          type: 'body',
          locations: [{
            filePath: sampleFilePath,
            lineNumber: 120,
            columnNumber: 1
          }]
        }],
        responseHandling: [],
        source: 'rtkquery',
        rtkQuerySpecific: {
          isQuery: false,
          isMutation: true,
          transformResponseUsed: false,
          baseQueryUsed: true
        }
      };

      // エンドポイント解析のモック
      const parseEndpointDefinitionSpy = jest.fn((node, context) => {
        if (node === instance(mockQueryCallExpr)) {
          return mockQueryEndpoint;
        }
        if (node === instance(mockMutationCallExpr)) {
          return mockMutationEndpoint;
        }
        return null;
      });

      // @ts-ignore - テスト用にクラスのプライベートメソッドを書き換え
      strategy.apiParser = {
        ...strategy.apiParser,
        parseEndpointDefinition: parseEndpointDefinitionSpy
      };

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockQueryCallExpr), instance(mockMutationCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(parseEndpointDefinitionSpy).toHaveBeenCalledTimes(2);
      expect(result.length).toBe(2);

      // GETリクエスト（クエリ）の検証
      const getRequest = result.find(r => r.method === 'GET');
      expect(getRequest).toBeDefined();
      expect(getRequest?.rtkQuerySpecific.isQuery).toBe(true);
      expect(getRequest?.rtkQuerySpecific.isMutation).toBe(false);

      // POSTリクエスト（ミューテーション）の検証
      const postRequest = result.find(r => r.method === 'POST');
      expect(postRequest).toBeDefined();
      expect(postRequest?.rtkQuerySpecific.isQuery).toBe(false);
      expect(postRequest?.rtkQuerySpecific.isMutation).toBe(true);
    });
  });

  describe('統合テスト', () => {
    it('複数のエンドポイントを検出して結果を統合できること', () => {
      // createApi呼び出しをモック
      const mockCreateApiCall = mock<Node>();
      const mockCreateApiExpr = mock<Node>();

      when(mockCreateApiCall.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCreateApiCall.getExpression()).thenReturn(instance(mockCreateApiExpr));
      when(mockCreateApiExpr.getText()).thenReturn('createApi');

      // builder.query呼び出しをモック
      const mockQueryCall = mock<Node>();
      const mockQueryExpr = mock<Node>();

      when(mockQueryCall.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockQueryCall.getExpression()).thenReturn(instance(mockQueryExpr));

      // useQuery呼び出しをモック
      const mockUseQueryCall = mock<CallExpression>();
      const mockUseQueryExpr = mock<Node>();

      when(mockUseQueryCall.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockUseQueryCall.getExpression()).thenReturn(instance(mockUseQueryExpr));
      when(mockUseQueryExpr.getText()).thenReturn('useGetUsersQuery');

      // NodePredicatesのモック
      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isCreateApiCallExpression')
        .mockImplementation((node: any) => {
          return node === instance(mockCreateApiCall);
        });

      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isEndpointDefinition')
        .mockImplementation((node: any) => {
          return node === instance(mockQueryCall);
        });

      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isRtkQueryHookUsage')
        .mockImplementation((node: any) => {
          return node === instance(mockUseQueryCall);
        });

      // NodeTraversalのモック
      jest.spyOn(require('../../src/utils/ast/NodeTraversal'), 'findNodes')
        .mockImplementation((sourceFile: any, predicate: any) => {
          if (typeof predicate === 'function') {
            if (predicate === require('../../src/utils/ast/NodePredicates').isCreateApiCallExpression) {
              return [instance(mockCreateApiCall)];
            }
            if (predicate === require('../../src/utils/ast/NodePredicates').isEndpointDefinition) {
              return [instance(mockQueryCall)];
            }
            if (predicate === require('../../src/utils/ast/NodePredicates').isRtkQueryHookUsage) {
              return [instance(mockUseQueryCall)];
            }
          }
          return [];
        });

      // モックエンドポイント情報
      const endpoints = [
        // createApiから検出したエンドポイント
        {
          path: '/api/users',
          method: 'GET' as HttpMethod,
          isDynamic: false,
          usageLocations: [{
            filePath: sampleFilePath,
            lineNumber: 130,
            columnNumber: 1,
            context: 'apiSlice',
            codeSnippet: 'createApi({ endpoints: (builder) => ({ getUsers: builder.query({ query: () => "/api/users" }) }) })'
          }],
          parametersUsed: [],
          responseHandling: [],
          source: 'rtkquery',
          rtkQuerySpecific: {
            isQuery: true,
            isMutation: false,
            transformResponseUsed: false,
            baseQueryUsed: true
          }
        },
        // builder.queryから検出したエンドポイント
        {
          path: '/api/posts',
          method: 'GET' as HttpMethod,
          isDynamic: false,
          usageLocations: [{
            filePath: sampleFilePath,
            lineNumber: 140,
            columnNumber: 1,
            context: 'apiSlice',
            codeSnippet: 'getPosts: builder.query({ query: () => "/api/posts" })'
          }],
          parametersUsed: [],
          responseHandling: [],
          source: 'rtkquery',
          rtkQuerySpecific: {
            isQuery: true,
            isMutation: false,
            transformResponseUsed: false,
            baseQueryUsed: true
          }
        },
        // useQueryから検出したエンドポイント
        {
          path: '/api/users/:id',
          method: 'GET' as HttpMethod,
          isDynamic: true,
          usageLocations: [{
            filePath: sampleFilePath,
            lineNumber: 150,
            columnNumber: 1,
            context: 'UserDetail',
            codeSnippet: 'const { data: user } = useGetUserQuery(id)'
          }],
          parametersUsed: [{
            name: 'id',
            type: 'path',
            required: true,
            locations: [{
              filePath: sampleFilePath,
              lineNumber: 150,
              columnNumber: 1
            }]
          }],
          responseHandling: [],
          source: 'rtkquery',
          rtkQuerySpecific: {
            isQuery: true,
            isMutation: false,
            transformResponseUsed: false,
            baseQueryUsed: true
          }
        }
      ];

      // 各解析メソッドのモック
      const parseCreateApiCallSpy = jest.fn().mockReturnValue({
        baseUrl: '',
        endpoints: [endpoints[0]]
      });

      const parseEndpointDefinitionSpy = jest.fn().mockReturnValue(endpoints[1]);
      const parseHookUsageSpy = jest.fn().mockReturnValue(endpoints[2]);

      // @ts-ignore - テスト用にクラスのプライベートメソッドを書き換え
      strategy.apiParser = {
        parseCreateApiCall: parseCreateApiCallSpy,
        parseEndpointDefinition: parseEndpointDefinitionSpy,
        parseHookUsage: parseHookUsageSpy
      };

      // 型検出器のモック
      // @ts-ignore
      strategy.typeDetector = {
        detectEndpointType: jest.fn().mockReturnValue(EndpointType.Query)
      };

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([
          instance(mockCreateApiCall),
          instance(mockQueryCall),
          instance(mockUseQueryCall)
        ]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(result.length).toBe(3);

      // 各エンドポイントが検出されていることを確認
      expect(result.find(e => e.path === '/api/users' && !e.isDynamic)).toBeDefined();
      expect(result.find(e => e.path === '/api/posts')).toBeDefined();
      expect(result.find(e => e.path === '/api/users/:id' && e.isDynamic)).toBeDefined();

      // 各解析メソッドが呼ばれたことを確認
      expect(parseCreateApiCallSpy).toHaveBeenCalledWith(instance(mockCreateApiCall), context);
      expect(parseEndpointDefinitionSpy).toHaveBeenCalledWith(instance(mockQueryCall), context);
      expect(parseHookUsageSpy).toHaveBeenCalledWith(instance(mockUseQueryCall), context);
    });

    it('重複するエンドポイントを適切にマージすること', () => {
      // 同じパスを持つ複数のエンドポイントをモック
      const mockCreateApiCall = mock<Node>();
      const mockUseQueryCall = mock<Node>();

      // NodePredicatesのモック
      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isCreateApiCallExpression')
        .mockImplementation((node: any) => {
          return node === instance(mockCreateApiCall);
        });

      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isRtkQueryHookUsage')
        .mockImplementation((node: any) => {
          return node === instance(mockUseQueryCall);
        });

      // NodeTraversalのモック
      jest.spyOn(require('../../src/utils/ast/NodeTraversal'), 'findNodes')
        .mockImplementation((sourceFile: any, predicate: any) => {
          if (typeof predicate === 'function') {
            if (predicate === require('../../src/utils/ast/NodePredicates').isCreateApiCallExpression) {
              return [instance(mockCreateApiCall)];
            }
            if (predicate === require('../../src/utils/ast/NodePredicates').isRtkQueryHookUsage) {
              return [instance(mockUseQueryCall)];
            }
          }
          return [];
        });

      // 重複するエンドポイント情報
      const endpoint1 = {
        path: '/api/users',
        method: 'GET' as HttpMethod,
        isDynamic: false,
        usageLocations: [{
          filePath: sampleFilePath,
          lineNumber: 160,
          columnNumber: 1,
          context: 'apiSlice',
          codeSnippet: 'createApi({ ... })'
        }],
        parametersUsed: [],
        responseHandling: [],
        source: 'rtkquery',
        rtkQuerySpecific: {
          isQuery: true,
          isMutation: false,
          transformResponseUsed: false,
          baseQueryUsed: true
        }
      };

      const endpoint2 = {
        path: '/api/users',
        method: 'GET' as HttpMethod,
        isDynamic: false,
        usageLocations: [{
          filePath: sampleFilePath,
          lineNumber: 170,
          columnNumber: 1,
          context: 'UsersList',
          codeSnippet: 'useGetUsersQuery()'
        }],
        parametersUsed: [],
        responseHandling: [{
          type: 'typed',
          typeName: 'User[]',
          location: {
            filePath: sampleFilePath,
            lineNumber: 170,
            columnNumber: 1
          }
        }],
        source: 'rtkquery',
        rtkQuerySpecific: {
          isQuery: true,
          isMutation: false,
          transformResponseUsed: false,
          baseQueryUsed: true
        }
      };

      // 各解析メソッドのモック
      const parseCreateApiCallSpy = jest.fn().mockReturnValue({
        baseUrl: '',
        endpoints: [endpoint1]
      });

      const parseHookUsageSpy = jest.fn().mockReturnValue(endpoint2);

      // @ts-ignore - テスト用にクラスのプライベートメソッドを書き換え
      strategy.apiParser = {
        parseCreateApiCall: parseCreateApiCallSpy,
        parseHookUsage: parseHookUsageSpy
      };

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([
          instance(mockCreateApiCall),
          instance(mockUseQueryCall)
        ]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(result.length).toBe(1);  // 重複はマージされる

      // マージされたエンドポイントを検証
      const mergedEndpoint = result[0];
      expect(mergedEndpoint.path).toBe('/api/users');
      expect(mergedEndpoint.method).toBe('GET');

      // 使用箇所がマージされていることを確認
      expect(mergedEndpoint.usageLocations.length).toBe(2);
      expect(mergedEndpoint.usageLocations.find(l => l.lineNumber === 160)).toBeDefined();
      expect(mergedEndpoint.usageLocations.find(l => l.lineNumber === 170)).toBeDefined();

      // レスポンス処理情報がマージされていることを確認
      expect(mergedEndpoint.responseHandling.length).toBe(1);
      expect(mergedEndpoint.responseHandling[0].typeName).toBe('User[]');
    });
  });
});
expect(parseCreateApiCallSpy).toHaveBeenCalledWith(instance(mockCallExpr), context);
expect(result.length).toBe(1);
expect(result[0].path).toBe('/users');
expect(result[0].method).toBe('GET');
expect(result[0].rtkQuerySpecific.isQuery).toBe(true);
    });
  });
});
