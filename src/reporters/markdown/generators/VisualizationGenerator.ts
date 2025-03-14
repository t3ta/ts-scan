/**
 * 可視化セクション生成クラス
 * 
 * エンドポイント解析結果を視覚的に表現するグラフやチャートを生成します。
 * Mermaid.jsを利用した様々な図表を提供します。
 */

import { AnalysisResult, EndpointSource } from '../../../types';
import { BaseGenerator } from './BaseGenerator';
import { classifyByPathPrefix } from '../../../utils/statistics';
import {
  generateMermaidPieChart,
  generateMermaidBarChart
} from '../../../utils/statistics/graphs';

/**
 * 可視化セクション生成クラス
 */
export class VisualizationGenerator extends BaseGenerator {
  /**
   * 可視化セクションの生成
   * @param result 解析結果
   * @returns 生成されたMarkdownセクション
   */
  public generateVisualizationSection(result: AnalysisResult): string {
    const { endpoints, statistics } = result;
    let content = '';
    
    content += `## エンドポイント分析ビジュアライゼーション\n\n`;
    
    // HTTPメソッド分布の円グラフ
    content += this.generateHttpMethodChart(statistics);
    
    // API実装パターン分布の棒グラフ
    content += this.generateSourcePatternChart(statistics);
    
    // APIバージョン分布の円グラフ
    content += this.generateApiVersionChart(statistics);
    
    // パスプレフィックスによる分類の棒グラフ
    content += this.generatePathPrefixChart(endpoints);
    
    // 機能カテゴリ分布の円グラフ（カテゴリが存在する場合）
    content += this.generateFeatureCategoryChart(statistics);
    
    return content;
  }
  
  /**
   * HTTPメソッド分布チャートの生成
   * @param statistics 統計情報
   * @returns 生成されたチャートMarkdown
   */
  private generateHttpMethodChart(statistics: AnalysisResult['statistics']): string {
    let content = `### HTTPメソッド分布\n\n`;
    
    const methodData = Object.entries(statistics.methodDistribution)
      .filter(([_, count]) => count > 0)
      .map(([method, count]) => ({ label: method, value: count }));
    
    content += generateMermaidPieChart(methodData, 'HTTPメソッド分布');
    content += `\n`;
    
    return content;
  }
  
  /**
   * API実装パターン分布チャートの生成
   * @param statistics 統計情報
   * @returns 生成されたチャートMarkdown
   */
  private generateSourcePatternChart(statistics: AnalysisResult['statistics']): string {
    let content = `### API実装パターン分布\n\n`;
    
    const sourceLabels: Record<EndpointSource, string> = {
      'axios': 'Axios',
      'fetch': 'Fetch API',
      'rtk-query': 'RTK Query',
      'custom-client': 'カスタムAPIクライアント',
      'default': '一般パターン',
      'v2-endpoint': 'V2エンドポイント'
    };
    
    const sourceData = Object.entries(statistics.sourceDistribution)
      .filter(([_, count]) => count > 0)
      .map(([source, count]) => ({
        label: sourceLabels[source as EndpointSource] || source,
        value: count
      }));
    
    content += generateMermaidBarChart(sourceData, 'API実装パターン分布', 'パターン', 'エンドポイント数');
    content += `\n`;
    
    return content;
  }
  
  /**
   * APIバージョン分布チャートの生成
   * @param statistics 統計情報
   * @returns 生成されたチャートMarkdown
   */
  private generateApiVersionChart(statistics: AnalysisResult['statistics']): string {
    // バージョンが1つしかない場合はグラフを生成しない
    if (Object.keys(statistics.apiVersionDistribution).length <= 1) {
      return '';
    }
    
    let content = `### APIバージョン分布\n\n`;
    
    const versionData = Object.entries(statistics.apiVersionDistribution)
      .map(([version, count]) => ({ label: version, value: count }));
    
    content += generateMermaidPieChart(versionData, 'APIバージョン分布');
    content += `\n`;
    
    return content;
  }
  
  /**
   * パスプレフィックス分布チャートの生成
   * @param endpoints エンドポイント情報配列
   * @returns 生成されたチャートMarkdown
   */
  private generatePathPrefixChart(endpoints: AnalysisResult['endpoints']): string {
    let content = `### エンドポイントパス構造\n\n`;
    
    const prefixData = Object.entries(classifyByPathPrefix(endpoints))
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([prefix, count]) => ({ label: prefix, value: count }));
    
    content += generateMermaidBarChart(prefixData, 'トップ10パスプレフィックス', 'パスプレフィックス', 'エンドポイント数');
    content += `\n`;
    
    return content;
  }
  
  /**
   * 機能カテゴリ分布チャートの生成
   * @param statistics 統計情報
   * @returns 生成されたチャートMarkdown
   */
  private generateFeatureCategoryChart(statistics: AnalysisResult['statistics']): string {
    // カテゴリが存在しない、または「未分類」のみの場合はグラフを生成しない
    if (Object.keys(statistics.featureCategoryDistribution).length <= 1 || 
        (Object.keys(statistics.featureCategoryDistribution).length === 1 && 
         Object.keys(statistics.featureCategoryDistribution).includes('未分類'))) {
      return '';
    }
    
    let content = `### 機能カテゴリ分布\n\n`;
    
    const categoryData = Object.entries(statistics.featureCategoryDistribution)
      .map(([category, count]) => ({ label: category, value: count }));
    
    content += generateMermaidPieChart(categoryData, '機能カテゴリ分布');
    content += `\n`;
    
    return content;
  }
}
