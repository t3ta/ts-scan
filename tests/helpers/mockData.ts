/**
 * テスト用モックデータヘルパー
 *
 * @description
 * テストで使用する共通のモックデータを提供します。
 * 型安全性を確保しつつ、再利用可能なモックデータを定義します。
 */

import { AnalysisResult, HttpMethod, EndpointSource, ParameterType } from '../../src/types';

/**
 * 基本的なエンドポイント情報のモックを生成
 */
export const createMockEndpoint = (overrides: Partial<AnalysisResult['endpoints'][0]> = {}) => ({
  path: '/api/test',
  method: 'GET' as HttpMethod,
  isDynamic: false,
  usageLocations: [{ filePath: 'file.ts', lineNumber: 1, columnNumber: 1 }],
  parametersUsed: [],
  responseHandling: [],
  source: 'axios' as EndpointSource,
  featureCategory: 'テスト',
  apiVersion: 'v1',
  ...overrides
});

/**
 * RTK Query固有のエンドポイント情報のモックを生成
 */
export const createMockRtkEndpoint = (overrides: Partial<AnalysisResult['endpoints'][0]> = {}) => ({
  ...createMockEndpoint({
    source: 'rtk-query' as EndpointSource,
    rtkQuerySpecific: {
      isQuery: true,
      isMutation: false,
      transformResponseUsed: true,
      baseQueryUsed: true,
      apiName: 'testApi'
    },
    ...overrides
  })
});

/**
 * 基本的な解析結果のモックを生成
 */
export const createMockAnalysisResult = (overrides: Partial<AnalysisResult> = {}): AnalysisResult => ({
  endpoints: [createMockEndpoint()],
  statistics: {
    totalEndpoints: 1,
    methodDistribution: {
      GET: 1,
      POST: 0,
      PUT: 0,
      DELETE: 0,
      PATCH: 0,
      OPTIONS: 0,
      HEAD: 0
    },
    sourceDistribution: {
      'axios': 1,
      'rtk-query': 0,
      'fetch': 0,
      'custom-client': 0,
      'default': 0,
      'v2-endpoint': 0
    },
    apiVersionDistribution: { 'v1': 1 },
    featureCategoryDistribution: { 'テスト': 1 },
    mostUsedEndpoints: [{ path: '/api/test', count: 1 }],
    pathParameterUsage: {},
    dynamicEndpoints: 0,
    rtkQueryUsage: {
      totalEndpoints: 0,
      queries: 0,
      mutations: 0,
      transformResponseUsage: 0
    }
  },
  analyzedAt: new Date('2023-01-01T00:00:00Z'),
  configuration: {
    targetDirectory: '/path/to/project'
  },
  analyzedFiles: ['file.ts'],
  errors: [],
  ...overrides
});

/**
 * 共通のアサーション関数
 */
export const assertMarkdownTable = (content: string, headers: string[]) => {
  // ヘッダー行の存在を確認
  expect(content).toContain(`| ${headers.join(' | ')} |`);
  // 区切り行の存在を確認
  expect(content).toContain(`|${'-'.repeat(headers.length * 3)}|`);
};

export const assertMarkdownSection = (content: string, title: string) => {
  expect(content).toContain(`## ${title}`);
};

export const assertMarkdownSubSection = (content: string, title: string) => {
  expect(content).toContain(`### ${title}`);
};
