/**
 * createApi呼び出し検出パターン
 * 
 * RTK QueryのcreateApi関数呼び出しを検出し、定義されたエンドポイント情報を抽出します。
 * endpointsプロパティに定義されたエンドポイントビルダーを解析します。
 */

// ts-morphの直接インポートを避け、抽象インターフェースのみを使用するのだ
import { INode } from '../../../core/ast/interfaces/INode';
import { ISourceFile } from '../../../core/ast/interfaces/ISourceFile';
import { 
  DetectionContext, 
  EndpointInfo,
  EndpointPatternDetector
} from '../../../types';
import { logger } from '../../../utils/Logger';
import { NodePredicates } from '../../../utils/ast/NodePredicates';
import { RtkQueryApiParser } from '../parsers/RtkQueryApiParser';
import { BasePatternDetector } from '../../common/PatternDetector';

/**
 * createApi呼び出し検出クラス
 */
export class CreateApiCallDetector extends BasePatternDetector {
  readonly patternName = 'CreateApiCall';
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
    return NodePredicates.isCreateApiCallExpression(node as any);
  }

  /**
   * エンドポイント情報の抽出
   * @param node 対象ノード（createApi呼び出し）
   * @param context 検出コンテキスト
   * @returns 抽出されたエンドポイント情報配列
   */
  public extractEndpoints(node: INode, context: DetectionContext): EndpointInfo[] {
    logger.debug(`[CreateApiCallDetector] createApi呼び出しからエンドポイント抽出開始`);
    
    try {
      // createApi呼び出しを解析してAPIメタデータを構築
      this.apiParser.parseCreateApiCall(node as any, context.sourceFile as any, context);
      
      // この段階では直接エンドポイント情報は返さない
      // エンドポイント使用箇所の検出で利用するためのメタデータを構築するだけ
      return [];
    } catch (error) {
      logger.error(`[CreateApiCallDetector] エンドポイント抽出中にエラーが発生: ${error}`);
      return [];
    }
  }
}
