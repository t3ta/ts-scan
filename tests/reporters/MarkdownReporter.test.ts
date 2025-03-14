/**
 * Markdownレポーターのテスト
 * 
 * @description
 * MarkdownReporterクラスの機能を検証するためのテストスイート。
 * ファイルシステム操作と内部ジェネレーターをモック化し、レポート生成機能を検証。
 */

import * as fs from 'fs';
import * as path from 'path';
import { mock, instance, when, verify, anything, anyString } from 'ts-mockito';
import { MarkdownReporter } from '../../src/reporters/markdown/MarkdownReporter';
import { AnalysisResult, EndpointInfo, HttpMethod, EndpointSource } from '../../src/types';
import { logger } from '../../src/utils/Logger';
import { SummaryGenerator } from '../../src/reporters/markdown/generators/SummaryGenerator';
import { StatisticsGenerator } from '../../src/reporters/markdown/generators/StatisticsGenerator';
import { VisualizationGenerator } from '../../src/reporters/markdown/generators/VisualizationGenerator';
import { DetailGenerator } from '../../src/reporters/markdown/generators/DetailGenerator';
import { EndpointListGenerator } from '../../src/reporters/markdown/generators/EndpointListGenerator';
import { AnalysisGenerator } from '../../src/reporters/markdown/generators/AnalysisGenerator';
import { RecommendationGenerator } from '../../src/reporters/markdown/generators/RecommendationGenerator';

// ジェネレータークラスのモック
jest.mock('../../src/reporters/markdown/generators/SummaryGenerator', () => {
  return {
    SummaryGenerator: jest.fn().mockImplementation(() => {
      return {
        generateExecutiveSummary: jest.fn().mockReturnValue('# エグゼクティブサマリー\n\nモックサマリーコンテンツ\n\n')
      };
    })
  };
});

jest.mock('../../src/reporters/markdown/generators/StatisticsGenerator', () => {
  return {
    StatisticsGenerator: jest.fn().mockImplementation(() => {
      return {
        generateStatisticsSection: jest.fn().mockReturnValue('## 統計情報\n\nモック統計コンテンツ\n\n')
      };
    })
  };
});

jest.mock('../../src/reporters/markdown/generators/VisualizationGenerator', () => {
  return {
    VisualizationGenerator: jest.fn().mockImplementation(() => {
      return {
        generateVisualizationSection: jest.fn().mockReturnValue('## 可視化\n\nモック可視化コンテンツ\n\n')
      };
    })
  };
});

jest.mock('../../src/reporters/markdown/generators/DetailGenerator', () => {
  return {
    DetailGenerator: jest.fn().mockImplementation(() => {
      return {
        generateDetailedEndpoints: jest.fn().mockReturnValue('## 詳細情報\n\nモック詳細コンテンツ\n\n'),
        generateErrorSection: jest.fn().mockReturnValue('## エラー\n\nモックエラーコンテンツ\n\n')
      };
    })
  };
});

jest.mock('../../src/reporters/markdown/generators/EndpointListGenerator', () => {
  return {
    EndpointListGenerator: jest.fn().mockImplementation(() => {
      return {
        generateCategorizedEndpoints: jest.fn().mockReturnValue('## カテゴリ別エンドポイント\n\nモックカテゴリコンテンツ\n\n'),
        generateMethodBasedEndpoints: jest.fn().mockReturnValue('## メソッド別エンドポイント\n\nモックメソッドコンテンツ\n\n')
      };
    })
  };
});

jest.mock('../../src/reporters/markdown/generators/AnalysisGenerator', () => {
  return {
    AnalysisGenerator: jest.fn().mockImplementation(() => {
      return {
        generateMostUsedEndpoints: jest.fn().mockReturnValue('## 使用頻度\n\nモック使用頻度コンテンツ\n\n'),
        generateComplexityAnalysis: jest.fn().mockReturnValue('## 複雑度分析\n\nモック複雑度コンテンツ\n\n'),
        generateRtkQueryAnalysis: jest.fn().mockReturnValue('## RTK Query分析\n\nモックRTK分析コンテンツ\n\n')
      };
    })
  };
});

jest.mock('../../src/reporters/markdown/generators/RecommendationGenerator', () => {
  return {
    RecommendationGenerator: jest.fn().mockImplementation(() => {
      return {
        generateRecommendationsSection: jest.fn().mockReturnValue('## 推奨事項\n\nモック推奨事項コンテンツ\n\n')
      };
    })
  };
});

// fs関連関数のモック化
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));

// path関連関数のモック化
jest.mock('path', () => ({
  dirname: jest.fn().mockReturnValue('/mock/output/dir'),
  join: jest.fn().mockImplementation((...args) => args.join('/'))
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

describe('MarkdownReporter', () => {
  let reporter: MarkdownReporter;
  let mockResult: AnalysisResult;

  beforeEach(() => {
    // テスト実行前に各モックをリセット
    jest.clearAllMocks();
    
    // MarkdownReporterインスタンスを作成
    reporter = new MarkdownReporter();
    
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
        outputMarkdownPath: './output/report.md'
      },
      analyzedFiles: ['/path/to/file.ts', '/path/to/response.ts'],
      errors: []
    };
  });

  describe('generateReport', () => {
    it('デフォルトのファイルパスにレポートを出力する', async () => {
      // Arrange
      const expectedFilePath = './output/endpoints-report.md';

      // Act
      const result = await reporter.generateReport(mockResult);

      // Assert
      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expectedFilePath,
        expect.any(String),
        'utf8'
      );
      expect(logger.info).toHaveBeenCalled();
    });

    it('指定されたファイルパスにレポートを出力する', async () => {
      // Arrange
      const customPath = './custom/path/report.md';

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

    it('各ジェネレーターからの出力が正しく結合される', async () => {
      // Arrange
      let capturedOutput: string = '';
      (fs.writeFileSync as jest.Mock).mockImplementation((path, data) => {
        capturedOutput = data;
      });

      // Act
      await reporter.generateReport(mockResult);

      // Assert
      // ヘッダー情報が含まれていることを確認
      expect(capturedOutput).toContain('# APIエンドポイント解析レポート');
      expect(capturedOutput).toContain(`**対象ディレクトリ:** \`${mockResult.configuration.targetDirectory}\``);
      expect(capturedOutput).toContain(`**解析ファイル数:** ${mockResult.analyzedFiles.length}`);
      
      // 各モックジェネレーターの出力が含まれていることを確認
      expect(capturedOutput).toContain('# エグゼクティブサマリー');
      expect(capturedOutput).toContain('## 統計情報');
      expect(capturedOutput).toContain('## 可視化');
      expect(capturedOutput).toContain('## カテゴリ別エンドポイント');
      expect(capturedOutput).toContain('## メソッド別エンドポイント');
      expect(capturedOutput).toContain('## 使用頻度');
      expect(capturedOutput).toContain('## 複雑度分析');
      expect(capturedOutput).toContain('## RTK Query分析');
      expect(capturedOutput).toContain('## 詳細情報');
      expect(capturedOutput).toContain('## 推奨事項');
    });

    it('エラーがある場合はエラーセクションが含まれる', async () => {
      // Arrange
      let capturedOutput: string = '';
      (fs.writeFileSync as jest.Mock).mockImplementation((path, data) => {
        capturedOutput = data;
      });
      
      // エラーを含む解析結果
      const resultWithErrors = {
        ...mockResult,
        errors: ['エラー1', 'エラー2']
      };

      // Act
      await reporter.generateReport(resultWithErrors);

      // Assert
      expect(capturedOutput).toContain('## エラー');
    });
  });

  describe('ジェネレーター初期化', () => {
    it('コンストラクタで全てのジェネレーターが初期化される', () => {
      // Assert
      expect(SummaryGenerator).toHaveBeenCalled();
      expect(StatisticsGenerator).toHaveBeenCalled();
      expect(VisualizationGenerator).toHaveBeenCalled();
      expect(DetailGenerator).toHaveBeenCalled();
      expect(EndpointListGenerator).toHaveBeenCalled();
      expect(AnalysisGenerator).toHaveBeenCalled();
      expect(RecommendationGenerator).toHaveBeenCalled();
    });
  });
});
