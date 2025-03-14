import { Node, SyntaxKind } from 'typescript';

/**
 * AST操作における型安全性を提供する高度な型定義モジュール
 * @packageDocumentation
 */

/**
 * ノードの型検証を行う汎用的な型ガード関数
 * @template T ノードの具体的な型
 * @param node 検証対象のノード
 * @param predicate 型検証のための述語関数
 * @returns 型が一致するかどうかのブール値
 */
export function isNodeOfType<T extends Node>(
  node: Node | undefined, 
  predicate: (node: Node) => node is T
): node is T {
  return node !== undefined && predicate(node);
}

/**
 * オブジェクトリテラル式の型ガード
 * @param node 検証対象のノード
 * @returns オブジェクトリテラル式かどうかのブール値
 */
export function isObjectLiteralExpression(node: Node | undefined): node is ts.ObjectLiteralExpression {
  return node?.kind === SyntaxKind.ObjectLiteralExpression;
}

/**
 * 関数宣言の型ガード
 * @param node 検証対象のノード
 * @returns 関数宣言かどうかのブール値
 */
export function isFunctionDeclaration(node: Node | undefined): node is ts.FunctionDeclaration {
  return node?.kind === SyntaxKind.FunctionDeclaration;
}

/**
 * メソッド宣言の型ガード
 * @param node 検証対象のノード
 * @returns メソッド宣言かどうかのブール値
 */
export function isMethodDeclaration(node: Node | undefined): node is ts.MethodDeclaration {
  return node?.kind === SyntaxKind.MethodDeclaration;
}

/**
 * AST操作における安全な名称抽出関数
 * @param node 名称抽出対象のノード
 * @returns ノードの名称（存在しない場合は空文字）
 */
export function safeGetNodeName(node: Node | undefined): string {
  if (isFunctionDeclaration(node) || isMethodDeclaration(node)) {
    return node.name?.getText() || '(anonymous)';
  }
  return '(unnamed)';
}

/**
 * ソースコード内のノード位置情報を表現するインターフェース
 */
export interface NodeLocation {
  line: number;
  column: number;
  sourceFile: string;
}

/**
 * ノード位置情報を安全に取得する関数
 * @param node 位置情報を取得するノード
 * @returns ノードの位置情報
 */
export function getNodeLocation(node: Node): NodeLocation {
  const sourceFile = node.getSourceFile();
  const { line, character: column } = sourceFile.getLineAndColumnAtPos(node.pos);
  
  return {
    line,
    column,
    sourceFile: sourceFile.fileName
  };
}
