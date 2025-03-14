/**
 * RTK Query API 解析ファサードモジュール
 * 
 * RTK Query APIの解析に関する各サブモジュールを統合し、
 * 統一されたインターフェースを提供するファサードパターン実装です。
 * 外部モジュールはこのクラスを通じてRTK Query解析機能を利用します。
 */

import { Node, SourceFile } from 'ts-morph';
import { DetectionContext, EndpointInfo } from '../../../types';
import { logger } from '../../../utils/Logger';
import { rtkApiMetadataManager } from './RtkApiMetadataManager';
import { RtkApiConfigExtractor } from './RtkApiConfigExtractor';
import { RtkEndpointDefinitionParser } from './RtkEndpointDefinitionParser';
import { RtkEndpointUsageAnalyzer } from './RtkEndpointUsageAnalyzer';
import { NodePredicates } from '../../../utils/ast/NodePredicates';

/**
 * RTK Query API解析ファサードクラス
 * 
 * RTK Query解析の統合エントリーポイントとして機能し、
 * 内部実装の詳細を隠蔽しながら必要な機能を提供します。
 */
export class RtkQueryApiParser {
  private apiConfigExtractor: RtkApiConfigExtractor;
  private endpointDefinitionParser: RtkEndpointDefinitionParser;
  private endpointUsageAnalyzer: RtkEndpointUsageAnalyzer;

  /**
   * コンストラクタ
   * 必要なサブコンポーネントを初期化します。
   */
  constructor() {
    this.apiConfigExtractor = new RtkApiConfigExtractor();
    this.endpointDefinitionParser = new RtkEndpointDefinitionParser();
    this.endpointUsageAnalyzer = new RtkEndpointUsageAnalyzer();
  }

  /**
   * createApi呼び出しの解析
   * @param node createApi呼び出しノード
   * @param sourceFile ソースファイル
   * @param context 検出コンテキスト
   */
  public parseCreateApiCall(
    node: Node, 
    sourceFile: SourceFile, 
    context: DetectionContext
  ): void {
    logger.debug(`[RtkQueryApiParser] createApi呼び出しの解析開始: ${sourceFile.getFilePath()}`);
    
    try {
      // 1. API設定の抽出
      const apiMetadata = this.apiConfigExtractor.extractApiFromCreateApiCall(node, sourceFile, context);
      if (!apiMetadata) {
        logger.warn(`[RtkQueryApiParser] API設定の抽出に失敗しました`);
        return;
      }
      
      // 2. エンドポイント定義の解析
      // APIメタデータは既にmanagerに登録されているので、設定オブジェクトを取得して直接渡す
      const configObject = node.getFirstDescendant(n => n.getKind() === Node.isObjectLiteralExpression);
      if (configObject && Node.isObjectLiteralExpression(configObject)) {
        this.endpointDefinitionParser.parseEndpointBuilder(configObject, apiMetadata, context);
      }
      
      // 3. インポート情報の解析
      rtkApiMetadataManager.parseAndRegisterImports(sourceFile);
      
      logger.debug(`[RtkQueryApiParser] API "${apiMetadata.apiName}" の解析完了、${apiMetadata.endpoints.size}個のエンドポイントを検出`);
    } catch (error) {
      logger.error(`[RtkQueryApiParser] createApi解析中にエラーが発生: ${error}`);
    }
  }

  /**
   * エンドポイント使用箇所の解析
   * @param node 対象ノード
   * @param sourceFile ソースファイル
   * @param context 検出コンテキスト
   * @returns 検出されたエンドポイント情報
   */
  public analyzeEndpointUsage(
    node: Node,
    sourceFile: SourceFile,
    context: DetectionContext
  ): EndpointInfo | undefined {
    try {
      // 1. API使用情報の抽出
      const usageInfo = this.endpointUsageAnalyzer.analyzeApiUsage(node, sourceFile, context);
      if (!usageInfo) {
        return undefined;
      }
      
      // 2. 使用情報からエンドポイント情報を構築
      return this.endpointUsageAnalyzer.constructEndpointInfoFromUsage(usageInfo, node, context);
    } catch (error) {
      logger.error(`[RtkQueryApiParser] エンドポイント使用解析中にエラーが発生: ${error}`);
      return undefined;
    }
  }

  /**
   * ソースファイルからすべてのRTK Queryエンドポイントを検出
   * @param sourceFile ソースファイル
   * @param context 検出コンテキスト
   * @returns 検出されたエンドポイント情報の配列
   */
  public detectAllEndpoints(
    sourceFile: SourceFile,
    context: DetectionContext
  ): EndpointInfo[] {
    const endpoints: EndpointInfo[] = [];
    
    try {
      // ファイル内のインポート情報を解析して登録
      rtkApiMetadataManager.parseAndRegisterImports(sourceFile);
      
      // エンドポイント使用箇所の検出
      sourceFile.forEachDescendant(node => {
        if (NodePredicates.isRtkQueryHookCall(node)) {
          const endpointInfo = this.analyzeEndpointUsage(node, sourceFile, context);
          if (endpointInfo) {
            endpoints.push(endpointInfo);
          }
        }
      });
      
      // 重複除去（同一エンドポイントへの複数の参照をマージ）
      return this.deduplicateEndpoints(endpoints);
    } catch (error) {
      logger.error(`[RtkQueryApiParser] エンドポイント検出中にエラーが発生: ${error}`);
      return [];
    }
  }

  /**
   * 登録されているすべてのAPIメタデータを取得
   * @returns APIメタデータの配列
   */
  public getAllApiMetadata() {
    return rtkApiMetadataManager.getAllApiMetadata();
  }

  /**
   * 登録されているすべてのエンドポイントメタデータを取得
   * @returns エンドポイントメタデータの配列
   */
  public getAllEndpointMetadata() {
    return rtkApiMetadataManager.getAllEndpointMetadata();
  }

  /**
   * 検出されたエンドポイントの重複を除去
   * @param endpoints エンドポイント情報配列
   * @returns 重複除去後のエンドポイント情報配列
   */
  private deduplicateEndpoints(endpoints: EndpointInfo[]): EndpointInfo[] {
    const uniqueEndpoints: EndpointInfo[] = [];
    const endpointMap = new Map<string, EndpointInfo>();
    
    for (const endpoint of endpoints) {
      const key = `${endpoint.method}:${endpoint.path}`;
      
      if (endpointMap.has(key)) {
        // 既存エントリにマージ
        const existing = endpointMap.get(key)!;
        
        // 使用箇所を結合
        existing.usageLocations.push(...endpoint.usageLocations);
        
        // パラメータを結合
        for (const param of endpoint.parametersUsed) {
          const existingParam = existing.parametersUsed.find(p => p.name === param.name);
          if (existingParam) {
            existingParam.locations.push(...param.locations);
          } else {
            existing.parametersUsed.push(param);
          }
        }
        
        // レスポンス処理を結合
        existing.responseHandling.push(...endpoint.responseHandling);
      } else {
        // 新規エントリとして追加
        endpointMap.set(key, {...endpoint});
      }
    }
    
    return Array.from(endpointMap.values());
  }
}
