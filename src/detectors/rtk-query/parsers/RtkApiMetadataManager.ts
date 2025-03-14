/**
 * RTK API メタデータ管理モジュール
 * 
 * 検出されたRTK Query API定義とそのエンドポイント情報を集中管理します。
 * APIの登録、検索、エクスポート/インポート関係の解決機能を提供します。
 */

import { SourceFile } from 'ts-morph';
import { RTKApiMetadata, RTKEndpointMetadata, ImportInfo } from './RtkQueryTypes';
import { logger } from '../../../utils/Logger';
import { NodeExtractorsExtended } from '../../../utils/ast/NodeExtractorsExtended';

/**
 * RTK API メタデータ管理クラス
 * RTK Query APIの定義と使用関係を追跡して一元管理
 */
export class RtkApiMetadataManager {
  // APIメタデータの保持（apiName => metadata）
  private apiRegistry: Map<string, RTKApiMetadata> = new Map();
  
  // APIのエクスポート名マッピング（エクスポート名 => apiName）
  private exportMap: Map<string, string> = new Map();
  
  // APIのインポートマッピング（インポート名 => {sourceFile, exportName}）
  private importMap: Map<string, ImportInfo> = new Map();

  /**
   * API情報を登録
   * @param apiMetadata API情報
   */
  public registerApi(apiMetadata: RTKApiMetadata): void {
    this.apiRegistry.set(apiMetadata.apiName, apiMetadata);
    logger.debug(`[RtkApiMetadataManager] API "${apiMetadata.apiName}" を登録しました（${apiMetadata.endpoints.size}個のエンドポイント）`);
  }

  /**
   * API名からメタデータを取得
   * @param apiName API名
   * @returns APIメタデータ（存在しない場合はundefined）
   */
  public getApiMetadata(apiName: string): RTKApiMetadata | undefined {
    return this.apiRegistry.get(apiName);
  }

  /**
   * 登録されている全APIメタデータを取得
   * @returns APIメタデータの配列
   */
  public getAllApiMetadata(): RTKApiMetadata[] {
    return Array.from(this.apiRegistry.values());
  }

  /**
   * エクスポート情報を登録
   * @param exportName エクスポート名
   * @param apiName API内部名
   */
  public registerExport(exportName: string, apiName: string): void {
    this.exportMap.set(exportName, apiName);
    logger.debug(`[RtkApiMetadataManager] API "${apiName}" のエクスポート "${exportName}" を登録`);
  }

  /**
   * インポート情報を登録
   * @param importName インポート名
   * @param sourceFile ソースファイルパス
   * @param exportName エクスポート名
   */
  public registerImport(importName: string, sourceFile: string, exportName: string): void {
    this.importMap.set(importName, { sourceFile, exportName });
    logger.debug(`[RtkApiMetadataManager] インポート "${importName}" を登録（${sourceFile}から${exportName}）`);
  }

  /**
   * インポート/エクスポート関係からAPI名を解決
   * @param importName インポート名
   * @returns 解決されたAPI名（解決できない場合はundefined）
   */
  public resolveApiFromImport(importName: string): string | undefined {
    // インポート情報を取得
    const importInfo = this.importMap.get(importName);
    if (!importInfo) {
      return undefined;
    }
    
    // エクスポート名からAPI名を解決
    const apiName = this.exportMap.get(importInfo.exportName);
    return apiName;
  }
  
  /**
   * ソースファイルからインポートを解析して登録
   * @param sourceFile ソースファイル
   */
  public parseAndRegisterImports(sourceFile: SourceFile): void {
    // インポート宣言を解析
    const importDeclarations = sourceFile.getImportDeclarations();
    
    for (const importDecl of importDeclarations) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      
      // 相対パスのインポートのみ処理
      if (!moduleSpecifier.startsWith('.')) {
        continue;
      }
      
      // インポート元ファイルの解決
      const sourceFilePath = sourceFile.getFilePath();
      const importedSourcePath = NodeExtractors.resolveModulePath(sourceFilePath, moduleSpecifier);
      
      if (!importedSourcePath) {
        continue;
      }
      
      // 名前付きインポートの処理
      const namedImports = importDecl.getNamedImports();
      for (const namedImport of namedImports) {
        const importName = namedImport.getName();
        const aliasName = namedImport.getAliasNode()?.getText() || importName;
        
        this.registerImport(aliasName, importedSourcePath, importName);
      }
      
      // デフォルトインポートの処理
      const defaultImport = importDecl.getDefaultImport();
      if (defaultImport) {
        const importName = defaultImport.getText();
        this.registerImport(importName, importedSourcePath, 'default');
      }
    }
  }

  /**
   * API名とエンドポイント名からエンドポイントメタデータを取得
   * @param apiName API名
   * @param endpointName エンドポイント名
   * @returns エンドポイントメタデータ（存在しない場合はundefined）
   */
  public getEndpointMetadata(apiName: string, endpointName: string): RTKEndpointMetadata | undefined {
    const api = this.apiRegistry.get(apiName);
    if (!api) {
      return undefined;
    }
    
    return api.endpoints.get(endpointName);
  }

  /**
   * 登録されている全エンドポイントメタデータを取得
   * @returns エンドポイントメタデータの配列
   */
  public getAllEndpointMetadata(): RTKEndpointMetadata[] {
    const allEndpoints: RTKEndpointMetadata[] = [];
    
    for (const api of this.apiRegistry.values()) {
      for (const endpoint of api.endpoints.values()) {
        allEndpoints.push(endpoint);
      }
    }
    
    return allEndpoints;
  }
}

// シングルトンインスタンスの提供
export const rtkApiMetadataManager = new RtkApiMetadataManager();
