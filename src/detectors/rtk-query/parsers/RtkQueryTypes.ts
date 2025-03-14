/**
 * RTK Query 構造解析用 型定義
 * 
 * RTK Queryの解析に必要な基本的な型定義と共通インターフェースを提供します。
 * 他のRTK Query解析モジュールがこれらの型を利用します。
 */

import { Node, SourceFile } from 'ts-morph';
import { HttpMethod } from '../../../types';

/**
 * RTK Query API メタデータ
 * APIの構造情報を格納するインターフェース
 */
export interface RTKApiMetadata {
  apiName: string;           // API変数/定数名
  reducerPath?: string;      // リデューサーパス
  baseUrl?: string;          // ベースURL
  tagTypes?: string[];       // タグタイプ定義
  endpoints: Map<string, RTKEndpointMetadata>; // エンドポイント定義
  sourceFile: SourceFile;    // 定義元ファイル
  varName?: string;          // 変数名
  builderName?: string;      // ビルダー変数名
  hasBaseQuery: boolean;     // baseQueryの使用有無
}

/**
 * RTK Query エンドポイント メタデータ
 * 個々のエンドポイント定義情報を格納するインターフェース
 */
export interface RTKEndpointMetadata {
  name: string;              // エンドポイント名
  path: string;              // パス
  method: HttpMethod;        // HTTPメソッド
  isQuery: boolean;          // クエリ (GET) かどうか
  isMutation: boolean;       // ミューテーション (POST等) かどうか
  node: Node;                // 定義ノード
  useTransformResponse: boolean; // レスポンス変換の使用有無
  invalidatesTags?: string[]; // 無効化するタグ
  providesTags?: string[];   // 提供するタグ
}

/**
 * API使用情報
 * 使用箇所のAPI参照とエンドポイント情報
 */
export interface ApiUsageInfo {
  apiName: string;           // API名
  endpointName: string;      // エンドポイント名
  sourceFile: SourceFile;    // 使用元ファイル
}

/**
 * エンドポイントパス情報
 * 抽出されたエンドポイントのURLとメソッド情報
 */
export interface EndpointPathInfo {
  path: string;              // エンドポイントパス
  method?: HttpMethod;       // HTTPメソッド（指定されている場合）
}

/**
 * インポート情報
 * RTK Query APIのインポート関係を追跡するための情報
 */
export interface ImportInfo {
  sourceFile: string;        // インポート元ファイルパス
  exportName: string;        // エクスポート名
}
