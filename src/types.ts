/**
 * エンドポイント解析ツール 型定義
 * 
 * アプリケーション全体で使用される基本的な型定義を提供します。
 * 各モジュールは必要に応じて独自の型を定義または拡張することがあります。
 */

import { TypeChecker, Node } from 'ts-morph';
import { ISourceFile } from './core/ast/interfaces/ISourceFile';
import { INode } from './core/ast/interfaces/INode';

/**
 * サポートするHTTPメソッド
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

/**
 * パラメータの種類
 */
export type ParameterType = 'path' | 'query' | 'body' | 'header' | 'unknown';

/**
 * レスポンス処理の種類
 */
export type ResponseHandlingType = 
  | 'direct'        // 直接使用
  | 'transformation' // 変換処理あり
  | 'typed'         // 型付け
  | 'unknown';      // 不明

/**
 * エンドポイント検出の起点となる技術や実装
 */
export type EndpointSource = 
  | 'axios'         // Axiosライブラリ
  | 'fetch'         // Fetch API
  | 'rtk-query'     // RTK Query
  | 'custom-client' // カスタムAPIクライアント
  | 'default'       // 上記以外のデフォルト検出
  | 'v2-endpoint';  // v2専用エンドポイント

/**
 * 使用箇所の詳細情報
 */
export interface UsageLocation {
  filePath: string;       // ファイルパス
  lineNumber: number;     // 行番号
  columnNumber: number;   // 列番号
  context?: string;       // 使用コンテキスト（関数名等）
  codeSnippet?: string;   // コードスニペット
}

/**
 * パラメータ使用情報
 */
export interface ParameterUsage {
  name: string;           // パラメータ名
  type: ParameterType;    // パラメータ種別
  required?: boolean;     // 必須かどうか
  defaultValue?: string;  // デフォルト値
  locations: UsageLocation[]; // 使用箇所
}

/**
 * レスポンス処理情報
 */
export interface ResponseUsage {
  type: ResponseHandlingType;  // 処理種別
  typeName?: string;          // 型名（型付けされている場合）
  location: UsageLocation;    // 使用箇所
}

/**
 * RTK Query固有情報
 */
export interface RTKQuerySpecific {
  isQuery: boolean;           // クエリ（GET）かどうか
  isMutation: boolean;        // ミューテーション（POST等）かどうか
  transformResponseUsed: boolean; // レスポンス変換処理の有無
  baseQueryUsed: boolean;     // ベースクエリ使用の有無
  apiName?: string;           // API名
  builderName?: string;       // ビルダー変数名
}

/**
 * エンドポイント情報
 */
export interface EndpointInfo {
  path: string;               // エンドポイントパス
  method: HttpMethod;         // HTTPメソッド
  isDynamic: boolean;         // 動的パラメータを含むか
  usageLocations: UsageLocation[]; // 使用箇所
  parametersUsed: ParameterUsage[]; // 使用パラメータ
  responseHandling: ResponseUsage[]; // レスポンス処理
  apiVersion?: string | number; // APIバージョン
  featureCategory?: string;   // 機能カテゴリ
  source: EndpointSource;     // 検出元
  rtkQuerySpecific?: RTKQuerySpecific; // RTK Query固有情報
}

/**
 * 解析設定
 */
export interface AnalysisConfiguration {
  targetDirectory: string;    // 対象ディレクトリ
  filePatterns?: string[];    // ファイルパターン
  ignorePatterns?: string[];  // 除外パターン
  apiPrefixRegex?: string;    // APIプレフィックス正規表現
  tsConfigPath?: string;      // tsconfig.jsonパス
  outputJsonPath?: string;    // JSON出力パス
  outputMarkdownPath?: string; // Markdown出力パス
  failFast?: boolean;         // エラー発生時に即座に終了
  verbose?: boolean;          // 詳細ログ出力
}

/**
 * RTK Query 使用に関する統計情報
 */
export interface RTKQueryUsageStatistics {
  totalEndpoints: number;       // RTK Query エンドポイント総数
  queries: number;              // Query操作数
  mutations: number;           // Mutation操作数
  transformResponseUsage: number; // レスポンス変換使用数
}

/**
 * 解析統計情報
 */
export interface AnalysisStatistics {
  totalEndpoints: number;                // 合計エンドポイント数
  methodDistribution: Record<HttpMethod, number>; // メソッド別分布
  sourceDistribution: Record<EndpointSource, number>; // ソース別分布
  apiVersionDistribution: Record<string, number>; // バージョン別分布
  featureCategoryDistribution: Record<string, number>; // 機能カテゴリ分布
  mostUsedEndpoints: Array<{ path: string; count: number }>; // 頻出エンドポイント
  pathParameterUsage: Record<string, number>; // パスパラメータ使用数
  dynamicEndpoints: number;    // 動的パスパラメータを持つエンドポイント数
  rtkQueryUsage: RTKQueryUsageStatistics; // RTK Query関連の統計情報
  potentiallyUnusedEndpoints?: number; // 未使用の可能性があるエンドポイント数
}

/**
 * 解析結果
 */
export interface AnalysisResult {
  endpoints: EndpointInfo[];          // 検出されたエンドポイント
  statistics: AnalysisStatistics;     // 統計情報
  analyzedAt: Date;                   // 解析実行日時
  configuration: AnalysisConfiguration; // 解析設定
  analyzedFiles: string[];            // 解析対象ファイル
  errors: string[];                   // エラーメッセージ
}

/**
 * 検出コンテキスト
 */
export interface DetectionContext {
  sourceFile: ISourceFile;            // 解析対象ソースファイル
  configuration: AnalysisConfiguration; // 解析設定
  typeChecker: TypeChecker;          // 型チェッカー
  apiName?: string;                  // API名（コンテキストに応じて設定）
  baseUrl?: string;                  // ベースURL（コンテキストに応じて設定）
  serviceLocator?: ServiceLocator;   // サービスロケータ
}

/**
 * エンドポイント検出戦略インターフェース
 */
export interface EndpointDetectionStrategy {
  readonly name: string;             // 戦略名
  readonly priority: number;         // 優先度（低い値ほど先に実行）
  
  /**
   * エンドポイント検出メイン処理
   * @param sourceFile 解析対象ソースファイル
   * @param context 検出コンテキスト
   * @returns 検出されたエンドポイント情報配列
   */
  detect(sourceFile: ISourceFile, context: DetectionContext): EndpointInfo[];
}

/**
 * エンドポイントパターン検出器インターフェース
 */
export interface EndpointPatternDetector {
  /**
   * パターン適用可否の判定
   * @param node 対象ノード
   * @returns パターンが適用可能かどうか
   */
  canHandle(node: INode): boolean;
  
  /**
   * エンドポイント情報の抽出
   * @param node 対象ノード
   * @param context 検出コンテキスト
   * @returns 抽出されたエンドポイント情報配列
   */
  extractEndpoints(node: INode, context: DetectionContext): EndpointInfo[];

  /**
   * ソースファイル内の該当するパターンをすべて検出して処理
   * @param sourceFile 対象ソースファイル
   * @param context 検出コンテキスト
   * @returns 検出・抽出されたエンドポイント情報配列
   */
  detectAndExtract(sourceFile: ISourceFile, context: DetectionContext): EndpointInfo[];
}

/**
 * URL解析インターフェース
 */
export interface IUrlParser {
  /**
   * エンドポイントURL情報の解析
   * @param node 対象ノード
   * @returns URL情報（パスとHTTPメソッド）
   */
  parseEndpointUrl(node: INode): { path: string | null; method: HttpMethod };
  
  /**
   * 完全URLパスの構築
   * @param baseUrl ベースURL
   * @param path パス部分
   * @returns 完全なURLパス
   */
  buildFullPath(baseUrl: string, path: string): string;
}

/**
 * エンドポイントビルダーインターフェース
 */
export interface IEndpointBuilder {
  /**
   * エンドポイント情報の構築
   * @param path パス
   * @param method HTTPメソッド
   * @param location 使用箇所
   * @param params パラメータ
   * @param responseHandling レスポンス処理
   * @param source 検出元
   * @param additionalInfo 追加情報
   * @returns 構築されたエンドポイント情報
   */
  buildEndpoint(
    path: string,
    method: HttpMethod,
    location: UsageLocation,
    params: ParameterUsage[],
    responseHandling: ResponseUsage[],
    source: EndpointSource,
    additionalInfo?: any
  ): EndpointInfo;
}

/**
 * タイプヘルパーインターフェース
 */
export interface ITypeHelper {
  /**
   * パラメータタイプの推論
   * @param node 対象ノード
   * @returns 推論されたパラメータタイプ
   */
  inferParameterType(node: INode): ParameterType;
  
  /**
   * レスポンス処理情報の抽出
   * @param node 対象ノード
   * @param location 使用箇所
   * @returns 抽出されたレスポンス処理情報
   */
  extractResponseHandling(node: INode, location: UsageLocation): ResponseUsage[];
}

/**
 * サービスロケータインターフェース（DI用）
 */
export interface ServiceLocator {
  /**
   * サービスの登録
   * @param serviceId サービスID
   * @param implementation 実装
   */
  register<T>(serviceId: string, implementation: T): void;
  
  /**
   * サービスの取得
   * @param serviceId サービスID
   * @returns 取得したサービス
   */
  resolve<T>(serviceId: string): T;
  
  /**
   * 登録されたすべてのサービスIDを取得する
   * @returns サービスID配列
   */
  getRegisteredServiceIds(): string[];
}

/**
 * レポーター（出力生成器）インターフェース
 */
export interface IReporter {
  /**
   * 解析結果のレポート生成
   * @param result 解析結果
   */
  generateReport(result: AnalysisResult): void;
}

/**
 * ロガーインターフェース
 */
export interface ILogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
