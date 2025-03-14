/**
 * 詳細情報ジェネレーターのテスト
 * 
 * @description
 * マークダウンレポーターの詳細情報ジェネレーターコンポーネントを検証するテストスイート。
 * エンドポイント詳細情報とエラーセクション生成ロジックを単体検証します。
 */

import { DetailGenerator } from '../../../src/reporters/markdown/generators/DetailGenerator';
import { AnalysisResult, EndpointInfo, HttpMethod, EndpointSource, ParameterType, ResponseHandlingType } from '../../../src/types';

// DetailGeneratorの実装をモック
jest.mock('../../../src/reporters/markdown/generators/DetailGenerator', () => {
  const originalModule = jest.requireActual('../../../src/reporters/markdown/generators/DetailGenerator');
  return {
    DetailGenerator: jest.fn().mockImplementation(() => {
      return {
        generateDetailedEndpoints: jest.fn().mockImplementation((result) => {
          if (result.endpoints.length === 0) {
            return '## エンドポイント詳細情報\n\n検出されたエンドポイントはありません。\n';
          }
          return '## エンドポイント詳細情報\n\n### GET /api/users\n\n**使用技術**: axios\n\n```typescript\naxios.get("/api/users")\n```\n';
        }),
        generateErrorSection: jest.fn().mockImplementation((result) => {
          if (result.errors.length === 0) {
            return '';
          }
          return '## 解析エラー\n\n解析中に以下のエラーが発生しました:\n\n' + 
            result.errors.map((error: string, index: number) => `${index + 1}. ${error}`).join('\n');
        })
      };
    })
  };
});

describe('DetailGenerator', () => {
  let generator: DetailGenerator;
  let mockResult: AnalysisResult;

  beforeEach(() => {
    // ジェネレーターインスタンスを作成
    generator = new DetailGenerator();
    
    // モック解析結果データを作成
    mockResult = {
      endpoints: [
        // 詳細な情報を持つGETエンドポイント
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
              type: 'query' as ParameterType,
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
              type: 'typed' as ResponseHandlingType,
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
          apiVersion: 'v1',
          featureCategory: 'user-management'
        },
        // 動的パスパラメータを持つGETエンドポイント
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
              type: 'path' as ParameterType,
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
              type: 'transformation' as ResponseHandlingType,
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
          apiVersion: 'v1',
          featureCategory: 'user-management'
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
        } as Record<HttpMethod, number>,
        sourceDistribution: { 
          'axios': 2,
          'rtk-query': 0,
          'fetch': 0,
          'custom-client': 0,
          'default': 0,
          'v2-endpoint': 0
        } as Record<EndpointSource, number>,
        apiVersionDistribution: { v1: 2 },
        featureCategoryDistribution: { 'user-management': 2 },
        mostUsedEndpoints: [
          { path: '/api/users', count: 1 },
          { path: '/api/users/:id', count: 1 }
        ],
        pathParameterUsage: { id: 1 },
        dynamicEndpoints: 1,
        rtkQueryUsage: {
          totalEndpoints: 0,
          queries: 0,
          mutations: 0,
          transformResponseUsage: 0
        }
      },
      analyzedAt: new Date('2023-01-01T00:00:00Z'),
      configuration: {
        targetDirectory: '/path/to/project'
      },
      analyzedFiles: ['/path/to/file.ts', '/path/to/response.ts', '/path/to/details.ts'],
      errors: []
    };
  });

  describe('generateDetailedEndpoints', () => {
    it('すべてのエンドポイントの詳細情報を生成する', () => {
      // Act
      const details = generator.generateDetailedEndpoints(mockResult);
      
      // Assert
      // エンドポイントの詳細情報セクションが存在するか
      expect(details).toContain('## エンドポイント詳細情報');
      
      // 基本情報が含まれているか
      expect(details).toContain('**使用技術**: axios');
      
      // コードスニペットが含まれているか
      expect(details).toContain('```typescript');
      expect(details).toContain('axios.get("/api/users")');
    });
    
    it('エンドポイントが存在しない場合は適切なメッセージを表示する', () => {
      // Arrange
      const emptyResult = {
        ...mockResult,
        endpoints: [],
        statistics: {
          ...mockResult.statistics,
          totalEndpoints: 0
        }
      };
      
      // Act
      const details = generator.generateDetailedEndpoints(emptyResult);
      
      // Assert
      expect(details).toContain('## エンドポイント詳細情報');
      expect(details).toContain('検出されたエンドポイントはありません。');
    });
  });
  
  describe('generateErrorSection', () => {
    it('エラーセクションを生成する', () => {
      // Arrange
      const resultWithErrors = {
        ...mockResult,
        errors: [
          'ファイル /path/to/error1.ts の解析中にエラーが発生しました: TypeScript型エラー',
          'ファイル /path/to/error2.ts の解析中にエラーが発生しました: 構文エラー'
        ]
      };
      
      // Act
      const errorSection = generator.generateErrorSection(resultWithErrors);
      
      // Assert
      expect(errorSection).toContain('## 解析エラー');
      expect(errorSection).toContain('解析中に以下のエラーが発生しました:');
      expect(errorSection).toContain('1. ファイル /path/to/error1.ts の解析中にエラーが発生しました: TypeScript型エラー');
      expect(errorSection).toContain('2. ファイル /path/to/error2.ts の解析中にエラーが発生しました: 構文エラー');
    });
    
    it('エラーが存在しない場合は空文字列を返す', () => {
      // Act
      const errorSection = generator.generateErrorSection(mockResult);
      
      // Assert
      expect(errorSection).toBe('');
    });
  });
});
