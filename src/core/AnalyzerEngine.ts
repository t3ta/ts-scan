/**
 * エンドポイント解析エンジン
 * 
 * TypeScriptコードを解析し、バックエンドAPIエンドポイントの使用状況を検出するエンジンの
 * コア実装を提供します。複数の検出戦略を組み合わせて効率的にエンドポイントを検出します。
 */

import { Project, SourceFile } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';
import {
  AnalysisConfiguration,
  AnalysisResult,
  AnalysisStatistics,
  EndpointDetectionStrategy,
  EndpointInfo,
  DetectionContext,
  ServiceLocator
} from '../types';
import { ServiceLocator as ServiceLocatorImpl, ServiceIds } from './ServiceLocator';
import { logger } from '../utils/Logger';
import { StrategyRegistry } from './StrategyRegistry';
import { calculateStatistics } from '../utils/statistics';
import { validateProjectStructure, findTsConfigFile, generateTemporaryTsConfig, isDirectory, isFile } from '../utils/fs-helper';

/**
 * エンドポイント解析エンジン
 */
export class AnalyzerEngine {
  private project: Project;
  private configuration: AnalysisConfiguration;
  private strategyRegistry: StrategyRegistry;
  private serviceLocator: ServiceLocator;
  private sourceFiles: SourceFile[] = [];
  private temporaryFiles: string[] = [];
  
  /**
   * コンストラクタ
   * @param configuration 解析設定
   * @param serviceLocator サービスロケータ（DI用、省略時は新規作成）
   */
  constructor(
    configuration: AnalysisConfiguration, 
    serviceLocator?: ServiceLocator
  ) {
    this.configuration = configuration;
    this.serviceLocator = serviceLocator || ServiceLocatorImpl.getInstance();
    
    try {
      const tsConfigPath = this.findOrCreateTsConfigPath();
      this.project = new Project({
        tsConfigFilePath: tsConfigPath,
        skipAddingFilesFromTsConfig: true
      });
      
      // TypeChecker の登録
      this.serviceLocator.register(ServiceIds.TYPE_CHECKER, this.project.getTypeChecker());
    } catch (error: unknown) {
      logger.error(`プロジェクト初期化中にエラーが発生: ${error}`);
      throw new Error(`TypeScript環境の初期化に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // 戦略レジストリの初期化
    this.strategyRegistry = new StrategyRegistry(this.serviceLocator);
    
    // 一時ファイルのクリーンアップ設定
    process.on('exit', this.cleanupTemporaryFiles.bind(this));
  }
  
  /**
   * tsconfig.jsonの検索と処理
   */
  private findOrCreateTsConfigPath(): string {
    const frontendDir = path.resolve(this.configuration.targetDirectory);
    logger.debug(`対象ディレクトリの解決パス: ${frontendDir}`);
    
    if (!isDirectory(frontendDir)) {
      throw new Error(`指定されたパス '${frontendDir}' は有効なディレクトリではありません。`);
    }
    
    const { isValid, detectedStructure, confidence } = validateProjectStructure(frontendDir);
    
    if (!isValid) {
      logger.warn(`警告: 指定されたディレクトリ '${frontendDir}' はフロントエンドプロジェクト構造を持たない可能性があります。`);
    } else {
      logger.info(`フロントエンド構造を検出 (信頼度: ${Math.round(confidence * 100)}%): ${detectedStructure.join(', ')}`);
    }
    
    // カスタムtsconfig.jsonが指定されている場合はそれを使用
    if (this.configuration.tsConfigPath) {
      if (!isFile(this.configuration.tsConfigPath)) {
        throw new Error(`指定されたtsconfig.json '${this.configuration.tsConfigPath}' が見つかりません。`);
      }
      
      logger.info(`カスタムtsconfig.jsonを使用: ${this.configuration.tsConfigPath}`);
      return this.configuration.tsConfigPath;
    }
    
    // プロジェクト内のtsconfig.jsonを探す
    const tsconfigPath = findTsConfigFile(frontendDir);
    
    if (tsconfigPath) {
      logger.info(`tsconfig.jsonを使用: ${tsconfigPath}`);
      return tsconfigPath;
    }
    
    // 見つからない場合は一時的に生成
    logger.warn('tsconfig.jsonが見つかりませんでした。一時的な設定を生成します。');
    const tempTsConfigPath = generateTemporaryTsConfig(frontendDir);
    this.temporaryFiles.push(tempTsConfigPath);
    
    return tempTsConfigPath;
  }
  
  /**
   * 一時ファイルのクリーンアップ
   */
  private cleanupTemporaryFiles(): void {
    for (const filePath of this.temporaryFiles) {
      try {
        if (isFile(filePath)) {
          fs.unlinkSync(filePath);
          logger.debug(`一時ファイルを削除しました: ${filePath}`);
        }
      } catch (error) {
        logger.error(`一時ファイル削除中にエラーが発生: ${error}`);
      }
    }
  }
  
  /**
   * ソースファイルの追加と検証
   */
  private addSourceFiles(): void {
    const targetDir = path.resolve(this.configuration.targetDirectory);
    
    if (!isDirectory(targetDir)) {
      throw new Error(`対象ディレクトリ '${targetDir}' が存在しないか、ディレクトリではありません。`);
    }
    
    const patterns = (this.configuration.filePatterns || ['**/*.ts', '**/*.tsx']).map(pattern =>
      path.join(targetDir, pattern)
    );
    
    logger.info(`ソースファイルを追加中: ${patterns.join(', ')}`);
    
    try {
      this.project.addSourceFilesAtPaths(patterns);
      this.sourceFiles = this.project.getSourceFiles();
      
      if (this.sourceFiles.length === 0) {
        logger.warn(`警告: 指定されたパターン '${patterns.join(', ')}' に一致するファイルが見つかりませんでした。`);
        logger.info('ディレクトリ内のファイル構造を確認中...');
        
        const defaultPatterns = [
          path.join(targetDir, '**/*.ts'),
          path.join(targetDir, '**/*.tsx')
        ];
        
        logger.info(`デフォルトパターンでの再試行: ${defaultPatterns.join(', ')}`);
        this.project.addSourceFilesAtPaths(defaultPatterns);
        this.sourceFiles = this.project.getSourceFiles();
      }
      
      // 除外パターンの適用
      const ignorePatterns = this.configuration.ignorePatterns || [];
      if (ignorePatterns.length > 0) {
        const originalCount = this.sourceFiles.length;
        this.sourceFiles = this.sourceFiles.filter(file => {
          const relativePath = path.relative(targetDir, file.getFilePath());
          return !ignorePatterns.some(pattern => {
            const escapedPattern = pattern
              .replace(/\./g, '\\.')
              .replace(/\*\*/g, '.*')
              .replace(/\*/g, '[^/]*');
            
            try {
              return new RegExp(escapedPattern).test(relativePath);
            } catch (e) {
              logger.error(`正規表現パターンエラー [${pattern}]: ${e}`);
              return false;
            }
          });
        });
        
        logger.debug(`除外フィルタ適用: ${originalCount} → ${this.sourceFiles.length} ファイル`);
      }
      
      logger.info(`解析対象ファイル数: ${this.sourceFiles.length}`);
      
      if (this.sourceFiles.length < 5) {
        logger.warn(`警告: 解析対象ファイルが非常に少ないです (${this.sourceFiles.length})。設定を確認してください。`);
      }
    } catch (error: unknown) {
      logger.error(`ソースファイル追加中にエラーが発生: ${error}`);
      throw new Error(`TypeScript環境の初期化に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * エンドポイント解析の実行
   * @returns 解析結果
   */
  public async analyze(): Promise<AnalysisResult> {
    const overallStartTime = Date.now();
    logger.info('エンドポイント解析を開始します...');
    
    // ソースファイルの準備
    this.addSourceFiles();
    
    const discoveredEndpoints: EndpointInfo[] = [];
    const errors: string[] = [];
    
    // ファイル単位での解析処理
    for (const sourceFile of this.sourceFiles) {
      try {
        const fileStartTime = Date.now();
        const filePath = sourceFile.getFilePath();
        const relativeFilePath = path.relative(this.configuration.targetDirectory, filePath);
        
        logger.debug(`解析中: ${relativeFilePath}`);
        
        // 検出コンテキストの準備
        const context: DetectionContext = {
          sourceFile,
          configuration: this.configuration,
          typeChecker: this.project.getTypeChecker(),
          serviceLocator: this.serviceLocator
        };
        
        // 登録された戦略を優先度順に実行
        for (const strategy of this.strategyRegistry.getAllStrategies()) {
          try {
            const strategyStartTime = Date.now();
            const endpoints = strategy.detect(sourceFile, context);
            
            // 検出結果の処理
            for (const endpoint of endpoints) {
              const existingIndex = discoveredEndpoints.findIndex(
                e => e.path === endpoint.path && e.method === endpoint.method
              );
              
              if (existingIndex >= 0) {
                // 既存エントリにマージ
                const existing = discoveredEndpoints[existingIndex];
                
                // 使用箇所を結合
                existing.usageLocations.push(...endpoint.usageLocations);
                
                // パラメータを結合
                for (const param of endpoint.parametersUsed) {
                  const existingParam = existing.parametersUsed.find(p => p.name === param.name);
                  if (existingParam) {
                    existingParam.locations.push(...param.locations);
                  } else {
                    existing.parametersUsed.push(param);
                  }
                }
                
                // レスポンス処理を結合
                existing.responseHandling.push(...endpoint.responseHandling);
              } else {
                // 新規エントリとして追加
                discoveredEndpoints.push(endpoint);
              }
            }
            
            if (endpoints.length > 0) {
              const strategyEndTime = Date.now();
              logger.debug(`  [${strategy.name}] ${endpoints.length}件のエンドポイントを検出 (${strategyEndTime - strategyStartTime}ms)`);
            }
          } catch (strategyError: unknown) {
            const errorMessage = `戦略 '${strategy.name}' の実行中にエラーが発生: ${strategyError instanceof Error ? strategyError.message : String(strategyError)}`;
            logger.error(errorMessage);
            errors.push(errorMessage);
            
            if (this.configuration.failFast) {
              throw new Error(`フェイルファストモードでエラーが発生しました: ${errorMessage}`);
            }
          }
        }
        
        const fileEndTime = Date.now();
        logger.debug(`ファイル解析完了: ${relativeFilePath} (${fileEndTime - fileStartTime}ms)`);
      } catch (fileError: unknown) {
        const errorMessage = `ファイル '${sourceFile.getFilePath()}' の解析中にエラーが発生: ${fileError instanceof Error ? fileError.message : String(fileError)}`;
        logger.error(errorMessage);
        errors.push(errorMessage);
        
        if (this.configuration.failFast) {
          throw new Error(`フェイルファストモードでエラーが発生しました: ${errorMessage}`);
        }
      }
    }
    
    // 統計情報の計算
    const statistics = calculateStatistics(discoveredEndpoints, this.sourceFiles.length);
    
    const overallEndTime = Date.now();
    logger.info(`解析完了。検出されたエンドポイント数: ${discoveredEndpoints.length} (所要時間: ${overallEndTime - overallStartTime}ms)`);
    
    // 結果オブジェクトの作成
    const result: AnalysisResult = {
      endpoints: discoveredEndpoints,
      statistics,
      analyzedAt: new Date(),
      configuration: this.configuration,
      analyzedFiles: this.sourceFiles.map(file => file.getFilePath()),
      errors
    };
    
    return result;
  }
  
  /**
   * 戦略レジストリへの直接アクセスを提供
   * @returns 戦略レジストリ
   */
  public getStrategyRegistry(): StrategyRegistry {
    return this.strategyRegistry;
  }
  
  /**
   * サービスロケータへの直接アクセスを提供
   * @returns サービスロケータ
   */
  public getServiceLocator(): ServiceLocator {
    return this.serviceLocator;
  }
}
