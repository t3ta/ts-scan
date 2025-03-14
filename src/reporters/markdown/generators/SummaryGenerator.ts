/**
 * サマリー生成クラス
 * 
 * エグゼクティブサマリー情報を生成するクラスです。
 * 解析結果の重要なポイントを簡潔にまとめます。
 */

import { AnalysisResult } from '../../../types';
import { BaseGenerator } from './BaseGenerator';
import { rankEndpointsByComplexity } from '../../../utils/statistics';

/**
 * エグゼクティブサマリー生成クラス
 */
export class SummaryGenerator extends BaseGenerator {
  /**
   * エグゼクティブサマリーセクションの生成
   * @param result 解析結果
   * @returns 生成されたMarkdownセクション
   */
  public generateExecutiveSummary(result: AnalysisResult): string {
    const { endpoints, statistics } = result;
    let content = '';
    
    content += `## エグゼクティブサマリー\n\n`;
    
    // 主要な統計情報をハイライト
    content += `### 主要指標\n\n`;
    content += `- **エンドポイント総数:** ${statistics.totalEndpoints}\n`;
    content += `- **最も多いHTTPメソッド:** ${this.getMostFrequentMethod(statistics.methodDistribution)}\n`;
    content += `- **動的エンドポイント割合:** ${this.calculatePercentage(statistics.dynamicEndpoints, statistics.totalEndpoints)}%\n`;
    content += `- **RTK Query採用率:** ${this.calculatePercentage(statistics.rtkQueryUsage.totalEndpoints, statistics.totalEndpoints)}%\n`;

    // 最頻使用エンドポイント
    if (statistics.mostUsedEndpoints.length > 0) {
      const topEndpoint = statistics.mostUsedEndpoints[0];
      content += `- **最も使用されているエンドポイント:** \`${topEndpoint.path}\` (${topEndpoint.count}回使用)\n`;
    }
    
    // 複雑性の高いエンドポイント
    const complexityRanking = rankEndpointsByComplexity(endpoints, 1);
    if (complexityRanking.length > 0) {
      const mostComplex = complexityRanking[0];
      content += `- **最も複雑なエンドポイント:** \`${mostComplex.endpoint.method} ${mostComplex.endpoint.path}\` (複雑性スコア: ${mostComplex.complexity})\n`;
    }
    
    content += `\n### 推奨事項の概要\n\n`;
    
    // 解析結果に基づく推奨事項
    content += this.generateQuickRecommendations(result);
    
    content += `\n`;
    return content;
  }
  
  /**
   * クイック推奨事項の生成
   * @param result 解析結果
   * @returns 推奨事項のMarkdown文字列
   */
  private generateQuickRecommendations(result: AnalysisResult): string {
    const { endpoints, statistics } = result;
    let content = '';
    
    // 未使用エンドポイントの推奨
    const unusedEndpointsCount = endpoints.filter(e => e.usageLocations.length === 0).length;
    if (unusedEndpointsCount > 0) {
      content += `- **未使用エンドポイントの検証:** ${unusedEndpointsCount}件のエンドポイントが未使用の可能性があります。\n`;
    }
    
    // RTK Query移行に関する推奨
    const nonRtkEndpoints = statistics.totalEndpoints - statistics.rtkQueryUsage.totalEndpoints;
    if (nonRtkEndpoints > 0 && statistics.rtkQueryUsage.totalEndpoints > 0) {
      content += `- **RTK Query移行の促進:** 従来のAPI呼び出しからRTK Queryへの移行を継続してください (現在の移行率: ${this.calculatePercentage(statistics.rtkQueryUsage.totalEndpoints, statistics.totalEndpoints)}%)。\n`;
    }
    
    // バージョン統一に関する推奨
    const versionCount = Object.keys(statistics.apiVersionDistribution).length;
    if (versionCount > 2) { // デフォルトバージョンを除いて2つ以上ある場合
      content += `- **APIバージョンの統一:** ${versionCount}種類のAPIバージョンが混在しています。バージョンの統一または移行計画の策定を検討してください。\n`;
    }
    
    // 複雑なエンドポイントに関する推奨
    const complexEndpoints = rankEndpointsByComplexity(endpoints, 3);
    if (complexEndpoints.some(item => item.complexity > 20)) {
      content += `- **複雑エンドポイントのリファクタリング:** 複雑性の高いエンドポイントが検出されました。これらのエンドポイントのリファクタリングを検討してください。\n`;
    }
    
    return content;
  }
}
