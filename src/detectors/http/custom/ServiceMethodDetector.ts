/**
 * サービスメソッド検出器
 * 
 * サービスクラスやリポジトリクラスのメソッド呼び出しパターンを検出し、
 * エンドポイント情報を抽出します。リポジトリパターンなどの一般的なパターンに対応します。
 */

// ts-morphの直接インポートを避け、抽象インターフェースのみを使用するのだ
import { INode, NodeKind } from '../../../core/ast/interfaces/INode';
import { ISourceFile } from '../../../core/ast/interfaces/ISourceFile';
import { BasePatternDetector } from '../../common/PatternDetector';
import { 
  DetectionContext, 
  EndpointInfo, 
  HttpMethod, 
  ParameterType, 
  ParameterUsage, 
  ResponseUsage, 
  UsageLocation 
} from '../../../types';
import { NodePredicates } from '../../../utils/ast/NodePredicates';
import { NodeExtractorsExtended } from '../../../utils/ast/NodeExtractorsExtended';
import { MethodInference } from '../../../utils/http/MethodInference';
import { ServiceIds } from '../../../core/ServiceLocator';
import { EndpointBuilder } from '../../common/EndpointBuilder';
// import { logger } from '../../../utils/Logger';

/**
 * サービスクラスメソッド検出器
 * リポジトリパターンなどの設計パターンを検出します
 */
export class ServiceMethodDetector extends BasePatternDetector {
  readonly patternName = 'ServiceMethod';
  
  /**
   * サービスクラスメソッド呼び出しを検出
   * @param node 検査対象ノード
   * @returns パターンに一致するか否か
   */
  public canHandle(node: INode): boolean {
    if (!node.isKind(NodeKind.CallExpression)) {
      return false;
    }
    
    const expression = node.getExpression?.();
    if (!expression || !expression.isKind(NodeKind.PropertyAccessExpression)) {
      return false;
    }
    
    const objExpr = expression.getExpression?.();
    if (!objExpr) return false;

    const methodName = (expression as any).getName?.() || '';
    
    // オブジェクト名がサービスっぽいかチェック
    const objName = objExpr.getText().toLowerCase();
    const isServiceLike = (
      objName.includes('service') ||
      objName.includes('repository') ||
      objName.includes('store') ||
      objName.includes('facade') ||
      objName.includes('provider')
    );
    
    if (!isServiceLike) {
      return false;
    }
    
    // メソッド名がCRUD操作っぽいかチェック
    const isCrudMethod = (
      methodName.startsWith('get') ||
      methodName.startsWith('find') ||
      methodName.startsWith('fetch') ||
      methodName.startsWith('load') ||
      methodName.startsWith('create') ||
      methodName.startsWith('add') ||
      methodName.startsWith('update') ||
      methodName.startsWith('save') ||
      methodName.startsWith('delete') ||
      methodName.startsWith('remove')
    );
    
    return isCrudMethod;
  }
  
  /**
   * サービスメソッド呼び出しからエンドポイント情報を抽出
   * @param node 対象ノード
   * @param context 検出コンテキスト
   * @returns 抽出されたエンドポイント情報配列
   */
  public extractEndpoints(node: INode, context: DetectionContext): EndpointInfo[] {
    if (!node.isKind(NodeKind.CallExpression)) {
      return [];
    }
    
    const expression = node.getExpression?.();
    if (!expression || !expression.isKind(NodeKind.PropertyAccessExpression)) {
      return [];
    }
    
    // オブジェクト名とメソッド名を取得
    const objExpr = expression.getExpression?.();
    if (!objExpr) return [];

    const methodName = (expression as any).getName?.() || '';
    const objName = objExpr.getText();
    
    // 引数を取得
    const args = node.getArguments?.() || [];
    
    // メソッド名からリソース名とHTTPメソッドを推測
    return this.extractEndpointFromMethodName(node, methodName, args, context);
  }
  
  /**
   * メソッド名からエンドポイント情報を抽出（簡易版）
   * @param node 対象ノード
   * @param methodName メソッド名
   * @param args 引数配列
   * @param context 検出コンテキスト
   * @returns 抽出されたエンドポイント情報配列
   */
  private extractEndpointFromMethodName(
    node: INode,
    methodName: string,
    args: INode[],
    context: DetectionContext
  ): EndpointInfo[] {
    // HTTPメソッドを推測
    let httpMethod = MethodInference.inferMethodFromName(methodName);
    
    // リソース名を推測
    let resourceName = '';
    
    // メソッド名から接頭辞を除去してリソース名を抽出
    if (methodName.startsWith('get') || methodName.startsWith('find') || methodName.startsWith('fetch') || methodName.startsWith('load')) {
      resourceName = methodName.replace(/^(get|find|fetch|load)/, '');
      httpMethod = 'GET';
    } else if (methodName.startsWith('create') || methodName.startsWith('add')) {
      resourceName = methodName.replace(/^(create|add)/, '');
      httpMethod = 'POST';
    } else if (methodName.startsWith('update') || methodName.startsWith('save')) {
      resourceName = methodName.replace(/^(update|save)/, '');
      httpMethod = 'PUT';
    } else if (methodName.startsWith('delete') || methodName.startsWith('remove')) {
      resourceName = methodName.replace(/^(delete|remove)/, '');
      httpMethod = 'DELETE';
    }
    
    // リソース名の先頭を小文字に
    if (resourceName.length > 0) {
      resourceName = resourceName.charAt(0).toLowerCase() + resourceName.substring(1);
    }
    
    // キャメルケースをケバブケースに変換
    resourceName = resourceName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    
    // URLを構築
    let urlValue = `/${resourceName}`;
    
    // 引数があればIDパラメータとして扱う
    if (args.length > 0 && httpMethod !== 'POST') {
      if (args[0].isKind(NodeKind.StringLiteral) || args[0].isKind(NodeKind.NumericLiteral)) {
        urlValue += '/:id';
      }
    }
    
    // 使用箇所情報の作成
    const location = this.createUsageLocation(node, context.sourceFile);
    
    // パラメータの抽出
    const params: ParameterUsage[] = [];
    
    // URLからパスパラメータを抽出
    const pathParams = NodeExtractorsExtended.extractPathParameters(urlValue);
    for (const paramName of pathParams) {
      params.push({
        name: paramName,
        type: 'path',
        required: true,
        locations: [location]
      });
    }
    
    // 引数からパラメータを抽出
    if (args.length > 0) {
      // 最初の引数がIDの場合
      if (httpMethod !== 'POST' && (args[0].isKind(NodeKind.StringLiteral) || args[0].isKind(NodeKind.NumericLiteral))) {
        // すでにパスパラメータとして追加済み
      }
      // オブジェクトリテラルの引数がある場合
      else if (args.some(arg => arg.isKind(NodeKind.ObjectLiteralExpression))) {
        const objArg = args.find(arg => arg.isKind(NodeKind.ObjectLiteralExpression));
        if (objArg && objArg.isKind(NodeKind.ObjectLiteralExpression)) {
          const objProps = NodeExtractorsExtended.extractObjectProperties(objArg);
          
          // POSTやPUTの場合はボディパラメータ、GETの場合はクエリパラメータとして扱う
          const paramType: ParameterType = (httpMethod === 'GET') ? 'query' : 'body';
          
          for (const prop of objProps) {
            params.push({
              name: prop.name,
              type: paramType,
              locations: [location]
            });
          }
        }
      }
    }
    
    // レスポンス処理の情報
    const responseHandling: ResponseUsage[] = [{
      type: 'unknown',
      location: location
    }];
    
    // エンドポイント情報の構築
    const endpointBuilder = context.serviceLocator?.resolve<EndpointBuilder>(ServiceIds.ENDPOINT_BUILDER);
    
    if (!endpointBuilder || !endpointBuilder.buildEndpoint) {
      return [];
    }
    
    const endpoint = endpointBuilder.buildEndpoint(
      urlValue,
      httpMethod,
      location,
      params,
      responseHandling,
      'custom-client'
    );
    
    return endpoint ? [endpoint] : [];
  }
  
  /**
   * 使用箇所の詳細情報を作成
   * @param node ノード
   * @param sourceFile ソースファイル
   * @param context コンテキスト情報
   * @returns 使用箇所詳細情報
   */
  private createUsageLocation(node: INode, sourceFile: ISourceFile, context?: string): UsageLocation {
    const location = node.getLocation?.() || { lineNumber: 1, columnNumber: 1 };
    
    // 周囲のコンテキスト（メソッド/クラス名など）を推測
    let contextName = context;
    if (!contextName) {
      contextName = NodeExtractorsExtended.inferNodeContext(node);
    }
    
    return {
      filePath: sourceFile.getFilePath(),
      lineNumber: location.lineNumber ?? 1, // デフォルト値を与える
      columnNumber: location.columnNumber ?? 1, // デフォルト値を与える
      context: contextName,
      codeSnippet: node.getText().slice(0, 100) // 先頭100文字までを取得
    };
  }
}
