/**
 * 統計計算ユーティリティ
 * 
 * 解析結果から統計情報を計算するためのユーティリティ関数群を提供します。
 * エンドポイントのグループ化、ランキング、集計などの機能を含みます。
 */

import { EndpointInfo, HttpMethod, AnalysisStatistics, EndpointSource } from '../../types';

/**
 * 解析結果からの統計情報計算
 * @param endpoints 検出されたエンドポイント情報の配列
 * @param analyzedFilesCount 解析されたファイル数
 * @returns 計算された統計情報
 */
export function calculateStatistics(endpoints: EndpointInfo[], analyzedFilesCount: number): AnalysisStatistics {
  // HTTPメソッド分布の初期化
  const methodDistribution: Record<HttpMethod, number> = {
    'GET': 0,
    'POST': 0,
    'PUT': 0,
    'DELETE': 0,
    'PATCH': 0,
    'OPTIONS': 0,
    'HEAD': 0
  };
  
  // 検出元分布の初期化
  const sourceDistribution: Record<EndpointSource, number> = {
    'axios': 0,
    'fetch': 0,
    'rtk-query': 0,
    'custom-client': 0,
    'default': 0,
    'v2-endpoint': 0
  };
  
  // APIバージョン分布
  const apiVersionDistribution: Record<string, number> = {};
  
  // 機能カテゴリ分布
  const featureCategoryDistribution: Record<string, number> = {};
  
  // パスパラメータ使用数
  const pathParameterUsage: Record<string, number> = {};
  
  // RTK Queryエンドポイント数
  let rtkQueryEndpoints = 0;
  let rtkQueryQueries = 0;
  let rtkQueryMutations = 0;
  let transformResponseUsage = 0;
  
  // 動的エンドポイント数
  let dynamicEndpoints = 0;
  
  // エンドポイントごとの集計
  for (const endpoint of endpoints) {
    // メソッド分布
    if (methodDistribution[endpoint.method] !== undefined) {
      methodDistribution[endpoint.method]++;
    }
    
    // 検出元分布
    if (sourceDistribution[endpoint.source] !== undefined) {
      sourceDistribution[endpoint.source]++;
    }
    
    // APIバージョン分布
    const version = endpoint.apiVersion || 'デフォルト';
    apiVersionDistribution[version] = (apiVersionDistribution[version] || 0) + 1;
    
    // 機能カテゴリ分布
    if (endpoint.featureCategory) {
      const category = endpoint.featureCategory.trim();
      featureCategoryDistribution[category] = (featureCategoryDistribution[category] || 0) + 1;
    } else {
      featureCategoryDistribution['未分類'] = (featureCategoryDistribution['未分類'] || 0) + 1;
    }
    
    // 動的エンドポイント集計
    if (endpoint.isDynamic) {
      dynamicEndpoints++;
    }
    
    // RTK Query固有情報の集計
    if (endpoint.rtkQuerySpecific) {
      rtkQueryEndpoints++;
      
      if (endpoint.rtkQuerySpecific.isQuery) {
        rtkQueryQueries++;
      }
      
      if (endpoint.rtkQuerySpecific.isMutation) {
        rtkQueryMutations++;
      }
      
      if (endpoint.rtkQuerySpecific.transformResponseUsed) {
        transformResponseUsage++;
      }
    }
    
    // パラメータ使用状況の集計
    for (const param of endpoint.parametersUsed) {
      if (param.type === 'path') {
        pathParameterUsage[param.name] = (pathParameterUsage[param.name] || 0) + param.locations.length;
      }
    }
  }
  
  // 使用頻度の高いエンドポイントランキング
  const mostUsedEndpoints = endpoints
    .map(endpoint => ({
      path: endpoint.path,
      count: endpoint.usageLocations.length
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // 未使用の可能性があるエンドポイント数
  const potentiallyUnusedEndpoints = endpoints.filter(e => e.usageLocations.length <= 1).length;
  
  return {
    totalEndpoints: endpoints.length,
    methodDistribution,
    sourceDistribution,
    apiVersionDistribution,
    featureCategoryDistribution,
    mostUsedEndpoints,
    pathParameterUsage,
    dynamicEndpoints,
    potentiallyUnusedEndpoints,
    rtkQueryUsage: {
      totalEndpoints: rtkQueryEndpoints,
      queries: rtkQueryQueries,
      mutations: rtkQueryMutations,
      transformResponseUsage
    }
  };
}

/**
 * エンドポイントをカテゴリ別にグループ化
 * @param endpoints エンドポイント配列
 * @returns カテゴリ別にグループ化されたエンドポイント
 */
export function groupEndpointsByCategory(endpoints: EndpointInfo[]): Record<string, EndpointInfo[]> {
  const grouped: Record<string, EndpointInfo[]> = {};
  
  for (const endpoint of endpoints) {
    // カテゴリが未設定の場合は「未分類」に分類
    const category = endpoint.featureCategory?.trim() || '未分類';
    
    if (!grouped[category]) {
      grouped[category] = [];
    }
    
    grouped[category].push(endpoint);
  }
  
  // 各カテゴリ内でHTTPメソッド→パスの順でソート
  for (const category of Object.keys(grouped)) {
    grouped[category].sort((a, b) => {
      // まずメソッドでソート
      const methodOrder = a.method.localeCompare(b.method);
      if (methodOrder !== 0) return methodOrder;
      
      // 次にパスでソート
      return a.path.localeCompare(b.path);
    });
  }
  
  return grouped;
}

/**
 * エンドポイントを使用頻度でランク付け
 * @param endpoints エンドポイント配列
 * @returns ランク付けされたエンドポイント情報
 */
export function rankEndpointsByUsage(endpoints: EndpointInfo[]): Array<{
  endpoint: EndpointInfo;
  usageCount: number;
  rank: number;
}> {
  // 使用箇所数でソート
  const sortedEndpoints = [...endpoints]
    .map(endpoint => ({
      endpoint,
      usageCount: endpoint.usageLocations.length
    }))
    .sort((a, b) => b.usageCount - a.usageCount);
  
  // ランク付け（同順位対応）
  let currentRank = 1;
  let previousCount = -1;
  let offset = 0;
  
  return sortedEndpoints.map((item, index) => {
    if (item.usageCount !== previousCount) {
      currentRank = index + 1 - offset;
      previousCount = item.usageCount;
    } else {
      offset++;
    }
    
    return {
      ...item,
      rank: currentRank
    };
  });
}

/**
 * APIバージョン別エンドポイント数の集計
 * @param endpoints エンドポイント配列
 * @returns バージョン別の集計結果
 */
export function summarizeApiVersions(endpoints: EndpointInfo[]): Record<string, number> {
  const summary: Record<string, number> = {};
  
  for (const endpoint of endpoints) {
    const version = endpoint.apiVersion || 'デフォルト';
    summary[version] = (summary[version] || 0) + 1;
  }
  
  return summary;
}

/**
 * 使用されているHTTPメソッドの集計
 * @param endpoints エンドポイント配列
 * @returns HTTPメソッド別の集計結果
 */
export function summarizeHttpMethods(endpoints: EndpointInfo[]): Record<HttpMethod, number> {
  const summary: Record<HttpMethod, number> = {
    'GET': 0,
    'POST': 0,
    'PUT': 0,
    'DELETE': 0,
    'PATCH': 0,
    'OPTIONS': 0,
    'HEAD': 0
  };
  
  for (const endpoint of endpoints) {
    if (summary[endpoint.method] !== undefined) {
      summary[endpoint.method]++;
    }
  }
  
  return summary;
}

/**
 * APIパターン（検出元）別エンドポイント数の集計
 * @param endpoints エンドポイント配列
 * @returns パターン別の集計結果
 */
export function summarizeApiPatterns(endpoints: EndpointInfo[]): Record<EndpointSource, number> {
  const summary: Record<EndpointSource, number> = {
    'axios': 0,
    'fetch': 0,
    'rtk-query': 0,
    'custom-client': 0,
    'default': 0,
    'v2-endpoint': 0
  };
  
  for (const endpoint of endpoints) {
    if (summary[endpoint.source] !== undefined) {
      summary[endpoint.source]++;
    }
  }
  
  return summary;
}

/**
 * エンドポイントのパスのプレフィックスベースの分類
 * @param endpoints エンドポイント配列
 * @param depth 分割する深さ（デフォルト: 2）
 * @returns プレフィックス別の集計結果
 */
export function classifyByPathPrefix(endpoints: EndpointInfo[], depth: number = 2): Record<string, number> {
  const classification: Record<string, number> = {};
  
  for (const endpoint of endpoints) {
    // パスを分割
    const segments = endpoint.path.split('/').filter(s => s.length > 0);
    
    // 指定された深さまでの部分を取得
    const prefix = segments.slice(0, Math.min(depth, segments.length)).join('/');
    const prefixPath = prefix ? `/${prefix}` : '/';
    
    classification[prefixPath] = (classification[prefixPath] || 0) + 1;
  }
  
  return classification;
}

/**
 * エンドポイントの複雑性計算（パラメータ数、使用箇所数に基づく）
 * @param endpoint エンドポイント情報
 * @returns 複雑性スコア
 */
export function calculateEndpointComplexity(endpoint: EndpointInfo): number {
  // パラメータ数による複雑性
  const parameterComplexity = endpoint.parametersUsed.length * 2;
  
  // 使用箇所の多様性（異なるファイルの数）
  const uniqueFiles = new Set(endpoint.usageLocations.map(loc => loc.filePath)).size;
  
  // 動的パスによる複雑性
  const dynamicComplexity = endpoint.isDynamic ? 5 : 0;
  
  // レスポンス処理の複雑性
  const responseComplexity = endpoint.responseHandling.filter(h => h.type === 'transformation').length * 3;
  
  return parameterComplexity + uniqueFiles + dynamicComplexity + responseComplexity;
}

/**
 * 最も複雑なエンドポイントのランキング
 * @param endpoints エンドポイント配列
 * @param limit 結果の最大数（デフォルト: 10）
 * @returns 複雑性でランク付けされたエンドポイント
 */
export function rankEndpointsByComplexity(endpoints: EndpointInfo[], limit: number = 10): Array<{
  endpoint: EndpointInfo;
  complexity: number;
  rank: number;
}> {
  // 複雑性を計算してソート
  const rankedEndpoints = endpoints
    .map(endpoint => ({
      endpoint,
      complexity: calculateEndpointComplexity(endpoint)
    }))
    .sort((a, b) => b.complexity - a.complexity);
  
  // ランク付け
  let currentRank = 1;
  let previousComplexity = -1;
  let offset = 0;
  
  return rankedEndpoints
    .map((item, index) => {
      if (item.complexity !== previousComplexity) {
        currentRank = index + 1 - offset;
        previousComplexity = item.complexity;
      } else {
        offset++;
      }
      
      return {
        ...item,
        rank: currentRank
      };
    })
    .slice(0, limit);
}
