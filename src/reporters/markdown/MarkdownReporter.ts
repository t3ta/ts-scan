/**
 * Markdownレポーター
 * 
 * 解析結果をMarkdown形式で出力するレポーター実装です。
 * 人間が読みやすい形式で結果を整形し、ドキュメントとして活用できるようにします。
 * モジュール化された設計により、拡張性と保守性を確保しています。
 */

import * as fs from 'fs';
import * as path from 'path';
import { IReporter, AnalysisResult } from '../../types';
import { logger } from '../../utils/Logger';
import { ensureDirectoryExists } from '../../utils/fs-helper';
import { SummaryGenerator } from './generators/SummaryGenerator';
import { StatisticsGenerator } from './generators/StatisticsGenerator';
import { VisualizationGenerator } from './generators/VisualizationGenerator';
import { DetailGenerator } from './generators/DetailGenerator';
import { EndpointListGenerator } from './generators/EndpointListGenerator';
import { AnalysisGenerator } from './generators/AnalysisGenerator';
import { RecommendationGenerator } from './generators/RecommendationGenerator';

/**
 * 拡張Markdown形式レポーター実装クラス
 * モジュール化されたジェネレーターを利用し、責務を分割した設計
 */
export class MarkdownReporter implements IReporter {
  private summaryGenerator: SummaryGenerator;
  private statisticsGenerator: StatisticsGenerator;
  private visualizationGenerator: VisualizationGenerator;
  private detailGenerator: DetailGenerator;
  private endpointListGenerator: EndpointListGenerator;
  private analysisGenerator: AnalysisGenerator;
  private recommendationGenerator: RecommendationGenerator;

  /**
   * コンストラクタ
   */
  constructor() {
    // 各セクションジェネレーターの初期化
    this.summaryGenerator = new SummaryGenerator();
    this.statisticsGenerator = new StatisticsGenerator();
    this.visualizationGenerator = new VisualizationGenerator();
    this.detailGenerator = new DetailGenerator();
    this.endpointListGenerator = new EndpointListGenerator();
    this.analysisGenerator = new AnalysisGenerator();
    this.recommendationGenerator = new RecommendationGenerator();
  }

  /**
   * 解析結果をMarkdown形式で出力
   * @param result 解析結果
   * @param outputPath 出力先ファイルパス
   * @returns 出力成功の場合true
   */
  public async generateReport(result: AnalysisResult, outputPath?: string): Promise<boolean> {
    try {
      const filePath = outputPath || './output/endpoints-report.md';

      // 出力先ディレクトリの確保
      const outputDir = path.dirname(filePath);
      ensureDirectoryExists(outputDir);

      // Markdownコンテンツの生成
      const markdownContent = this.generateMarkdownContent(result);

      // ファイル出力
      fs.writeFileSync(filePath, markdownContent, 'utf8');

      logger.info(`Markdownレポートを生成しました: ${filePath}`);
      return true;
    } catch (error) {
      logger.error(`Markdownレポート生成中にエラーが発生: ${error}`);
      return false;
    }
  }

  /**
   * Markdownコンテンツの生成
   * @param result 解析結果
   * @returns 生成されたMarkdownコンテンツ
   */
  private generateMarkdownContent(result: AnalysisResult): string {
    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    let content = '';

    // ヘッダー
    content += `# APIエンドポイント解析レポート\n\n`;
    content += `**生成日時:** ${timestamp}\n\n`;
    content += `**対象ディレクトリ:** \`${result.configuration.targetDirectory}\`\n\n`;
    content += `**解析ファイル数:** ${result.analyzedFiles.length}\n\n`;

    // 各セクションの生成（責務を委譲）
    content += this.summaryGenerator.generateExecutiveSummary(result);
    content += this.visualizationGenerator.generateVisualizationSection(result);
    content += this.statisticsGenerator.generateStatisticsSection(result);
    content += this.endpointListGenerator.generateCategorizedEndpoints(result);
    content += this.endpointListGenerator.generateMethodBasedEndpoints(result);
    content += this.analysisGenerator.generateMostUsedEndpoints(result);
    content += this.analysisGenerator.generateComplexityAnalysis(result);
    content += this.analysisGenerator.generateRtkQueryAnalysis(result);
    content += this.detailGenerator.generateDetailedEndpoints(result);

    // エラー情報（存在する場合）
    if (result.errors.length > 0) {
      content += this.detailGenerator.generateErrorSection(result);
    }

    // 推奨事項と最適化提案
    content += this.recommendationGenerator.generateRecommendationsSection(result);

    return content;
  }
}
