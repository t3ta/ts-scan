/**
 * 統計情報生成クラス
 * 
 * 詳細な統計情報セクションを生成するクラスです。
 * 解析結果の統計データを表形式で整理します。
 */

import { AnalysisResult } from '../../../types';
import { BaseGenerator } from './BaseGenerator';

/**
 * 統計情報セクション生成クラス
 */
export class StatisticsGenerator extends BaseGenerator {
  /**
   * 統計情報セクションの生成
   * @param result 解析結果
   * @returns 生成されたMarkdownセクション
   */
  public generateStatisticsSection(result: AnalysisResult): string {
    const { statistics } = result;
    let content = '';
    
    content += `## 詳細統計情報\n\n`;
    
    // HTTPメソッド分布
    content += this.generateHttpMethodDistribution(statistics);
    
    // 検出元分布
    content += this.generateSourceDistribution(statistics);
    
    // APIバージョン分布
    content += this.generateApiVersionDistribution(statistics);
    
    // 機能カテゴリ分布
    content += this.generateFeatureCategoryDistribution(statistics);
    
    // パスパラメータ使用状況
    content += this.generatePathParameterUsage(statistics);
    
    // RTK Query固有統計
    content += this.generateRtkQueryStatistics(statistics);
    
    return content;
  }
  
  /**
   * HTTPメソッド分布テーブルの生成
   * @param statistics 統計情報
   * @returns Markdown形式のテーブル
   */
  private generateHttpMethodDistribution(statistics: AnalysisResult['statistics']): string {
    let content = `### HTTPメソッド分布\n\n`;
    content += `| メソッド | エンドポイント数 | 割合 |\n`;
    content += `|---------|---------------:|------:|\n`;
    
    for (const [method, count] of Object.entries(statistics.methodDistribution)) {
      if (count > 0) {
        content += `| ${method} | ${count} | ${this.calculatePercentage(count, statistics.totalEndpoints)}% |\n`;
      }
    }
    
    content += `\n`;
    return content;
  }
  
  /**
   * 検出元分布テーブルの生成
   * @param statistics 統計情報
   * @returns Markdown形式のテーブル
   */
  private generateSourceDistribution(statistics: AnalysisResult['statistics']): string {
    let content = `### 検出元分布\n\n`;
    content += `| タイプ | エンドポイント数 | 割合 |\n`;
    content += `|------|---------------:|------:|\n`;
    
    for (const [source, count] of Object.entries(statistics.sourceDistribution)) {
      if (count > 0) {
        const label = this.formatSourceName(source);
        content += `| ${label} | ${count} | ${this.calculatePercentage(count, statistics.totalEndpoints)}% |\n`;
      }
    }
    
    content += `\n`;
    return content;
  }
  
  /**
   * APIバージョン分布テーブルの生成
   * @param statistics 統計情報
   * @returns Markdown形式のテーブル
   */
  private generateApiVersionDistribution(statistics: AnalysisResult['statistics']): string {
    let content = `### APIバージョン分布\n\n`;
    content += `| バージョン | エンドポイント数 | 割合 |\n`;
    content += `|-----------|---------------:|------:|\n`;
    
    for (const [version, count] of Object.entries(statistics.apiVersionDistribution)) {
      content += `| ${version} | ${count} | ${this.calculatePercentage(count, statistics.totalEndpoints)}% |\n`;
    }
    
    content += `\n`;
    return content;
  }
  
  /**
   * 機能カテゴリ分布テーブルの生成
   * @param statistics 統計情報
   * @returns Markdown形式のテーブル
   */
  private generateFeatureCategoryDistribution(statistics: AnalysisResult['statistics']): string {
    // カテゴリが存在しない場合は空文字列を返す
    if (Object.keys(statistics.featureCategoryDistribution).length === 0) {
      return '';
    }
    
    let content = `### 機能カテゴリ分布\n\n`;
    content += `| カテゴリ | エンドポイント数 | 割合 |\n`;
    content += `|---------|---------------:|------:|\n`;
    
    for (const [category, count] of Object.entries(statistics.featureCategoryDistribution)) {
      content += `| ${category} | ${count} | ${this.calculatePercentage(count, statistics.totalEndpoints)}% |\n`;
    }
    
    content += `\n`;
    return content;
  }
  
  /**
   * パスパラメータ使用状況テーブルの生成
   * @param statistics 統計情報
   * @returns Markdown形式のテーブル
   */
  private generatePathParameterUsage(statistics: AnalysisResult['statistics']): string {
    // パスパラメータが存在しない場合は空文字列を返す
    if (Object.keys(statistics.pathParameterUsage).length === 0) {
      return '';
    }
    
    let content = `### 最も使用されているパスパラメータ\n\n`;
    content += `| パラメータ名 | 使用回数 |\n`;
    content += `|------------|--------:|\n`;
    
    const sortedParams = Object.entries(statistics.pathParameterUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    for (const [param, count] of sortedParams) {
      content += `| ${param} | ${count} |\n`;
    }
    
    content += `\n`;
    return content;
  }
  
  /**
   * RTK Query統計情報の生成
   * @param statistics 統計情報
   * @returns Markdown形式の統計情報
   */
  private generateRtkQueryStatistics(statistics: AnalysisResult['statistics']): string {
    // RTK Queryエンドポイントがない場合は簡略化した内容を返す
    if (statistics.rtkQueryUsage.totalEndpoints === 0) {
      return `### RTK Query統計\n\nRTK Queryを使用したエンドポイントは検出されませんでした。\n\n`;
    }
    
    let content = `### RTK Query統計\n\n`;
    content += `- **RTK Query使用エンドポイント:** ${statistics.rtkQueryUsage.totalEndpoints} (${this.calculatePercentage(statistics.rtkQueryUsage.totalEndpoints, statistics.totalEndpoints)}%)\n`;
    content += `- **Query操作:** ${statistics.rtkQueryUsage.queries} (${this.calculatePercentage(statistics.rtkQueryUsage.queries, statistics.rtkQueryUsage.totalEndpoints)}% of RTK)\n`;
    content += `- **Mutation操作:** ${statistics.rtkQueryUsage.mutations} (${this.calculatePercentage(statistics.rtkQueryUsage.mutations, statistics.rtkQueryUsage.totalEndpoints)}% of RTK)\n`;
    content += `- **レスポンス変換使用:** ${statistics.rtkQueryUsage.transformResponseUsage} (${this.calculatePercentage(statistics.rtkQueryUsage.transformResponseUsage, statistics.rtkQueryUsage.totalEndpoints)}% of RTK)\n`;
    
    content += `\n`;
    return content;
  }
}
