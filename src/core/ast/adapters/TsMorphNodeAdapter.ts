/**
 * ts-morphのNode向けアダプター実装
 * 
 * ts-morphのNodeオブジェクトを抽象インターフェースINodeに適合させる
 * アダプタークラスです。AST操作の基本単位となります。
 */

import { Node as TsMorphNode, SyntaxKind } from 'ts-morph';
import { INode, NodeKind, NodeLocation } from '../interfaces/INode';

/**
 * SyntaxKindとNodeKindのマッピング
 */
const syntaxKindToNodeKind = new Map<SyntaxKind, NodeKind>([
  // 基本構造
  [SyntaxKind.SourceFile, NodeKind.SourceFile],
  [SyntaxKind.Block, NodeKind.Block],
  
  // 宣言
  [SyntaxKind.FunctionDeclaration, NodeKind.FunctionDeclaration],
  [SyntaxKind.ClassDeclaration, NodeKind.ClassDeclaration],
  [SyntaxKind.InterfaceDeclaration, NodeKind.InterfaceDeclaration],
  [SyntaxKind.TypeAliasDeclaration, NodeKind.TypeAliasDeclaration],
  [SyntaxKind.VariableDeclaration, NodeKind.VariableDeclaration],
  
  // 式
  [SyntaxKind.CallExpression, NodeKind.CallExpression],
  [SyntaxKind.PropertyAccessExpression, NodeKind.PropertyAccessExpression],
  [SyntaxKind.ObjectLiteralExpression, NodeKind.ObjectLiteralExpression],
  [SyntaxKind.ArrayLiteralExpression, NodeKind.ArrayLiteralExpression],
  [SyntaxKind.StringLiteral, NodeKind.StringLiteral],
  [SyntaxKind.NumericLiteral, NodeKind.NumericLiteral],
  [SyntaxKind.Identifier, NodeKind.Identifier],
  
  // 文
  [SyntaxKind.ExpressionStatement, NodeKind.ExpressionStatement],
  [SyntaxKind.ReturnStatement, NodeKind.ReturnStatement],
  [SyntaxKind.IfStatement, NodeKind.IfStatement],
  [SyntaxKind.ForStatement, NodeKind.ForStatement],
  
  // インポート/エクスポート
  [SyntaxKind.ImportDeclaration, NodeKind.ImportDeclaration],
  [SyntaxKind.ExportDeclaration, NodeKind.ExportDeclaration]
]);

/**
 * ts-morphのSyntaxKindを抽象NodeKindに変換する
 * @param kind ts-morphのSyntaxKind
 * @returns 対応するNodeKind（マッピングがない場合はUnknown）
 */
export function convertSyntaxKindToNodeKind(kind: SyntaxKind): NodeKind {
  return syntaxKindToNodeKind.get(kind) || NodeKind.Unknown;
}

/**
 * ts-morphのNode向けアダプタークラス
 */
export class TsMorphNodeAdapter implements INode {
  protected node: TsMorphNode;
  
  /**
   * コンストラクタ
   * @param node ts-morphのNodeオブジェクト
   */
  constructor(node: TsMorphNode) {
    this.node = node;
  }
  
  /**
   * ノードの種類を取得する
   * @returns ノードの種類
   */
  public getKind(): NodeKind {
    return convertSyntaxKindToNodeKind(this.node.getKind());
  }
  
  /**
   * ノードの文字列表現を取得する
   * @returns ノードのテキスト
   */
  public getText(): string {
    return this.node.getText();
  }
  
  /**
   * ノードの位置情報を取得する
   * @returns ノードの位置情報
   */
  public getLocation(): NodeLocation {
    const sourceFile = this.node.getSourceFile();
    const start = this.node.getStart();
    const end = this.node.getEnd();
    const { line, column } = sourceFile.getLineAndColumnAtPos(start);
    
    return {
      line,
      column,
      start,
      end
    };
  }
  
  /**
   * 親ノードを取得する
   * @returns 親ノード（ルートノードの場合はnull）
   */
  public getParent(): INode | null {
    const parent = this.node.getParent();
    return parent ? new TsMorphNodeAdapter(parent) : null;
  }
  
  /**
   * 子ノードを取得する
   * @returns 子ノードの配列
   */
  public getChildren(): INode[] {
    return this.node.getChildren().map(child => new TsMorphNodeAdapter(child));
  }
  
  /**
   * 特定の条件に一致する子孫ノードを検索する
   * @param predicate ノードをフィルタリングするための述語関数
   * @param recursive 再帰的に検索するかどうか
   * @returns 条件に一致するノードの配列
   */
  public findDescendants(predicate: (node: INode) => boolean, recursive: boolean = true): INode[] {
    const results: INode[] = [];
    
    // ts-morphのdescendantsは常に再帰的なので、非再帰の場合は子ノードのみを対象に
    if (recursive) {
      const descendants = this.node.getDescendants();
      for (const descendant of descendants) {
        const adapter = new TsMorphNodeAdapter(descendant);
        if (predicate(adapter)) {
          results.push(adapter);
        }
      }
    } else {
      // 直接の子ノードのみを調査
      const children = this.node.getChildren();
      for (const child of children) {
        const adapter = new TsMorphNodeAdapter(child);
        if (predicate(adapter)) {
          results.push(adapter);
        }
      }
    }
    
    return results;
  }
  
  /**
   * 特定の種類のノードかどうかを判定する
   * @param kind 判定対象のノード種類
   * @returns 指定された種類のノードであればtrue
   */
  public isKind(kind: NodeKind): boolean {
    return this.getKind() === kind;
  }
  
  /**
   * 実装固有の内部ノードオブジェクトを取得する
   * @returns 内部ノードオブジェクト
   */
  public getInternalNode(): TsMorphNode {
    return this.node;
  }
  
  /**
   * このノードが属するソースファイルを取得する
   * @returns ノードが含まれるソースファイル
   */
  public getSourceFile(): any {
    return this.node.getSourceFile();
  }
}
