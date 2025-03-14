/**
 * エンドポイント検出 - エンドポイントビルダークラス
 * 
 * エンドポイント情報オブジェクトを構築するためのビルダークラスを提供します。
 * 一貫性のあるエンドポイント情報構築と、柔軟な属性設定を可能にします。
 */

import {
  HttpMethod,
  UsageLocation,
  ParameterUsage,
  ResponseUsage,
  EndpointInfo,
  EndpointSource,
  IEndpointBuilder,
  RTKQuerySpecific,
  DetectionContext
} from '../../types';
import { UrlNormalizer } from '../../utils/http/UrlNormalizer';
import { NodeExtractors } from '../../utils/ast/NodeExtractors';

/**
 * エンドポイント情報ビルダークラス
 */
export class EndpointBuilder implements IEndpointBuilder {
  // 必須フィールド
  private path: string;
  private method: HttpMethod;
  private source: EndpointSource;
  
  // オプションフィールド
  private usageLocations: UsageLocation[] = [];
  private parametersUsed: ParameterUsage[] = [];
  private responseHandling: ResponseUsage[] = [];
  private isDynamic?: boolean;
  private apiVersion?: string | number;
  private featureCategory?: string;
  private rtkQuerySpecific?: RTKQuerySpecific;
  
  /**
   * コンストラクタ
   * @param path エンドポイントパス
   * @param method HTTPメソッド
   * @param source 検出元
   */
  constructor(path: string, method: HttpMethod, source: EndpointSource) {
    this.path = UrlNormalizer.normalize(path);
    this.method = method;
    this.source = source;
  }
  
  /**
   * 使用箇所情報を追加
   * @param location 使用箇所情報
   * @returns このビルダーインスタンス（メソッドチェーン用）
   */
  public withUsageLocation(location: UsageLocation): EndpointBuilder {
    this.usageLocations.push(location);
    return this;
  }
  
  /**
   * 複数の使用箇所情報を追加
   * @param locations 使用箇所情報配列
   * @returns このビルダーインスタンス（メソッドチェーン用）
   */
  public withUsageLocations(locations: UsageLocation[]): EndpointBuilder {
    this.usageLocations.push(...locations);
    return this;
  }
  
  /**
   * パラメータ使用情報を追加
   * @param param パラメータ使用情報
   * @returns このビルダーインスタンス（メソッドチェーン用）
   */
  public withParameter(param: ParameterUsage): EndpointBuilder {
    this.parametersUsed.push(param);
    return this;
  }
  
  /**
   * 複数のパラメータ使用情報を追加
   * @param params パラメータ使用情報配列
   * @returns このビルダーインスタンス（メソッドチェーン用）
   */
  public withParameters(params: ParameterUsage[]): EndpointBuilder {
    this.parametersUsed.push(...params);
    return this;
  }
  
  /**
   * レスポンス処理情報を追加
   * @param response レスポンス処理情報
   * @returns このビルダーインスタンス（メソッドチェーン用）
   */
  public withResponseHandling(response: ResponseUsage): EndpointBuilder {
    this.responseHandling.push(response);
    return this;
  }
  
  /**
   * 複数のレスポンス処理情報を追加
   * @param responses レスポンス処理情報配列
   * @returns このビルダーインスタンス（メソッドチェーン用）
   */
  public withResponseHandlings(responses: ResponseUsage[]): EndpointBuilder {
    this.responseHandling.push(...responses);
    return this;
  }
  
  /**
   * 動的パラメータフラグを設定
   * @param isDynamic 動的パラメータを持つかどうか
   * @returns このビルダーインスタンス（メソッドチェーン用）
   */
  public withIsDynamic(isDynamic: boolean): EndpointBuilder {
    this.isDynamic = isDynamic;
    return this;
  }
  
  /**
   * APIバージョンを設定
   * @param version APIバージョン
   * @returns このビルダーインスタンス（メソッドチェーン用）
   */
  public withApiVersion(version: string | number): EndpointBuilder {
    this.apiVersion = version;
    return this;
  }
  
  /**
   * 機能カテゴリを設定
   * @param category 機能カテゴリ
   * @returns このビルダーインスタンス（メソッドチェーン用）
   */
  public withFeatureCategory(category: string): EndpointBuilder {
    this.featureCategory = category;
    return this;
  }
  
  /**
   * RTK Query固有情報を設定
   * @param rtkSpecific RTK Query固有情報
   * @returns このビルダーインスタンス（メソッドチェーン用）
   */
  public withRtkQuerySpecific(rtkSpecific: RTKQuerySpecific): EndpointBuilder {
    this.rtkQuerySpecific = rtkSpecific;
    return this;
  }
  
  /**
   * URLからパスパラメータを自動抽出して追加
   * @param location パラメータの使用箇所情報
   * @returns このビルダーインスタンス（メソッドチェーン用）
   */
  public withPathParametersFromUrl(location: UsageLocation): EndpointBuilder {
    const pathParams = NodeExtractors.extractPathParameters(this.path);
    
    for (const paramName of pathParams) {
      this.parametersUsed.push({
        name: paramName,
        type: 'path',
        required: true,
        locations: [location]
      });
    }
    
    return this;
  }
  
  /**
   * エンドポイント情報オブジェクトを構築
   * @returns 構築されたエンドポイント情報
   */
  public build(): EndpointInfo {
    // 動的パラメータフラグを自動判定（未設定の場合）
    if (this.isDynamic === undefined) {
      this.isDynamic = this.path.includes(':') || this.path.includes('{');
    }
    
    // API バージョンを URL から抽出（未設定の場合）
    if (this.apiVersion === undefined) {
      const version = UrlNormalizer.extractApiVersion(this.path);
      if (version) {
        this.apiVersion = version;
      }
    }
    
    // 結果オブジェクトの構築
    const endpoint: EndpointInfo = {
      path: this.path,
      method: this.method,
      isDynamic: this.isDynamic,
      usageLocations: this.usageLocations,
      parametersUsed: this.parametersUsed,
      responseHandling: this.responseHandling,
      source: this.source
    };
    
    // オプションフィールドの追加
    if (this.apiVersion !== undefined) {
      endpoint.apiVersion = this.apiVersion;
    }
    
    if (this.featureCategory) {
      endpoint.featureCategory = this.featureCategory;
    }
    
    if (this.rtkQuerySpecific) {
      endpoint.rtkQuerySpecific = this.rtkQuerySpecific;
    }
    
    return endpoint;
  }
  
  /**
   * Interface実装メソッド: エンドポイント情報の構築（１ステップ版）
   * @param path パス
   * @param method HTTPメソッド
   * @param location 使用箇所情報
   * @param params パラメータ情報配列
   * @param responseHandling レスポンス処理情報配列
   * @param source 検出元
   * @param additionalInfo 追加情報
   * @returns 構築されたエンドポイント情報
   */
  public buildEndpoint(
    path: string,
    method: HttpMethod,
    location: UsageLocation,
    params: ParameterUsage[],
    responseHandling: ResponseUsage[],
    source: EndpointSource,
    additionalInfo?: any
  ): EndpointInfo {
    const builder = new EndpointBuilder(path, method, source)
      .withUsageLocation(location)
      .withParameters(params)
      .withResponseHandlings(responseHandling);
    
    // 追加情報の適用
    if (additionalInfo) {
      if (additionalInfo.apiVersion) {
        builder.withApiVersion(additionalInfo.apiVersion);
      }
      
      if (additionalInfo.featureCategory) {
        builder.withFeatureCategory(additionalInfo.featureCategory);
      }
      
      if (additionalInfo.rtkQuerySpecific) {
        builder.withRtkQuerySpecific(additionalInfo.rtkQuerySpecific);
      }
    }
    
    return builder.build();
  }
  
  /**
   * 検出コンテキストから機能カテゴリを推定して設定
   * @param context 検出コンテキスト
   * @returns このビルダーインスタンス（メソッドチェーン用）
   */
  public withFeatureCategoryFromContext(context: DetectionContext): EndpointBuilder {
    const filePath = context.sourceFile.getFilePath();
    const category = NodeExtractors.inferFeatureCategoryFromPath(filePath);
    
    if (category) {
      this.featureCategory = category;
    }
    
    return this;
  }
}
