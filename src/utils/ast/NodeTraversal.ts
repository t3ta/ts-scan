// 依存関係を抽象化レイヤーに変更
import { INode, NodeKind } from '../../core/ast/interfaces/INode';

export class NodeTraversal {
  /**
   * INodeインターフェースを持つオブジェクトかどうかを判別する型ガード
   * @param node 検査対象ノード
   * @returns INodeインターフェースを持つオブジェクトならtrue
   */
  private static isINode(node: any): node is INode {
    return 'isKind' in node && typeof node.isKind === 'function';
  }
  /**
   * 最初の先祖ノードを見つける
   * @param node 開始ノード
   * @param predicate 検索条件
   * @returns 見つかったノード、または undefined
   */
  public static findFirstAncestor(node: INode, predicate: (node: INode) => boolean): INode | undefined {
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
  public static findFirstDescendant(node: INode, predicate: (node: INode) => boolean): INode | undefined {
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
  public static findNodes(node: INode, predicate: (node: INode) => boolean): INode[] {
    const results: INode[] = [];
    const queue: INode[] = [node];

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
  public static findFirstDescendantByKind(node: INode, kind: NodeKind): INode | undefined {
    return this.findFirstDescendant(node, n => n.getKind() === kind);
  }

  /**
   * 指定された種類の全ての子孫ノードを見つける
   * @param node 開始ノード
   * @param kind 探すノードの種類
   * @returns 見つかったノードの配列
   */
  public static findNodesByKind(node: INode, kind: NodeKind): INode[] {
    return this.findNodes(node, n => n.getKind() === kind);
  }

  /**
   * メソッドチェーンを解析する
   * @param node 開始ノード
   * @returns メソッドチェーンの配列
   */
  public static analyzeMethodChain(node: INode): { method: string; args: INode[] }[] {
    const chain: { method: string; args: INode[] }[] = [];
    let current: INode | null = node;

    while (current) {
      if (current.isKind(NodeKind.CallExpression)) {
        // ここでgetExpression?()が返すものは型アノテーションをつけて明示する
        const expression: INode | null | undefined = current.getExpression?.();
        if (expression && expression.isKind(NodeKind.PropertyAccessExpression)) {
          const methodName = expression.getName?.();
          const args = current.getArguments?.() || [];
          if (methodName) {
            chain.unshift({
              method: methodName,
              args: args
            });
          }
        }
        current = expression || null;
      } else if (current.isKind(NodeKind.PropertyAccessExpression)) {
        current = current.getExpression?.() || null;
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
  public static isMethodCall(node: INode, methodName: string): boolean {
    if (!node.isKind(NodeKind.CallExpression)) {
      return false;
    }

    const expression = node.getExpression?.();
    if (!expression || !expression.isKind(NodeKind.PropertyAccessExpression)) {
      return false;
    }

    const name = expression.getName?.();
    return name !== undefined && name === methodName;
  }
}
