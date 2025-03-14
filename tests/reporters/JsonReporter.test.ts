/**
 * JSONレポーターのテスト
 * 
 * @description
 * JsonReporterクラスの機能を検証するためのテストスイート。
 * fs関連の外部依存性をモック化し、内部ロジックを分離テスト。
 */

import * as fs from 'fs';
import * as path from 'path';
import { mock, instance, when, verify, anything, anyString } from 'ts-mockito';
import { JsonReporter } from '../../src/reporters/JsonReporter';
import { AnalysisResult, EndpointInfo, HttpMethod, EndpointSource } from '../../src/types';
import { logger } from '../../src/utils/Logger';

// fs関連関数のモック化
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));

// path関連関数のモック化
jest.mock('path', () => ({
  dirname: jest.fn().mockReturnValue('/mock/output/dir'),
  basename: jest.fn().mockReturnValue('target-dir'),
  relative: jest.fn().mockImplementation((from, to) => 'relative/path')
}));

// loggerのモック化
jest.mock('../../src/utils/Logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn()
  }
}));

// fsヘルパーのモック化
jest.mock('../../src/utils/fs-helper', () => ({
  ensureDirectoryExists: jest.fn().mockReturnValue(true)
}));

describe('JsonReporter', () => {
  let reporter: JsonReporter;
  let mockResult: AnalysisResult;

  beforeEach(() => {
    // テスト実行前に各モックをリセット
    jest.clearAllMocks();
    
    // JsonReporterインスタンスを作成
    reporter = new JsonReporter();
    
    // モック解析結果データを作成
    mockResult = {
      endpoints: [
        {
          path: '/api/users',
          method: 'GET' as HttpMethod,
          isDynamic: false,
          usageLocations: [
            {
              filePath: '/path/to/file.ts',
              lineNumber: 10,
              columnNumber: 5
            }
          ],
          parametersUsed: [
            {
              name: 'limit',
              type: 'query',
              locations: [
                {
                  filePath: '/path/to/file.ts',
                  lineNumber: 12,
                  columnNumber: 7
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
                columnNumber: 3
              }
            }
          ],
          source: 'axios'
        }
      ],
      statistics: {
        totalEndpoints: 1,
        methodDistribution: { GET: 1 } as Record<HttpMethod, number>,
        sourceDistribution: {
          'axios': 1,
          'fetch': 0,
          'rtk-query': 0,
          'custom-client': 0, 
          'default': 0,
          'v2-endpoint': 0
        } as Record<EndpointSource, number>,
        apiVersionDistribution: {},
        featureCategoryDistribution: {},
        mostUsedEndpoints: [{ path: '/api/users', count: 1 }],
        pathParameterUsage: {},
        dynamicEndpoints: 0,
        rtkQueryUsage: {
          totalEndpoints: 0,
          queries: 0,
          mutations: 0,
          transformResponseUsage: 0
        }
      },
      analyzedAt: new Date(),
      configuration: {
        targetDirectory: '/path/to/project',
        outputJsonPath: './output/result.json'
      },
      analyzedFiles: ['/path/to/file.ts', '/path/to/response.ts'],
      errors: []
    };
  });

  describe('generateReport', () => {
    it('デフォルトのファイルパスにレポートを出力する', async () => {
      // Arrange
      const expectedFilePath = './output/analysis-result.json';

      // Act
      const result = await reporter.generateReport(mockResult);

      // Assert
      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expectedFilePath,
        expect.any(String),
        'utf8'
      );
    });

    it('指定されたファイルパスにレポートを出力する', async () => {
      // Arrange
      const customPath = './custom/path/report.json';

      // Act
      const result = await reporter.generateReport(mockResult, customPath);

      // Assert
      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        customPath,
        expect.any(String),
        'utf8'
      );
    });

    it('エラーが発生した場合はfalseを返す', async () => {
      // Arrange
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('書き込みエラー');
      });

      // Act
      const result = await reporter.generateReport(mockResult);

      // Assert
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('JSONデータが正しい形式で出力される', async () => {
      // Arrange
      let capturedOutput: string = '';
      (fs.writeFileSync as jest.Mock).mockImplementation((path, data) => {
        capturedOutput = data;
      });

      // Act
      await reporter.generateReport(mockResult);

      // Assert
      const outputData = JSON.parse(capturedOutput);
      
      // JSONの構造を検証
      expect(outputData).toHaveProperty('endpoints');
      expect(outputData).toHaveProperty('statistics');
      expect(outputData).toHaveProperty('configuration');
      expect(outputData).toHaveProperty('analyzedFiles');
      expect(outputData).toHaveProperty('metadata');
      
      // エンドポイント情報の検証
      expect(outputData.endpoints).toHaveLength(1);
      expect(outputData.endpoints[0].path).toBe('/api/users');
      expect(outputData.endpoints[0].method).toBe('GET');
      
      // 統計情報の検証
      expect(outputData.statistics.totalEndpoints).toBe(1);
      expect(outputData.statistics.methodDistribution.GET).toBe(1);
      
      // メタデータの検証
      expect(outputData.metadata.version).toBe('2.0.0');
      expect(outputData.metadata.generatedBy).toBe('endpoint-analyzer-2');
    });
  });

  describe('prepareOutputData', () => {
    it('相対パスが正しく設定される', async () => {
      // Arrange
      let capturedOutput: string = '';
      (fs.writeFileSync as jest.Mock).mockImplementation((path, data) => {
        capturedOutput = data;
      });

      // Act
      await reporter.generateReport(mockResult);

      // Assert
      const outputData = JSON.parse(capturedOutput);
      
      // ファイルパスが相対パスに変換されていることを確認
      expect(outputData.endpoints[0].usageLocations[0].filePath).toBe('relative/path');
      expect(outputData.endpoints[0].parametersUsed[0].locations[0].filePath).toBe('relative/path');
      expect(outputData.endpoints[0].responseHandling[0].location.filePath).toBe('relative/path');
    });
  });
});
