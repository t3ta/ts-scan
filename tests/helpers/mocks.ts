/**
 * テスト用のモックヘルパー
 * 
 * ユニットテストで使用する共通のモックを提供します。
 * 依存性を分離し、単体テストを容易にするためのモック関数です。
 */

import { SourceFile, TypeChecker, Project } from 'ts-morph';
import { 
  AnalysisConfiguration, 
  EndpointInfo, 
  HttpMethod, 
  EndpointSource,
  EndpointDetectionStrategy,
  DetectionContext
} from '../../src/types';

/**
 * モックソースファイルを作成
 * @param filePath ファイルパス
 * @returns モックソースファイル
 */
export function createMockSourceFile(filePath: string = 'test/file.ts'): SourceFile {
  return {
    getFilePath: jest.fn().mockReturnValue(filePath),
    getFullText: jest.fn().mockReturnValue('// Mock source file content'),
    getChildIndentationLevel: jest.fn(),
    getFirstChildByKind: jest.fn(),
    getChildrenOfKind: jest.fn().mockReturnValue([]),
    getImportDeclarations: jest.fn().mockReturnValue([]),
    forEachChild: jest.fn()
  } as unknown as SourceFile;
}

/**
 * モック型チェッカーを作成
 * @returns モック型チェッカー
 */
export function createMockTypeChecker(): TypeChecker {
  return {
    getTypeAtLocation: jest.fn(),
    getSymbolAtLocation: jest.fn(),
    getTypeOfSymbolAtLocation: jest.fn(),
    getSymbolsInScope: jest.fn(),
    getReturnTypeOfSignature: jest.fn()
  } as unknown as TypeChecker;
}

/**
 * モックプロジェクトを作成
 * @returns モックプロジェクト
 */
export function createMockProject(): Project {
  const mockSourceFile = createMockSourceFile();
  const mockTypeChecker = createMockTypeChecker();
  
  return {
    getTypeChecker: jest.fn().mockReturnValue(mockTypeChecker),
    getSourceFiles: jest.fn().mockReturnValue([mockSourceFile]),
    addSourceFilesAtPaths: jest.fn(),
    createSourceFile: jest.fn().mockReturnValue(mockSourceFile)
  } as unknown as Project;
}

/**
 * モック解析設定を作成
 * @param overrides オーバーライドする設定
 * @returns モック解析設定
 */
export function createMockConfiguration(overrides: Partial<AnalysisConfiguration> = {}): AnalysisConfiguration {
  return {
    targetDirectory: overrides.targetDirectory || '/test/project',
    filePatterns: overrides.filePatterns || ['**/*.ts', '**/*.tsx'],
    ignorePatterns: overrides.ignorePatterns || ['**/node_modules/**'],
    apiPrefixRegex: overrides.apiPrefixRegex || '/api/',
    tsConfigPath: overrides.tsConfigPath,
    outputJsonPath: overrides.outputJsonPath || 'output/result.json',
    outputMarkdownPath: overrides.outputMarkdownPath || 'output/result.md',
    failFast: overrides.failFast || false,
    verbose: overrides.verbose || false
  };
}

/**
 * モックエンドポイント情報を作成
 * @param overrides オーバーライドする情報
 * @returns モックエンドポイント情報
 */
export function createMockEndpointInfo(overrides: Partial<EndpointInfo> = {}): EndpointInfo {
  return {
    path: overrides.path || '/api/test',
    method: overrides.method || 'GET' as HttpMethod,
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
    source: overrides.source || 'axios' as EndpointSource,
    apiVersion: overrides.apiVersion || 'v1',
    featureCategory: overrides.featureCategory || 'test',
  };
}

/**
 * モック検出戦略を作成
 * @param name 戦略名
 * @param priority 優先度
 * @param detectImplementation 検出実装関数
 * @returns モック検出戦略
 */
export function createMockStrategy(
  name: string = 'mock-strategy',
  priority: number = 10,
  detectImplementation?: (sourceFile: SourceFile, context: DetectionContext) => EndpointInfo[]
): EndpointDetectionStrategy {
  return {
    name,
    priority,
    detect: detectImplementation || ((_, __) => []),
  };
}

/**
 * モック検出コンテキストを作成
 * @param sourceFile ソースファイル
 * @param typeChecker 型チェッカー
 * @param configuration 設定
 * @returns モック検出コンテキスト
 */
export function createMockDetectionContext(
  sourceFile?: SourceFile,
  typeChecker?: TypeChecker,
  configuration?: AnalysisConfiguration
): DetectionContext {
  return {
    sourceFile: sourceFile || createMockSourceFile(),
    typeChecker: typeChecker || createMockTypeChecker(),
    configuration: configuration || createMockConfiguration(),
  };
}
