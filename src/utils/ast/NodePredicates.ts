/**
 * AST関連ユーティリティ - ノード判定述語モジュール
 * 
 * TypeScriptのASTノードに対する判定述語（Predicates）を提供します。
 * 複雑な条件判定を関数として抽象化することで、可読性と再利用性を向上させます。
 */

import { Node, SyntaxKind } from 'ts-morph';

/**
 * ノード判定述語ユーティリティクラス
 */
export class NodePredicates {
  /**
   * 指定されたメソッド名を持つPropertyAccessExpressionノードか判定
   * @param node 判定対象ノード
   * @param methodName 検索するメソッド名
   * @returns 判定結果
   */
  public static isMethodCall(node: Node, methodName: string): boolean {
    if (!Node.isPropertyAccessExpression(node)) return false;
    return node.getName() === methodName;
  }
  
  /**
   * 指定されたオブジェクト名とメソッド名を持つ関数呼び出しか判定
   * @param node 判定対象ノード
   * @param objectName オブジェクト名
   * @param methodName メソッド名
   * @returns 判定結果
   */
  public static isObjectMethodCall(node: Node, objectName: string, methodName: string): boolean {
    if (!Node.isCallExpression(node)) return false;
    
    const expression = node.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) return false;
    
    const object = expression.getExpression();
    return expression.getName() === methodName && 
           object.getText() === objectName;
  }
  
  /**
   * 指定されたパターンに一致するオブジェクトメソッド呼び出しか判定
   * @param node 判定対象ノード
   * @param objectPattern オブジェクト名パターン
   * @param methodName メソッド名
   * @returns 判定結果
   */
  public static isObjectMethodCallWithPattern(node: Node, objectPattern: RegExp, methodName: string): boolean {
    if (!Node.isCallExpression(node)) return false;
    
    const expression = node.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) return false;
    
    const object = expression.getExpression();
    return expression.getName() === methodName && 
           objectPattern.test(object.getText());
  }
  
  /**
   * HTTPクライアントメソッド呼び出しか判定（get, post, put, delete等）
   * @param node 判定対象ノード
   * @returns 判定結果
   */
  public static isHttpMethodCall(node: Node): boolean {
    if (!Node.isCallExpression(node)) return false;
    
    const expression = node.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) return false;
    
    const methodName = expression.getName().toLowerCase();
    return ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(methodName);
  }
  
  /**
   * Fetchメソッド呼び出しか判定
   * @param node 判定対象ノード
   * @returns 判定結果
   */
  public static isFetchCall(node: Node): boolean {
    if (!Node.isCallExpression(node)) return false;
    
    const expression = node.getExpression();
    return Node.isIdentifier(expression) && 
           expression.getText() === 'fetch';
  }
  
  /**
   * RTK Query createApi呼び出しか判定
   * @param node 判定対象ノード
   * @returns 判定結果
   */
  public static isCreateApiCallExpression(node: Node): boolean {
    if (!Node.isCallExpression(node)) return false;
    
    const expression = node.getExpression();
    return Node.isIdentifier(expression) && 
           expression.getText() === 'createApi';
  }
  
  /**
   * RTK Query injectEndpoints呼び出しか判定
   * @param node 判定対象ノード
   * @returns 判定結果
   */
  public static isInjectEndpointsCall(node: Node): boolean {
    if (!Node.isCallExpression(node)) return false;
    
    const expression = node.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) return false;
    
    const methodName = expression.getName();
    const objectName = expression.getExpression().getText();
    
    return methodName === 'injectEndpoints' && 
           (objectName === 'api' || objectName.toLowerCase().includes('api') || objectName.endsWith('Api'));
  }
  
  /**
   * RTK Query useQueryまたはuseMutation系フックの呼び出しか判定
   * @param node 判定対象ノード
   * @returns 判定結果
   */
  public static isRtkQueryHookCall(node: Node): boolean {
    if (!Node.isCallExpression(node)) return false;
    
    const expression = node.getExpression();
    const expressionText = expression.getText();
    
    // 1. api.useXxxQuery 形式
    if (Node.isPropertyAccessExpression(expression)) {
      const methodName = expression.getName();
      return (methodName.startsWith('use') && 
             (methodName.endsWith('Query') || methodName.endsWith('Mutation')));
    }
    
    // 2. useXxxQuery() 形式
    if (Node.isIdentifier(expression)) {
      return expressionText.startsWith('use') && 
             (expressionText.endsWith('Query') || expressionText.endsWith('Mutation'));
    }
    
    return false;
  }
  
  /**
   * オブジェクトリテラル内のプロパティ宣言か判定
   * @param node 判定対象ノード
   * @param propertyName プロパティ名
   * @returns 判定結果
   */
  public static isPropertyWithName(node: Node, propertyName: string): boolean {
    if (!Node.isPropertyAssignment(node)) return false;
    return node.getName() === propertyName;
  }
  
  /**
   * builder.query()またはbuilder.mutation()パターンか判定
   * @param node 判定対象ノード
   * @param builderParam ビルダーパラメータ名（デフォルト: 'builder'）
   * @returns 判定結果とクエリ/ミューテーション種別
   */
  public static isBuilderEndpointMethod(
    node: Node, 
    builderParam: string = 'builder'
  ): { isMatch: boolean; isQuery: boolean; isMutation: boolean } {
    if (!Node.isCallExpression(node)) {
      return { isMatch: false, isQuery: false, isMutation: false };
    }
    
    const expression = node.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) {
      return { isMatch: false, isQuery: false, isMutation: false };
    }
    
    const methodName = expression.getName();
    const objectName = expression.getExpression().getText();
    
    const isQuery = methodName === 'query';
    const isMutation = methodName === 'mutation';
    
    return {
      isMatch: (isQuery || isMutation) && objectName === builderParam,
      isQuery,
      isMutation
    };
  }
  
  /**
   * 特定の関数/変数名を使用しているか判定
   * @param node 判定対象ノード
   * @param identifierName 識別子名
   * @returns 判定結果
   */
  public static usesIdentifier(node: Node, identifierName: string): boolean {
    return node.getText().includes(identifierName);
  }
  
  /**
   * エクスポート宣言かつ指定された名前を持つか判定
   * @param node 判定対象ノード
   * @param exportName エクスポート名
   * @returns 判定結果
   */
  public static isNamedExport(node: Node, exportName: string): boolean {
    if (Node.isVariableStatement(node)) {
      const declaration = node.getDeclarations()[0];
      if (!declaration) return false;
      
      return node.isExported() && declaration.getName() === exportName;
    } else if (Node.isFunctionDeclaration(node)) {
      return node.isExported() && node.getName() === exportName;
    }
    
    return false;
  }
  
  /**
   * URLリテラルまたはURLを含む文字列リテラルか判定
   * @param node 判定対象ノード
   * @returns 判定結果
   */
  public static isUrlLike(node: Node): boolean {
    if (!Node.isStringLiteral(node)) return false;
    
    const text = node.getLiteralValue();
    return text.startsWith('/') || 
           text.startsWith('http://') || 
           text.startsWith('https://') || 
           text.includes('/api/') || 
           text.includes('/v1/') || 
           text.includes('/v2/');
  }
  
  /**
   * オブジェクトリテラル中のメソッドプロパティか判定
   * @param node 判定対象ノード
   * @returns 判定結果
   */
  public static isMethodPropertyInObject(node: Node): boolean {
    if (!Node.isPropertyAssignment(node)) return false;
    
    const initializer = node.getInitializer();
    return Node.isStringLiteral(initializer) && 
           ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(initializer.getLiteralValue().toUpperCase());
  }
}
