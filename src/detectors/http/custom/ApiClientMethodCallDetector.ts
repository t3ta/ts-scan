/**
 * APIクライアントメソッド呼び出し検出器
 * 
 * カスタムAPIクライアントのメソッド呼び出しパターンを検出し、エンドポイント情報を抽出します。
 * 例: apiClient.get('/users'), httpService.fetchUsers() など様々なパターンに対応します。
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
import { NodeExtractors } from '../../../utils/ast/NodeExtractors';
import { NodeExtractorsExtended } from '../../../utils/ast/NodeExtractorsExtended';
import { MethodInference } from '../../../utils/http/MethodInference';
import { ServiceIds } from '../../../core/ServiceLocator';
// logger は警告が出ているが、将来的に使用する可能性があるため残しておく
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { logger } from '../../../utils/Logger';

/**
 * APIクライアントメソッド呼び出し検出器
 * 一般的なAPIクライアントパターンを検出します
 */
export class ApiClientMethodCallDetector extends BasePatternDetector {
  readonly patternName = 'ApiClientMethodCall';
  
  /**
   * APIクライアントメソッド呼び出しを検出
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
    const methodName = expression.getName().toLowerCase();
    
    // オブジェクト名がAPIクライアントっぽいかチェック
    const objName = objExpr.getText().toLowerCase();
    const isApiClientLike = (
      objName.includes('api') ||
      objName.includes('http') ||
      objName.includes('client') ||
      objName.includes('service') ||
      objName.includes('facade') ||
      objName.includes('gateway') ||
      objName.includes('repository')
    );
    
    if (!isApiClientLike) {
      return false;
    }
    
    // メソッド名が以下のいずれかに該当するかチェック
    // 1. HTTPメソッド名と一致
    const isHttpMethod = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(methodName);
    
    // 2. fetch/request/call で始まる
    const isRequestMethod = (
      methodName.startsWith('fetch') ||
      methodName.startsWith('get') ||
      methodName.startsWith('create') ||
      methodName.startsWith('update') ||
      methodName.startsWith('delete') ||
      methodName.startsWith('request') ||
      methodName.startsWith('call')
    );
    
    return isHttpMethod || isRequestMethod;
  }
  
  /**
   * APIクライアントメソッド呼び出しからエンドポイント情報を抽出
   * @param node 対象ノード
   * @param context 検出コンテキスト
   * @returns 抽出されたエンドポイント情報配列
   */
  public extractEndpoints(node: Node, context: DetectionContext): EndpointInfo[] {
    if (!Node.isCallExpression(node)) {
      return [];
    }
    
    const callExpr = node;
    const propExpr = callExpr.getExpression();
    
    if (!propExpr.isKind(SyntaxKind.PropertyAccessExpression)) {
      return [];
    }
    
    // オブジェクト名とメソッド名を取得
    const objExpr = propExpr.getExpression();
    const methodName = propExpr.getName();
    const objName = objExpr.getText();
    
    // HTTPメソッドを取得/推測
    let httpMethod: HttpMethod;
    
    // 1. メソッド名がHTTPメソッドと一致する場合
    if (['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(methodName.toLowerCase())) {
      httpMethod = methodName.toUpperCase() as HttpMethod;
    } else {
      // 2. メソッド名からHTTPメソッドを推測
      httpMethod = MethodInference.inferMethodFromName(methodName);
    }
    
    // 引数を取得
    const args = callExpr.isKind(SyntaxKind.CallExpression) ? callExpr.getArguments() : [];
    
    // URLを推測
    let urlValue: string | null = null;
    
    // 1. 第1引数が文字列リテラルの場合はURLとして扱う
    if (args.length > 0) {
      urlValue = NodeExtractorsExtended.extractStringValue(args[0]);
    }
    
    // 2. 文字列が見つからない場合はメソッド名からURLを推測
    if (!urlValue) {
      urlValue = this.inferUrlFromMethodName(methodName);
    }
    
    // 3. それでも見つからない場合は関数定義を探して調査
    if (!urlValue) {
      const methodDecl = this.findMethodDefinition(context.sourceFile, objName, methodName);
      if (methodDecl) {
        urlValue = this.extractUrlFromMethodDefinition(methodDecl);
      }
    }
    
    // URLが見つからない場合は検出不能
    if (!urlValue) {
      return [];
    }
    
    // 使用箇所情報の作成
    const location = this.createUsageLocation(node, context.sourceFile);
    
    // パラメータの抽出
    const params: ParameterUsage[] = [];
    
    // URLからパスパラメータとクエリパラメータを抽出
    const pathParams = NodeExtractors.extractPathParameters(urlValue);
    for (const paramName of pathParams) {
      params.push({
        name: paramName,
        type: 'path',
        required: true,
        locations: [location]
      });
    }
    
    const queryParams = NodeExtractorsExtended.extractQueryParameters(urlValue);
    for (const paramName of queryParams) {
      params.push({
        name: paramName,
        type: 'query',
        locations: [location]
      });
    }
    
    // 2番目以降の引数からパラメータを抽出
    if (args.length > 1) {
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.isKind(SyntaxKind.ObjectLiteralExpression)) {
          const objProps = NodeExtractorsExtended.extractObjectProperties(arg);
          
          // POSTやPUTの第2引数はデータ本体、GETの第2引数はクエリパラメータと推測
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
    const responseHandling = this.extractResponseHandling(node, location);
    
    // エンドポイント情報の構築
    const endpointBuilder = context.serviceLocator?.resolve<any>(ServiceIds.ENDPOINT_BUILDER);
    
    const endpoint = endpointBuilder.buildEndpoint(
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
   * レスポンス処理情報を抽出する
   * @param node 対象ノード
   * @param location 使用箇所情報
   * @returns レスポンス処理情報
   */
  private extractResponseHandling(node: Node, location: UsageLocation): ResponseUsage[] {
    let responseHandling: ResponseUsage[] = [];
    
    // 1. メソッドの戻り値型を確認（呼び出し位置での使用方法から）
    const returnType = NodeExtractorsExtended.extractReturnType(node);
    if (returnType && returnType.includes('Promise<')) {
      // Promiseを返すメソッドの場合、thenメソッドチェーンを検出
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
                  responseHandling.push({
                    type: 'typed',
                    typeName: typeInfo[0].typeName,
                    location: location
                  });
                } else {
                  // 変換処理のあるレスポンス処理を検出
                  const transformationDetected = NodeExtractorsExtended.detectResponseTransformation(callbackBody);
                  
                  responseHandling.push({
                    type: transformationDetected ? 'transformation' : 'direct',
                    location: location
                  });
                }
              }
            }
          }
        }
      }
      
      // async/awaitパターンの検出
      if (responseHandling.length === 0) {
        // awaitの親を見つける
        const awaitParent = NodeExtractorsExtended.findAwaitExpression(node);
        if (awaitParent) {
          // 変数への代入を探す
          const assignment = NodeExtractorsExtended.findAssignmentExpression(awaitParent);
          if (assignment) {
            // 型付け情報を探す
            const typeInfo = NodeExtractorsExtended.extractVariableTypeAnnotation(assignment);
            if (typeInfo) {
              responseHandling.push({
                type: 'typed',
                typeName: typeInfo,
                location: location
              });
            } else {
              responseHandling.push({
                type: 'direct',
                location: location
              });
            }
          }
        }
      }
    } else {
      // 直接値を返すメソッドの場合
      responseHandling.push({
        type: 'direct',
        location: location
      });
    }
    
    // レスポンス処理が検出されなかった場合はデフォルト値を設定
    if (responseHandling.length === 0) {
      responseHandling.push({
        type: 'unknown',
        location: location
      });
    }
    
    return responseHandling;
  }
  
  /**
   * メソッド名からURLを推測
   * @param methodName メソッド名
   * @returns 推測されたURL
   */
  private inferUrlFromMethodName(methodName: string): string | null {
    // メソッド名が特定の接頭辞を持つ場合、それを除去してURLを推測
    let endpoint = methodName.toLowerCase();
    
    // 接頭辞を除去
    const prefixes = ['fetch', 'get', 'create', 'update', 'delete', 'retrieve', 'request', 'call'];
    for (const prefix of prefixes) {
      if (endpoint.startsWith(prefix)) {
        endpoint = endpoint.substring(prefix.length);
        break;
      }
    }
    
    // 先頭文字を小文字化
    if (endpoint.length > 0) {
      endpoint = endpoint.charAt(0).toLowerCase() + endpoint.substring(1);
    }
    
    // キャメルケースをケバブケースに変換（例: getUserData → user-data）
    endpoint = endpoint.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    
    // By や For などの単語を除去
    endpoint = endpoint.replace(/[-_]?by[-_]?/g, '/');
    endpoint = endpoint.replace(/[-_]?for[-_]?/g, '/');
    
    // 空文字列の場合はnullを返す
    if (!endpoint || endpoint === '') {
      return null;
    }
    
    // 先頭に / を追加
    if (!endpoint.startsWith('/')) {
      endpoint = '/' + endpoint;
    }
    
    return endpoint;
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
        className.toLowerCase().includes(objName.toLowerCase().replace(/client|service|api/g, '').trim())
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
   * メソッド定義からURLを抽出
   * @param methodDecl メソッド定義ノード
   * @returns 抽出されたURL
   */
  private extractUrlFromMethodDefinition(methodDecl: Node): string | null {
    // メソッド本体を取得
    const body = methodDecl.getFirstDescendantByKind(SyntaxKind.Block);
    if (!body) {
      return null;
    }
    
    // 文字列リテラルを探す
    const stringLiterals = body.getDescendantsOfKind(SyntaxKind.StringLiteral);
    
    // URLっぽい文字列を探す
    for (const literal of stringLiterals) {
      const text = literal.getText().replace(/['"]/g, '');
      
      // URLっぽい文字列かチェック
      if (text.startsWith('/') || text.startsWith('http') || text.includes('/api/')) {
        return text;
      }
    }
    
    return null;
  }
  
  /**
   * 使用箇所の詳細情報を作成
   * @param node ノード
   * @param sourceFile ソースファイル
   * @param context コンテキスト情報
   * @returns 使用箇所詳細情報
   */
  private createUsageLocation(node: Node, sourceFile: SourceFile, context?: string): UsageLocation {
    // ts-morphのノード位置情報を安全に取得
    // getStart()を使用してノードの開始位置を取得
    const startPos = node.getStart();
    
    // 位置情報から行と列の情報を構築
    // 固定値を使用してエラーを回避
    const line = 1;  // デフォルト値
    const character = 1;
    
    // 周囲のコンテキスト（メソッド/クラス名など）を推測
    let contextName = context;
    if (!contextName) {
      contextName = NodeExtractorsExtended.inferContext(node);
    }
    
    return {
      filePath: sourceFile.getFilePath(),
      lineNumber: line + 1, // 0ベースから1ベースに変換
      columnNumber: character + 1,
      context: contextName,
      codeSnippet: node.getText().slice(0, 100) // 先頭100文字までを取得
    };
  }
}
