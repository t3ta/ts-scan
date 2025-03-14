/**
 * エンドポイント一覧生成クラス
 * 
 * カテゴリ別・メソッド別のエンドポイント一覧を生成します。
 * 様々な分類方法でエンドポイントを整理して表示します。
 */

import { AnalysisResult, HttpMethod } from '../../../types';
import { BaseGenerator } from './BaseGenerator';
import { groupEndpointsByCategory, calculateEndpointComplexity } from '../../../utils/statistics';

/**
 * エンドポイント一覧生成クラス
 */
export class EndpointListGenerator extends BaseGenerator {
  /**
   * カテゴリ別エンドポイント一覧セクションの生成
   * @param result 解析結果
   * @returns 生成されたMarkdownセクション
   */
  public generateCategorizedEndpoints(result: AnalysisResult): string {
    const categorizedEndpoints = groupEndpointsByCategory(result.endpoints);
    let content = '';
    
    content += `## カテゴリ別エンドポイント一覧\n\n`;
    
    // カテゴリ別の表示
    for (const [category, endpoints] of Object.entries(categorizedEndpoints)) {
      content += `### ${category}\n\n`;
      
      content += `| メソッド | エンドポイント | 使用箇所数 | 動的パラメータ | 検出元 |\n`;
      content += `|--------|--------------|-----------|----------------|--------|\n`;
      
      for (const endpoint of endpoints) {
        const sourceLabel = this.formatSourceName(endpoint.source);
        content += `| ${endpoint.method} | \`${endpoint.path}\` | ${endpoint.usageLocations.length} | ${endpoint.isDynamic ? '✓' : '-'} | ${sourceLabel} |\n`;
      }
      
      content += '\n';
      
      // カテゴリ内の複雑なエンドポイントをハイライト（ある場合）
      content += this.generateCategoryComplexEndpoints(endpoints);
    }
    
    return content;
  }
  
  /**
   * カテゴリ内の複雑なエンドポイントのハイライト生成
   * @param endpoints カテゴリ内のエンドポイント配列
   * @returns 生成されたMarkdownセクション
   */
  private generateCategoryComplexEndpoints(endpoints: AnalysisResult['endpoints']): string {
    const complexEndpoints = endpoints
      .map(endpoint => ({
        endpoint,
        complexity: calculateEndpointComplexity(endpoint)
      }))
      .filter(item => item.complexity > 10) // 複雑性閾値
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 3); // 上位3件
    
    if (complexEndpoints.length === 0) {
      return '';
    }
    
    let content = `#### カテゴリ内の複雑なエンドポイント\n\n`;
    content += `| エンドポイント | 複雑性スコア | 使用箇所数 | パラメータ数 |\n`;
    content += `|--------------|------------:|-----------|------------:|\n`;
    
    for (const { endpoint, complexity } of complexEndpoints) {
      content += `| \`${endpoint.method} ${endpoint.path}\` | ${complexity} | ${endpoint.usageLocations.length} | ${endpoint.parametersUsed.length} |\n`;
    }
    
    content += '\n';
    return content;
  }
  
  /**
   * メソッド別エンドポイント一覧セクションの生成
   * @param result 解析結果
   * @returns 生成されたMarkdownセクション
   */
  public generateMethodBasedEndpoints(result: AnalysisResult): string {
    let content = '';
    
    content += `## HTTPメソッド別エンドポイント一覧\n\n`;
    
    const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
    
    for (const method of methods) {
      const methodEndpoints = result.endpoints.filter(e => e.method === method);
      
      if (methodEndpoints.length === 0) {
        continue;
      }
      
      content += `### ${method} エンドポイント (${methodEndpoints.length})\n\n`;
      
      content += `| エンドポイント | カテゴリ | 使用箇所数 | 動的パラメータ | APIバージョン |\n`;
      content += `|--------------|----------|-----------|----------------|---------------|\n`;
      
      // パスでソート
      const sortedEndpoints = [...methodEndpoints].sort((a, b) => a.path.localeCompare(b.path));
      
      for (const endpoint of sortedEndpoints) {
        content += `| \`${endpoint.path}\` | ${endpoint.featureCategory || '-'} | ${endpoint.usageLocations.length} | ${endpoint.isDynamic ? '✓' : '-'} | ${endpoint.apiVersion || 'デフォルト'} |\n`;
      }
      
      content += '\n';
    }
    
    return content;
  }
}
