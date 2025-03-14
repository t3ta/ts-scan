/**
 * レポーターモジュール統合テスト
 * 
 * @description
 * レポーターモジュール全体の連携動作を検証するための統合テスト。
 * 実際のデータを使用し、各レポーターの出力連携を検証します。
 */

import * as fs from 'fs';
import * as path from 'path';
import { JsonReporter } from '../../src/reporters/JsonReporter';
import { MarkdownReporter } from '../../src/reporters/markdown/MarkdownReporter';
import { AnalysisResult, EndpointInfo, HttpMethod, EndpointSource } from '../../src/types';

// fs関連関数のモック化
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));

// path関連関数のモック化
jest.mock('path', () => {
  const originalPath = jest.requireActual('path');
  return {
    ...originalPath,
    dirname: jest.fn().mockReturnValue('/mock/output/dir'),
    basename: jest.fn().mockReturnValue('target-dir'),
    relative: jest.fn().mockImplementation((from, to) => 'relative/path')
  };
});

// fsヘルパーのモック化
jest.mock('../../src/utils/fs-helper', () => ({
  ensureDirectoryExists: jest.fn().mockReturnValue(true)
}));

// 実際のジェネレーターを使用するため、モック化しない

describe('Reporters Integration', () => {
  let jsonReporter: JsonReporter;
  let markdownReporter: MarkdownReporter;
  let mockResult: AnalysisResult;
  
  beforeEach(() => {
    // テスト実行前に各モックをリセット
    jest.clearAllMocks();
    
    // レポーターインスタンスを作成
    jsonReporter = new JsonReporter();
    markdownReporter = new MarkdownReporter();
    
    // 詳細なモック解析結果データを作成
    mockResult = createDetailedMockResult();
  });
  
  describe('両レポーターの連携動作', () => {
    it('同じ解析結果から両方のフォーマットでレポートを生成できる', async () => {
      // Arrange
      const jsonPath = './output/integration-test.json';
      const markdownPath = './output/integration-test.md';
      
      // Act
      const jsonResult = await jsonReporter.generateReport(mockResult, jsonPath);
      const markdownResult = await markdownReporter.generateReport(mockResult, markdownPath);
      
      // Assert
      expect(jsonResult).toBe(true);
      expect(markdownResult).toBe(true);
      
      // 両方のレポーターが正しくファイル出力を呼び出したことを確認
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
      
      // 引数検証（JSON出力）
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        jsonPath,
        expect.any(String),
        'utf8'
      );
      
      // 引数検証（Markdown出力）
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        markdownPath,
        expect.any(String),
        'utf8'
      );
    });
    
    it('エラーが発生した場合でも両方のレポーターは独立して動作する', async () => {
      // Arrange - fsのwriteFileSyncを選択的にモック
      (fs.writeFileSync as jest.Mock)
        .mockImplementationOnce(() => { throw new Error('JSON書き込みエラー'); }) // 最初の呼び出し（JSON）で失敗
        .mockImplementationOnce(() => {}); // 2回目の呼び出し（Markdown）で成功
      
      // Act
      const jsonResult = await jsonReporter.generateReport(mockResult);
      const markdownResult = await markdownReporter.generateReport(mockResult);
      
      // Assert
      expect(jsonResult).toBe(false); // JSON出力は失敗
      expect(markdownResult).toBe(true); // Markdown出力は成功
    });
    
    it('出力形式の違いを検証する', async () => {
      // Arrange
      let jsonOutput: string = '';
      let markdownOutput: string = '';
      
      (fs.writeFileSync as jest.Mock)
        .mockImplementationOnce((path, data) => { jsonOutput = data; })
        .mockImplementationOnce((path, data) => { markdownOutput = data; });
      
      // Act
      await jsonReporter.generateReport(mockResult);
      await markdownReporter.generateReport(mockResult);
      
      // Assert
      // JSONレポートの検証
      const parsedJson = JSON.parse(jsonOutput);
      expect(parsedJson).toHaveProperty('endpoints');
      expect(parsedJson).toHaveProperty('statistics');
      expect(parsedJson).toHaveProperty('metadata');
      
      // Markdownレポートの検証
      expect(markdownOutput).toContain('# APIエンドポイント解析レポート');
      expect(markdownOutput).not.toBe(jsonOutput); // 異なる形式であることを確認
    });
  });
});

/**
 * 詳細なモック解析結果を作成する
 */
function createDetailedMockResult(): AnalysisResult {
  const timestamp = new Date();
  
  return {
    endpoints: [
      // GETエンドポイント
      {
        path: '/api/users',
        method: 'GET' as HttpMethod,
        isDynamic: false,
        usageLocations: [
          {
            filePath: '/path/to/file.ts',
            lineNumber: 10,
            columnNumber: 5,
            context: 'fetchUsers',
            codeSnippet: 'axios.get("/api/users")'
          }
        ],
        parametersUsed: [
          {
            name: 'limit',
            type: 'query',
            required: false,
            defaultValue: '10',
            locations: [
              {
                filePath: '/path/to/file.ts',
                lineNumber: 12,
                columnNumber: 7,
                context: 'fetchUsers',
                codeSnippet: 'params: { limit }'
              }
            ]
          }
        ],
        responseHandling: [
          {
            type: 'typed',
            typeName: 'User[]',
            location: {
              filePath: '/path/to/response.ts',
              lineNumber: 15,
              columnNumber: 3,
              context: 'handleUsersResponse',
              codeSnippet: 'const users: User[] = response.data;'
            }
          }
        ],
        source: 'axios',
        apiVersion: '1.0',
        featureCategory: 'user-management'
      },
      // POSTエンドポイント
      {
        path: '/api/users',
        method: 'POST' as HttpMethod,
        isDynamic: false,
        usageLocations: [
          {
            filePath: '/path/to/create.ts',
            lineNumber: 20,
            columnNumber: 5,
            context: 'createUser',
            codeSnippet: 'axios.post("/api/users", userData)'
          }
        ],
        parametersUsed: [
          {
            name: 'userData',
            type: 'body',
            required: true,
            locations: [
              {
                filePath: '/path/to/create.ts',
                lineNumber: 22,
                columnNumber: 7,
                context: 'createUser',
                codeSnippet: 'axios.post("/api/users", userData)'
              }
            ]
          }
        ],
        responseHandling: [
          {
            type: 'direct',
            location: {
              filePath: '/path/to/create.ts',
              lineNumber: 25,
              columnNumber: 3,
              context: 'handleCreateResponse',
              codeSnippet: 'return response.data;'
            }
          }
        ],
        source: 'axios',
        apiVersion: '1.0',
        featureCategory: 'user-management'
      },
      // 動的パラメータを含むGETエンドポイント
      {
        path: '/api/users/:id',
        method: 'GET' as HttpMethod,
        isDynamic: true,
        usageLocations: [
          {
            filePath: '/path/to/details.ts',
            lineNumber: 30,
            columnNumber: 5,
            context: 'getUserDetails',
            codeSnippet: 'axios.get(`/api/users/${userId}`)'
          }
        ],
        parametersUsed: [
          {
            name: 'id',
            type: 'path',
            required: true,
            locations: [
              {
                filePath: '/path/to/details.ts',
                lineNumber: 32,
                columnNumber: 7,
                context: 'getUserDetails',
                codeSnippet: '`/api/users/${userId}`'
              }
            ]
          }
        ],
        responseHandling: [
          {
            type: 'transformation',
            location: {
              filePath: '/path/to/details.ts',
              lineNumber: 35,
              columnNumber: 3,
              context: 'handleUserDetailsResponse',
              codeSnippet: 'return { ...response.data, lastAccessed: new Date() };'
            }
          }
        ],
        source: 'axios',
        apiVersion: '1.0',
        featureCategory: 'user-management'
      },
      // RTK Queryエンドポイント
      {
        path: '/api/products',
        method: 'GET' as HttpMethod,
        isDynamic: false,
        usageLocations: [
          {
            filePath: '/path/to/api/productApi.ts',
            lineNumber: 40,
            columnNumber: 5,
            context: 'endpoints.getProducts',
            codeSnippet: 'endpoints.getProducts = builder.query({...})'
          }
        ],
        parametersUsed: [],
        responseHandling: [
          {
            type: 'typed',
            typeName: 'Product[]',
            location: {
              filePath: '/path/to/api/productApi.ts',
              lineNumber: 45,
              columnNumber: 3,
              context: 'transformResponse',
              codeSnippet: 'transformResponse: (response: Product[]) => response'
            }
          }
        ],
        source: 'rtk-query',
        apiVersion: '2.0',
        featureCategory: 'catalog',
        rtkQuerySpecific: {
          isQuery: true,
          isMutation: false,
          transformResponseUsed: true,
          baseQueryUsed: true,
          apiName: 'productApi',
          builderName: 'builder'
        }
      }
    ],
    statistics: {
      totalEndpoints: 4,
      methodDistribution: {
        GET: 3,
        POST: 1
      } as Record<HttpMethod, number>,
      sourceDistribution: {
        'axios': 3,
        'rtk-query': 1,
        'fetch': 0,
        'custom-client': 0,
        'default': 0,
        'v2-endpoint': 0
      } as Record<EndpointSource, number>,
      apiVersionDistribution: {
        '1.0': 3,
        '2.0': 1
      },
      featureCategoryDistribution: {
        'user-management': 3,
        'catalog': 1
      },
      mostUsedEndpoints: [
        { path: '/api/users', count: 2 },
        { path: '/api/users/:id', count: 1 },
        { path: '/api/products', count: 1 }
      ],
      pathParameterUsage: {
        'id': 1
      },
      dynamicEndpoints: 1,
      rtkQueryUsage: {
        totalEndpoints: 1,
        queries: 1,
        mutations: 0,
        transformResponseUsage: 1
      }
    },
    analyzedAt: timestamp,
    configuration: {
      targetDirectory: '/path/to/project',
      filePatterns: ['**/*.ts', '**/*.tsx'],
      ignorePatterns: ['**/node_modules/**'],
      outputJsonPath: './output/result.json',
      outputMarkdownPath: './output/report.md',
      verbose: true
    },
    analyzedFiles: [
      '/path/to/file.ts',
      '/path/to/response.ts',
      '/path/to/create.ts',
      '/path/to/details.ts',
      '/path/to/api/productApi.ts'
    ],
    errors: []
  };
}
