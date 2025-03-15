/**
 * ts-morphのSourceFile向けアダプター実装
 * 
 * ts-morphのSourceFileオブジェクトを抽象インターフェースISourceFileに適合させる
 * アダプタークラスです。
 */

import {
  SourceFile,
  FunctionDeclaration,
  ClassDeclaration,
  InterfaceDeclaration,
  VariableDeclaration,
  ImportDeclaration,
  Node as TsMorphNode,
  SyntaxKind
} from 'ts-morph';
import { ISourceFile } from '../interfaces/ISourceFile';
import { INode, NodeKind } from '../interfaces/INode';
import { IFunction } from '../interfaces/IFunction';
import { IClass } from '../interfaces/IClass';
import { IInterface } from '../interfaces/IInterface';
import { IVariable } from '../interfaces/IVariable';
import { IImportDeclaration } from '../interfaces/IImportDeclaration';
import { TsMorphNodeAdapter } from './TsMorphNodeAdapter';
import { TsMorphFunctionAdapter } from './TsMorphFunctionAdapter';
import { TsMorphClassAdapter } from './TsMorphClassAdapter';
import { TsMorphInterfaceAdapter } from './TsMorphInterfaceAdapter';
import { TsMorphVariableAdapter } from './TsMorphVariableAdapter';
import { TsMorphImportDeclarationAdapter } from './TsMorphImportDeclarationAdapter';

/**
 * ts-morphのSourceFile向けアダプタークラス
 */
export class TsMorphSourceFileAdapter implements ISourceFile {
  private sourceFile: SourceFile;
  private rootNodeAdapter: TsMorphNodeAdapter;
  
  /**
   * コンストラクタ
   * @param sourceFile ts-morphのSourceFileオブジェクト
   */
  constructor(sourceFile: SourceFile) {
    this.sourceFile = sourceFile;
    this.rootNodeAdapter = new TsMorphNodeAdapter(sourceFile);
  }
  
  /**
   * ファイルパスを取得する
   * @returns ファイルの絶対パス
   */
  public getFilePath(): string {
    return this.sourceFile.getFilePath();
  }
  
  /**
   * ファイル名を取得する
   * @returns ファイル名（パスなし）
   */
  public getFileName(): string {
    return this.sourceFile.getBaseName();
  }
  
  /**
   * ソースファイルのテキスト内容を取得する
   * @returns ファイルの完全なテキスト
   */
  public getText(): string {
    return this.sourceFile.getFullText();
  }
  
  /**
   * ソースファイル内のすべての関数宣言を取得する
   * @returns 関数宣言の配列
   */
  public getFunctions(): IFunction[] {
    const functionDeclarations = this.sourceFile.getFunctions();
    return functionDeclarations.map(func => new TsMorphFunctionAdapter(func));
  }
  
  /**
   * ソースファイル内のすべてのクラス宣言を取得する
   * @returns クラス宣言の配列
   */
  public getClasses(): IClass[] {
    const classDeclarations = this.sourceFile.getClasses();
    return classDeclarations.map(cls => new TsMorphClassAdapter(cls));
  }
  
  /**
   * ソースファイル内のすべてのインターフェース宣言を取得する
   * @returns インターフェース宣言の配列
   */
  public getInterfaces(): IInterface[] {
    const interfaceDeclarations = this.sourceFile.getInterfaces();
    return interfaceDeclarations.map(intf => new TsMorphInterfaceAdapter(intf));
  }
  
  /**
   * ソースファイル内のすべての変数宣言を取得する
   * @returns 変数宣言の配列
   */
  public getVariables(): IVariable[] {
    // ts-morphの変数宣言は少し複雑なため、適切に抽出
    const variableDeclarations: VariableDeclaration[] = [];
    
    // 変数宣言ステートメントから各変数宣言を取得
    this.sourceFile.getVariableStatements().forEach(statement => {
      statement.getDeclarations().forEach(declaration => {
        variableDeclarations.push(declaration);
      });
    });
    
    return variableDeclarations.map(variable => new TsMorphVariableAdapter(variable));
  }
  
  /**
   * ソースファイル内のすべてのインポート宣言を取得する
   * @returns インポート宣言の配列
   */
  public getImportDeclarations(): IImportDeclaration[] {
    const importDeclarations = this.sourceFile.getImportDeclarations();
    return importDeclarations.map(importDecl => new TsMorphImportDeclarationAdapter(importDecl));
  }
  
  /**
   * 特定の条件に一致するノードを検索する
   * @param predicate ノードをフィルタリングするための述語関数
   * @returns 条件に一致するノードの配列
   */
  public findNodes(predicate: (node: INode) => boolean): INode[] {
    return this.rootNodeAdapter.findDescendants(predicate, true);
  }
  
  /**
   * ソースファイルのルートノードを取得する
   * @returns ルートノード
   */
  public getRootNode(): INode {
    return this.rootNodeAdapter;
  }
  
  /**
   * 内部のts-morphのSourceFileオブジェクトを取得する
   * @returns ts-morphのSourceFileオブジェクト
   */
  public getInternalSourceFile(): SourceFile {
    return this.sourceFile;
  }
  
  /**
   * INodeインターフェースの実装
   * 多くはrootNodeAdapterに委譲する
   */

  /**
   * ノードの種類を取得する
   * @returns ノードの種類
   */
  public getKind(): NodeKind {
    return NodeKind.SourceFile;
  }
  
  /**
   * ノードの位置情報を取得する
   * @returns ノードの位置情報
   */
  public getLocation(): { line: number; column: number; start: number; end: number } {
    return this.rootNodeAdapter.getLocation();
  }
  
  /**
   * 親ノードを取得する
   * @returns 親ノード（ルートノードの場合はnull）
   */
  public getParent(): INode | null {
    return null; // ソースファイルはルートなので親は存在しない
  }
  
  /**
   * 子ノードを取得する
   * @returns 子ノードの配列
   */
  public getChildren(): INode[] {
    return this.rootNodeAdapter.getChildren();
  }
  
  /**
   * 特定の条件に一致する子孫ノードを検索する
   * @param predicate ノードをフィルタリングするための述語関数
   * @param recursive 再帰的に検索するかどうか
   * @returns 条件に一致するノードの配列
   */
  public findDescendants(predicate: (node: INode) => boolean, recursive: boolean = true): INode[] {
    return this.rootNodeAdapter.findDescendants(predicate, recursive);
  }
  
  /**
   * 特定の種類のノードかどうかを判定する
   * @param kind 判定対象のノード種類
   * @returns 指定された種類のノードであればtrue
   */
  public isKind(kind: NodeKind): boolean {
    return kind === NodeKind.SourceFile;
  }
  
  /**
   * 実装固有の内部ノードオブジェクトを取得する
   * @returns 内部ノードオブジェクト
   */
  public getInternalNode(): any {
    return this.sourceFile;
  }
  
  /**
   * このノードが属するソースファイルを取得する
   * @returns ノードが含まれるソースファイル
   */
  public getSourceFile(): any {
    return this; // 自身がソースファイル
  }
  
  /**
   * このノードの全ての先祖ノードを取得する
   * @returns 先祖ノードの配列
   */
  public getAncestors(): INode[] {
    return []; // ルートノードなので先祖は存在しない
  }
}
