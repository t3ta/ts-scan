/**
 * AST関連ユーティリティ - ノード走査モジュール
 * 
 * TypeScriptのASTノードを効率的に走査するためのユーティリティ関数を提供します。
 * 複雑なノード走査操作を抽象化し、検出ロジックの可読性向上に寄与します。
 */

import { Node, SyntaxKind, SourceFile, TypeChecker } from 'ts-morph';
import { logger } from '../Logger';

/**
 * ノード判定の述語関数型
 */
export type NodePredicate = (node: Node) => boolean;

/**
 * ノード処理のコールバック関数型
 */
export type NodeHandler<T> = (node: Node) => T | undefined;

/**
 * ノード走査ユーティリティクラス
 */
export class NodeTraversal {
  /**
   * 指定条件に一致する最初の祖先ノードを検索
   * @param node 開始ノード
   * @param predicate 判定関数
   * @returns 一致するノード、または未検出時はundefined
   */
  public static findFirstAncestor(node: Node, predicate: NodePredicate): Node | undefined {
    let current = node;
    
    while (current) {
      if (predicate(current)) {
        return current;
      }
      const parent = current.getParent();
      if (!parent) break;
      current = parent;
    }
    
    return undefined;
  }
  
  /**
   * 指定条件に一致するすべての祖先ノードを収集
   * @param node 開始ノード
   * @param predicate 判定関数
   * @returns 一致するノードの配列
   */
  public static collectAncestors(node: Node, predicate: NodePredicate): Node[] {
    const results: Node[] = [];
    let current = node;
    
    while (current) {
      if (predicate(current)) {
        results.push(current);
      }
      const parent = current.getParent();
      if (!parent) break;
      current = parent;
    }
    
    return results;
  }
  
  /**
   * 指定条件に一致する子孫ノードの最初の発見を処理
   * @param node 探索開始ノード
   * @param predicate 判定条件
   * @param handler 一致ノード処理関数
   * @returns 処理結果、一致なければundefined
   */
  public static processFirstDescendant<T>(
    node: Node,
    predicate: NodePredicate,
    handler: NodeHandler<T>
  ): T | undefined {
    // 前提条件: 現在のノードから再帰的に探索
    const descendant = this.findFirstDescendant(node, predicate);
    if (descendant) {
      return handler(descendant);
    }
    return undefined;
  }
  
  /**
   * 指定条件に一致するすべての子孫ノードを処理
   * @param node 探索開始ノード
   * @param predicate 判定条件
   * @param handler 一致ノード処理関数
   * @returns 処理結果の配列
   */
  public static processDescendants<T>(
    node: Node,
    predicate: NodePredicate,
    handler: NodeHandler<T>
  ): T[] {
    const results: T[] = [];
    const descendants = this.collectDescendants(node, predicate);
    
    for (const descendant of descendants) {
      const result = handler(descendant);
      if (result !== undefined) {
        results.push(result);
      }
    }
    
    return results;
  }
  
  /**
   * 指定条件に一致する最初の子孫ノードを検索
   * @param node 探索開始ノード
   * @param predicate 判定条件
   * @returns 一致するノード、または未検出時はundefined
   */
  public static findFirstDescendant(node: Node, predicate: NodePredicate): Node | undefined {
    // 自分自身がマッチするか確認
    if (predicate(node)) {
      return node;
    }
    
    // 子ノードを順に探索
    for (const child of node.getChildren()) {
      const match = this.findFirstDescendant(child, predicate);
      if (match) {
        return match;
      }
    }
    
    return undefined;
  }
  
  /**
   * 指定条件に一致するすべての子孫ノードを収集
   * @param node 探索開始ノード
   * @param predicate 判定条件
   * @returns 一致するノードの配列
   */
  public static collectDescendants(node: Node, predicate: NodePredicate): Node[] {
    const results: Node[] = [];
    
    // 自分自身がマッチするか確認
    if (predicate(node)) {
      results.push(node);
    }
    
    // 子ノードを順に探索
    for (const child of node.getChildren()) {
      results.push(...this.collectDescendants(child, predicate));
    }
    
    return results;
  }
  
  /**
   * 指定されたシンボル名を持つインポート宣言を検索
   * @param sourceFile 対象ソースファイル
   * @param symbolName 検索するシンボル名
   * @returns インポート宣言ノード、または未検出時はundefined
   */
  public static findImportDeclaration(sourceFile: SourceFile, symbolName: string): Node | undefined {
    try {
      const importDeclarations = sourceFile.getImportDeclarations();
      
      for (const importDecl of importDeclarations) {
        const namedImports = importDecl.getNamedImports();
        
        for (const namedImport of namedImports) {
          if (namedImport.getName() === symbolName) {
            return importDecl;
          }
        }
        
        // デフォルトインポートの確認
        const defaultImport = importDecl.getDefaultImport();
        if (defaultImport && defaultImport.getText() === symbolName) {
          return importDecl;
        }
      }
      
      return undefined;
    } catch (error) {
      logger.error(`インポート宣言検索中にエラーが発生: ${error}`);
      return undefined;
    }
  }
  
  /**
   * シンボル定義の参照先を追跡
   * @param node シンボルノード
   * @param typeChecker タイプチェッカー
   * @returns 定義ノード、または未検出時はundefined
   */
  public static followSymbolDefinition(node: Node, typeChecker: TypeChecker): Node | undefined {
    try {
      if (!Node.isIdentifier(node)) {
        return undefined;
      }
      
      // ts-morphのNode型が期待しているcompilerNodeを使用してシンボルを取得
      // 構文解析のためコンパイラノードを直接使用
      // nodeがIdentifier型であることは確認済み
      const symbol = typeChecker.getSymbolAtLocation(node.getSymbol()?.getDeclarations()?.[0] || node);
      if (!symbol) {
        return undefined;
      }
      
      const declarations = symbol.getDeclarations();
      if (!declarations || declarations.length === 0) {
        return undefined;
      }
      
      // ts-morphのノードに変換
      const declaration = declarations[0];
      // ts-morphでのポジション取得方法を安全に使用
      // posプロパティは存在しないためノードの開始位置を使用
      if (!declaration) {
        return undefined;
      }
      
      try {
        return node.getSourceFile().getDescendantAtPos(declaration.getStart?.() || 0);
      } catch (e) {
        logger.error(`ノード位置の取得中にエラーが発生: ${e}`);
        return undefined;
      }
    } catch (error) {
      logger.error(`シンボル定義追跡中にエラーが発生: ${error}`);
      return undefined;
    }
  }
  
  /**
   * 指定された関数呼び出しノードのうち、特定の名前と一致するものをフィルタリング
   * @param nodes 関数呼び出しノードの配列
   * @param functionName 検索する関数名
   * @returns フィルタリングされたノード配列
   */
  public static filterFunctionCalls(nodes: Node[], functionName: string): Node[] {
    return nodes.filter(node => {
      if (!Node.isCallExpression(node)) return false;
      
      const expression = node.getExpression();
      if (Node.isIdentifier(expression)) {
        return expression.getText() === functionName;
      } else if (Node.isPropertyAccessExpression(expression)) {
        return expression.getName() === functionName;
      }
      
      return false;
    });
  }
  
  /**
   * 特定のSyntaxKindを持つ最初の親ノードを取得
   * @param node 開始ノード
   * @param kind 検索するSyntaxKind
   * @returns 一致する親ノード、または未検出時はundefined
   */
  public static getFirstParentByKind(node: Node, kind: SyntaxKind): Node | undefined {
    return this.findFirstAncestor(node, n => n.getKind() === kind);
  }
  
  /**
   * 特定のSyntaxKindを持つすべての子孫ノードを収集し型指定して返却
   * @param node 探索開始ノード
   * @param kind 検索するSyntaxKind
   * @returns 一致するノードの配列
   */
  public static getDescendantsByKindTyped<T extends Node>(node: Node, kind: SyntaxKind): T[] {
    return node.getDescendantsOfKind(kind) as T[];
  }
}
