import { Node, SyntaxKind } from 'ts-morph';

export class NodeTraversal {
  /**
   * 最初の先祖ノードを見つける
   * @param node 開始ノード
   * @param predicate 検索条件
   * @returns 見つかったノード、または undefined
   */
  public static findFirstAncestor(node: Node, predicate: (node: Node) => boolean): Node | undefined {
    let current = node.getParent();
    while (current) {
      if (predicate(current)) {
        return current;
      }
      current = current.getParent();
    }
    return undefined;
  }

  /**
   * 最初の子孫ノードを見つける
   * @param node 開始ノード
   * @param predicate 検索条件
   * @returns 見つかったノード、または undefined
   */
  public static findFirstDescendant(node: Node, predicate: (node: Node) => boolean): Node | undefined {
    const children = node.getChildren();
    for (const child of children) {
      if (predicate(child)) {
        return child;
      }
      const found = this.findFirstDescendant(child, predicate);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  /**
   * 条件に一致する全ての子孫ノードを見つける
   * @param node 開始ノード
   * @param predicate 検索条件
   * @returns 見つかったノードの配列
   */
  public static findNodes(node: Node, predicate: (node: Node) => boolean): Node[] {
    const results: Node[] = [];
    const queue: Node[] = [node];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (predicate(current)) {
        results.push(current);
      }
      queue.push(...current.getChildren());
    }

    return results;
  }

  /**
   * 指定された種類の最初の子孫ノードを見つける
   * @param node 開始ノード
   * @param kind 探すノードの種類
   * @returns 見つかったノード、または undefined
   */
  public static findFirstDescendantByKind(node: Node, kind: SyntaxKind): Node | undefined {
    return this.findFirstDescendant(node, n => n.getKind() === kind);
  }

  /**
   * 指定された種類の全ての子孫ノードを見つける
   * @param node 開始ノード
   * @param kind 探すノードの種類
   * @returns 見つかったノードの配列
   */
  public static findNodesByKind(node: Node, kind: SyntaxKind): Node[] {
    return this.findNodes(node, n => n.getKind() === kind);
  }

  /**
   * メソッドチェーンを解析する
   * @param node 開始ノード
   * @returns メソッドチェーンの配列
   */
  public static analyzeMethodChain(node: Node): { method: string; args: Node[] }[] {
    const chain: { method: string; args: Node[] }[] = [];
    let current = node;

    while (current) {
      if (current.isKind(SyntaxKind.CallExpression)) {
        const expression = current.getExpression();
        if (expression.isKind(SyntaxKind.PropertyAccessExpression)) {
          chain.unshift({
            method: expression.getName(),
            args: current.getArguments()
          });
        }
        current = expression;
      } else if (current.isKind(SyntaxKind.PropertyAccessExpression)) {
        current = current.getExpression();
      } else {
        break;
      }
    }

    return chain;
  }

  /**
   * 特定のメソッド名を持つメソッド呼び出しかどうかを判定
   * @param node チェックするノード
   * @param methodName メソッド名
   * @returns true: 指定されたメソッド名の呼び出し / false: それ以外
   */
  public static isMethodCall(node: Node, methodName: string): boolean {
    if (!node.isKind(SyntaxKind.CallExpression)) {
      return false;
    }

    const expression = node.getExpression();
    if (!expression.isKind(SyntaxKind.PropertyAccessExpression)) {
      return false;
    }

    return expression.getName() === methodName;
  }
}
