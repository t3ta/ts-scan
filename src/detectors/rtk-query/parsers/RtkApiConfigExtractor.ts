/**
 * RTK API 設定抽出モジュール
 * 
 * createApi呼び出しからRTK Query API設定を抽出し、
 * APIメタデータを構築するためのユーティリティクラスを提供します。
 */

import { 
  CallExpression,
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
  SourceFile,
  StringLiteral,
  SyntaxKind
} from 'ts-morph';
import { 
  RTKApiMetadata 
} from './RtkQueryTypes';
import { DetectionContext } from '../../../types';
import { logger } from '../../../utils/Logger';
import { rtkApiMetadataManager } from './RtkApiMetadataManager';

/**
 * RTK API設定抽出クラス
 * createApi呼び出しの解析と設定オブジェクトからのメタデータ抽出を担当
 */
export class RtkApiConfigExtractor {
  /**
   * createApi呼び出しを解析してAPIメタデータを構築
   * @param node 対象ノード（createApi呼び出し）
   * @param sourceFile ソースファイル
   * @param context 検出コンテキスト
   * @returns 構築されたAPIメタデータ
   */
  public extractApiFromCreateApiCall(
    node: Node, 
    sourceFile: SourceFile, 
    context: DetectionContext
  ): RTKApiMetadata | undefined {
    if (!node.isKind(SyntaxKind.CallExpression)) {
      return undefined;
    }

    logger.debug(`[RtkApiConfigExtractor] createApi呼び出しの解析開始`);
    
    const callExpression = node as CallExpression;
    
    // 引数の取得（設定オブジェクト）
    const configArg = callExpression.getArguments()[0];
    if (!configArg || !configArg.isKind(SyntaxKind.ObjectLiteralExpression)) {
      logger.warn(`[RtkApiConfigExtractor] createApiの設定オブジェクトが見つかりません`);
      return undefined;
    }
    
    const configObject = configArg as ObjectLiteralExpression;
    
    // createApiの結果の変数名を取得
    const apiName = this.findApiName(callExpression, sourceFile);
    if (!apiName) {
      logger.warn(`[RtkApiConfigExtractor] API名が特定できません`);
      return undefined;
    }
    
    // APIメタデータを作成
    const apiMetadata: RTKApiMetadata = {
      apiName,
      sourceFile,
      endpoints: new Map(),
      hasBaseQuery: false
    };
    
    // 設定オブジェクトからメタデータを抽出
    this.extractApiConfig(configObject, apiMetadata, context);
    
    // エクスポートを検出して登録
    this.detectAndRegisterExports(apiName, sourceFile);
    
    // メタデータマネージャに登録
    rtkApiMetadataManager.registerApi(apiMetadata);
    
    return apiMetadata;
  }

  /**
   * createApiの結果が代入される変数名を取得
   * @param callExpression createApi呼び出し式
   * @param sourceFile ソースファイル
   * @returns API名（変数名）
   */
  private findApiName(callExpression: CallExpression, sourceFile: SourceFile): string | undefined {
    // 変数宣言の一部として使用されているケース
    const varDecl = callExpression.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
    if (varDecl) {
      return varDecl.getName();
    }
    
    // 変数割り当てとして使用されているケース
    const binExpr = callExpression.getFirstAncestorByKind(SyntaxKind.BinaryExpression);
    if (binExpr && binExpr.getLeft().getKind() === SyntaxKind.Identifier) {
      return binExpr.getLeft().getText();
    }
    
    // デフォルト名
    return `api_${sourceFile.getBaseName().replace(/\.[^/.]+$/, '')}`;
  }

  /**
   * API設定オブジェクトからメタデータを抽出
   * @param configObject 設定オブジェクト
   * @param apiMetadata APIメタデータ
   * @param context 検出コンテキスト
   */
  private extractApiConfig(
    configObject: ObjectLiteralExpression,
    apiMetadata: RTKApiMetadata,
    context: DetectionContext
  ): void {
    // reducerPathの抽出
    const reducerPathProp = configObject.getProperty('reducerPath');
    if (reducerPathProp && reducerPathProp.isKind(SyntaxKind.PropertyAssignment)) {
      const initializer = (reducerPathProp as PropertyAssignment).getInitializer();
      if (initializer && initializer.isKind(SyntaxKind.StringLiteral)) {
        apiMetadata.reducerPath = (initializer as StringLiteral).getLiteralValue();
      }
    }
    
    // baseUrlの抽出（baseUrl, baseQuery関連）
    this.extractBaseUrl(configObject, apiMetadata);
    
    // tagTypesの抽出
    const tagTypesProp = configObject.getProperty('tagTypes');
    if (tagTypesProp && tagTypesProp.isKind(SyntaxKind.PropertyAssignment)) {
      const initializer = (tagTypesProp as PropertyAssignment).getInitializer();
      if (initializer && initializer.isKind(SyntaxKind.ArrayLiteralExpression)) {
        const tagTypes: string[] = [];
        initializer.forEachChild(child => {
          if (child.isKind(SyntaxKind.StringLiteral)) {
            tagTypes.push((child as StringLiteral).getLiteralValue());
          }
        });
        apiMetadata.tagTypes = tagTypes;
      }
    }
  }

  /**
   * ベースURLの抽出
   * @param configObject 設定オブジェクト
   * @param apiMetadata APIメタデータ
   */
  private extractBaseUrl(
    configObject: ObjectLiteralExpression, 
    apiMetadata: RTKApiMetadata
  ): void {
    // 1. baseUrl直接指定の場合
    const baseUrlProp = configObject.getProperty('baseUrl');
    if (baseUrlProp && baseUrlProp.isKind(SyntaxKind.PropertyAssignment)) {
      const initializer = (baseUrlProp as PropertyAssignment).getInitializer();
      if (initializer && initializer.isKind(SyntaxKind.StringLiteral)) {
        apiMetadata.baseUrl = (initializer as StringLiteral).getLiteralValue();
        return;
      }
    }
    
    // 2. baseQueryプロパティからの抽出
    const baseQueryProp = configObject.getProperty('baseQuery');
    if (baseQueryProp && baseQueryProp.isKind(SyntaxKind.PropertyAssignment)) {
      apiMetadata.hasBaseQuery = true;
      const initializer = (baseQueryProp as PropertyAssignment).getInitializer();
      
      // fetchBaseQueryの呼び出しからURLを抽出
      if (initializer && initializer.isKind(SyntaxKind.CallExpression)) {
        const callExpr = initializer as CallExpression;
        const callName = callExpr.getExpression().getText();
        
        if (callName === 'fetchBaseQuery') {
          const arg = callExpr.getArguments()[0];
          if (arg && arg.isKind(SyntaxKind.ObjectLiteralExpression)) {
            const baseUrlProp = (arg as ObjectLiteralExpression).getProperty('baseUrl');
            if (baseUrlProp && baseUrlProp.isKind(SyntaxKind.PropertyAssignment)) {
              const baseUrlInit = (baseUrlProp as PropertyAssignment).getInitializer();
              if (baseUrlInit && baseUrlInit.isKind(SyntaxKind.StringLiteral)) {
                apiMetadata.baseUrl = (baseUrlInit as StringLiteral).getLiteralValue();
              }
            }
          }
        }
      }
    }
  }

  /**
   * APIのエクスポートを検出して登録
   * @param apiName API名
   * @param sourceFile ソースファイル
   */
  private detectAndRegisterExports(apiName: string, sourceFile: SourceFile): void {
    // 名前付きエクスポート
    const namedExports = sourceFile.getExportedDeclarations();
    for (const [exportName, declarations] of namedExports.entries()) {
      for (const decl of declarations) {
        if (decl.isKind(SyntaxKind.VariableDeclaration) && decl.getName() === apiName) {
          rtkApiMetadataManager.registerExport(exportName, apiName);
        }
      }
    }
    
    // デフォルトエクスポート
    const defaultExport = sourceFile.getDefaultExportSymbol();
    if (defaultExport) {
      const declarations = defaultExport.getDeclarations();
      for (const decl of declarations) {
        if (decl.isKind(SyntaxKind.VariableDeclaration) && decl.getName() === apiName) {
          rtkApiMetadataManager.registerExport('default', apiName);
        }
      }
    }
  }
}
