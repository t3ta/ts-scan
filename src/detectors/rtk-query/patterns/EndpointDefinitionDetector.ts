/**
 * エンドポイント定義検出パターン
 * 
 * RTK Queryのエンドポイント定義を検出し、定義情報を抽出します。
 * builder.query()やbuilder.mutation()形式の定義を解析します。
 */

import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import { 
  DetectionContext, 
  EndpointInfo,
  EndpointPatternDetector
} from '../../../types';
import { logger } from '../../../utils/Logger';
import { NodePredicates } from '../../../utils/ast/NodePredicates';
import { RtkQueryApiParser } from '../parsers/RtkQueryApiParser';

/**
 * エンドポイント定義検出クラス
 */
export class EndpointDefinitionDetector implements EndpointPatternDetector {
  private apiParser: RtkQueryApiParser;

  /**
   * コンストラクタ
   * @param apiParser RTK Query API解析インスタンス
   */
  constructor(apiParser: RtkQueryApiParser) {
    this.apiParser = apiParser;
  }

  /**
   * パターン適用可否の判定
   * @param node 対象ノード
   * @returns パターンが適用可能かどうか
   */
  public canHandle(node: Node): boolean {
    // エンドポイントビルダーのquery/mutationメソッド呼び出しを検出
    // 例: builder.query({ ... }) または builder.mutation({ ... })
    if (!node.isKind(SyntaxKind.PropertyAccessExpression)) {
      return false;
    }
    
    const propAccess = node;
    const propName = propAccess.getName();
    
    if (propName !== 'query' && propName !== 'mutation') {
      return false;
    }
    
    const objExpr = propAccess.getExpression();
    // builderパラメータ名は様々なので、正確な判定は難しい
    // endpoints関数内のPropertyAccessExpressionであることを条件とする
    const isInEndpointsFunction = this.isNodeInEndpointsFunction(node);
    
    return isInEndpointsFunction;
  }

  /**
   * ノードがendpoints関数内に存在するか判定
   * @param node 対象ノード
   * @returns endpoints関数内に存在するならtrue
   */
  private isNodeInEndpointsFunction(node: Node): boolean {
    // 親の関数を検索
    const arrowFunc = node.getFirstAncestorByKind(SyntaxKind.ArrowFunction);
    if (!arrowFunc) {
      return false;
    }
    
    // その関数の親がendpointsプロパティに割り当てられているか
    const propAssign = arrowFunc.getFirstAncestorByKind(SyntaxKind.PropertyAssignment);
    if (!propAssign) {
      return false;
    }
    
    return propAssign.getName() === 'endpoints';
  }

  /**
   * エンドポイント情報の抽出
   * @param node 対象ノード（builder.query/mutation）
   * @param context 検出コンテキスト
   * @returns 抽出されたエンドポイント情報配列
   */
  public extractEndpoints(node: Node, context: DetectionContext): EndpointInfo[] {
    logger.debug(`[EndpointDefinitionDetector] エンドポイント定義からエンドポイント抽出開始`);
    
    try {
      // この段階では直接エンドポイント情報は返さない
      // エンドポイントメタデータを構築するだけで、使用箇所の検出で利用する
      // RTK Queryの場合、定義と使用が分離しているケースが多い
      
      // 必要に応じて定義情報を処理
      
      return [];
    } catch (error) {
      logger.error(`[EndpointDefinitionDetector] エンドポイント抽出中にエラーが発生: ${error}`);
      return [];
    }
  }
}
