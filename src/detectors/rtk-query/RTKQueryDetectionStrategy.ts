/**
 * RTK Queryエンドポイント検出戦略
 * 
 * Redux Toolkit Query APIを使用して宣言されたAPIエンドポイントを検出します。
 * 高度な型システム解析を用いて、エンドポイントの種別を正確に判別します。
 */

import { Node, SourceFile } from 'ts-morph';
import { 
  DetectionContext, 
  EndpointInfo, 
  EndpointPatternDetector,
  EndpointSource,
  RTKQuerySpecific
} from '../../types';
import { BaseDetectionStrategy } from '../common/BaseDetectionStrategy';
import { logger } from '../../utils/Logger';
import { NodePredicates } from '../../utils/ast/NodePredicates';
import { NodeTraversal } from '../../utils/ast/NodeTraversal';
import { CreateApiCallDetector } from './patterns/CreateApiCallDetector';
import { EndpointDefinitionDetector } from './patterns/EndpointDefinitionDetector';
import { EnhancedEndpointDefinitionDetector } from './patterns/EnhancedEndpointDefinitionDetector';
import { ApiInstanceUsageDetector } from './patterns/ApiInstanceUsageDetector';
import { RtkQueryApiParser } from './parsers/RtkQueryApiParser';
import { RtkQueryTypeDetector } from './parsers/RtkQueryTypeDetector';
import { EndpointType } from './parsers/RtkQueryTypeDefinitions';

/**
 * RTK Query検出戦略クラス
 * 型システムを活用した高精度なエンドポイント検出を提供します。
 */
export class RTKQueryDetectionStrategy extends BaseDetectionStrategy {
  public readonly name = 'RTKQueryDetectionStrategy';
  public readonly priority = 20;

  private detectors: EndpointPatternDetector[] = [];
  private apiParser: RtkQueryApiParser;
  private typeDetector: RtkQueryTypeDetector;
  private typeInfoCache: Map<string, string> = new Map<string, string>();

  /**
   * コンストラクタ
   */
  constructor() {
    super();
    this.apiParser = new RtkQueryApiParser();
    this.typeDetector = new RtkQueryTypeDetector();
    this.initializeDetectors();
  }

  /**
   * 検出器の初期化
   * 標準検出器と型ベース検出器を登録します
   */
  private initializeDetectors(): void {
    this.detectors = [
      // API呼び出しの検出
      new CreateApiCallDetector(this.apiParser),
      
      // エンドポイント定義の検出（従来型と型システム活用型の両方を登録）
      new EndpointDefinitionDetector(this.apiParser),
      new EnhancedEndpointDefinitionDetector(this.apiParser), // 新しい型ベース検出器
      
      // エンドポイント使用箇所の検出
      new ApiInstanceUsageDetector(this.apiParser)
    ];
    
    logger.info(`[${this.name}] RTK Query検出器初期化完了: ${this.detectors.length}個の検出パターンを登録`);
  }

  /**
   * 検出前の前処理
   * @param sourceFile 解析対象ソースファイル
   * @param context 検出コンテキスト
   */
  protected prepareDetection(sourceFile: SourceFile, context: DetectionContext): void {
    // RTK Queryの検出に必要な前処理
    this.scanCreateApiCalls(sourceFile, context);
    
    // 型情報の事前解析
    this.preAnalyzeTypeInformation(sourceFile, context);
  }

  /**
   * createApi呼び出しのスキャン
   * @param sourceFile 解析対象ソースファイル
   * @param context 検出コンテキスト
   */
  private scanCreateApiCalls(sourceFile: SourceFile, context: DetectionContext): void {
    logger.debug(`[${this.name}] createApiのスキャン開始: ${sourceFile.getFilePath()}`);
    
    // createApi関数呼び出しを検索
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
   * 型情報の事前解析
   * @param sourceFile 解析対象ソースファイル
   * @param context 検出コンテキスト
   */
  private preAnalyzeTypeInformation(sourceFile: SourceFile, context: DetectionContext): void {
    try {
      logger.debug(`[${this.name}] 型情報の事前解析開始: ${sourceFile.getFilePath()}`);
      
      // エンドポイント定義（build.query/mutation）を検索
      const endpointDefinitions = NodeTraversal.findNodes(
        sourceFile,
        (node) => {
          if (Node.isCallExpression(node)) {
            const expression = node.getExpression();
            if (Node.isPropertyAccessExpression(expression)) {
              const propName = expression.getName();
              return propName === 'query' || propName === 'mutation' || propName === 'infiniteQuery';
            }
          }
          return false;
        }
      );
      
      logger.debug(`[${this.name}] 潜在的なエンドポイント定義を ${endpointDefinitions.length}件 検出`);
      
      // 各エンドポイント定義の型情報を解析
      for (const node of endpointDefinitions) {
        const endpointType = this.typeDetector.detectEndpointType(node);
        if (endpointType) {
          logger.debug(`[${this.name}] エンドポイント型検出: ${node.getKindName()} => ${endpointType}`);
          
          // 検出された型情報をキャッシュに保存
          // getStart()の値をキーとして使用
          const nodeKey = node.getStart().toString();
          this.typeInfoCache.set(nodeKey, endpointType);
        }
      }
    } catch (error) {
      logger.error(`[${this.name}] 型情報の事前解析中にエラー: ${error}`);
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
    
    // エンドポイント情報の重複除去と統合
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
    
    // RTK Query固有の情報補完と型情報の拡充
    this.enrichEndpointTypeInformation(endpoints, context);
  }

  /**
   * エンドポイント情報を型情報で拡充
   * @param endpoints エンドポイント情報配列
   * @param context 検出コンテキスト
   */
  private enrichEndpointTypeInformation(
    endpoints: EndpointInfo[],
    context: DetectionContext
  ): void {
    for (const endpoint of endpoints) {
      // RTK Query固有情報の初期化（未設定の場合）
      if (!endpoint.rtkQuerySpecific) {
        endpoint.rtkQuerySpecific = this.createDefaultRtkQuerySpecific();
      }
      
      // 型情報に基づく精密な種別判定
      // エンドポイントの使用箇所を走査して定義箇所を探す
      for (const location of endpoint.usageLocations) {
        // 位置情報をキーにして型情報を取得
        const locationKey = location.columnNumber.toString();
        if (this.typeInfoCache.has(locationKey)) {
          const typeInfo = this.typeInfoCache.get(locationKey);
          
          // 型情報に基づいて種別を設定
          if (typeInfo === EndpointType.Query || typeInfo === EndpointType.InfiniteQuery) {
            endpoint.rtkQuerySpecific.isQuery = true;
            endpoint.rtkQuerySpecific.isMutation = false;
          } else if (typeInfo === EndpointType.Mutation) {
            endpoint.rtkQuerySpecific.isQuery = false;
            endpoint.rtkQuerySpecific.isMutation = true;
          }
        }
      }
      
      // 型情報がない場合はHTTPメソッドに基づくフォールバック判定
      if (!endpoint.rtkQuerySpecific.isQuery && !endpoint.rtkQuerySpecific.isMutation) {
        if (endpoint.method === 'GET') {
          endpoint.rtkQuerySpecific.isQuery = true;
          endpoint.rtkQuerySpecific.isMutation = false;
        } else {
          endpoint.rtkQuerySpecific.isQuery = false;
          endpoint.rtkQuerySpecific.isMutation = true;
        }
      }
      
      // メソッドと種別の整合性確認
      this.ensureMethodConsistency(endpoint);
    }
  }

  /**
   * メソッドと種別の整合性を確保
   * 種別とHTTPメソッドが矛盾している場合に調整
   * @param endpoint エンドポイント情報
   */
  private ensureMethodConsistency(endpoint: EndpointInfo): void {
    if (endpoint.rtkQuerySpecific) {
      // クエリなのにGET以外のメソッドになっている場合
      if (endpoint.rtkQuerySpecific.isQuery && endpoint.method !== 'GET') {
        logger.debug(`[${this.name}] エンドポイント ${endpoint.path} はクエリですがメソッドが ${endpoint.method} です。GETに調整します。`);
        endpoint.method = 'GET';
      }
      
      // ミューテーションなのにGETになっている場合
      if (endpoint.rtkQuerySpecific.isMutation && endpoint.method === 'GET') {
        logger.debug(`[${this.name}] エンドポイント ${endpoint.path} はミューテーションですがメソッドが GET です。POSTに調整します。`);
        endpoint.method = 'POST';
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
