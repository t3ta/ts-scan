/**
 * モックソースファイルの実装
 * 
 * テスト環境でts-morphへの依存なしにソースファイルを表現するためのモッククラスです。
 * スナップショットデータを活用してソースファイルの構造をシミュレートします。
 */

import { ISourceFile } from '../interfaces/ISourceFile';
import { INode } from '../interfaces/INode';
import { IFunction } from '../interfaces/IFunction';
import { IClass } from '../interfaces/IClass';
import { IInterface } from '../interfaces/IInterface';
import { IVariable } from '../interfaces/IVariable';
import { IImportDeclaration } from '../interfaces/IImportDeclaration';
import { NodeKind } from '../interfaces/INode';
import { MockNode } from './MockNode';
import { ASTSnapshot, ASTNodeSnapshot } from './MockProvider';

/**
 * モックソースファイルの実装クラス
 */
export class MockSourceFile implements ISourceFile {
  private filePath: string;
  private fileName: string;
  private text: string;
  private rootNode: MockNode;
  private typeChecker: any;
  
  /**
   * コンストラクタ
   * @param snapshot ソースファイルのASTスナップショット
   * @param typeChecker モックの型チェッカー
   */
  constructor(snapshot: ASTSnapshot, typeChecker: any) {
    this.filePath = snapshot.filePath;
    this.fileName = snapshot.fileName;
    this.text = snapshot.text;
    this.typeChecker = typeChecker;
    
    // ルートノードを構築
    this.rootNode = new MockNode({
      kind: snapshot.kind,
      text: this.text,
      children: snapshot.children,
      location: { line: 1, column: 1, start: 0, end: this.text.length },
    }, null, this);
  }
  
  /**
   * ファイルパスを取得する
   * @returns ファイルの絶対パス
   */
  public getFilePath(): string {
    return this.filePath;
  }
  
  /**
   * ファイル名を取得する
   * @returns ファイル名（パスなし）
   */
  public getFileName(): string {
    return this.fileName;
  }
  
  /**
   * ソースファイルのテキスト内容を取得する
   * @returns ファイルの完全なテキスト
   */
  public getText(): string {
    return this.text;
  }
  
  /**
   * ソースファイル内のすべての関数宣言を取得する
   * @returns 関数宣言の配列
   */
  public getFunctions(): IFunction[] {
    return this.findNodes(node => node.getKind() === NodeKind.FunctionDeclaration) as IFunction[];
  }
  
  /**
   * ソースファイル内のすべてのクラス宣言を取得する
   * @returns クラス宣言の配列
   */
  public getClasses(): IClass[] {
    return this.findNodes(node => node.getKind() === NodeKind.ClassDeclaration) as IClass[];
  }
  
  /**
   * ソースファイル内のすべてのインターフェース宣言を取得する
   * @returns インターフェース宣言の配列
   */
  public getInterfaces(): IInterface[] {
    return this.findNodes(node => node.getKind() === NodeKind.InterfaceDeclaration) as IInterface[];
  }
  
  /**
   * ソースファイル内のすべての変数宣言を取得する
   * @returns 変数宣言の配列
   */
  public getVariables(): IVariable[] {
    return this.findNodes(node => node.getKind() === NodeKind.VariableDeclaration) as IVariable[];
  }
  
  /**
   * ソースファイル内のすべてのインポート宣言を取得する
   * @returns インポート宣言の配列
   */
  public getImportDeclarations(): IImportDeclaration[] {
    return this.findNodes(node => node.getKind() === NodeKind.ImportDeclaration) as IImportDeclaration[];
  }
  
  /**
   * 特定の条件に一致するノードを検索する
   * @param predicate ノードをフィルタリングするための述語関数
   * @returns 条件に一致するノードの配列
   */
  public findNodes(predicate: (node: INode) => boolean): INode[] {
    return this.rootNode.findDescendants(predicate, true);
  }
  
  /**
   * ソースファイルのルートノードを取得する
   * @returns ルートノード
   */
  public getRootNode(): INode {
    return this.rootNode;
  }
  
  /**
   * ソースコードの特定位置にある行と列の情報を取得する
   * @param position 文字位置
   * @returns 行と列の情報
   */
  public getLineAndColumnAtPos(position: number): { line: number; column: number } {
    // 単純な実装: 改行を数えて行と列を計算
    const textBefore = this.text.substring(0, position);
    const lines = textBefore.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    
    return { line, column };
  }
  
  /**
   * 型チェッカーへのアクセスを提供する
   * @returns 型チェッカー
   */
  public getTypeChecker(): any {
    return this.typeChecker;
  }
}
