/**
 * RTK Queryエンドポイント検出戦略
 * 
 * Redux Toolkit Query APIを使用して宣言されたAPIエンドポイントを検出します。
 * createApi呼び出し、エンドポイント定義、および使用箇所を解析します。
 */

// 不要な型定義をコメントアウトして警告を抑制
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import { 
  DetectionContext, 
  EndpointInfo, 
  EndpointPatternDetector,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  HttpMethod,
  RTKQuerySpecific,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ServiceLocator,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  UsageLocation
} from '../../types';
import { BaseDetectionStrategy } from '../common/BaseDetectionStrategy';
import { logger } from '../../utils/Logger';
import { NodePredicates } from '../../utils/ast/NodePredicates';
import { NodeTraversal } from '../../utils/ast/NodeTraversal';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ServiceIds } from '../../core/ServiceLocator';
import { CreateApiCallDetector } from './patterns/CreateApiCallDetector';
import { EndpointDefinitionDetector } from './patterns/EndpointDefinitionDetector';
import { ApiInstanceUsageDetector } from './patterns/ApiInstanceUsageDetector';
import { RtkQueryApiParser } from './parsers/RtkQueryApiParser';

/**
 * RTK Query検出戦略クラス
 */
export class RTKQueryDetectionStrategy extends BaseDetectionStrategy {
  public readonly name = 'RTKQueryDetectionStrategy';
  public readonly priority = 20;

  private detectors: EndpointPatternDetector[] = [];
  private apiParser: RtkQueryApiParser;

  /**
   * コンストラクタ
   */
  constructor() {
    super();
    this.apiParser = new RtkQueryApiParser();
    this.initializeDetectors();
  }

  /**
   * 検出器の初期化
   */
  private initializeDetectors(): void {
    this.detectors = [
      new CreateApiCallDetector(this.apiParser),
      new EndpointDefinitionDetector(this.apiParser),
      new ApiInstanceUsageDetector(this.apiParser)
    ];
  }

  /**
   * 検出前の前処理
   * @param sourceFile 解析対象ソースファイル
   * @param context 検出コンテキスト
   */
  protected prepareDetection(sourceFile: SourceFile, context: DetectionContext): void {
    // RTK Queryの検出に必要な前処理
    // createApiの呼び出し情報をスキャンして記録
    this.scanCreateApiCalls(sourceFile, context);
  }

  /**
   * createApi呼び出しのスキャン
   * @param sourceFile 解析対象ソースファイル
   * @param context 検出コンテキスト
   */
  private scanCreateApiCalls(sourceFile: SourceFile, context: DetectionContext): void {
    logger.debug(`[${this.name}] createApiのスキャン開始: ${sourceFile.getFilePath()}`);
    
    // createApi関数呼び出しを検索
    // NodeTraversal.findNodesを使用
    const nodes = NodeTraversal.findNodes(
      sourceFile, 
      NodePredicates.isCreateApiCallExpression
    );

    if (nodes.length > 0) {
      logger.debug(`[${this.name}] ${nodes.length}個のcreateApi呼び出しを検出`);
      
      // 各createApi呼び出しをパースしてAPIメタデータを登録
      for (const node of nodes) {
        this.apiParser.parseCreateApiCall(node, sourceFile, context);
      }
    }
  }

  /**
   * エンドポイント検出の主処理
   * @param sourceFile 解析対象ソースファイル
   * @param context 検出コンテキスト
   * @returns 検出されたエンドポイント情報の配列
   */
  protected performDetection(sourceFile: SourceFile, context: DetectionContext): EndpointInfo[] {
    logger.debug(`[${this.name}] エンドポイント検出開始: ${sourceFile.getFilePath()}`);
    
    const endpoints: EndpointInfo[] = [];
    
    // ファイル内の全ノードを走査
    sourceFile.forEachDescendant((node) => {
      for (const detector of this.detectors) {
        if (detector.canHandle(node)) {
          try {
            const detectedEndpoints = detector.extractEndpoints(node, context);
            endpoints.push(...detectedEndpoints);
          } catch (error) {
            logger.error(`[${this.name}] エンドポイント抽出中にエラー: ${error}`);
          }
        }
      }
    });
    
    // エンドポイント情報の重複除去
    const uniqueEndpoints = this.deduplicateEndpoints(endpoints);
    
    logger.debug(`[${this.name}] エンドポイント検出完了: ${uniqueEndpoints.length}件`);
    return uniqueEndpoints;
  }

  /**
   * 検出後の後処理
   * @param endpoints 検出されたエンドポイント情報配列
   * @param sourceFile 解析対象ソースファイル
   * @param context 検出コンテキスト
   */
  protected finalizeDetection(
    endpoints: EndpointInfo[], 
    sourceFile: SourceFile, 
    context: DetectionContext
  ): void {
    // 基底クラスの処理を実行
    super.finalizeDetection(endpoints, sourceFile, context);
    
    // RTK Query固有の情報補完
    for (const endpoint of endpoints) {
      // RTK Query固有情報の初期化（未設定の場合）
      if (!endpoint.rtkQuerySpecific) {
        endpoint.rtkQuerySpecific = this.createDefaultRtkQuerySpecific();
      }
      
      // メソッドに基づくクエリ/ミューテーション情報の補完
      if (endpoint.method === 'GET') {
        endpoint.rtkQuerySpecific.isQuery = true;
        endpoint.rtkQuerySpecific.isMutation = false;
      } else {
        endpoint.rtkQuerySpecific.isQuery = false;
        endpoint.rtkQuerySpecific.isMutation = true;
      }
    }
  }

  /**
   * RTK Query固有情報のデフォルト値を作成
   * @returns デフォルトのRTK Query固有情報
   */
  private createDefaultRtkQuerySpecific(): RTKQuerySpecific {
    return {
      isQuery: false,
      isMutation: false,
      transformResponseUsed: false,
      baseQueryUsed: true
    };
  }
}
