/**
 * APIインスタンス使用検出パターン
 * 
 * RTK QueryのAPIインスタンス使用を検出し、対応するエンドポイント情報を抽出します。
 * useQuery/useMutationフックの使用箇所を検出します。
 */

// ts-morphの直接インポートを避け、抽象インターフェースのみを使用するのだ
import { INode } from '../../../core/ast/interfaces/INode';
import { 
  DetectionContext, 
  EndpointInfo
} from '../../../types';
import { logger } from '../../../utils/Logger';
import { NodePredicates } from '../../../utils/ast/NodePredicates';
import { RtkQueryApiParser } from '../parsers/RtkQueryApiParser';
import { BasePatternDetector } from '../../common/PatternDetector';

/**
 * APIインスタンス使用検出クラス
 */
export class ApiInstanceUsageDetector extends BasePatternDetector {
  readonly patternName = 'ApiInstanceUsage';
  private apiParser: RtkQueryApiParser;

  /**
   * コンストラクタ
   * @param apiParser RTK Query API解析インスタンス
   */
  constructor(apiParser: RtkQueryApiParser) {
    super();
    this.apiParser = apiParser;
  }

  /**
   * パターン適用可否の判定
   * @param node 対象ノード
   * @returns パターンが適用可能かどうか
   */
  public canHandle(node: INode): boolean {
    return NodePredicates.isRtkQueryHookCall(node as any);
  }

  /**
   * エンドポイント情報の抽出
   * @param node 対象ノード（useXxxQuery/useXxxMutation呼び出し）
   * @param context 検出コンテキスト
   * @returns 抽出されたエンドポイント情報配列
   */
  public extractEndpoints(node: INode, context: DetectionContext): EndpointInfo[] {
    logger.debug(`[ApiInstanceUsageDetector] APIインスタンス使用からエンドポイント抽出開始`);
    
    try {
      // エンドポイント使用解析
      const endpointInfo = this.apiParser.analyzeEndpointUsage(node as any, context.sourceFile as any, context);
      
      if (endpointInfo) {
        return [endpointInfo];
      }
      
      return [];
    } catch (error) {
      logger.error(`[ApiInstanceUsageDetector] エンドポイント抽出中にエラーが発生: ${error}`);
      return [];
    }
  }
}
