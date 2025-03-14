/**
 * RTK Query型定義ファイル
 * 
 * RTK Queryの型システムに関連する定数と型定義を提供します。
 * エンドポイントの種別判定や型推論に使用します。
 */

/**
 * エンドポイントタイプの列挙型
 * RTK Queryで使用される3つの主要エンドポイントタイプを定義
 */
export enum EndpointType {
  Query = 'query',
  Mutation = 'mutation',
  InfiniteQuery = 'infinitequery'
}

/**
 * RTK Queryの内部型定数 - DefinitionType
 * RTK Query自体で使用される型識別子
 */
export const RtkQueryDefinitionType = {
  Query: 'query',
  Mutation: 'mutation',
  InfiniteQuery: 'infinitequery'
};

/**
 * QueryエンドポイントのTypeScript型名リスト
 * 型検知で使用される型名のパターン
 */
export const QueryEndpointTypes = [
  'QueryDefinition',
  'build.query',
  'EndpointDefinitionWithQuery', 
  'ApiEndpointQuery'
];

/**
 * MutationエンドポイントのTypeScript型名リスト
 * 型検知で使用される型名のパターン
 */
export const MutationEndpointTypes = [
  'MutationDefinition',
  'build.mutation',
  'EndpointDefinitionWithMutation',
  'ApiEndpointMutation'
];

/**
 * InfiniteQueryエンドポイントのTypeScript型名リスト
 * 型検知で使用される型名のパターン
 */
export const InfiniteQueryEndpointTypes = [
  'InfiniteQueryDefinition',
  'build.infiniteQuery',
  'EndpointDefinitionWithInfiniteQuery',
  'ApiEndpointInfiniteQuery'
];

/**
 * エンドポイント種別の判定インターフェース
 * エンドポイントの種別判定結果とメタデータを提供
 */
export interface EndpointTypeInfo {
  /**
   * エンドポイントの種別（Query/Mutation/InfiniteQuery）
   */
  type: EndpointType;
  
  /**
   * 入力（引数）の型情報
   */
  inputType?: string;
  
  /**
   * 出力（レスポンス）の型情報
   */
  outputType?: string;
  
  /**
   * 使用されているベースクエリ型
   */
  baseQueryType?: string;
  
  /**
   * タグタイプ情報
   */
  tagTypes?: string[];
  
  /**
   * 追加のメタデータ情報
   */
  metadata?: Record<string, unknown>;
}

/**
 * RTK Queryエンドポイントジェネリクスのインデックス
 * 型パラメータの位置を示す定数
 */
export const EndpointGenericIndexes = {
  // build.query<ResultType, QueryArg>
  Query: {
    ResultType: 0,
    QueryArg: 1,
    BaseQuery: 2, // オプショナル
    TagTypes: 3,  // オプショナル
  },
  
  // build.mutation<ResultType, QueryArg>
  Mutation: {
    ResultType: 0,
    QueryArg: 1,
    BaseQuery: 2, // オプショナル
    TagTypes: 3,  // オプショナル
  },
  
  // build.infiniteQuery<ResultType, QueryArg, PageParam>
  InfiniteQuery: {
    ResultType: 0,
    QueryArg: 1,
    PageParam: 2,
    BaseQuery: 3, // オプショナル
    TagTypes: 4,  // オプショナル
  }
};

/**
 * RTK Queryエンドポイントプロパティ識別子
 * エンドポイント構成オブジェクトの主要プロパティ名
 */
export const EndpointPropertyIdentifiers = {
  Query: 'query',
  QueryFn: 'queryFn',
  Transform: 'transformResponse',
  ErrorTransform: 'transformErrorResponse',
  ProvidesTags: 'providesTags',
  InvalidatesTags: 'invalidatesTags',
  OnQueryStarted: 'onQueryStarted',
  OnCacheEntryAdded: 'onCacheEntryAdded',
  SerializeQueryArgs: 'serializeQueryArgs',
  Merge: 'merge',
  ForceRefetch: 'forceRefetch',
  StructuralSharing: 'structuralSharing',
  KeepUnusedDataFor: 'keepUnusedDataFor',
  InfiniteQueryOptions: 'infiniteQueryOptions',
};

/**
 * エンドポイント定義が使用する主要パターン
 * コード検出のための正規表現パターン
 */
export const EndpointDefinitionPatterns = {
  /** createApi呼び出しパターン */
  CreateApiPattern: /createApi\s*\(/,
  
  /** endpoints定義パターン */
  EndpointsPattern: /endpoints\s*:\s*\(\s*build\s*\)\s*=>\s*\(/,
  
  /** クエリエンドポイント定義パターン */
  QueryPattern: /build\.query<.*?>\s*\(/,
  
  /** ミューテーションエンドポイント定義パターン */
  MutationPattern: /build\.mutation<.*?>\s*\(/,
  
  /** 無限クエリエンドポイント定義パターン */
  InfiniteQueryPattern: /build\.infiniteQuery<.*?>\s*\(/,
};
