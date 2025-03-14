/**
 * HTTP関連ユーティリティ - HTTPメソッド推論モジュール
 * 
 * コード上の様々なパターンからHTTPメソッドを推論するためのユーティリティを提供します。
 * 関数名や変数名、コード構造などから最適なHTTPメソッドを推定します。
 */

import { Node, SyntaxKind } from 'ts-morph';
import { HttpMethod } from '../../types';
import { logger } from '../Logger';

/**
 * HTTPメソッド推論ユーティリティクラス
 */
export class MethodInference {
  /**
   * 有効なHTTPメソッドかどうかを判定
   * @param method 判定対象のメソッド文字列
   * @returns 有効なHTTPメソッドの場合true
   */
  public static isValidHttpMethod(method: string): boolean {
    return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(method.toUpperCase());
  }

  /**
   * 関数名または変数名からHTTPメソッドを推論
   * @param name 関数名または変数名
   * @returns 推論されたHTTPメソッド、判断できない場合はGET
   */
  public static inferMethodFromName(name: string): HttpMethod {
    const normalizedName = name.toLowerCase();
    
    // 明示的なHTTPメソッド部分を持つ名前
    if (normalizedName.startsWith('get') || normalizedName.includes('fetch')) {
      return 'GET';
    }
    
    if (normalizedName.startsWith('post') || 
        normalizedName.startsWith('create') || 
        normalizedName.startsWith('add') ||
        normalizedName.startsWith('insert')) {
      return 'POST';
    }
    
    if (normalizedName.startsWith('put') || 
        normalizedName.startsWith('update') || 
        normalizedName.startsWith('edit') ||
        normalizedName.startsWith('modify')) {
      return 'PUT';
    }
    
    if (normalizedName.startsWith('delete') || 
        normalizedName.startsWith('remove') || 
        normalizedName.startsWith('destroy')) {
      return 'DELETE';
    }
    
    if (normalizedName.startsWith('patch')) {
      return 'PATCH';
    }
    
    // CRUD操作を示唆する動詞の場合
    if (normalizedName.includes('save') ||
        normalizedName.includes('submit') ||
        normalizedName.includes('register')) {
      return 'POST';
    }
    
    if (normalizedName.includes('change') ||
        normalizedName.includes('replace')) {
      return 'PUT';
    }
    
    if (normalizedName.includes('erase') ||
        normalizedName.includes('purge')) {
      return 'DELETE';
    }
    
    // クエリ操作を示唆する単語の場合
    if (normalizedName.includes('find') ||
        normalizedName.includes('search') ||
        normalizedName.includes('query') ||
        normalizedName.includes('list') ||
        normalizedName.includes('get') ||
        normalizedName.includes('read')) {
      return 'GET';
    }
    
    // デフォルトはGET
    return 'GET';
  }
  
  /**
   * 関数呼び出しノードからHTTPメソッドを推論
   * @param node 関数呼び出しノード
   * @returns 推論されたHTTPメソッド
   */
  public static inferMethodFromFunctionCall(node: Node): HttpMethod {
    if (!Node.isCallExpression(node)) {
      return 'GET';
    }
    
    const expression = node.getExpression();
    
    // axios.get(), client.post() などのメソッド名から推論
    if (Node.isPropertyAccessExpression(expression)) {
      const methodName = expression.getName().toLowerCase();
      
      switch (methodName) {
        case 'get':
          return 'GET';
        case 'post':
          return 'POST';
        case 'put':
          return 'PUT';
        case 'delete':
          return 'DELETE';
        case 'patch':
          return 'PATCH';
        case 'options':
          return 'OPTIONS';
        case 'head':
          return 'HEAD';
      }
      
      // メソッド名からの推論
      return this.inferMethodFromName(methodName);
    }
    
    // fetch('url', { method: 'POST' }) などの第2引数からの推論
    if (node.getArguments().length >= 2) {
      const secondArg = node.getArguments()[1];
      
      if (Node.isObjectLiteralExpression(secondArg)) {
        const methodProp = secondArg.getProperty('method');
        
        if (methodProp && Node.isPropertyAssignment(methodProp)) {
          const initializer = methodProp.getInitializer();
          
          if (Node.isStringLiteral(initializer)) {
            const methodValue = initializer.getLiteralValue().toUpperCase();
            
            if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(methodValue)) {
              return methodValue as HttpMethod;
            }
          }
        }
      }
    }
    
    // 呼び出されている関数名からの推論
    if (Node.isIdentifier(expression)) {
      return this.inferMethodFromName(expression.getText());
    }
    
    // URLパターンからの推論
    const args = node.getArguments();
    if (args.length > 0) {
      const firstArg = args[0];
      
      if (Node.isStringLiteral(firstArg)) {
        const url = firstArg.getLiteralValue();
        return this.inferMethodFromUrl(url);
      }
    }
    
    return 'GET';
  }
  
  /**
   * URLパスからHTTPメソッドを推論
   * @param url URLパス
   * @returns 推論されたHTTPメソッド
   */
  public static inferMethodFromUrl(url: string): HttpMethod {
    const normalizedUrl = url.toLowerCase();
    
    // URLパスの最後のセグメントを取得
    const segments = normalizedUrl.split('/');
    const lastSegment = segments[segments.length - 1];
    
    // 最後のセグメントがIDパターンに見える場合、
    // 前のセグメントが単数形ならGET詳細、複数形ならGETコレクション要素
    if (/^[0-9a-f]{8,}$/.test(lastSegment) || lastSegment === ':id' || lastSegment === '{id}') {
      return 'GET';
    }
    
    // パス中のアクション名からの推論
    if (normalizedUrl.includes('/create/') || 
        normalizedUrl.includes('/add/') ||
        normalizedUrl.includes('/post/')) {
      return 'POST';
    }
    
    if (normalizedUrl.includes('/update/') || 
        normalizedUrl.includes('/edit/') ||
        normalizedUrl.includes('/put/')) {
      return 'PUT';
    }
    
    if (normalizedUrl.includes('/delete/') || 
        normalizedUrl.includes('/remove/')) {
      return 'DELETE';
    }
    
    if (normalizedUrl.includes('/patch/')) {
      return 'PATCH';
    }
    
    // パス末尾のアクション名からの推論
    if (lastSegment === 'create' || lastSegment === 'add' || lastSegment === 'upload') {
      return 'POST';
    }
    
    if (lastSegment === 'update' || lastSegment === 'edit') {
      return 'PUT';
    }
    
    if (lastSegment === 'delete' || lastSegment === 'remove') {
      return 'DELETE';
    }
    
    // デフォルト: クエリパラメータがある場合はGET
    if (normalizedUrl.includes('?')) {
      return 'GET';
    }
    
    // その他の場合はGET
    return 'GET';
  }
  
  /**
   * RTK Query定義からHTTPメソッドを推論
   * @param node RTK Queryエンドポイント定義ノード
   * @param isQuery RTK Queryオペレーションの場合true
   * @param isMutation RTK Mutationオペレーションの場合true
   * @returns 推論されたHTTPメソッド
   */
  public static inferMethodFromRtkQueryDefinition(
    node: Node, 
    isQuery: boolean, 
    isMutation: boolean
  ): HttpMethod {
    // クエリ/ミューテーションの種別からの基本推論
    let method: HttpMethod = isQuery ? 'GET' : (isMutation ? 'POST' : 'GET');
    
    try {
      // オブジェクトリテラル内のmethod指定を探す
      const methodSpecs = node.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
        .filter(prop => prop.getName() === 'method');
      
      if (methodSpecs.length > 0) {
        const methodSpec = methodSpecs[0];
        const initializer = methodSpec.getInitializer();
        
        if (Node.isStringLiteral(initializer)) {
          const methodValue = initializer.getLiteralValue().toUpperCase();
          
          if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(methodValue)) {
            return methodValue as HttpMethod;
          }
        }
      }
      
      // エンドポイント名からの推論
      const parentProp = node.getFirstAncestorByKind(SyntaxKind.PropertyAssignment);
      if (parentProp) {
        const propName = parentProp.getName();
        return this.inferMethodFromName(propName);
      }
    } catch (error) {
      logger.error(`RTK Query定義からのメソッド推論中にエラーが発生: ${error}`);
    }
    
    return method;
  }
  
  /**
   * オブジェクトリテラルからHTTPメソッドを推論
   * @param obj オブジェクトリテラルノード
   * @returns 推論されたHTTPメソッド
   */
  public static inferMethodFromObjectLiteral(obj: Node): HttpMethod {
    if (!Node.isObjectLiteralExpression(obj)) {
      return 'GET';
    }
    
    // method属性の直接指定を探す
    const methodProp = obj.getProperty('method');
    if (methodProp && Node.isPropertyAssignment(methodProp)) {
      const initializer = methodProp.getInitializer();
      
      if (Node.isStringLiteral(initializer)) {
        const methodValue = initializer.getLiteralValue().toUpperCase();
        
        if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(methodValue)) {
          return methodValue as HttpMethod;
        }
      }
    }
    
    // bodyやdata属性の存在からPOSTを推論
    const hasBodyOrData = obj.getProperty('body') || obj.getProperty('data');
    if (hasBodyOrData) {
      return 'POST';
    }
    
    // paramsの存在からGETを推論
    const hasParams = obj.getProperty('params');
    if (hasParams) {
      return 'GET';
    }
    
    return 'GET';
  }
  
  /**
   * 複数の情報源から最適なHTTPメソッドを推論
   * @param sources 推論のための情報源
   * @returns 推論されたHTTPメソッド
   */
  public static inferMethodFromMultipleSources(sources: {
    functionName?: string;
    url?: string;
    methodProperty?: string;
    isRtkQuery?: boolean;
    isRtkMutation?: boolean;
    hasRequestBody?: boolean;
  }): HttpMethod {
    // 明示的なmethod指定があればそれを優先
    if (sources.methodProperty) {
      const methodUpper = sources.methodProperty.toUpperCase();
      if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(methodUpper)) {
        return methodUpper as HttpMethod;
      }
    }
    
    // RTK Queryの種別による推論
    if (sources.isRtkMutation) {
      return 'POST'; // ミューテーションはデフォルトでPOST
    }
    
    if (sources.isRtkQuery) {
      return 'GET'; // クエリはデフォルトでGET
    }
    
    // リクエストボディの有無による推論
    if (sources.hasRequestBody) {
      return 'POST'; // ボディがあればPOST
    }
    
    // URLからの推論
    if (sources.url) {
      const urlMethod = this.inferMethodFromUrl(sources.url);
      if (urlMethod !== 'GET') {
        return urlMethod; // URLから特定のメソッドが推論できた場合
      }
    }
    
    // 関数名からの推論
    if (sources.functionName) {
      return this.inferMethodFromName(sources.functionName);
    }
    
    // デフォルトはGET
    return 'GET';
  }
}
