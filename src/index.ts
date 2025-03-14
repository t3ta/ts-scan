/**
 * エンドポイント解析ツール - エントリーポイント
 *
 * コマンドライン引数の解析と実行フローの制御を担当します。
 * 解析実行からレポート生成までの全体プロセスを統括します。
 */

import { Command } from 'commander';
import * as path from 'path';
import { AnalyzerEngine } from './core/AnalyzerEngine';
import { ServiceLocator, ServiceIds } from './core/ServiceLocator';
import { logger, LogLevel } from './utils/Logger';
import { AnalysisConfiguration, AnalysisResult } from './types';
import { JsonReporter } from './reporters/JsonReporter';
import { MarkdownReporter } from './reporters/markdown';
import { ensureDirectoryExists, writeJsonFile } from './utils/fs-helper';
import { EndpointBuilder } from './detectors/common/EndpointBuilder';
import { AxiosDetectionStrategy } from './detectors/http/AxiosDetectionStrategy';
import { FetchDetectionStrategy } from './detectors/http/FetchDetectionStrategy';
import { CustomApiClientStrategy } from './detectors/http/CustomApiClientStrategy';
import { DefaultDetectionStrategy } from './detectors/DefaultDetectionStrategy';

/**
 * コマンドラインオプション定義
 */
interface CommandLineOptions {
  directory: string;
  pattern?: string[];
  ignore?: string[];
  apiPrefix?: string;
  outputJson?: string;
  outputMd?: string;
  tsconfig?: string;
  failFast?: boolean;
  verbose?: boolean;
}

/**
 * サービスの初期化と登録
 */
function initializeServices(): ServiceLocator {
  const serviceLocator = ServiceLocator.getInstance();

  // 共通ユーティリティ登録
  serviceLocator.register(ServiceIds.ENDPOINT_BUILDER, new EndpointBuilder('', 'GET', 'default'));

  // 検出戦略の登録
  serviceLocator.register(ServiceIds.AXIOS_STRATEGY, new AxiosDetectionStrategy());
  serviceLocator.register(ServiceIds.FETCH_STRATEGY, new FetchDetectionStrategy());
  serviceLocator.register(ServiceIds.CUSTOM_API_CLIENT_STRATEGY, new CustomApiClientStrategy());
  serviceLocator.register(ServiceIds.DEFAULT_STRATEGY, new DefaultDetectionStrategy());

  return serviceLocator;
}

/**
 * コマンドライン引数の設定と解析
 */
function parseCommandLineArguments(): CommandLineOptions {
  const program = new Command();

  program
    .name('endpoint-analyzer')
    .description('フロントエンドコードからAPIエンドポイント使用状況を解析するツール')
    .version('2.0.0');

  program
    .option('-d, --directory <path>', 'フロントエンドのソースディレクトリパス', 'frontend/src')
    .option('-p, --pattern <patterns...>', '解析対象ファイルのグロブパターン')
    .option('-i, --ignore <patterns...>', '除外ファイルのパターン')
    .option('-a, --api-prefix <regex>', 'APIエンドポイント判定用の正規表現', '(/api/|/v[0-9]+/)')
    .option('-j, --output-json <path>', 'JSON形式の出力先パス', 'output/analysis-result.json')
    .option('-m, --output-md <path>', 'Markdown形式の出力先パス', 'output/endpoints-report.md')
    .option('--tsconfig <path>', 'カスタムtsconfig.jsonのパス')
    .option('--fail-fast', 'エラー発生時に即座に終了', false)
    .option('-v, --verbose', '詳細なログ出力', false);

  program.parse();

  return program.opts<CommandLineOptions>();
}

/**
 * 解析設定オブジェクトの作成
 * @param options コマンドラインオプション
 * @returns 解析設定オブジェクト
 */
function createAnalysisConfiguration(options: CommandLineOptions): AnalysisConfiguration {
  // デフォルトパターンの設定
  const filePatterns = options.pattern || ['**/*.ts', '**/*.tsx'];

  // デフォルト除外パターンの設定
  const ignorePatterns = options.ignore || [
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/*.test.tsx',
    '**/*.spec.tsx',
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**'
  ];

  return {
    targetDirectory: options.directory,
    filePatterns,
    ignorePatterns,
    apiPrefixRegex: options.apiPrefix,
    tsConfigPath: options.tsconfig,
    outputJsonPath: options.outputJson,
    outputMarkdownPath: options.outputMd,
    failFast: options.failFast,
    verbose: options.verbose
  };
}

/**
 * 解析結果のレポート出力
 * @param result 解析結果
 * @param configuration 解析設定
 */
async function writeReports(result: AnalysisResult, configuration: AnalysisConfiguration): Promise<void> {
  // JSON出力
  if (configuration.outputJsonPath) {
    const jsonPath = path.resolve(configuration.outputJsonPath);
    const jsonDir = path.dirname(jsonPath);

    if (ensureDirectoryExists(jsonDir)) {
      const jsonReporter = new JsonReporter();
      const success = await jsonReporter.generateReport(result, jsonPath);

      if (success) {
        logger.info(`JSON形式の解析結果を出力しました: ${jsonPath}`);
      } else {
        logger.error(`JSON形式の解析結果の出力に失敗しました: ${jsonPath}`);
      }
    }
  }

  // Markdown出力
  if (configuration.outputMarkdownPath) {
    const mdPath = path.resolve(configuration.outputMarkdownPath);
    const mdDir = path.dirname(mdPath);

    if (ensureDirectoryExists(mdDir)) {
      const markdownReporter = new MarkdownReporter();
      const success = await markdownReporter.generateReport(result, mdPath);

      if (success) {
        logger.info(`Markdown形式の解析結果を出力しました: ${mdPath}`);
      } else {
        logger.error(`Markdown形式の解析結果の出力に失敗しました: ${mdPath}`);
      }
    }
  }
}

/**
 * メイン処理関数
 */
async function main(): Promise<void> {
  try {
    console.log(`
    =======================================
     エンドポイント解析ツール v2.0.0
    =======================================
    `);

    // コマンドライン引数の解析
    const options = parseCommandLineArguments();

    // ログレベルの設定
    if (options.verbose) {
      logger.setLogLevel(LogLevel.DEBUG);
    }

    // 解析設定の作成
    const configuration = createAnalysisConfiguration(options);
    logger.debug(JSON.stringify(configuration, null, 2));

    // サービスの初期化
    const serviceLocator = initializeServices();

    // 解析エンジンの初期化
    const analyzer = new AnalyzerEngine(configuration, serviceLocator);

    logger.info('エンドポイント解析を開始します...');
    const startTime = Date.now();

    // 戦略の登録
    const strategyRegistry = analyzer.getStrategyRegistry();
    strategyRegistry.registerAllStrategiesFromServiceLocator();

    // 解析の実行
    const result = await analyzer.analyze();

    const endTime = Date.now();
    logger.info(`解析が完了しました (所要時間: ${(endTime - startTime) / 1000}秒)`);
    logger.info(`検出されたエンドポイント数: ${result.endpoints.length}`);

    // レポートの出力
    await writeReports(result, configuration);

    // 成功メッセージ
    logger.success('エンドポイント解析が正常に完了しました。');

    // エラーサマリー（エラーがある場合）
    if (result.errors.length > 0) {
      logger.warn(`解析中に ${result.errors.length} 件のエラーが発生しました。`);

      if (options.verbose) {
        logger.info('エラー一覧:');
        result.errors.forEach((error, index) => {
          logger.error(`[${index + 1}] ${error}`);
        });
      }
    }
  } catch (error) {
    logger.error(`エンドポイント解析中に致命的なエラーが発生しました: ${error}`);
    process.exit(1);
  }
}

// エントリーポイント実行
if (require.main === module) {
  main();
}

// モジュールとしてのエクスポート
export { AnalyzerEngine, ServiceLocator, ServiceIds };
