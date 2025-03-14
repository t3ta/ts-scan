/**
 * サービスロケータークラス
 * 
 * 依存性注入のためのシンプルなサービスロケーターパターン実装です。
 * アプリケーション全体の依存関係を一元管理し、モジュール間の結合度を低減します。
 */

import { ServiceLocator as IServiceLocator } from '../types';
import { IASTProvider } from './ast/interfaces/IASTProvider';
import { createASTProvider } from './ast/factories/ASTProviderFactory';

/**
 * サービスロケーター実装
 */
export class ServiceLocator implements IServiceLocator {
  private static instance: ServiceLocator;
  private services: Map<string, any> = new Map();
  
  /**
   * プライベートコンストラクタ（シングルトンパターン）
   */
  private constructor() {}
  
  /**
   * サービスロケータのシングルトンインスタンスを取得
   * @returns サービスロケータインスタンス
   */
  public static getInstance(): ServiceLocator {
    if (!ServiceLocator.instance) {
      ServiceLocator.instance = new ServiceLocator();
    }
    return ServiceLocator.instance;
  }
  
  /**
   * サービスを登録する
   * @param serviceId サービス識別子
   * @param implementation サービス実装
   * @throws 登録済みのサービスIDが指定された場合にエラーを投げる
   */
  public register<T>(serviceId: string, implementation: T): void {
    if (this.services.has(serviceId)) {
      throw new Error(`サービス '${serviceId}' は既に登録されています`);
    }
    this.services.set(serviceId, implementation);
  }
  
  /**
   * サービスの登録を上書きする
   * @param serviceId サービス識別子
   * @param implementation サービス実装
   */
  public override<T>(serviceId: string, implementation: T): void {
    this.services.set(serviceId, implementation);
  }
  
  /**
   * 登録されたサービスを取得する
   * @param serviceId サービス識別子
   * @returns サービス実装
   * @throws 未登録のサービスIDが指定された場合にエラーを投げる
   */
  public resolve<T>(serviceId: string): T {
    if (!this.services.has(serviceId)) {
      throw new Error(`サービス '${serviceId}' が登録されていません`);
    }
    return this.services.get(serviceId) as T;
  }
  
  /**
   * サービスが登録されているか確認する
   * @param serviceId サービス識別子
   * @returns 登録されているかどうか
   */
  public has(serviceId: string): boolean {
    return this.services.has(serviceId);
  }
  
  /**
   * 登録されたすべてのサービスIDを取得する
   * @returns サービスID配列
   */
  public getRegisteredServiceIds(): string[] {
    return Array.from(this.services.keys());
  }
  
  /**
   * すべてのサービスを削除する（主にテスト用）
   */
  public clear(): void {
    this.services.clear();
  }
  
  /**
   * ASTプロバイダーを登録する
   * @param provider 登録するASTプロバイダー（省略時はデフォルトプロバイダーを生成）
   */
  public registerASTProvider(provider?: IASTProvider): void {
    const astProvider = provider || createASTProvider();
    this.register(ServiceIds.AST_PROVIDER, astProvider);
    
    // 型チェッカーも同時に登録（互換性のため）
    if (!this.has(ServiceIds.TYPE_CHECKER)) {
      this.register(ServiceIds.TYPE_CHECKER, astProvider.getTypeChecker());
    }
  }
  
  /**
   * ASTプロバイダーを取得する
   * @returns 登録されたASTプロバイダー
   * @throws ASTプロバイダーが登録されていない場合にエラーを投げる
   */
  public getASTProvider(): IASTProvider {
    if (!this.has(ServiceIds.AST_PROVIDER)) {
      this.registerASTProvider();
    }
    return this.resolve<IASTProvider>(ServiceIds.AST_PROVIDER);
  }
}

/**
 * サービスID定数
 * アプリケーション全体で使用されるサービスIDを一元管理
 */
export const ServiceIds = {
  // コアサービス
  LOGGER: 'logger',
  TYPE_CHECKER: 'typeChecker',
  AST_PROVIDER: 'astProvider',
  
  // 解析器
  URL_PARSER: 'urlParser',
  TYPE_HELPER: 'typeHelper',
  ENDPOINT_BUILDER: 'endpointBuilder',
  
  // 検出戦略
  AXIOS_STRATEGY: 'axiosStrategy',
  FETCH_STRATEGY: 'fetchStrategy',
  RTK_QUERY_STRATEGY: 'rtkQueryStrategy',
  CUSTOM_API_CLIENT_STRATEGY: 'customApiClientStrategy',
  DEFAULT_STRATEGY: 'defaultStrategy',
  
  // レポーター
  JSON_REPORTER: 'jsonReporter',
  MARKDOWN_REPORTER: 'markdownReporter'
};
