/**
 * AST関連ユーティリティ - ノード判定述語モジュール
 * 
 * TypeScriptのASTノードに対する判定述語（Predicates）を提供します。
 * 複雑な条件判定を関数として抽象化することで、可読性と再利用性を向上させます。
 */

import { Node, SyntaxKind } from 'ts-morph';
import { INode, NodeKind } from '../../core/ast/interfaces/INode';

/**
 * ノード判定述語ユーティリティクラス
 */
export class NodePredicates {
  /**
   * INodeインターフェースを持つオブジェクトかどうかを判別する型ガード
   * @param node 検査対象ノード
   * @returns INodeインターフェースを持つオブジェクトならtrue
   */
  private static isINode(node: Node | INode): node is INode {
    return 'isKind' in node && typeof node.isKind === 'function';
  }
  
  /**
   * ts-morph Nodeかどうかを判別する型ガード
   * @param node 検査対象ノード
   * @returns ts-morph Nodeならtrue
   */
  private static isTsMorphNode(node: Node | INode): node is Node {
    return !('isKind' in node);
  }
  /**
   * 指定されたメソッド名を持つPropertyAccessExpressionノードか判定
   * @param node 判定対象ノード
   * @param methodName 検索するメソッド名
   * @returns 判定結果
   */
  public static isMethodCall(node: Node | INode, methodName: string): boolean {
    // INodeの場合
    if (this.isINode(node)) {
      if (!node.isKind(NodeKind.PropertyAccessExpression)) return false;
      // getNameメソッドが実装されている場合
      if ('getName' in node && typeof node.getName === 'function') {
        return node.getName() === methodName;
      }
      // テキスト検索を使用するフォールバック
      return node.getText().endsWith('.' + methodName);
    }
    // ts-morph Nodeの場合
    if (!this.isTsMorphNode(node)) return false;
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
  public static isObjectMethodCall(node: Node | INode, objectName: string, methodName: string): boolean {
    // INodeの場合
    if (this.isINode(node)) {
      if (!node.isKind(NodeKind.CallExpression)) return false;
      
      const expression = node.getExpression?.();
      if (!expression || !expression.isKind(NodeKind.PropertyAccessExpression)) return false;
      
      const object = expression.getExpression?.();
      if (!object) return false;
      
      const name = expression.getName?.();
      return name === methodName && object.getText() === objectName;
    }
    
    // ts-morph Nodeの場合
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
  public static isObjectMethodCallWithPattern(node: Node | INode, objectPattern: RegExp, methodName: string): boolean {
    // INodeの場合
    if (this.isINode(node)) {
      if (!node.isKind(NodeKind.CallExpression)) return false;
      
      const expression = node.getExpression?.();
      if (!expression || !expression.isKind(NodeKind.PropertyAccessExpression)) return false;
      
      const object = expression.getExpression?.();
      if (!object) return false;
      
      const name = expression.getName?.();
      return name === methodName && objectPattern.test(object.getText());
    }
    
    // ts-morph Nodeの場合
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
  public static isHttpMethodCall(node: Node | INode): boolean {
    // INodeの場合
    if (this.isINode(node)) {
      if (!node.isKind(NodeKind.CallExpression)) return false;
      
      const expression = node.getExpression?.();
      if (!expression || !expression.isKind(NodeKind.PropertyAccessExpression)) return false;
      
      const name = expression.getName?.();
      if (!name) return false;
      
      const methodName = name.toLowerCase();
      return ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(methodName);
    }
    
    // ts-morph Nodeの場合
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
  public static isFetchCall(node: Node | INode): boolean {
    // INodeの場合
    if (this.isINode(node)) {
      if (!node.isKind(NodeKind.CallExpression)) return false;
      
      const expression = node.getExpression?.();
      if (!expression) return false;
      
      return expression.isKind(NodeKind.Identifier) && 
             expression.getText() === 'fetch';
    }
    
    // ts-morph Nodeの場合
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
  public static isCreateApiCallExpression(node: Node | INode): boolean {
    // INodeの場合
    if (this.isINode(node)) {
      if (!node.isKind(NodeKind.CallExpression)) return false;
      
      const expression = node.getExpression?.();
      if (!expression) return false;
      
      return expression.isKind(NodeKind.Identifier) && 
             expression.getText() === 'createApi';
    }
    
    // ts-morph Nodeの場合
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
  public static isInjectEndpointsCall(node: Node | INode): boolean {
    // INodeの場合
    if (this.isINode(node)) {
      if (!node.isKind(NodeKind.CallExpression)) return false;
      
      const expression = node.getExpression?.();
      if (!expression || !expression.isKind(NodeKind.PropertyAccessExpression)) return false;
      
      const methodName = expression.getName?.();
      if (!methodName || methodName !== 'injectEndpoints') return false;
      
      const object = expression.getExpression?.();
      if (!object) return false;
      
      const objectName = object.getText();
      return objectName === 'api' || objectName.toLowerCase().includes('api') || objectName.endsWith('Api');
    }
    
    // ts-morph Nodeの場合
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
  public static isRtkQueryHookCall(node: Node | INode): boolean {
    // INodeの場合
    if (this.isINode(node)) {
      if (!node.isKind(NodeKind.CallExpression)) return false;
      
      const expression = node.getExpression?.();
      if (!expression) return false;
      
      const expressionText = expression.getText();
      
      // 1. api.useXxxQuery 形式
      if (expression.isKind(NodeKind.PropertyAccessExpression)) {
        const methodName = expression.getName?.();
        if (!methodName) return false;
        
        return (methodName.startsWith('use') && 
               (methodName.endsWith('Query') || methodName.endsWith('Mutation')));
      }
      
      // 2. useXxxQuery() 形式
      if (expression.isKind(NodeKind.Identifier)) {
        return expressionText.startsWith('use') && 
               (expressionText.endsWith('Query') || expressionText.endsWith('Mutation'));
      }
      
      return false;
    }
    
    // ts-morph Nodeの場合
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
  public static isPropertyWithName(node: Node | INode, propertyName: string): boolean {
    // INodeの場合
    if (this.isINode(node)) {
      if (!node.isKind(NodeKind.PropertyAssignment)) return false;
      const name = node.getName?.();
      return name === propertyName;
    }
    
    // ts-morph Nodeの場合
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
    node: Node | INode, 
    builderParam: string = 'builder'
  ): { isMatch: boolean; isQuery: boolean; isMutation: boolean } {
    // INodeの場合
    if (this.isINode(node)) {
      if (!node.isKind(NodeKind.CallExpression)) {
        return { isMatch: false, isQuery: false, isMutation: false };
      }
      
      const expression = node.getExpression?.();
      if (!expression || !expression.isKind(NodeKind.PropertyAccessExpression)) {
        return { isMatch: false, isQuery: false, isMutation: false };
      }
      
      const methodName = expression.getName?.();
      if (!methodName) {
        return { isMatch: false, isQuery: false, isMutation: false };
      }
      
      const object = expression.getExpression?.();
      if (!object) {
        return { isMatch: false, isQuery: false, isMutation: false };
      }
      
      const objectName = object.getText();
      
      const isQuery = methodName === 'query';
      const isMutation = methodName === 'mutation';
      
      return {
        isMatch: (isQuery || isMutation) && objectName === builderParam,
        isQuery,
        isMutation
      };
    }
    
    // ts-morph Nodeの場合
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
  public static usesIdentifier(node: Node | INode, identifierName: string): boolean {
    return node.getText().includes(identifierName);
  }
  
  /**
   * エクスポート宣言かつ指定された名前を持つか判定
   * @param node 判定対象ノード
   * @param exportName エクスポート名
   * @returns 判定結果
   */
  public static isNamedExport(node: Node | INode, exportName: string): boolean {
    // INodeの場合
    if (this.isINode(node)) {
      const text = node.getText();
      return text.includes('export') && text.includes(exportName);
    }
    
    // ts-morph Nodeの場合
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
  public static isUrlLike(node: Node | INode): boolean {
    // INodeの場合
    if (this.isINode(node)) {
      if (!node.isKind(NodeKind.StringLiteral)) return false;
      
      const text = node.getText().replace(/["']/g, '');
      return text.startsWith('/') || 
             text.startsWith('http://') || 
             text.startsWith('https://') || 
             text.includes('/api/') || 
             text.includes('/v1/') || 
             text.includes('/v2/');
    }
    
    // ts-morph Nodeの場合
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
  public static isMethodPropertyInObject(node: Node | INode): boolean {
    // INodeの場合
    if (this.isINode(node)) {
      if (!node.isKind(NodeKind.PropertyAssignment)) return false;
      
      const initializer = node.getInitializer?.();
      if (!initializer || !initializer.isKind(NodeKind.StringLiteral)) return false;
      
      const value = initializer.getText().replace(/["']/g, '');
      return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(value.toUpperCase());
    }
    
    // ts-morph Nodeの場合
    if (!Node.isPropertyAssignment(node)) return false;
    
    const initializer = node.getInitializer();
    return Node.isStringLiteral(initializer) && 
           ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(initializer.getLiteralValue().toUpperCase());
  }
}
