/**
 * 詳細情報生成クラス
 * 
 * エンドポイントの詳細情報とエラー情報を生成します。
 * 個々のエンドポイントの詳細な仕様と使用状況を表示します。
 */

import * as path from 'path';
import { AnalysisResult, EndpointInfo } from '../../../types';
import { BaseGenerator } from './BaseGenerator';

/**
 * 詳細情報生成クラス
 */
export class DetailGenerator extends BaseGenerator {
  /**
   * 詳細なエンドポイント情報セクションの生成
   * @param result 解析結果
   * @returns 生成されたMarkdownセクション
   */
  public generateDetailedEndpoints(result: AnalysisResult): string {
    let content = '';
    
    // エンドポイント数が多い場合は詳細表示を制限
    const maxEndpointsToShow = result.endpoints.length > 100 ? 50 : result.endpoints.length;
    const displayEndpoints = [...result.endpoints]
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, maxEndpointsToShow);
    
    content += `## エンドポイント詳細情報\n\n`;
    
    if (result.endpoints.length > maxEndpointsToShow) {
      content += `> **注意:** エンドポイント数が多いため、最初の${maxEndpointsToShow}件のみ表示しています。\n\n`;
    }
    
    // パスでソートしたエンドポイントを処理
    for (const endpoint of displayEndpoints) {
      content += this.generateEndpointDetail(endpoint, result.configuration.targetDirectory);
    }
    
    return content;
  }
  
  /**
   * 単一エンドポイントの詳細情報生成
   * @param endpoint エンドポイント情報
   * @param baseDir 基準ディレクトリ
   * @returns 生成されたMarkdownセクション
   */
  private generateEndpointDetail(endpoint: EndpointInfo, baseDir: string): string {
    let content = '';
    
    content += `### \`${endpoint.method} ${endpoint.path}\`\n\n`;
    
    // 基本情報
    content += `- **使用箇所数:** ${endpoint.usageLocations.length}\n`;
    content += `- **カテゴリ:** ${endpoint.featureCategory || '未分類'}\n`;
    content += `- **APIバージョン:** ${endpoint.apiVersion || 'デフォルト'}\n`;
    content += `- **動的パス:** ${endpoint.isDynamic ? 'はい' : 'いいえ'}\n`;
    content += `- **検出元:** ${this.formatSourceName(endpoint.source)}\n\n`;
    
    // RTKクエリ固有の情報
    const rtkContent = this.generateRtkSpecificInfo(endpoint);
    if (rtkContent) {
      content += rtkContent;
    }
    
    // パラメータ情報
    if (endpoint.parametersUsed.length > 0) {
      content += this.generateParameterInfo(endpoint);
    }
    
    // 使用箇所情報（一部）
    if (endpoint.usageLocations.length > 0) {
      content += this.generateUsageLocationInfo(endpoint, baseDir);
    }
    
    content += `---\n\n`;
    return content;
  }
  
  /**
   * RTK Query固有情報の生成
   * @param endpoint エンドポイント情報
   * @returns 生成されたMarkdownセクション
   */
  private generateRtkSpecificInfo(endpoint: EndpointInfo): string {
    // ここでrtkQuerySpecificの存在を確認しておきます
    if (!endpoint.rtkQuerySpecific) {
      return '';
    }

    let content = `#### RTK Query固有情報\n\n`;
    
    content += `- **タイプ:** ${endpoint.rtkQuerySpecific.isQuery ? 'クエリ' : endpoint.rtkQuerySpecific.isMutation ? 'ミューテーション' : '不明'}\n`;
    
    if (endpoint.rtkQuerySpecific.builderName) {
      content += `- **ビルダー名:** ${endpoint.rtkQuerySpecific.builderName}\n`;
    }
    
    if (endpoint.rtkQuerySpecific.apiName) {
      content += `- **API定義名:** ${endpoint.rtkQuerySpecific.apiName}\n`;
    }
    
    content += `- **レスポンス変換:** ${endpoint.rtkQuerySpecific.transformResponseUsed ? 'あり' : 'なし'}\n`;
    content += `- **baseQuery使用:** ${endpoint.rtkQuerySpecific.baseQueryUsed ? 'あり' : 'なし'}\n\n`;
    
    return content;
  }
  
  /**
   * パラメータ情報の生成
   * @param endpoint エンドポイント情報
   * @returns 生成されたMarkdownセクション
   */
  private generateParameterInfo(endpoint: EndpointInfo): string {
    let content = `#### 使用パラメータ\n\n`;
    content += `| パラメータ名 | 種別 | 必須 | 使用箇所数 |\n`;
    content += `|------------|------|------|------------|\n`;
    
    for (const param of endpoint.parametersUsed) {
      content += `| ${param.name} | ${this.formatParameterType(param.type)} | ${param.required ? '✓' : '-'} | ${param.locations.length} |\n`;
    }
    
    content += `\n`;
    return content;
  }
  
  /**
   * 使用箇所情報の生成
   * @param endpoint エンドポイント情報
   * @param baseDir 基準ディレクトリ
   * @returns 生成されたMarkdownセクション
   */
  private generateUsageLocationInfo(endpoint: EndpointInfo, baseDir: string): string {
    let content = `#### 使用箇所\n\n`;
    
    // ファイルパスでグループ化
    const locationsByFile: Record<string, typeof endpoint.usageLocations> = {};
    
    for (const location of endpoint.usageLocations) {
      const filePath = location.filePath;
      if (!locationsByFile[filePath]) {
        locationsByFile[filePath] = [];
      }
      locationsByFile[filePath].push(location);
    }
    
    // 最大表示ファイル数を設定
    const maxFilesToShow = 5;
    const fileEntries = Object.entries(locationsByFile);
    const displayFiles = fileEntries.slice(0, maxFilesToShow);
    const hiddenFileCount = Math.max(0, fileEntries.length - maxFilesToShow);
    
    // ファイルごとの表示
    for (const [filePath, locations] of displayFiles) {
      const relativePath = path.relative(baseDir, filePath);
      content += `**${path.basename(filePath)}** (${relativePath})\n\n`;
      
      // 各ファイルの最大表示行数
      const maxLocationsPerFile = 3;
      const displayLocations = locations.slice(0, maxLocationsPerFile);
      const hiddenLocationCount = Math.max(0, locations.length - maxLocationsPerFile);
      
      for (const location of displayLocations) {
        content += `- 行 ${location.lineNumber}, ${location.context || '不明コンテキスト'}\n`;
        if (location.codeSnippet) {
          content += `  \`\`\`typescript\n  ${location.codeSnippet.trim()}\n  \`\`\`\n`;
        }
      }
      
      if (hiddenLocationCount > 0) {
        content += `- ... 他 ${hiddenLocationCount} 箇所\n`;
      }
      
      content += `\n`;
    }
    
    if (hiddenFileCount > 0) {
      content += `... 他 ${hiddenFileCount} ファイルでも使用されています。\n\n`;
    }
    
    return content;
  }
  
  /**
   * エラーセクションの生成
   * @param result 解析結果
   * @returns 生成されたMarkdownセクション
   */
  public generateErrorSection(result: AnalysisResult): string {
    let content = '';
    
    content += `## 解析中のエラー (${result.errors.length}件)\n\n`;
    
    // 最大20件まで表示
    const displayErrors = result.errors.slice(0, 20);
    const hiddenErrors = result.errors.length - displayErrors.length;
    
    content += `\`\`\`\n`;
    for (const error of displayErrors) {
      content += `${error}\n`;
    }
    
    if (hiddenErrors > 0) {
      content += `\n... 他 ${hiddenErrors} 件のエラー\n`;
    }
    content += `\`\`\`\n\n`;
    
    content += `これらのエラーは主に以下の理由で発生している可能性があります：\n\n`;
    content += `- 非標準的なAPIパターンの使用\n`;
    content += `- 動的なURL構築パターン\n`;
    content += `- 型情報の不足\n`;
    content += `- ファイル解析の問題\n\n`;
    
    content += `エラーが多数ある場合は、調査が必要なファイルを特定し、API使用パターンの標準化を検討してください。\n\n`;
    
    return content;
  }
}
