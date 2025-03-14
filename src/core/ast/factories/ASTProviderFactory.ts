/**
 * ASTプロバイダーファクトリー
 * 
 * 実行環境やコンテキストに応じた適切なASTプロバイダーを生成するファクトリークラスです。
 * テスト環境ではモック実装を、本番環境ではts-morph実装を提供します。
 */

import { IASTProvider } from '../interfaces/IASTProvider';
import { TsMorphAdapter } from '../adapters/TsMorphAdapter';
import { MockProvider, ASTSnapshot } from '../implementations/MockProvider';

/**
 * 環境の種類
 */
export enum EnvironmentType {
  Production,
  Test,
  Development
}

/**
 * ASTプロバイダーファクトリークラス
 */
export class ASTProviderFactory {
  private static instance: ASTProviderFactory;
  private currentEnvironment: EnvironmentType;
  private cachedProviders: Map<string, IASTProvider> = new Map();
  
  /**
   * プライベートコンストラクタ（シングルトンパターン）
   */
  private constructor() {
    // デフォルトでは本番環境と判断
    this.currentEnvironment = EnvironmentType.Production;
    
    // 環境変数からテスト環境かどうかを判定
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      this.currentEnvironment = EnvironmentType.Test;
    } else if (process.env.NODE_ENV === 'development') {
      this.currentEnvironment = EnvironmentType.Development;
    }
  }
  
  /**
   * シングルトンインスタンスを取得する
   * @returns ファクトリーのインスタンス
   */
  public static getInstance(): ASTProviderFactory {
    if (!ASTProviderFactory.instance) {
      ASTProviderFactory.instance = new ASTProviderFactory();
    }
    return ASTProviderFactory.instance;
  }
  
  /**
   * 環境タイプを設定する
   * @param environment 設定する環境タイプ
   */
  public setEnvironmentType(environment: EnvironmentType): void {
    this.currentEnvironment = environment;
    this.clearCache();
  }
  
  /**
   * 現在の環境タイプを取得する
   * @returns 現在の環境タイプ
   */
  public getEnvironmentType(): EnvironmentType {
    return this.currentEnvironment;
  }
  
  /**
   * キャッシュをクリアする
   */
  public clearCache(): void {
    // 既存のプロバイダーをリセットしてキャッシュをクリア
    for (const provider of this.cachedProviders.values()) {
      provider.reset();
    }
    this.cachedProviders.clear();
  }
  
  /**
   * ASTプロバイダーを作成する
   * @param options オプション（環境に応じた追加設定）
   * @returns 環境に適したASTプロバイダーのインスタンス
   */
  public createProvider(options: {
    tsConfigPath?: string;
    mockSnapshots?: ASTSnapshot[];
    cacheKey?: string;
  } = {}): IASTProvider {
    const { tsConfigPath, mockSnapshots, cacheKey } = options;
    
    // キャッシュキーが指定されている場合はキャッシュを確認
    if (cacheKey && this.cachedProviders.has(cacheKey)) {
      return this.cachedProviders.get(cacheKey)!;
    }
    
    let provider: IASTProvider;
    
    // 環境に応じたプロバイダーの作成
    switch (this.currentEnvironment) {
      case EnvironmentType.Test:
        // テスト環境ではモックプロバイダーを使用
        provider = new MockProvider(mockSnapshots || []);
        break;
        
      case EnvironmentType.Development:
      case EnvironmentType.Production:
      default:
        // 開発・本番環境ではts-morphアダプターを使用
        provider = new TsMorphAdapter(tsConfigPath);
        break;
    }
    
    // キャッシュキーが指定されている場合はキャッシュに保存
    if (cacheKey) {
      this.cachedProviders.set(cacheKey, provider);
    }
    
    return provider;
  }
  
  /**
   * 強制的にモックプロバイダーを作成する
   * 環境設定に関わらず明示的にモックを使用したい場合に使用
   * @param snapshots モックで使用するASTスナップショット
   * @param cacheKey オプションのキャッシュキー
   * @returns モックASTプロバイダーのインスタンス
   */
  public createMockProvider(snapshots: ASTSnapshot[] = [], cacheKey?: string): IASTProvider {
    const provider = new MockProvider(snapshots);
    
    // キャッシュキーが指定されている場合はキャッシュに保存
    if (cacheKey) {
      this.cachedProviders.set(cacheKey, provider);
    }
    
    return provider;
  }
  
  /**
   * 強制的にts-morphアダプターを作成する
   * 環境設定に関わらず明示的にts-morphを使用したい場合に使用
   * @param tsConfigPath オプションのtsconfig.jsonのパス
   * @param cacheKey オプションのキャッシュキー
   * @returns ts-morphアダプターのインスタンス
   */
  public createTsMorphProvider(tsConfigPath?: string, cacheKey?: string): IASTProvider {
    const provider = new TsMorphAdapter(tsConfigPath);
    
    // キャッシュキーが指定されている場合はキャッシュに保存
    if (cacheKey) {
      this.cachedProviders.set(cacheKey, provider);
    }
    
    return provider;
  }
}

/**
 * デフォルトのファクトリーインスタンスを取得するヘルパー関数
 * @returns ASTプロバイダーファクトリーのデフォルトインスタンス
 */
export function getDefaultFactory(): ASTProviderFactory {
  return ASTProviderFactory.getInstance();
}

/**
 * デフォルトの設定でプロバイダーを作成するヘルパー関数
 * @param options オプション（環境に応じた追加設定）
 * @returns 環境に適したASTプロバイダーのインスタンス
 */
export function createASTProvider(options?: {
  tsConfigPath?: string;
  mockSnapshots?: ASTSnapshot[];
  cacheKey?: string;
}): IASTProvider {
  return getDefaultFactory().createProvider(options);
}
