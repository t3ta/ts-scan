/**
 * 推奨事項生成クラス
 * 
 * 解析結果に基づく推奨事項と最適化提案を生成します。
 * コードの改善方法やベストプラクティスの適用方法を提示します。
 */

import { AnalysisResult } from '../../../types';
import { BaseGenerator } from './BaseGenerator';
import { rankEndpointsByComplexity } from '../../../utils/statistics';

/**
 * 推奨事項生成クラス
 */
export class RecommendationGenerator extends BaseGenerator {
  /**
   * 推奨事項セクションの生成
   * @param result 解析結果
   * @returns 生成されたMarkdownセクション
   */
  public generateRecommendationsSection(result: AnalysisResult): string {
    let content = '';
    
    content += `## 推奨事項と最適化提案\n\n`;
    
    // APIパターン標準化の推奨事項
    content += this.generateApiPatternRecommendations(result);
    
    // エンドポイント設計の推奨事項
    content += this.generateEndpointDesignRecommendations(result);
    
    // RTK Query移行の推奨事項
    content += this.generateRtkQueryMigrationRecommendations(result);
    
    // 複雑性改善の推奨事項
    content += this.generateComplexityRecommendations(result);
    
    // コード品質向上の推奨事項
    content += this.generateCodeQualityRecommendations();
    
    return content;
  }
  
  /**
   * APIパターン標準化の推奨事項生成
   * @param result 解析結果
   * @returns 生成されたMarkdownセクション
   */
  private generateApiPatternRecommendations(result: AnalysisResult): string {
    const { statistics } = result;
    let content = '';
    
    content += `### APIパターン標準化\n\n`;
    
    // 使用されているAPIパターンの数をカウント
    const usedSourceTypes = Object.entries(statistics.sourceDistribution)
      .filter(([_, count]) => count > 0)
      .map(([source]) => source);
    
    if (usedSourceTypes.length > 2) {
      content += `- **APIクライアントの統一:** 現在、${usedSourceTypes.length}種類の異なるAPIアクセスパターン（${usedSourceTypes.map(s => this.formatSourceName(s)).join('、')}）が混在しています。一貫性のあるアプローチに統一することで、保守性が向上します。\n\n`;
      
      // 最も使用されているパターンを特定
      const mostUsedSource = Object.entries(statistics.sourceDistribution)
        .sort((a, b) => b[1] - a[1])[0][0];
      
      content += `  - 推奨: ${this.formatSourceName(mostUsedSource)}を主要なAPIアクセスパターンとして標準化することを検討してください。\n`;
      
      if (statistics.sourceDistribution['rtk-query'] > 0) {
        content += `  - RTK Queryは状態管理が統合されており、キャッシュやローディング状態の管理が容易になるため、可能であればRTK Queryへの移行を優先してください。\n`;
      }
    }
    
    // APIバージョンに関する推奨
    const apiVersions = Object.keys(statistics.apiVersionDistribution);
    if (apiVersions.length > 2) { // デフォルトバージョンを除いて複数ある場合
      content += `- **APIバージョンの統一:** ${apiVersions.length}種類のAPIバージョン（${apiVersions.join('、')}）が混在しています。段階的な移行プランを策定し、最新バージョンへの統一を進めてください。\n`;
    }
    
    // 未使用エンドポイントの確認
    const unusedEndpoints = result.endpoints.filter(e => e.usageLocations.length === 0);
    if (unusedEndpoints.length > 0) {
      content += `- **未使用エンドポイントの検証:** ${unusedEndpoints.length}件のエンドポイントが未使用の可能性があります。これらが本当に必要ないか確認し、不要なコードを削除してください。\n`;
    }
    
    content += '\n';
    return content;
  }
  
  /**
   * エンドポイント設計の推奨事項生成
   * @param result 解析結果
   * @returns 生成されたMarkdownセクション
   */
  private generateEndpointDesignRecommendations(result: AnalysisResult): string {
    const { statistics } = result;
    let content = '';
    
    content += `### エンドポイント設計の改善\n\n`;
    
    // 動的パスパラメータに関する推奨
    if (statistics.dynamicEndpoints > 0) {
      content += `- **動的パスパラメータの一貫した命名:** ${statistics.dynamicEndpoints}件の動的パスパラメータを持つエンドポイントが検出されました。パラメータ名の一貫性を確保し、型安全性を向上させてください。\n`;
    }
    
    // 使用頻度が偏っているエンドポイントに関する推奨
    const mostUsedEndpoints = statistics.mostUsedEndpoints.slice(0, 3);
    if (mostUsedEndpoints.some(e => e.count > 20)) {
      content += `- **高頻度使用エンドポイントの最適化:** 特に使用頻度の高いエンドポイント（${mostUsedEndpoints.map(e => e.path).join('、')}）については、以下の最適化を検討してください：\n`;
      content += `  - キャッシュ戦略の実装\n`;
      content += `  - RTK Queryへの移行（自動キャッシュ管理のため）\n`;
      content += `  - パフォーマンスモニタリングの強化\n`;
    }
    
    // メソッド使用の偏りに関する推奨
    const getCount = statistics.methodDistribution['GET'] || 0;
    const postCount = statistics.methodDistribution['POST'] || 0;
    const putCount = statistics.methodDistribution['PUT'] || 0;
    const deleteCount = statistics.methodDistribution['DELETE'] || 0;
    
    if (getCount > 0 && postCount > 0 && (putCount === 0 || deleteCount === 0)) {
      content += `- **RESTful設計原則の適用:** 現在、GETとPOSTは使用されていますが、${putCount === 0 ? 'PUT' : ''}${putCount === 0 && deleteCount === 0 ? 'と' : ''}${deleteCount === 0 ? 'DELETE' : ''}の使用が少ないです。リソース指向の設計と適切なHTTPメソッドの使用を検討してください。\n`;
    }
    
    content += '\n';
    return content;
  }
  
  /**
   * RTK Query移行の推奨事項生成
   * @param result 解析結果
   * @returns 生成されたMarkdownセクション
   */
  private generateRtkQueryMigrationRecommendations(result: AnalysisResult): string {
    const { statistics } = result;
    
    // RTK Queryが全く使用されていない場合、または既に大部分が移行済みの場合はスキップ
    if (statistics.sourceDistribution['rtk-query'] === 0 || 
        statistics.sourceDistribution['rtk-query'] > statistics.totalEndpoints * 0.8) {
      return '';
    }
    
    let content = '';
    
    content += `### RTK Query移行計画\n\n`;
    
    // 現在の移行状況を計算
    const rtkEndpointCount = statistics.sourceDistribution['rtk-query'] || 0;
    const migrationPercentage = this.calculatePercentage(rtkEndpointCount, statistics.totalEndpoints);
    
    content += `- **移行進捗状況:** 現在、${migrationPercentage}%のエンドポイントがRTK Queryに移行済みです。\n`;
    
    // 移行手順の提案
    content += `- **推奨移行手順:**\n`;
    content += `  1. **類似エンドポイントのグループ化:** 関連する機能や同じリソースを扱うエンドポイントをグループ化し、一つのAPI定義にまとめる\n`;
    content += `  2. **優先順位付け:** 使用頻度の高いエンドポイントと副作用の少ないGETリクエストから移行を開始する\n`;
    content += `  3. **段階的導入:** 一度に全てを変更するのではなく、機能ごとに移行を進め、その都度テストを行う\n`;
    content += `  4. **コード生成の検討:** RTK Query使用のボイラープレートコードを削減するためのコード生成ツールの導入\n`;
    
    // 移行のメリット
    content += `- **移行のメリット:**\n`;
    content += `  - 状態管理の簡素化（ローディング、エラー、データ状態の自動管理）\n`;
    content += `  - キャッシュの自動最適化\n`;
    content += `  - タグベースの依存関係更新による一貫性の確保\n`;
    content += `  - TypeScript型安全性の向上\n`;
    
    content += '\n';
    return content;
  }
  
  /**
   * 複雑性改善の推奨事項生成
   * @param result 解析結果
   * @returns 生成されたMarkdownセクション
   */
  private generateComplexityRecommendations(result: AnalysisResult): string {
    const { endpoints } = result;
    
    // 複雑なエンドポイントが少ない場合はスキップ
    const complexEndpoints = rankEndpointsByComplexity(endpoints, 5)
      .filter(item => item.complexity > 15);
    
    if (complexEndpoints.length === 0) {
      return '';
    }
    
    let content = '';
    
    content += `### 複雑性の高いエンドポイントの改善\n\n`;
    
    content += `以下の複雑性の高いエンドポイントについて、リファクタリングを検討してください：\n\n`;
    
    for (const { endpoint, complexity } of complexEndpoints) {
      content += `- **${endpoint.method} \`${endpoint.path}\`** (複雑性スコア: ${complexity})\n`;
      
      // 複雑性の原因に基づく推奨事項
      const causes = [];
      if (endpoint.parametersUsed.length > 3) {
        causes.push('パラメータ数が多い');
      }
      if (endpoint.usageLocations.length > 10) {
        causes.push('使用箇所が広範囲に散らばっている');
      }
      if (endpoint.isDynamic) {
        causes.push('動的パスパラメータを使用している');
      }
      if (endpoint.responseHandling.some(h => h.type === 'transformation')) {
        causes.push('複雑なレスポンス変換処理がある');
      }
      
      if (causes.length > 0) {
        content += `  - 複雑性の原因: ${causes.join('、')}\n`;
      }
      
      content += `  - 改善提案:\n`;
      if (endpoint.parametersUsed.length > 3) {
        content += `    - パラメータを整理し、関連するものをオブジェクトにグループ化\n`;
      }
      if (endpoint.usageLocations.length > 10) {
        content += `    - カスタムフックやヘルパー関数を導入して再利用性を高める\n`;
      }
      if (endpoint.isDynamic) {
        content += `    - 動的パラメータに型定義を導入し、安全性を確保\n`;
      }
      if (endpoint.responseHandling.some(h => h.type === 'transformation')) {
        content += `    - レスポンス変換ロジックを分離し、ユニットテストを作成\n`;
      }
      
      // RTK Queryへの移行を提案
      if (endpoint.source !== 'rtk-query') {
        content += `    - RTK Queryに移行して状態管理を簡素化\n`;
      }
    }
    
    content += '\n';
    return content;
  }
  
  /**
   * コード品質向上の推奨事項生成
   * @returns 生成されたMarkdownセクション
   */
  private generateCodeQualityRecommendations(): string {
    let content = '';
    
    content += `### コード品質とテスト戦略\n\n`;
    
    content += `- **型安全性の強化:**\n`;
    content += `  - API接続層では厳格な型定義を導入し、リクエストとレスポンスの型を明示的に定義する\n`;
    content += `  - "unknown" 型を活用した型安全なパース処理の実装\n`;
    content += `  - ジェネリクスを活用して型の再利用性を高める\n\n`;
    
    content += `- **テスト戦略:**\n`;
    content += `  - 各エンドポイント呼び出しに単体テストを作成\n`;
    content += `  - MSW（Mock Service Worker）などを使用したAPIモックの導入\n`;
    content += `  - CI/CDパイプラインにテスト自動化を組み込む\n\n`;
    
    content += `- **ドキュメント整備:**\n`;
    content += `  - OpenAPI/Swaggerを使用したAPI仕様の文書化\n`;
    content += `  - 生成したエンドポイント分析レポートの定期的な更新\n`;
    content += `  - コードコメントによるAPI使用方法の説明充実\n\n`;
    
    content += `- **エラーハンドリングの改善:**\n`;
    content += `  - 一貫したエラー構造の定義\n`;
    content += `  - エラー状態のUI表示の標準化\n`;
    content += `  - ユーザーフレンドリーなエラーメッセージの提供\n\n`;
    
    content += `- **パフォーマンス監視:**\n`;
    content += `  - API呼び出しの処理時間計測の実装\n`;
    content += `  - エラー率の追跡\n`;
    content += `  - パフォーマンスメトリクスのダッシュボード作成\n\n`;
    
    return content;
  }
}
