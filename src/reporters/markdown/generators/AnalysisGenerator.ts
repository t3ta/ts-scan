/**
 * 分析セクション生成クラス
 * 
 * エンドポイントの高度な分析結果を生成します。
 * 使用頻度、複雑性、RTK Query分析などの洞察情報を提供します。
 */

import { AnalysisResult } from '../../../types';
import { BaseGenerator } from './BaseGenerator';
import { 
  rankEndpointsByUsage, 
  rankEndpointsByComplexity,
  calculateEndpointComplexity
} from '../../../utils/statistics';
import { generateAsciiBarGraph } from '../../../utils/statistics/graphs';

/**
 * 分析セクション生成クラス
 */
export class AnalysisGenerator extends BaseGenerator {
  /**
   * 使用頻度の高いエンドポイントセクションの生成
   * @param result 解析結果
   * @returns 生成されたMarkdownセクション
   */
  public generateMostUsedEndpoints(result: AnalysisResult): string {
    let content = '';
    
    content += `## 使用頻度の高いエンドポイント\n\n`;
    
    content += `| 順位 | メソッド | エンドポイント | 使用箇所数 | カテゴリ | APIバージョン |\n`;
    content += `|------|--------|--------------|-----------|----------|---------------|\n`;
    
    // 使用頻度でランク付け
    const rankedEndpoints = rankEndpointsByUsage(result.endpoints);
    
    // 上位20件を表示
    const topEndpoints = rankedEndpoints.slice(0, 20);
    
    for (const { endpoint, usageCount, rank } of topEndpoints) {
      content += `| ${rank} | ${endpoint.method} | \`${endpoint.path}\` | ${usageCount} | ${endpoint.featureCategory || '-'} | ${endpoint.apiVersion || 'デフォルト'} |\n`;
    }
    
    content += '\n';
    
    // 使用箇所の多いエンドポイントの分布
    content += this.generateUsageDistribution(rankedEndpoints);
    
    return content;
  }
  
  /**
   * 使用頻度分布の生成
   * @param rankedEndpoints 使用頻度でランク付けされたエンドポイント情報
   * @returns 生成されたMarkdownセクション
   */
  private generateUsageDistribution(rankedEndpoints: ReturnType<typeof rankEndpointsByUsage>): string {
    const usageDistribution = [
      { range: '20以上', count: rankedEndpoints.filter(item => item.usageCount >= 20).length },
      { range: '10-19', count: rankedEndpoints.filter(item => item.usageCount >= 10 && item.usageCount < 20).length },
      { range: '5-9', count: rankedEndpoints.filter(item => item.usageCount >= 5 && item.usageCount < 10).length },
      { range: '2-4', count: rankedEndpoints.filter(item => item.usageCount >= 2 && item.usageCount < 5).length },
      { range: '1のみ', count: rankedEndpoints.filter(item => item.usageCount === 1).length },
      { range: '0 (未使用)', count: rankedEndpoints.filter(item => item.usageCount === 0).length }
    ];
    
    let content = `### 使用頻度分布\n\n`;
    
    const usageData = usageDistribution
      .filter(item => item.count > 0)
      .map(item => ({ label: item.range, value: item.count }));
    
    content += generateAsciiBarGraph(usageData);
    content += '\n';
    
    return content;
  }
  
  /**
   * エンドポイント複雑性分析セクションの生成
   * @param result 解析結果
   * @returns 生成されたMarkdownセクション
   */
  public generateComplexityAnalysis(result: AnalysisResult): string {
    let content = '';
    
    content += `## エンドポイント複雑性分析\n\n`;
    
    content += `エンドポイントの複雑性は、パラメータ数、使用箇所数、動的パス、レスポンス処理などの要素から総合的に計算されています。\n\n`;
    
    content += `### 最も複雑なエンドポイント\n\n`;
    
    content += `| 順位 | メソッド | エンドポイント | 複雑性スコア | パラメータ数 | 使用箇所数 | 動的パス |\n`;
    content += `|------|--------|--------------|------------:|------------:|-----------|----------|\n`;
    
    // 複雑性でランク付け
    const rankedEndpoints = rankEndpointsByComplexity(result.endpoints, 15);
    
    for (const { endpoint, complexity, rank } of rankedEndpoints) {
      content += `| ${rank} | ${endpoint.method} | \`${endpoint.path}\` | ${complexity} | ${endpoint.parametersUsed.length} | ${endpoint.usageLocations.length} | ${endpoint.isDynamic ? '✓' : '-'} |\n`;
    }
    
    content += '\n';
    
    // 複雑性分布
    content += this.generateComplexityDistribution(result);
    
    return content;
  }
  
  /**
   * 複雑性分布の生成
   * @param result 解析結果
   * @returns 生成されたMarkdownセクション
   */
  private generateComplexityDistribution(result: AnalysisResult): string {
    const complexityDistribution = [
      { range: '高 (20+)', count: result.endpoints.filter(e => calculateEndpointComplexity(e) >= 20).length },
      { range: '中高 (10-19)', count: result.endpoints.filter(e => calculateEndpointComplexity(e) >= 10 && calculateEndpointComplexity(e) < 20).length },
      { range: '中 (5-9)', count: result.endpoints.filter(e => calculateEndpointComplexity(e) >= 5 && calculateEndpointComplexity(e) < 10).length },
      { range: '低 (0-4)', count: result.endpoints.filter(e => calculateEndpointComplexity(e) < 5).length }
    ];
    
    let content = `### 複雑性分布\n\n`;
    
    const complexityData = complexityDistribution
      .filter(item => item.count > 0)
      .map(item => ({ label: item.range, value: item.count }));
    
    content += generateAsciiBarGraph(complexityData);
    content += '\n';
    
    return content;
  }
  
  /**
   * RTK Query分析セクションの生成
   * @param result 解析結果
   * @returns 生成されたMarkdownセクション
   */
  public generateRtkQueryAnalysis(result: AnalysisResult): string {
    let content = '';
    
    // RTKエンドポイントがない場合はセクションを生成しない
    const rtkEndpoints = result.endpoints.filter(e => e.source === 'rtk-query');
    if (rtkEndpoints.length === 0) {
      return '';
    }
    
    content += `## RTK Query分析\n\n`;
    
    // 基本統計
    content += this.generateRtkQueryBasicStats(result);
    
    // API定義の一覧
    content += this.generateRtkQueryApiList(rtkEndpoints);
    
    // RTKエンドポイント一覧
    content += this.generateRtkQueryEndpointList(rtkEndpoints);
    
    return content;
  }
  
  /**
   * RTK Query基本統計情報の生成
   * @param result 解析結果
   * @returns 生成されたMarkdownセクション
   */
  private generateRtkQueryBasicStats(result: AnalysisResult): string {
    const { rtkQueryUsage } = result.statistics;
    
    let content = `### RTK Query統計概要\n\n`;
    content += `- **総エンドポイント数:** ${rtkQueryUsage.totalEndpoints}\n`;
    content += `- **Query操作:** ${rtkQueryUsage.queries} (${this.calculatePercentage(rtkQueryUsage.queries, rtkQueryUsage.totalEndpoints)}%)\n`;
    content += `- **Mutation操作:** ${rtkQueryUsage.mutations} (${this.calculatePercentage(rtkQueryUsage.mutations, rtkQueryUsage.totalEndpoints)}%)\n`;
    content += `- **レスポンス変換使用:** ${rtkQueryUsage.transformResponseUsage} (${this.calculatePercentage(rtkQueryUsage.transformResponseUsage, rtkQueryUsage.totalEndpoints)}%)\n\n`;
    
    return content;
  }
  
  /**
   * RTK Query API定義一覧の生成
   * @param rtkEndpoints RTK Queryエンドポイント配列
   * @returns 生成されたMarkdownセクション
   */
  private generateRtkQueryApiList(rtkEndpoints: AnalysisResult['endpoints']): string {
    // API定義の一覧
    const apiNames = new Set<string>();
    rtkEndpoints.forEach(endpoint => {
      if (endpoint.rtkQuerySpecific?.apiName) {
        apiNames.add(endpoint.rtkQuerySpecific.apiName);
      }
    });
    
    if (apiNames.size === 0) {
      return '';
    }
    
    let content = `### 検出されたRTK Query API\n\n`;
    content += `| API名 | エンドポイント数 |\n`;
    content += `|-------|---------------:|\n`;
    
    for (const apiName of Array.from(apiNames)) {
      const count = rtkEndpoints.filter(e => e.rtkQuerySpecific?.apiName === apiName).length;
      content += `| ${apiName} | ${count} |\n`;
    }
    
    content += '\n';
    return content;
  }
  
  /**
   * RTK Queryエンドポイント一覧の生成
   * @param rtkEndpoints RTK Queryエンドポイント配列
   * @returns 生成されたMarkdownセクション
   */
  private generateRtkQueryEndpointList(rtkEndpoints: AnalysisResult['endpoints']): string {
    let content = `### RTK Queryエンドポイント一覧\n\n`;
    
    content += `| メソッド | エンドポイント | タイプ | API名 | 変換処理 |\n`;
    content += `|--------|--------------|--------|-------|----------|\n`;
    
    // パスでソート
    const sortedEndpoints = [...rtkEndpoints].sort((a, b) => a.path.localeCompare(b.path));
    
    for (const endpoint of sortedEndpoints) {
      const type = endpoint.rtkQuerySpecific?.isQuery ? 'Query' : 
                  (endpoint.rtkQuerySpecific?.isMutation ? 'Mutation' : '-');
      
      const apiName = endpoint.rtkQuerySpecific?.apiName || '-';
      const transform = endpoint.rtkQuerySpecific?.transformResponseUsed ? '✓' : '-';
      
      content += `| ${endpoint.method} | \`${endpoint.path}\` | ${type} | ${apiName} | ${transform} |\n`;
    }
    
    content += '\n';
    return content;
  }
}
