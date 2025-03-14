/**
 * AnalyzerEngine クラスのユニットテスト
 * 
 * エンドポイント解析エンジンの各機能を検証します。
 * プロジェクト初期化、ファイル解析、戦略実行などの機能をテストします。
 */

import { mock, instance, when, anything } from 'ts-mockito';
import { AnalyzerEngine } from '../../src/core/AnalyzerEngine';
import { ServiceLocator, ServiceIds } from '../../src/core/ServiceLocator';
import { StrategyRegistry } from '../../src/core/StrategyRegistry';
import { Project, SourceFile, TypeChecker } from 'ts-morph';
import { 
  AnalysisConfiguration, 
  EndpointInfo, 
  EndpointDetectionStrategy
} from '../../src/types';
// 将来の拡張用にインポートしておく
// import * as path from 'path';
// import * as fs from 'fs';

// ファイルシステムモジュールのモック
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  statSync: jest.fn().mockReturnValue({
    isDirectory: jest.fn().mockReturnValue(true),
    isFile: jest.fn().mockReturnValue(true)
  }),
  readFileSync: jest.fn().mockReturnValue('{}'),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn()
}));

// ロガーのモック
jest.mock('../../src/utils/Logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn()
  }
}));

// fs-helperのモックで特定の部分だけモック
jest.mock('../../src/utils/fs-helper', () => ({
  isDirectory: jest.fn().mockReturnValue(true),
  isFile: jest.fn().mockReturnValue(true),
  validateProjectStructure: jest.fn().mockReturnValue({
    isValid: true,
    detectedStructure: ['React'],
    confidence: 0.8
  }),
  findTsConfigFile: jest.fn().mockReturnValue('/test/project/tsconfig.json'),
  generateTemporaryTsConfig: jest.fn().mockReturnValue('/test/project/tsconfig.temp.json'),
}));

// 統計計算関数のモック
jest.mock('../../src/utils/statistics/index', () => ({
  calculateStatistics: jest.fn().mockImplementation((endpoints) => ({
    totalEndpoints: endpoints.length,
    methodDistribution: { 'GET': endpoints.length, 'POST': 0, 'PUT': 0, 'DELETE': 0, 'PATCH': 0, 'OPTIONS': 0, 'HEAD': 0 },
    sourceDistribution: { 'axios': endpoints.length, 'fetch': 0, 'rtk-query': 0, 'custom-client': 0, 'default': 0, 'v2-endpoint': 0 },
    apiVersionDistribution: { 'v1': endpoints.length },
    featureCategoryDistribution: { 'test': endpoints.length },
    mostUsedEndpoints: endpoints.map((e: EndpointInfo) => ({ path: e.path, count: e.usageLocations.length })),
    pathParameterUsage: {},
    dynamicEndpoints: 0,
    rtkQueryUsage: {
      totalEndpoints: 0,
      queries: 0,
      mutations: 0,
      transformResponseUsage: 0
    }
  }))
}));

// テスト用のモックエンドポイント情報を作成する関数
function createMockEndpointInfo(overrides: Partial<EndpointInfo> = {}): EndpointInfo {
  return {
    path: overrides.path || '/api/test',
    method: overrides.method || 'GET',
    isDynamic: overrides.isDynamic || false,
    usageLocations: overrides.usageLocations || [
      {
        filePath: 'src/components/TestComponent.tsx',
        lineNumber: 42,
        columnNumber: 10,
        context: 'fetchData',
        codeSnippet: 'axios.get("/api/test")',
      },
    ],
    parametersUsed: overrides.parametersUsed || [],
    responseHandling: overrides.responseHandling || [],
    source: overrides.source || 'axios',
    apiVersion: overrides.apiVersion || 'v1',
    featureCategory: overrides.featureCategory || 'test',
  } as EndpointInfo;
}

// テスト用のモック検出戦略を作成する関数
function createMockStrategy(
  name: string = 'mock-strategy',
  priority: number = 10,
  detectImplementation?: jest.Mock
): EndpointDetectionStrategy {
  return {
    name,
    priority,
    detect: detectImplementation || jest.fn().mockReturnValue([]),
  } as EndpointDetectionStrategy;
}

describe('AnalyzerEngine', () => {
  let serviceLocator: ServiceLocator;
  let mockConfiguration: AnalysisConfiguration;
  let mockTypeChecker: TypeChecker;
  let mockSourceFile: SourceFile;
  let mockProject: Project;
  
  // 各テスト前の共通セットアップ
  beforeEach(() => {
    // ServiceLocatorのリセット
    serviceLocator = ServiceLocator.getInstance();
    serviceLocator.clear();
    
    // モックオブジェクトの作成
    mockConfiguration = mock<AnalysisConfiguration>();
    mockTypeChecker = mock<TypeChecker>();
    mockSourceFile = mock<SourceFile>();
    mockProject = mock<Project>();
    
    // モック設定
    when(mockConfiguration.targetDirectory).thenReturn('/test/project');
    when(mockConfiguration.filePatterns).thenReturn(['**/*.ts', '**/*.tsx']);
    when(mockConfiguration.ignorePatterns).thenReturn(['**/node_modules/**']);
    
    // SourceFileのモック設定
    // ts-morphのFilePathの扱いが特殊なためダミー扱いする
    // 実际のテストではもっと適切な処理が必要
    when(mockSourceFile.getFilePath() as any).thenReturn('/test/project/src/example.ts');
    
    // Projectのモック設定
    when(mockProject.getTypeChecker()).thenReturn(instance(mockTypeChecker));
    when(mockProject.getSourceFiles()).thenReturn([instance(mockSourceFile)]);
    when(mockProject.addSourceFilesAtPaths(anything())).thenReturn([instance(mockSourceFile)]);
    
    // Projectコンストラクタのモック
    (Project as jest.Mock).mockImplementation(() => instance(mockProject));
    
    // モックリセット
    jest.clearAllMocks();
  });
  
  describe('初期化', () => {
    it('サービスロケータを適切に初期化すること', () => {
      // Arrange
      const engine = new AnalyzerEngine(instance(mockConfiguration), serviceLocator);
      
      // Assert
      expect(serviceLocator.has(ServiceIds.TYPE_CHECKER)).toBe(true);
      expect(engine.getServiceLocator()).toBe(serviceLocator);
    });
    
    it('戦略レジストリを適切に初期化すること', () => {
      // Arrange
      const engine = new AnalyzerEngine(instance(mockConfiguration), serviceLocator);
      
      // Assert
      expect(engine.getStrategyRegistry()).toBeInstanceOf(StrategyRegistry);
    });
  });
  
  describe('analyze', () => {
    it('ソースファイルを追加して戦略を実行すること', async () => {
      // Arrange
      const mockStrategy = createMockStrategy('test-strategy', 10, jest.fn().mockReturnValue([
        createMockEndpointInfo({ path: '/api/test1' }),
        createMockEndpointInfo({ path: '/api/test2' })
      ]));
      
      const engine = new AnalyzerEngine(instance(mockConfiguration), serviceLocator);
      const registry = engine.getStrategyRegistry();
      
      registry.registerStrategy(mockStrategy);
      
      // Act
      const result = await engine.analyze();
      
      // Assert
      expect(result.endpoints.length).toBe(2);
      expect(result.endpoints[0].path).toBe('/api/test1');
      expect(result.endpoints[1].path).toBe('/api/test2');
      expect(result.statistics.totalEndpoints).toBe(2);
    });
    
    it('戦略がエラーを投げても処理が続行されること (failFast=false)', async () => {
      // Arrange
      const successStrategy = createMockStrategy('success-strategy', 10, jest.fn().mockReturnValue([
        createMockEndpointInfo()
      ]));
      
      const errorStrategy = createMockStrategy('error-strategy', 20, jest.fn().mockImplementation(() => {
        throw new Error('テスト用エラー');
      }));
      
      when(mockConfiguration.failFast).thenReturn(false);
      
      const engine = new AnalyzerEngine(instance(mockConfiguration), serviceLocator);
      const registry = engine.getStrategyRegistry();
      
      registry.registerStrategy(successStrategy);
      registry.registerStrategy(errorStrategy);
      
      // Act
      const result = await engine.analyze();
      
      // Assert
      expect(result.endpoints.length).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('テスト用エラー');
    });
    
    it('failFast=trueの場合、戦略がエラーを投げると中断されること', async () => {
      // Arrange
      const errorStrategy = createMockStrategy('error-strategy', 10, jest.fn().mockImplementation(() => {
        throw new Error('テスト用エラー');
      }));
      
      when(mockConfiguration.failFast).thenReturn(true);
      
      const engine = new AnalyzerEngine(instance(mockConfiguration), serviceLocator);
      const registry = engine.getStrategyRegistry();
      
      registry.registerStrategy(errorStrategy);
      
      // Act & Assert
      await expect(engine.analyze()).rejects.toThrow('フェイルファストモードでエラーが発生しました');
    });
  });
  
  // 追加のテストケース...
});
