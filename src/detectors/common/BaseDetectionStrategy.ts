/**
 * エンドポイント検出戦略 - 基底クラス
 * 
 * 各エンドポイント検出戦略の共通基盤となる抽象基底クラスを提供します。
 * 基本的な検出フレームワークと共通のユーティリティメソッドを実装します。
 */

import { Node, SourceFile } from 'ts-morph';
import { ISourceFile } from '../../core/ast/interfaces/ISourceFile';
import { 
  EndpointDetectionStrategy, 
  EndpointInfo, 
  DetectionContext,
  UsageLocation,
  ParameterUsage,
  ResponseUsage,
  HttpMethod,
  EndpointSource
} from '../../types';
import { ServiceLocator, ServiceIds } from '../../core/ServiceLocator';
import { logger } from '../../utils/Logger';
import { NodeExtractors } from '../../utils/ast/NodeExtractors';
import { UrlNormalizer } from '../../utils/http/UrlNormalizer';

/**
 * 検出戦略基底クラス
 */
export abstract class BaseDetectionStrategy implements EndpointDetectionStrategy {
  abstract readonly name: string;
  abstract readonly priority: number;
  
  /**
   * エンドポイント検出メイン処理（テンプレートメソッドパターン）
   * @param sourceFile 解析対象ソースファイル
   * @param context 検出コンテキスト
   * @returns 検出されたエンドポイント情報配列
   */
  public detect(sourceFile: ISourceFile, context: DetectionContext): EndpointInfo[] {
    const startTime = Date.now();
    logger.debug(`[${this.name}] 解析開始: ${sourceFile.getFilePath()}`);
    
    try {
      // 1. 検出前の前処理
      this.prepareDetection(sourceFile, context);
      
      // 2. エンドポイント検出実行
      const endpoints = this.performDetection(sourceFile, context);
      
      // 3. 検出後の後処理
      this.finalizeDetection(endpoints, sourceFile, context);
      
      const endTime = Date.now();
      logger.debug(`[${this.name}] 解析完了: ${sourceFile.getFilePath()} (${endpoints.length}件, ${endTime - startTime}ms)`);
      
      return endpoints;
    } catch (error) {
      logger.error(`[${this.name}] 解析中にエラーが発生: ${error}`);
      return [];
    }
  }
  
  /**
   * 検出前の前処理（オーバーライド可能）
   * @param sourceFile 解析対象ソースファイル
   * @param context 検出コンテキスト
   */
  protected prepareDetection(sourceFile: ISourceFile, context: DetectionContext): void {
    // デフォルトでは何もしない
  }
  
  /**
   * 実際のエンドポイント検出処理（サブクラスで実装）
   * @param sourceFile 解析対象ソースファイル
   * @param context 検出コンテキスト
   * @returns 検出されたエンドポイント情報配列
   */
  protected abstract performDetection(sourceFile: ISourceFile, context: DetectionContext): EndpointInfo[];
  
  /**
   * 検出後の後処理（オーバーライド可能）
   * @param endpoints 検出されたエンドポイント情報配列
   * @param sourceFile 解析対象ソースファイル
   * @param context 検出コンテキスト
   */
  protected finalizeDetection(
    endpoints: EndpointInfo[], 
    sourceFile: ISourceFile, 
    context: DetectionContext
  ): void {
    // デフォルトではエンドポイント情報の補完を行う
    this.complementEndpointInfo(endpoints, sourceFile);
  }
  
  /**
   * 検出されたエンドポイント情報の補完
   * @param endpoints エンドポイント情報配列
   * @param sourceFile 解析対象ソースファイル
   */
  protected complementEndpointInfo(endpoints: EndpointInfo[], sourceFile: ISourceFile): void {
    const filePath = sourceFile.getFilePath();
    
    for (const endpoint of endpoints) {
      // 1. 動的パラメータフラグの設定
      if (endpoint.path) {
        endpoint.isDynamic = endpoint.path.includes(':') || endpoint.path.includes('{');
      }
      
      // 2. 機能カテゴリの推定（未設定の場合）
      if (!endpoint.featureCategory) {
        endpoint.featureCategory = NodeExtractors.inferFeatureCategoryFromPath(filePath);
      }
      
      // 3. APIバージョンの抽出（未設定の場合）
      if (!endpoint.apiVersion && endpoint.path) {
        const version = UrlNormalizer.extractApiVersion(endpoint.path);
        if (version) {
          endpoint.apiVersion = version;
        }
      }
      
      // 4. 必須フィールドの保証
      if (!endpoint.usageLocations) {
        endpoint.usageLocations = [];
      }
      
      if (!endpoint.parametersUsed) {
        endpoint.parametersUsed = [];
      }
      
      if (!endpoint.responseHandling) {
        endpoint.responseHandling = [];
      }
      
      // 5. パスの正規化
      if (endpoint.path) {
        endpoint.path = UrlNormalizer.normalize(endpoint.path);
      }
    }
  }
  
  /**
   * 使用箇所情報の作成
   * @param node 対象ノード
   * @param sourceFile ソースファイル
   * @param context コンテキスト情報
   * @returns 使用箇所情報
   */
  protected createUsageLocation(
    node: Node, 
    sourceFile: ISourceFile, 
    context?: string
  ): UsageLocation {
    return NodeExtractors.createUsageLocation(node, sourceFile, context);
  }
  
  /**
   * エンドポイント情報の作成
   * @param path パス
   * @param method HTTPメソッド
   * @param location 使用箇所
   * @param params パラメータ
   * @param responseHandling レスポンス処理
   * @param source 検出元
   * @param additionalInfo 追加情報
   * @returns 作成されたエンドポイント情報
   */
  protected createEndpointInfo(
    path: string,
    method: HttpMethod,
    location: UsageLocation,
    params: ParameterUsage[],
    responseHandling: ResponseUsage[],
    source: EndpointSource,
    additionalInfo?: any
  ): EndpointInfo {
    const endpointInfo: EndpointInfo = {
      path: UrlNormalizer.normalize(path),
      method,
      isDynamic: path.includes(':') || path.includes('{'),
      usageLocations: [location],
      parametersUsed: params,
      responseHandling: responseHandling,
      source
    };
    
    // 追加情報の統合
    if (additionalInfo) {
      Object.assign(endpointInfo, additionalInfo);
    }
    
    return endpointInfo;
  }
  
  /**
   * 検出されたエンドポイントの重複を除去
   * @param endpoints エンドポイント情報配列
   * @returns 重複除去後のエンドポイント情報配列
   */
  protected deduplicateEndpoints(endpoints: EndpointInfo[]): EndpointInfo[] {
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
  
  /**
   * 指定されたサービスのインスタンスを取得
   * @param serviceId サービスID
   * @param context 検出コンテキスト
   * @returns サービスインスタンス
   */
  protected getService<T>(serviceId: string, context: DetectionContext): T {
    if (context.serviceLocator) {
      return context.serviceLocator.resolve<T>(serviceId);
    }
    
    return ServiceLocator.getInstance().resolve<T>(serviceId);
  }
}
