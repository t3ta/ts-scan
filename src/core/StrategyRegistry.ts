/**
 * 戦略レジストリ
 * 
 * エンドポイント検出戦略を登録・管理するためのレジストリを提供します。
 * 戦略の優先度に基づく実行順序の制御や、動的な戦略の追加・削除を行います。
 */

import { EndpointDetectionStrategy, ServiceLocator } from '../types';
import { ServiceIds } from './ServiceLocator';
import { logger } from '../utils/Logger';

/**
 * 戦略レジストリクラス
 */
export class StrategyRegistry {
  private strategies: Map<string, EndpointDetectionStrategy> = new Map();
  private serviceLocator: ServiceLocator;
  
  /**
   * コンストラクタ
   * @param serviceLocator サービスロケータ
   */
  constructor(serviceLocator: ServiceLocator) {
    this.serviceLocator = serviceLocator;
  }
  
  /**
   * 検出戦略を登録
   * @param strategy 検出戦略
   * @throws 同名の戦略が既に登録されている場合はエラー
   */
  public registerStrategy(strategy: EndpointDetectionStrategy): void {
    if (this.strategies.has(strategy.name)) {
      throw new Error(`戦略 '${strategy.name}' は既に登録されています`);
    }
    
    this.strategies.set(strategy.name, strategy);
    logger.debug(`戦略を登録しました: ${strategy.name} (優先度: ${strategy.priority})`);
  }
  
  /**
   * 検出戦略の登録を解除
   * @param strategyName 検出戦略名
   * @returns 解除に成功したかどうか
   */
  public unregisterStrategy(strategyName: string): boolean {
    const result = this.strategies.delete(strategyName);
    
    if (result) {
      logger.debug(`戦略の登録を解除しました: ${strategyName}`);
    }
    
    return result;
  }
  
  /**
   * 指定された名前の検出戦略を取得
   * @param strategyName 検出戦略名
   * @returns 検出戦略、未登録の場合はundefined
   */
  public getStrategy(strategyName: string): EndpointDetectionStrategy | undefined {
    return this.strategies.get(strategyName);
  }
  
  /**
   * 登録されているすべての検出戦略を優先度順で取得
   * @returns 検出戦略の配列
   */
  public getAllStrategies(): EndpointDetectionStrategy[] {
    return Array.from(this.strategies.values())
      .sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * サービスロケータに登録されているすべての検出戦略を登録
   */
  public registerAllStrategiesFromServiceLocator(): void {
    const serviceIds = this.serviceLocator.getRegisteredServiceIds ? 
      this.serviceLocator.getRegisteredServiceIds() : 
      [];
    
    // 各戦略用サービスIDを確認
    const strategyServiceIds = [
      ServiceIds.AXIOS_STRATEGY,
      ServiceIds.FETCH_STRATEGY,
      ServiceIds.RTK_QUERY_STRATEGY,
      ServiceIds.CUSTOM_API_CLIENT_STRATEGY,
      ServiceIds.DEFAULT_STRATEGY
    ];
    
    for (const serviceId of serviceIds) {
      if (strategyServiceIds.includes(serviceId)) {
        try {
          const strategy = this.serviceLocator.resolve<EndpointDetectionStrategy>(serviceId);
          this.registerStrategy(strategy);
        } catch (error) {
          logger.error(`サービスロケータからの戦略登録中にエラーが発生: ${error}`);
        }
      }
    }
    
    logger.info(`登録された戦略数: ${this.strategies.size}`);
  }
  
  /**
   * 登録されている戦略数を取得
   * @returns 戦略数
   */
  public getStrategyCount(): number {
    return this.strategies.size;
  }
  
  /**
   * すべての戦略を削除
   */
  public clearAllStrategies(): void {
    this.strategies.clear();
    logger.debug('すべての戦略を削除しました');
  }
  
  /**
   * 戦略の優先度を更新
   * @param strategyName 検出戦略名
   * @param newPriority 新しい優先度
   * @returns 更新に成功したかどうか
   */
  public updateStrategyPriority(strategyName: string, newPriority: number): boolean {
    const strategy = this.strategies.get(strategyName);
    
    if (!strategy) {
      return false;
    }
    
    // 優先度プロパティを直接更新できない場合の回避策
    (strategy as any).priority = newPriority;
    
    logger.debug(`戦略 '${strategyName}' の優先度を ${newPriority} に更新しました`);
    return true;
  }
}
