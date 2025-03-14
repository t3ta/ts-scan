/**
 * RTK Query エンドポイント使用解析モジュール
 * 
 * RTK Queryで定義されたAPIエンドポイントの使用箇所を検出し、
 * useQueryやuseMutationのような命名パターンから対応するエンドポイントを特定します。
 */

import { 
  CallExpression, 
  Identifier, 
  Node, 
  PropertyAccessExpression, 
  SourceFile, 
  SyntaxKind 
} from 'ts-morph';
import { 
  DetectionContext, 
  EndpointInfo,
  HttpMethod,
  ResponseUsage,
  ParameterUsage,
  UsageLocation
} from '../../../types';
import { 
  ApiUsageInfo 
} from './RtkQueryTypes';
import { logger } from '../../../utils/Logger';
import { NodeExtractors } from '../../../utils/ast/NodeExtractors';
import { rtkApiMetadataManager } from './RtkApiMetadataManager';

/**
 * RTK Query エンドポイント使用解析クラス
 */
export class RtkEndpointUsageAnalyzer {
  /**
   * API使用箇所を解析
   * @param node 対象ノード
   * @param sourceFile ソースファイル
   * @param context 検出コンテキスト
   * @returns API使用情報（API名とエンドポイント名）
   */
  public analyzeApiUsage(
    node: Node, 
    sourceFile: SourceFile, 
    context: DetectionContext
  ): ApiUsageInfo | undefined {
    if (!node.isKind(SyntaxKind.CallExpression)) {
      return undefined;
    }
    
    const callExpr = node as CallExpression;
    const calleeExpr = callExpr.getExpression();
    
    // useXxx形式のみ処理
    if (!this.isUseQueryOrMutationCall(calleeExpr)) {
      return undefined;
    }
    
    // プロパティアクセス式（api.useGetUsersQuery）の場合
    if (calleeExpr.isKind(SyntaxKind.PropertyAccessExpression)) {
      return this.analyzePropertyAccessUsage(calleeExpr as PropertyAccessExpression, sourceFile);
    }
    
    // 直接呼び出し（useGetUsersQuery()）の場合
    if (calleeExpr.isKind(SyntaxKind.Identifier)) {
      return this.analyzeDirectHookUsage(calleeExpr as Identifier, sourceFile);
    }
    
    return undefined;
  }

  /**
   * useQueryまたはuseMutation形式の呼び出しかどうかを判定
   * @param node 対象ノード
   * @returns useQueryまたはuseMutation形式ならtrue
   */
  private isUseQueryOrMutationCall(node: Node): boolean {
    const text = node.getText();
    return text.startsWith('use') && 
          (text.includes('Query') || text.includes('Mutation'));
  }

  /**
   * プロパティアクセス形式の使用（api.useXxxQuery）を解析
   * @param propAccess プロパティアクセス式
   * @param sourceFile ソースファイル
   * @returns API使用情報
   */
  private analyzePropertyAccessUsage(
    propAccess: PropertyAccessExpression,
    sourceFile: SourceFile
  ): ApiUsageInfo | undefined {
    const objExpr = propAccess.getExpression();
    const apiName = objExpr.getText();
    
    // エンドポイント名を抽出（useGetUsersQueryからGetUsersを抽出）
    const methodName = propAccess.getName();
    if (!methodName.startsWith('use') || 
       !(methodName.endsWith('Query') || methodName.endsWith('Mutation'))) {
      return undefined;
    }
    
    const endpointPart = methodName
      .replace(/^use/, '')
      .replace(/Query$/, '')
      .replace(/Mutation$/, '');
    
    // キャメルケースをパースして元のエンドポイント名を推測
    const endpointName = this.getCamelToOriginalName(endpointPart);
    
    return { apiName, endpointName, sourceFile };
  }

  /**
   * 直接Hookコール形式の使用（useXxxQuery()）を解析
   * @param identifier 識別子
   * @param sourceFile ソースファイル
   * @returns API使用情報
   */
  private analyzeDirectHookUsage(
    identifier: Identifier,
    sourceFile: SourceFile
  ): ApiUsageInfo | undefined {
    const methodName = identifier.getText();
    if (!methodName.startsWith('use') || 
       !(methodName.endsWith('Query') || methodName.endsWith('Mutation'))) {
      return undefined;
    }
    
    // インポートマップからAPI名を解決する必要あり
    // rtkApiMetadataManager.parseAndRegisterImports(sourceFile) が
    // 事前に呼ばれていることを前提とする
    
    // エンドポイント名の抽出
    const endpointPart = methodName
      .replace(/^use/, '')
      .replace(/Query$/, '')
      .replace(/Mutation$/, '');
    
    const endpointName = this.getCamelToOriginalName(endpointPart);
    
    // API名の推測（これは複雑なので簡略化）
    // ファイル名からの推測や、インポート解析からの逆引きなどが必要
    // 簡略化として、ファイル名からの推測を実装
    const fileBaseName = sourceFile.getBaseName().replace(/\.[^/.]+$/, '');
    const apiName = `${fileBaseName}Api`;
    
    return { apiName, endpointName, sourceFile };
  }

  /**
   * エンドポイント使用からエンドポイント情報を構築
   * @param usageInfo API使用情報
   * @param node 使用箇所ノード
   * @param context 検出コンテキスト
   * @returns 構築されたエンドポイント情報
   */
  public constructEndpointInfoFromUsage(
    usageInfo: ApiUsageInfo,
    node: Node,
    context: DetectionContext
  ): EndpointInfo | undefined {
    // APIメタデータマネージャからエンドポイント定義を検索
    const endpointMetadata = rtkApiMetadataManager.getEndpointMetadata(
      usageInfo.apiName, 
      usageInfo.endpointName
    );
    
    if (!endpointMetadata) {
      // 定義が見つからない場合は、インポートマップを使って解決を試みる
      const resolvedApiName = rtkApiMetadataManager.resolveApiFromImport(usageInfo.apiName);
      if (resolvedApiName) {
        usageInfo.apiName = resolvedApiName;
        return this.constructEndpointInfoFromUsage(usageInfo, node, context);
      }
      
      logger.warn(`[RtkEndpointUsageAnalyzer] エンドポイント定義が見つかりません: ${usageInfo.apiName}.${usageInfo.endpointName}`);
      return undefined;
    }
    
    // 使用箇所の情報を作成
    const usageLocation = this.createUsageLocation(node, usageInfo.sourceFile);
    
    // パラメータ情報を抽出
    const parameterUsages = this.extractParameterUsages(node, usageLocation, context);
    
    // レスポンス処理情報を抽出
    const responseUsages = this.extractResponseHandling(node, usageLocation, context);
    
    // エンドポイント情報を構築
    const endpointInfo: EndpointInfo = {
      path: endpointMetadata.path,
      method: endpointMetadata.method,
      isDynamic: endpointMetadata.path.includes(':') || endpointMetadata.path.includes('{'),
      usageLocations: [usageLocation],
      parametersUsed: parameterUsages,
      responseHandling: responseUsages,
      source: 'rtk-query',
      rtkQuerySpecific: {
        isQuery: endpointMetadata.isQuery,
        isMutation: endpointMetadata.isMutation,
        transformResponseUsed: endpointMetadata.useTransformResponse,
        baseQueryUsed: true,
        apiName: usageInfo.apiName,
        builderName: undefined // 使用箇所からはビルダー名は不明
      }
    };
    
    return endpointInfo;
  }

  /**
   * 使用箇所情報の作成
   * @param node 対象ノード
   * @param sourceFile ソースファイル
   * @returns 使用箇所情報
   */
  private createUsageLocation(node: Node, sourceFile: SourceFile): UsageLocation {
    // 関数コンテキストを取得する試み
    const functionDecl = node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ||
                       node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration) ||
                       node.getFirstAncestorByKind(SyntaxKind.ArrowFunction);
    
    const context = functionDecl ? 
      (functionDecl.getKind() === SyntaxKind.ArrowFunction ? 
        '(anonymous function)' : 
        (Node.isMethodDeclaration(functionDecl) || Node.isFunctionDeclaration(functionDecl) ? 
          functionDecl.getName() || '(unnamed function)' : 
          '(unnamed function)'
        )
      ) : undefined;
    
    return NodeExtractors.createUsageLocation(node, sourceFile, context);
  }

  /**
   * パラメータ使用情報の抽出
   * @param node 対象ノード
   * @param location 使用箇所情報
   * @param context 検出コンテキスト
   * @returns パラメータ使用情報配列
   */
  private extractParameterUsages(
    node: Node, 
    location: UsageLocation,
    context: DetectionContext
  ): ParameterUsage[] {
    const parameterUsages: ParameterUsage[] = [];
    
    // CallExpressionからの引数抽出
    if (node.isKind(SyntaxKind.CallExpression)) {
      const callExpr = node as CallExpression;
      const args = callExpr.getArguments();
      
      // 最初の引数がオブジェクトリテラルの場合、それをパラメータとして扱う
      if (args.length > 0 && args[0].isKind(SyntaxKind.ObjectLiteralExpression)) {
        const objLiteral = args[0];
        
        // プロパティごとにパラメータ情報を作成
        objLiteral.forEachChild(child => {
          if (child.isKind(SyntaxKind.PropertyAssignment)) {
            const propAssign = child as any;
            const paramName = propAssign.getName();
            
            // 簡易的にqueryパラメータと判断（より詳細な解析は拡張可能）
            const paramUsage: ParameterUsage = {
              name: paramName,
              type: 'query',
              locations: [location]
            };
            
            parameterUsages.push(paramUsage);
          }
        });
      }
    }
    
    return parameterUsages;
  }

  /**
   * レスポンス処理情報の抽出
   * @param node 対象ノード
   * @param location 使用箇所情報
   * @param context 検出コンテキスト
   * @returns レスポンス処理情報配列
   */
  private extractResponseHandling(
    node: Node, 
    location: UsageLocation,
    context: DetectionContext
  ): ResponseUsage[] {
    // 基本的な使用の場合は transformResponseUsed を使用
    const responseUsage: ResponseUsage = {
      type: 'direct',
      location: location
    };
    
    // 親の分割代入式を検索して型情報を抽出（拡張可能）
    const variableDecl = node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
    if (variableDecl) {
      // 型アノテーションがある場合は取得
      const typeNode = variableDecl.getTypeNode();
      if (typeNode) {
        responseUsage.typeName = typeNode.getText();
        responseUsage.type = 'typed';
      }
    }
    
    return [responseUsage];
  }

  /**
   * キャメルケースからオリジナルのエンドポイント名を推測
   * @param camelCaseName キャメルケース名
   * @returns 推測されたオリジナル名
   */
  private getCamelToOriginalName(camelCaseName: string): string {
    // キャメルケースのままで返す（単純なマッピング）
    // 例: GetUsers -> getUsers (最初の文字を小文字に)
    if (camelCaseName.length > 0) {
      return camelCaseName.charAt(0).toLowerCase() + camelCaseName.slice(1);
    }
    return camelCaseName;
  }
}
