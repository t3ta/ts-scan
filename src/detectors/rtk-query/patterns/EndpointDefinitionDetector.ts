/**
 * エンドポイント定義検出パターン
 * 
 * RTK Queryのエンドポイント定義を検出し、定義情報を抽出します。
 * builder.query()やbuilder.mutation()形式の定義を解析します。
 */

// ts-morphの直接インポートを避け、抽象インターフェースのみを使用するのだ
import { INode, NodeKind } from '../../../core/ast/interfaces/INode';
import { 
  DetectionContext, 
  EndpointInfo
} from '../../../types';
import { logger } from '../../../utils/Logger';
import { RtkQueryApiParser } from '../parsers/RtkQueryApiParser';
import { BasePatternDetector } from '../../common/PatternDetector';

/**
 * エンドポイント定義検出クラス
 */
export class EndpointDefinitionDetector extends BasePatternDetector {
  readonly patternName = 'EndpointDefinition';
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
    // エンドポイントビルダーのquery/mutationメソッド呼び出しを検出
    // 例: builder.query({ ... }) または builder.mutation({ ... })
    if (!node.isKind(NodeKind.PropertyAccessExpression)) {
      return false;
    }
    
    const propAccess = node;
    const propName = (propAccess as any).getName?.();
    
    if (propName !== 'query' && propName !== 'mutation') {
      return false;
    }
    
    // endpoints関数内のPropertyAccessExpressionであることを条件とする
    const isInEndpointsFunction = this.isNodeInEndpointsFunction(node);
    
    return isInEndpointsFunction;
  }

  /**
   * ノードがendpoints関数内に存在するか判定
   * @param node 対象ノード
   * @returns endpoints関数内に存在するならtrue
   */
  private isNodeInEndpointsFunction(node: INode): boolean {
    // getAncestorsメソッドを使って親を検索
    const ancestors = node.getAncestors?.() || [];
    
    // ArrowFunctionを探す
    const arrowFunc = ancestors.find(n => n.isKind(NodeKind.ArrowFunction));
    if (!arrowFunc) {
      return false;
    }
    
    // PropertyAssignmentを探す
    const propAssign = ancestors.find(n => n.isKind(NodeKind.PropertyAssignment));
    if (!propAssign) {
      return false;
    }
    
    // propertyAssignmentのnameが'endpoints'か確認
    return (propAssign as any).getName?.() === 'endpoints';
  }

  /**
   * エンドポイント情報の抽出
   * @param node 対象ノード（builder.query/mutation）
   * @param context 検出コンテキスト
   * @returns 抽出されたエンドポイント情報配列
   */
  public extractEndpoints(node: INode, context: DetectionContext): EndpointInfo[] {
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
