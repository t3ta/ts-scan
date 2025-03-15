/**
 * FetchDetectionStrategy クラスのユニットテスト
 *
 * Fetch API 検出戦略の各機能を検証します。
 * 様々なFetch APIパターンの検出能力をテストします。
 */

import { mock, instance, when, anything, verify } from 'ts-mockito';
import { SourceFile, TypeChecker, SyntaxKind, Node } from 'ts-morph';
import { adaptMockSourceFileInstance } from '../helpers/mock-adapters';
import { ISourceFile } from '../../src/core/ast/interfaces/ISourceFile';
import { FetchDetectionStrategy } from '../../src/detectors/http/FetchDetectionStrategy';
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

describe('FetchDetectionStrategy', () => {
  // テスト用の共通変数
  let mockSourceFile: SourceFile;
  let mockTypeChecker: TypeChecker;
  let mockServiceLocator: ServiceLocator;
  let mockEndpointBuilder: IEndpointBuilder;
  let strategy: FetchDetectionStrategy;
  let context: DetectionContext;

  // テストサンプルファイル
  const sampleFilePath = path.resolve(__dirname, '../fixtures/fetch-samples.ts');
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
    strategy = new FetchDetectionStrategy();

    // モックのリセット
    jest.clearAllMocks();
  });

  describe('基本機能', () => {
    it('正しい名前と優先度を持つこと', () => {
      expect(strategy.name).toBe('FetchDetectionStrategy');
      expect(strategy.priority).toBe(10);
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

  describe('標準的なfetch関数の検出', () => {
    it('基本的なfetch()呼び出しを検出できること', () => {
      // モックのセットアップ
      const mockCallExpr = mock<Node>();
      const mockExpression = mock<Node>();
      const mockUrlArg = mock<Node>();

      // 呼び出し式の構造をセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockExpression));
      when(mockExpression.getText()).thenReturn('fetch');

      // 引数の設定
      when(mockCallExpr.getArguments()).thenReturn([instance(mockUrlArg)]);
      when(mockUrlArg.getText()).thenReturn('"https://api.example.com/users"');

      // NodeExtractorsExtendedのextractStringValueをモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractStringValue')
        .mockImplementation((node: any) => {
          if (node === instance(mockUrlArg)) {
            return 'https://api.example.com/users';
          }
          return '';
        });

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('https://api.example.com/users');
      expect(result[0].method).toBe('GET');
      expect(result[0].source).toBe('fetch');
    });

    it('window.fetch()呼び出しを検出できること', () => {
      // モックのセットアップ
      const mockCallExpr = mock<Node>();
      const mockPropertyAccess = mock<Node>();
      const mockObjectExpr = mock<Node>();
      const mockUrlArg = mock<Node>();

      // 呼び出し式の構造をセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockPropertyAccess));

      when(mockPropertyAccess.isKind(SyntaxKind.PropertyAccessExpression)).thenReturn(true);
      when(mockPropertyAccess.getExpression()).thenReturn(instance(mockObjectExpr));
      when(mockObjectExpr.getText()).thenReturn('window');
      when(mockPropertyAccess.getText()).thenReturn('window.fetch');
      // PropertyAccessExpressionのgetName()をモック
      when((mockPropertyAccess as any).getName()).thenReturn('fetch');

      // 引数の設定
      when(mockCallExpr.getArguments()).thenReturn([instance(mockUrlArg)]);
      when(mockUrlArg.getText()).thenReturn('"https://api.example.com/products"');

      // NodeExtractorsExtendedのextractStringValueをモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractStringValue')
        .mockImplementation((node: any) => {
          if (node === instance(mockUrlArg)) {
            return 'https://api.example.com/products';
          }
          return '';
        });

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('https://api.example.com/products');
      expect(result[0].method).toBe('GET');
      expect(result[0].source).toBe('fetch');
    });

    it('オプション付きのfetch呼び出しを検出できること', () => {
      // モックのセットアップ
      const mockCallExpr = mock<Node>();
      const mockExpression = mock<Node>();
      const mockUrlArg = mock<Node>();
      const mockOptionsArg = mock<Node>();
      const mockMethodValue = mock<Node>();

      // 呼び出し式の構造をセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockExpression));
      when(mockExpression.getText()).thenReturn('fetch');

      // 引数の設定
      when(mockCallExpr.getArguments()).thenReturn([instance(mockUrlArg), instance(mockOptionsArg)]);
      when(mockUrlArg.getText()).thenReturn('"https://api.example.com/users"');
      when(mockOptionsArg.isKind(SyntaxKind.ObjectLiteralExpression)).thenReturn(true);

      // NodeExtractorsExtendedのモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractPropertyValue')
        .mockImplementation((node: any, propName: string) => {
          if (propName === 'method') {
            return instance(mockMethodValue);
          }
          return null;
        });

      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractStringValue')
        .mockImplementation((node: any) => {
          if (node === instance(mockUrlArg)) {
            return 'https://api.example.com/users';
          }
          if (node === instance(mockMethodValue)) {
            return 'POST';
          }
          return '';
        });

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('https://api.example.com/users');
      expect(result[0].method).toBe('POST');
      expect(result[0].source).toBe('fetch');
    });

    it('カスタムフェッチラッパー関数を検出できること', () => {
      // モックのセットアップ
      const mockCallExpr = mock<Node>();
      const mockExpression = mock<Node>();
      const mockUrlArg = mock<Node>();

      // 呼び出し式の構造をセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockExpression));
      when(mockExpression.getText()).thenReturn('fetchData');  // カスタムラッパー関数名

      // 引数の設定
      when(mockCallExpr.getArguments()).thenReturn([instance(mockUrlArg)]);
      when(mockUrlArg.getText()).thenReturn('"https://api.example.com/data"');

      // NodeExtractorsExtendedのextractStringValueをモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractStringValue')
        .mockImplementation((node: any) => {
          if (node === instance(mockUrlArg)) {
            return 'https://api.example.com/data';
          }
          return '';
        });

      // MethodInferenceのモック
      jest.spyOn(require('../../src/utils/http/MethodInference'), 'inferMethodFromName')
        .mockImplementation((name: string) => {
          return 'GET';
        });

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('https://api.example.com/data');
      expect(result[0].method).toBe('GET');
      expect(result[0].source).toBe('fetch');
    });

    it('名前にHTTPメソッドを含む関数からメソッドを推測できること', () => {
      // モックのセットアップ
      const mockCallExpr = mock<Node>();
      const mockExpression = mock<Node>();
      const mockUrlArg = mock<Node>();

      // 呼び出し式の構造をセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockExpression));
      when(mockExpression.getText()).thenReturn('postData');  // "post"を含む関数名

      // 引数の設定
      when(mockCallExpr.getArguments()).thenReturn([instance(mockUrlArg)]);
      when(mockUrlArg.getText()).thenReturn('"https://api.example.com/create"');

      // NodeExtractorsExtendedのextractStringValueをモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractStringValue')
        .mockImplementation((node: any) => {
          if (node === instance(mockUrlArg)) {
            return 'https://api.example.com/create';
          }
          return '';
        });

      // MethodInferenceのモック
      jest.spyOn(require('../../src/utils/http/MethodInference'), 'inferMethodFromName')
        .mockImplementation((name: string) => {
          // "post"を含む関数名からPOSTメソッドを推測
          if (name.toLowerCase().includes('post')) {
            return 'POST';
          }
          return 'GET';
        });

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('https://api.example.com/create');
      expect(result[0].method).toBe('POST');  // 関数名から推測されたメソッド
      expect(result[0].source).toBe('fetch');
    });
  });

  describe('レスポンス処理パターンの検出', () => {
    it('thenチェーンのレスポンス処理を検出できること', () => {
      // モックのセットアップ
      const mockCallExpr = mock<Node>();
      const mockExpression = mock<Node>();
      const mockUrlArg = mock<Node>();
      const mockThenMethod = mock<Node>();
      const mockCallback = mock<Node>();

      // fetch呼び出し式の構造をセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockExpression));
      when(mockExpression.getText()).thenReturn('fetch');

      // 引数の設定
      when(mockCallExpr.getArguments()).thenReturn([instance(mockUrlArg)]);
      when(mockUrlArg.getText()).thenReturn('"https://api.example.com/users"');

      // thenメソッドチェーンのセットアップ
      when(mockThenMethod.isKind(SyntaxKind.PropertyAccessExpression)).thenReturn(true);
      when((mockThenMethod as any).getName()).thenReturn('then');
      when(mockThenMethod.getExpression()).thenReturn(instance(mockCallExpr));

      when(mockThenMethod.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockThenMethod.getArguments()).thenReturn([instance(mockCallback)]);

      // NodeExtractorsExtendedのモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractStringValue')
        .mockImplementation((node: any) => {
          if (node === instance(mockUrlArg)) {
            return 'https://api.example.com/users';
          }
          return '';
        });

      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'findMethodChain')
        .mockImplementation((node: any) => {
          if (node === instance(mockCallExpr)) {
            return [instance(mockThenMethod)];
          }
          return null;
        });

      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isMethodCall')
        .mockImplementation((node: any, methodName: string) => {
          if (node === instance(mockThenMethod) && methodName === 'then') {
            return true;
          }
          return false;
        });

      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractCallbackBody')
        .mockImplementation((node: any) => {
          if (node === instance(mockCallback)) {
            return instance(mockCallback);
          }
          return null;
        });

      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractTypeAnnotation')
        .mockImplementation((node: any) => {
          return [{
            typeName: 'UserResponse',
            location: { filePath: sampleFilePath, lineNumber: 1, columnNumber: 1 }
          }];
        });

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('https://api.example.com/users');
      expect(result[0].method).toBe('GET');
      expect(result[0].responseHandling.length).toBe(1);
      expect(result[0].responseHandling[0].type).toBe('typed');
      expect(result[0].responseHandling[0].typeName).toBe('UserResponse');
    });

    it('json()メソッド変換を検出できること', () => {
      // モックのセットアップ
      const mockCallExpr = mock<Node>();
      const mockExpression = mock<Node>();
      const mockUrlArg = mock<Node>();
      const mockJsonMethod = mock<Node>();
      const mockThenMethod = mock<Node>();

      // fetch呼び出し式の構造をセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockExpression));
      when(mockExpression.getText()).thenReturn('fetch');

      // 引数の設定
      when(mockCallExpr.getArguments()).thenReturn([instance(mockUrlArg)]);
      when(mockUrlArg.getText()).thenReturn('"https://api.example.com/data"');

      // メソッドチェーンのセットアップ
      // fetch().then(response => response.json()).then(data => console.log(data))
      when(mockJsonMethod.isKind(SyntaxKind.PropertyAccessExpression)).thenReturn(true);
      when((mockJsonMethod as any).getName()).thenReturn('json');

      when(mockThenMethod.isKind(SyntaxKind.PropertyAccessExpression)).thenReturn(true);
      when((mockThenMethod as any).getName()).thenReturn('then');

      // NodeExtractorsExtendedのモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractStringValue')
        .mockImplementation((node: any) => {
          if (node === instance(mockUrlArg)) {
            return 'https://api.example.com/data';
          }
          return '';
        });

      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'findMethodChain')
        .mockImplementation((node: any) => {
          if (node === instance(mockCallExpr)) {
            return [instance(mockJsonMethod), instance(mockThenMethod)];
          }
          return null;
        });

      jest.spyOn(require('../../src/utils/ast/NodePredicates'), 'isMethodCall')
        .mockImplementation((node: any, methodName: string) => {
          if (node === instance(mockJsonMethod) && methodName === 'json') {
            return true;
          }
          if (node === instance(mockThenMethod) && methodName === 'then') {
            return true;
          }
          return false;
        });

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('https://api.example.com/data');
      expect(result[0].method).toBe('GET');
      expect(result[0].responseHandling.length).toBe(1);
      expect(result[0].responseHandling[0].type).toBe('transformation');
    });

    it('async/await処理パターンを検出できること', () => {
      // モックのセットアップ
      const mockCallExpr = mock<Node>();
      const mockExpression = mock<Node>();
      const mockUrlArg = mock<Node>();
      const mockAwaitExpr = mock<Node>();

      // fetch呼び出し式の構造をセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockExpression));
      when(mockExpression.getText()).thenReturn('fetch');

      // 引数の設定
      when(mockCallExpr.getArguments()).thenReturn([instance(mockUrlArg)]);
      when(mockUrlArg.getText()).thenReturn('"https://api.example.com/async-data"');

      // await式のセットアップ
      when(mockAwaitExpr.isKind(SyntaxKind.AwaitExpression)).thenReturn(true);
      when(mockAwaitExpr.getExpression()).thenReturn(instance(mockCallExpr));

      // NodeExtractorsExtendedのモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractStringValue')
        .mockImplementation((node: any) => {
          if (node === instance(mockUrlArg)) {
            return 'https://api.example.com/async-data';
          }
          return '';
        });

      // findMethodChainはnullを返すようにモック（awaitパターンでは呼ばれても結果がない）
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'findMethodChain')
        .mockImplementation((node: any) => {
          return null;
        });

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('https://api.example.com/async-data');
      expect(result[0].method).toBe('GET');
      // async/awaitパターンでは未知のレスポンス処理として検出
      expect(result[0].responseHandling.length).toBe(1);
      expect(result[0].responseHandling[0].type).toBe('unknown');
    });
  });

  describe('パラメータ抽出', () => {
    it('URLからクエリパラメータを抽出できること', () => {
      // モックのセットアップ
      const mockCallExpr = mock<Node>();
      const mockExpression = mock<Node>();
      const mockUrlArg = mock<Node>();

      // 呼び出し式の構造をセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockExpression));
      when(mockExpression.getText()).thenReturn('fetch');

      // クエリパラメータ付きURL
      const urlWithQuery = 'https://api.example.com/search?query=test&limit=10&sort=desc';

      // 引数の設定
      when(mockCallExpr.getArguments()).thenReturn([instance(mockUrlArg)]);
      when(mockUrlArg.getText()).thenReturn(`"${urlWithQuery}"`);

      // NodeExtractorsExtendedのモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractStringValue')
        .mockImplementation((node: any) => {
          if (node === instance(mockUrlArg)) {
            return urlWithQuery;
          }
          return '';
        });

      // extractQueryParametersのモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractQueryParameters')
        .mockImplementation((url: string) => {
          if (url === urlWithQuery) {
            return ['query', 'limit', 'sort'];
          }
          return [];
        });

      // パスパラメータは存在しないことを確認
      jest.spyOn(require('../../src/utils/ast/NodeExtractors'), 'extractPathParameters')
        .mockImplementation((url: string) => {
          return [];
        });

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(result.length).toBe(1);
      expect(result[0].path).toBe(urlWithQuery);
      expect(result[0].method).toBe('GET');

      // パラメータの検証
      const params = result[0].parametersUsed;
      expect(params.length).toBe(3);

      // クエリパラメータの確認
      const queryParams = params.filter(p => p.type === 'query');
      expect(queryParams.length).toBe(3);

      const paramNames = queryParams.map(p => p.name);
      expect(paramNames).toContain('query');
      expect(paramNames).toContain('limit');
      expect(paramNames).toContain('sort');
    });

    it('URLからパスパラメータを抽出できること', () => {
      // モックのセットアップ
      const mockCallExpr = mock<Node>();
      const mockExpression = mock<Node>();
      const mockUrlArg = mock<Node>();

      // 呼び出し式の構造をセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockExpression));
      when(mockExpression.getText()).thenReturn('fetch');

      // パスパラメータを含むURL
      const urlWithPathParam = 'https://api.example.com/users/:userId/profile';

      // 引数の設定
      when(mockCallExpr.getArguments()).thenReturn([instance(mockUrlArg)]);
      when(mockUrlArg.getText()).thenReturn(`"${urlWithPathParam}"`);

      // NodeExtractorsExtendedのモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractStringValue')
        .mockImplementation((node: any) => {
          if (node === instance(mockUrlArg)) {
            return urlWithPathParam;
          }
          return '';
        });

      // extractQueryParametersのモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractQueryParameters')
        .mockImplementation((url: string) => {
          return [];
        });

      // extractPathParametersのモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractors'), 'extractPathParameters')
        .mockImplementation((url: string) => {
          if (url === urlWithPathParam) {
            return ['userId'];
          }
          return [];
        });

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(result.length).toBe(1);
      expect(result[0].path).toBe(urlWithPathParam);
      expect(result[0].method).toBe('GET');
      expect(result[0].isDynamic).toBe(true);

      // パラメータの検証
      const params = result[0].parametersUsed;
      expect(params.length).toBe(1);

      // パスパラメータの確認
      const pathParams = params.filter(p => p.type === 'path');
      expect(pathParams.length).toBe(1);
      expect(pathParams[0].name).toBe('userId');
      expect(pathParams[0].required).toBe(true);
    });

    it('リクエストボディからパラメータを抽出できること', () => {
      // モックのセットアップ
      const mockCallExpr = mock<Node>();
      const mockExpression = mock<Node>();
      const mockUrlArg = mock<Node>();
      const mockOptionsArg = mock<Node>();
      const mockMethodValue = mock<Node>();
      const mockBodyValue = mock<Node>();

      // 呼び出し式の構造をセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockExpression));
      when(mockExpression.getText()).thenReturn('fetch');

      // 引数の設定
      when(mockCallExpr.getArguments()).thenReturn([instance(mockUrlArg), instance(mockOptionsArg)]);
      when(mockUrlArg.getText()).thenReturn('"https://api.example.com/users"');
      when(mockOptionsArg.isKind(SyntaxKind.ObjectLiteralExpression)).thenReturn(true);

      // NodeExtractorsExtendedのモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractPropertyValue')
        .mockImplementation((node: any, propName: string) => {
          if (propName === 'method') {
            return instance(mockMethodValue);
          }
          if (propName === 'body') {
            return instance(mockBodyValue);
          }
          return null;
        });

      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractStringValue')
        .mockImplementation((node: any) => {
          if (node === instance(mockUrlArg)) {
            return 'https://api.example.com/users';
          }
          if (node === instance(mockMethodValue)) {
            return 'POST';
          }
          return '';
        });

      // NodeExtractorsExtendedのextractObjectPropertiesをモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractObjectProperties')
        .mockImplementation((node: any) => {
          if (node === instance(mockBodyValue)) {
            return [
              { name: 'name', value: '"John Doe"' },
              { name: 'email', value: '"john@example.com"' },
              { name: 'age', value: '30' }
            ];
          }
          return [];
        });

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // ボディオブジェクトのモック
      when(mockBodyValue.isKind(SyntaxKind.ObjectLiteralExpression)).thenReturn(true);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('https://api.example.com/users');
      expect(result[0].method).toBe('POST');

      // ボディパラメータの検証
      const params = result[0].parametersUsed;
      expect(params.length).toBe(3);

      // ボディパラメータの確認
      const bodyParams = params.filter(p => p.type === 'body');
      expect(bodyParams.length).toBe(3);

      const bodyParamNames = bodyParams.map(p => p.name);
      expect(bodyParamNames).toContain('name');
      expect(bodyParamNames).toContain('email');
      expect(bodyParamNames).toContain('age');
    });

    it('ヘッダーからパラメータを抽出できること', () => {
      // モックのセットアップ
      const mockCallExpr = mock<Node>();
      const mockExpression = mock<Node>();
      const mockUrlArg = mock<Node>();
      const mockOptionsArg = mock<Node>();
      const mockHeadersValue = mock<Node>();

      // 呼び出し式の構造をセットアップ
      when(mockCallExpr.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr.getExpression()).thenReturn(instance(mockExpression));
      when(mockExpression.getText()).thenReturn('fetch');

      // 引数の設定
      when(mockCallExpr.getArguments()).thenReturn([instance(mockUrlArg), instance(mockOptionsArg)]);
      when(mockUrlArg.getText()).thenReturn('"https://api.example.com/secure-data"');
      when(mockOptionsArg.isKind(SyntaxKind.ObjectLiteralExpression)).thenReturn(true);

      // NodeExtractorsExtendedのモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractPropertyValue')
        .mockImplementation((node: any, propName: string) => {
          if (propName === 'headers') {
            return instance(mockHeadersValue);
          }
          return null;
        });

      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractStringValue')
        .mockImplementation((node: any) => {
          if (node === instance(mockUrlArg)) {
            return 'https://api.example.com/secure-data';
          }
          return '';
        });

      // NodeExtractorsExtendedのextractObjectPropertiesをモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractObjectProperties')
        .mockImplementation((node: any) => {
          if (node === instance(mockHeadersValue)) {
            return [
              { name: 'Authorization', value: '"Bearer token123"' },
              { name: 'Content-Type', value: '"application/json"' },
              { name: 'Accept', value: '"application/json"' }
            ];
          }
          return [];
        });

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr)]);

      // ヘッダーオブジェクトのモック
      when(mockHeadersValue.isKind(SyntaxKind.ObjectLiteralExpression)).thenReturn(true);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('https://api.example.com/secure-data');
      expect(result[0].method).toBe('GET');

      // ヘッダーパラメータの検証
      const params = result[0].parametersUsed;
      expect(params.length).toBe(3);

      // ヘッダーパラメータの確認
      const headerParams = params.filter(p => p.type === 'header');
      expect(headerParams.length).toBe(3);

      const headerParamNames = headerParams.map(p => p.name);
      expect(headerParamNames).toContain('Authorization');
      expect(headerParamNames).toContain('Content-Type');
      expect(headerParamNames).toContain('Accept');
    });
  });

  describe('複合パターンの検出', () => {
    it('複数のエンドポイントを検出してマージできること', () => {
      // モックのセットアップ - 2つの異なるfetch呼び出し
      const mockCallExpr1 = mock<Node>();
      const mockExpression1 = mock<Node>();
      const mockUrlArg1 = mock<Node>();

      const mockCallExpr2 = mock<Node>();
      const mockExpression2 = mock<Node>();
      const mockUrlArg2 = mock<Node>();
      const mockOptionsArg2 = mock<Node>();
      const mockMethodValue2 = mock<Node>();

      // 1つ目の呼び出し式のセットアップ
      when(mockCallExpr1.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr1.getExpression()).thenReturn(instance(mockExpression1));
      when(mockExpression1.getText()).thenReturn('fetch');

      when(mockCallExpr1.getArguments()).thenReturn([instance(mockUrlArg1)]);
      when(mockUrlArg1.getText()).thenReturn('"https://api.example.com/users"');

      // 2つ目の呼び出し式のセットアップ
      when(mockCallExpr2.isKind(SyntaxKind.CallExpression)).thenReturn(true);
      when(mockCallExpr2.getExpression()).thenReturn(instance(mockExpression2));
      when(mockExpression2.getText()).thenReturn('fetch');

      when(mockCallExpr2.getArguments()).thenReturn([instance(mockUrlArg2), instance(mockOptionsArg2)]);
      when(mockUrlArg2.getText()).thenReturn('"https://api.example.com/users"');
      when(mockOptionsArg2.isKind(SyntaxKind.ObjectLiteralExpression)).thenReturn(true);

      // NodeExtractorsExtendedのモック
      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractPropertyValue')
        .mockImplementation((node: any, propName: string) => {
          if (propName === 'method' && node === instance(mockOptionsArg2)) {
            return instance(mockMethodValue2);
          }
          return null;
        });

      jest.spyOn(require('../../src/utils/ast/NodeExtractorsExtended'), 'extractStringValue')
        .mockImplementation((node: any) => {
          if (node === instance(mockUrlArg1)) {
            return 'https://api.example.com/users';
          }
          if (node === instance(mockUrlArg2)) {
            return 'https://api.example.com/users';
          }
          if (node === instance(mockMethodValue2)) {
            return 'POST';
          }
          return '';
        });

      // ソースファイルの設定
      when(mockSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression))
        .thenReturn([instance(mockCallExpr1), instance(mockCallExpr2)]);

      // テスト実行
      const result = strategy.detect(adaptMockSourceFileInstance(mockSourceFile), context);

      // 検証
      expect(result.length).toBe(2);

      // GETリクエストの検証
      const getRequest = result.find(r => r.method === 'GET');
      expect(getRequest).toBeDefined();
      expect(getRequest?.path).toBe('https://api.example.com/users');

      // POSTリクエストの検証
      const postRequest = result.find(r => r.method === 'POST');
      expect(postRequest).toBeDefined();
      expect(postRequest?.path).toBe('https://api.example.com/users');
    });
  });
});
