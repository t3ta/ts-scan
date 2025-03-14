import { Node, SyntaxKind, SourceFile } from 'ts-morph';
import { isNodeOfType } from '@types/ast';
import { NodeExtractors } from './NodeExtractors';
import { logger } from '../Logger';
import { NodeTraversal } from './NodeTraversal';

export class NodeExtractorsExtended extends NodeExtractors {
  /**
   * ソースファイル内の変数宣言を検索する型安全な関数
   * @param sourceFile 対象ソースファイル
   * @param variableName 検索する変数名
   * @returns 変数宣言ノードの配列
   */
  public static findVariableDeclarations(sourceFile: SourceFile, variableName: string): Node[] {
    return sourceFile
      .getDescendantsOfKind(SyntaxKind.VariableDeclaration)
      .filter(decl => decl.getName() === variableName);
  }

  /**
   * ノード位置情報を安全に取得する関数
   * @param node 対象ノード
   * @returns 位置情報オブジェクト
   */
  public static getNodeLocation(node: Node): { line: number; column: number; sourceFile: string } {
    const sourceFile = node.getSourceFile();
    const pos = node.getStart();
    const { line, character: column } = sourceFile.getLineAndColumnAtPos(pos);

    return {
      line,
      column,
      sourceFile: sourceFile.getFilePath()
    };
  }

  /**
   * 型情報を安全に抽出する関数
   * @param node 対象ノード
   * @returns 型情報文字列、または null
   */
  public static extractTypeAnnotation(node: Node): string | null {
    if (isNodeOfType(node, Node.isVariableDeclaration)) {
      const typeNode = node.getTypeNode();
      return typeNode ? typeNode.getText() : null;
    }

    if (isNodeOfType(node, Node.isParameterDeclaration)) {
      const typeNode = node.getTypeNode();
      return typeNode ? typeNode.getText() : null;
    }

    return null;
  }

  /**
   * コンテキスト推論の改良された関数
   * @param node 対象ノード
   * @returns コンテキスト情報文字列
   */
  public static inferNodeContext(node: Node): string {
    const functionContext = NodeTraversal.findFirstAncestor(
      node,
      n => isNodeOfType(n, Node.isFunctionDeclaration) || 
           isNodeOfType(n, Node.isMethodDeclaration) || 
           isNodeOfType(n, Node.isArrowFunction)
    );

    if (functionContext) {
      if (isNodeOfType(functionContext, Node.isFunctionDeclaration)) {
        return functionContext.getName() || '(無名関数)';
      }
      if (isNodeOfType(functionContext, Node.isMethodDeclaration)) {
        return functionContext.getName() || '(無名メソッド)';
      }
      if (isNodeOfType(functionContext, Node.isArrowFunction)) {
        const parent = functionContext.getParent();
        return isNodeOfType(parent, Node.isVariableDeclaration) 
          ? parent.getName() 
          : '(アロー関数)';
      }
    }

    const classContext = NodeTraversal.findFirstAncestor(
      node,
      n => isNodeOfType(n, Node.isClassDeclaration)
    );

    if (classContext && isNodeOfType(classContext, Node.isClassDeclaration)) {
      return classContext.getName() || '(無名クラス)';
    }

    const sourceFile = node.getSourceFile();
    return sourceFile.getBaseName().replace(/\.[^/.]+$/, '');
  }

  // 他のメソッドも同様に型安全性を向上させる
}
