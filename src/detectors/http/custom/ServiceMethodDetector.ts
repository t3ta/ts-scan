/**
 * サービスメソッド検出器
 * 
 * サービスクラスやリポジトリクラスのメソッド呼び出しパターンを検出し、
 * エンドポイント情報を抽出します。リポジトリパターンなどの一般的なパターンに対応します。
 */

import { Node, SourceFile, SyntaxKind } from 'ts-morph';
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
import { logger } from '../../../utils/Logger';

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
  public canHandle(node: Node): boolean {
    if (!node.isKind(SyntaxKind.CallExpression)) {
      return false;
    }
    
    const expression = node.getExpression();
    if (!expression.isKind(SyntaxKind.PropertyAccessExpression)) {
      return false;
    }
    
    const objExpr = expression.getExpression();
    const methodName = expression.getName();
    
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
  public extractEndpoints(node: Node, context: DetectionContext): EndpointInfo[] {
    const callExpr = node;
    const propExpr = callExpr.getExpression();
    
    if (!propExpr.isKind(SyntaxKind.PropertyAccessExpression)) {
      return [];
    }
    
    // オブジェクト名とメソッド名を取得
    const objExpr = propExpr.getExpression();
    const methodName = propExpr.getName();
    const objName = objExpr.getText();
    
    // 引数を取得
    const args = callExpr.isKind(SyntaxKind.CallExpression) ? callExpr.getArguments() : [];
    
    // メソッド定義を探して調査
    const methodDecl = this.findMethodDefinition(context.sourceFile, objName, methodName);
    if (!methodDecl) {
      // メソッド名からリソース名とHTTPメソッドを推測する簡易ケース
      return this.extractEndpointFromMethodName(node, methodName, args, context);
    }
    
    // メソッド定義を解析してエンドポイントを抽出
    return this.extractEndpointFromMethodDefinition(node, methodDecl, args, context);
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
    node: Node,
    methodName: string,
    args: Node[],
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
      if (args[0].isKind(SyntaxKind.StringLiteral) || args[0].isKind(SyntaxKind.NumericLiteral)) {
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
      if (httpMethod !== 'POST' && (args[0].isKind(SyntaxKind.StringLiteral) || args[0].isKind(SyntaxKind.NumericLiteral))) {
        // すでにパスパラメータとして追加済み
      }
      // オブジェクトリテラルの引数がある場合
      else if (args.some(arg => arg.isKind(SyntaxKind.ObjectLiteralExpression))) {
        const objArg = args.find(arg => arg.isKind(SyntaxKind.ObjectLiteralExpression));
        if (objArg && objArg.isKind(SyntaxKind.ObjectLiteralExpression)) {
          const objProps = NodeExtractors.extractObjectProperties(objArg);
          
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
    
    // レスポンス処理の情報を抽出
    let responseHandling: ResponseUsage[] = [{
      type: 'unknown',
      location: location
    }];
    
    // thenメソッドチェーンを検出
    const parentChain = NodeExtractorsExtended.findMethodChain(node);
    if (parentChain) {
      for (const chainNode of parentChain) {
        if (NodePredicates.isMethodCall(chainNode, 'then')) {
          const thenArgs = chainNode.isKind(SyntaxKind.CallExpression) ? chainNode.getArguments() : [];
          
          if (thenArgs.length > 0) {
            const callbackBody = NodeExtractorsExtended.extractCallbackBody(thenArgs[0]);
            
            if (callbackBody) {
              // 型付け情報を探す
              const typeInfo = NodeExtractorsExtended.extractTypeAnnotations(callbackBody);
              
              if (typeInfo && typeInfo.length > 0) {
                responseHandling = [{
                  type: 'typed',
                  typeName: typeInfo[0].typeName,
                  location: location
                }];
              }
            }
          }
        }
      }
    }
    
    // エンドポイント情報の構築
    const endpointBuilder = context.serviceLocator?.resolve(ServiceIds.ENDPOINT_BUILDER);
    
    const endpoint = endpointBuilder?.buildEndpoint(
      urlValue,
      httpMethod,
      location,
      params,
      responseHandling,
      'custom-client'
    );
    
    return [endpoint];
  }
  
  /**
   * メソッド定義からエンドポイント情報を抽出
   * @param node 対象ノード
   * @param methodDecl メソッド定義ノード
   * @param args 引数配列
   * @param context 検出コンテキスト
   * @returns 抽出されたエンドポイント情報配列
   */
  private extractEndpointFromMethodDefinition(
    node: Node,
    methodDecl: Node,
    args: Node[],
    context: DetectionContext
  ): EndpointInfo[] {
    // メソッド本体を取得
    const body = methodDecl.getFirstDescendantByKind(SyntaxKind.Block);
    if (!body) {
      return [];
    }
    
    // HTTP呼び出しを探す
    const httpCalls: { node: Node; method: HttpMethod; url: string | null }[] = [];
    
    // fetch呼び出しを探す
    const fetchCalls = this.findFetchCalls(body);
    httpCalls.push(...fetchCalls);
    
    // axios呼び出しを探す
    const axiosCalls = this.findAxiosCalls(body);
    httpCalls.push(...axiosCalls);
    
    // HTTP呼び出しが見つかった場合はそれに基づいてエンドポイント情報を構築
    if (httpCalls.length > 0) {
      const endpointInfos: EndpointInfo[] = [];
      
      for (const httpCall of httpCalls) {
        const urlValue = httpCall.url;
        
        if (!urlValue) {
          continue;
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
        
        // URLからクエリパラメータを抽出
        const queryParams = NodeExtractorsExtended.extractQueryParameters(urlValue);
        for (const paramName of queryParams) {
          params.push({
            name: paramName,
            type: 'query',
            locations: [location]
          });
        }
        
        // メソッド呼び出しの引数からパラメータを抽出
        if (httpCall.node.isKind(SyntaxKind.CallExpression)) {
          const callArgs = httpCall.node.getArguments();
          
          // 2番目の引数がオブジェクトリテラルの場合
          if (callArgs.length > 1 && callArgs[1].isKind(SyntaxKind.ObjectLiteralExpression)) {
            const configObj = callArgs[1];
            
            // GETの場合はparamsプロパティからクエリパラメータを抽出
            if (httpCall.method === 'GET') {
              const paramsNode = NodeExtractorsExtended.getPropertyFromObjectLiteral(configObj, 'params');
              if (paramsNode && paramsNode.isKind(SyntaxKind.ObjectLiteralExpression)) {
                const paramProps = NodeExtractorsExtended.extractObjectProperties(paramsNode);
                
                for (const prop of paramProps) {
                  params.push({
                    name: prop.name,
                    type: 'query',
                    locations: [location]
                  });
                }
              }
            } 
            // POST/PUT/PATCHの場合はdataプロパティからボディパラメータを抽出
            else if (['POST', 'PUT', 'PATCH'].includes(httpCall.method)) {
              const dataNode = NodeExtractorsExtended.getPropertyFromObjectLiteral(configObj, 'data');
              if (dataNode && dataNode.isKind(SyntaxKind.ObjectLiteralExpression)) {
                const dataProps = NodeExtractorsExtended.extractObjectProperties(dataNode);
                
                for (const prop of dataProps) {
                  params.push({
                    name: prop.name,
                    type: 'body',
                    locations: [location]
                  });
                }
              }
            }
          }
        }
        
        // レスポンス処理の情報を抽出
        const responseHandling = this.extractResponseHandling(node, location);
        
        // エンドポイント情報の構築
        const endpointBuilder = context.serviceLocator?.resolve(ServiceIds.ENDPOINT_BUILDER);
        
        const endpoint = endpointBuilder?.buildEndpoint(
          urlValue,
          httpCall.method,
          location,
          params,
          responseHandling,
          'custom-client'
        );
        
        endpointInfos.push(endpoint);
      }
      
      return endpointInfos;
    }
    
    // HTTP呼び出しが見つからなかった場合は、メソッド名からエンドポイントを推測
    return this.extractEndpointFromMethodName(node, methodDecl.getName() || '', args, context);
  }
  
  /**
   * レスポンス処理情報を抽出する
   * @param node 対象ノード
   * @param location 使用箇所情報
   * @returns レスポンス処理情報
   */
  private extractResponseHandling(node: Node, location: UsageLocation): ResponseUsage[] {
    // thenメソッドチェーンを検出
    const parentChain = NodeExtractorsExtended.findMethodChain(node);
    if (parentChain) {
      for (const chainNode of parentChain) {
        if (NodePredicates.isMethodCall(chainNode, 'then')) {
          const thenArgs = chainNode.isKind(SyntaxKind.CallExpression) ? chainNode.getArguments() : [];
          
          if (thenArgs.length > 0) {
            const callbackBody = NodeExtractorsExtended.extractCallbackBody(thenArgs[0]);
            
            if (callbackBody) {
              // 型付け情報を探す
              const typeInfo = NodeExtractorsExtended.extractTypeAnnotations(callbackBody);
              
              if (typeInfo && typeInfo.length > 0) {
                return [{
                  type: 'typed',
                  typeName: typeInfo[0].typeName,
                  location: location
                }];
              } else {
                // 変換処理の有無を確認
                const transformationDetected = NodeExtractorsExtended.detectResponseTransformation(callbackBody);
                
                return [{
                  type: transformationDetected ? 'transformation' : 'direct',
                  location: location
                }];
              }
            }
          }
        }
      }
    }
    
    // async/awaitパターンの検出
    const awaitParent = NodeExtractorsExtended.findAwaitExpression(node);
    if (awaitParent) {
      // 変数への代入を探す
      const assignment = NodeExtractorsExtended.findAssignmentExpression(awaitParent);
      if (assignment) {
        // 型付け情報を探す
        const typeInfo = NodeExtractorsExtended.extractVariableTypeAnnotation(assignment);
        if (typeInfo) {
          return [{
            type: 'typed',
            typeName: typeInfo,
            location: location
          }];
        }
      }
    }
    
    // デフォルト値
    return [{
      type: 'unknown',
      location: location
    }];
  }
  
  /**
   * fetch呼び出しを探して情報を抽出
   * @param body 探索対象のノード
   * @returns 検出されたHTTP呼び出し情報
   */
  private findFetchCalls(body: Node): { node: Node; method: HttpMethod; url: string | null }[] {
    const result: { node: Node; method: HttpMethod; url: string | null }[] = [];
    
    const fetchCalls = body.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter(call => {
        const expr = call.getExpression();
        return expr.getText() === 'fetch' || 
               expr.getText() === 'window.fetch' || 
               expr.getText() === 'self.fetch' || 
               expr.getText() === 'global.fetch';
      });
    
    for (const fetchCall of fetchCalls) {
      const fetchArgs = fetchCall.getArguments();
      
      if (fetchArgs.length === 0) {
        continue;
      }
      
      const urlArg = fetchArgs[0];
      const urlValue = NodeExtractors.extractStringValue(urlArg);
      
      if (!urlValue) {
        continue;
      }
      
      let methodValue: HttpMethod = 'GET';
      
      if (fetchArgs.length > 1 && fetchArgs[1].isKind(SyntaxKind.ObjectLiteralExpression)) {
        const optionsObj = fetchArgs[1];
        const methodNode = NodeExtractors.getPropertyFromObjectLiteral(optionsObj, 'method');
        
        if (methodNode) {
          const methodText = NodeExtractors.extractStringValue(methodNode);
          if (methodText) {
            methodValue = methodText.toUpperCase() as HttpMethod;
          }
        }
      }
      
      result.push({ node: fetchCall, method: methodValue, url: urlValue });
    }
    
    return result;
  }
  
  /**
   * axios呼び出しを探して情報を抽出
   * @param body 探索対象のノード
   * @returns 検出されたHTTP呼び出し情報
   */
  private findAxiosCalls(body: Node): { node: Node; method: HttpMethod; url: string | null }[] {
    const result: { node: Node; method: HttpMethod; url: string | null }[] = [];
    
    const axiosCalls = body.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter(call => {
        const expr = call.getExpression();
        if (!expr.isKind(SyntaxKind.PropertyAccessExpression)) {
          return false;
        }
        
        const objExpr = expr.getExpression();
        const methodName = expr.getName().toLowerCase();
        
        return (
          objExpr.getText() === 'axios' ||
          objExpr.getText().toLowerCase().includes('axios') ||
          objExpr.getText().toLowerCase().includes('http') ||
          objExpr.getText().toLowerCase().includes('client')
        ) && ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(methodName);
      });
    
    for (const axiosCall of axiosCalls) {
      const expr = axiosCall.getExpression();
      if (!expr.isKind(SyntaxKind.PropertyAccessExpression)) {
        continue;
      }
      
      const methodName = expr.getName().toLowerCase();
      const axiosArgs = axiosCall.getArguments();
      
      if (axiosArgs.length === 0) {
        continue;
      }
      
      const urlArg = axiosArgs[0];
      const urlValue = NodeExtractors.extractStringValue(urlArg);
      
      if (!urlValue) {
        continue;
      }
      
      const methodValue = methodName.toUpperCase() as HttpMethod;
      
      result.push({ node: axiosCall, method: methodValue, url: urlValue });
    }
    
    return result;
  }
  
  /**
   * メソッド定義を探す
   * @param sourceFile ソースファイル
   * @param objName オブジェクト名
   * @param methodName メソッド名
   * @returns メソッド定義ノード
   */
  private findMethodDefinition(sourceFile: SourceFile, objName: string, methodName: string): Node | undefined {
    // クラス定義を探す
    const classes = sourceFile.getClasses();
    
    for (const cls of classes) {
      // クラス名が一致するか、インスタンス変数名と一致する可能性のあるものを探す
      const className = cls.getName();
      if (className && (
        objName === className ||
        objName.toLowerCase().includes(className.toLowerCase()) ||
        className.toLowerCase().includes(objName.toLowerCase().replace(/service|repository|store|facade|provider/g, '').trim())
      )) {
        // メソッド定義を探す
        const method = cls.getMethod(methodName);
        if (method) {
          return method;
        }
      }
    }
    
    // 関数定義を探す（静的メソッドや関数の場合）
    const functions = sourceFile.getFunctions();
    
    for (const func of functions) {
      const funcName = func.getName();
      if (funcName === methodName) {
        return func;
      }
    }
    
    return undefined;
  }
  
  /**
   * 使用箇所の詳細情報を作成
   * @param node ノード
   * @param sourceFile ソースファイル
   * @param context コンテキスト情報
   * @returns 使用箇所詳細情報
   */
  private createUsageLocation(node: Node, sourceFile: SourceFile, context?: string): UsageLocation {
    const lineAndColumn = NodeExtractorsExtended.getStartLineAndColumn(node);
    
    // 周囲のコンテキスト（メソッド/クラス名など）を推測
    let contextName = context;
    if (!contextName) {
      contextName = NodeExtractorsExtended.inferContext(node);
    }
    
    return {
      filePath: sourceFile.getFilePath(),
      lineNumber: lineAndColumn.line,
      columnNumber: lineAndColumn.column,
      context: contextName,
      codeSnippet: node.getText().slice(0, 100) // 先頭100文字までを取得
    };
  }
}
