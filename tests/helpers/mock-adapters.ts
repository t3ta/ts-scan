/**
 * テスト用モックアダプター
 * 
 * テスト時にts-mockitoでモックした各種オブジェクトを抽象インターフェースに適合させる
 * アダプタークラスを提供します。
 */

import { instance } from 'ts-mockito';
import { SourceFile } from 'ts-morph';
import { ISourceFile } from '../../src/core/ast/interfaces/ISourceFile';
import { INode, NodeKind } from '../../src/core/ast/interfaces/INode';
import { IFunction } from '../../src/core/ast/interfaces/IFunction';
import { IClass } from '../../src/core/ast/interfaces/IClass';
import { IInterface } from '../../src/core/ast/interfaces/IInterface';
import { IVariable } from '../../src/core/ast/interfaces/IVariable';
import { IImportDeclaration } from '../../src/core/ast/interfaces/IImportDeclaration';

/**
 * テスト用のSourceFileモックアダプター
 * ts-mockitoでモックしたSourceFileをISourceFileに適合させる
 */
export class MockSourceFileAdapter implements ISourceFile {
  private mockSourceFile: SourceFile;
  
  /**
   * コンストラクタ
   * @param mockSourceFile ts-mockitoでモックしたSourceFileオブジェクト
   */
  constructor(mockSourceFile: SourceFile) {
    this.mockSourceFile = mockSourceFile;
  }
  
  /**
   * ファイルパスを取得する
   */
  public getFilePath(): string {
    return this.mockSourceFile.getFilePath();
  }
  
  /**
   * ファイル名を取得する
   */
  public getFileName(): string {
    return this.mockSourceFile.getBaseName?.() || '';
  }
  
  /**
   * ソースファイルのテキスト内容を取得する
   */
  public getText(): string {
    return this.mockSourceFile.getFullText?.() || '';
  }
  
  /**
   * 関数宣言を取得する
   */
  public getFunctions(): IFunction[] {
    return [];
  }
  
  /**
   * クラス宣言を取得する
   */
  public getClasses(): IClass[] {
    return [];
  }
  
  /**
   * インターフェース宣言を取得する
   */
  public getInterfaces(): IInterface[] {
    return [];
  }
  
  /**
   * 変数宣言を取得する
   */
  public getVariables(): IVariable[] {
    return [];
  }
  
  /**
   * インポート宣言を取得する
   */
  public getImportDeclarations(): IImportDeclaration[] {
    return [];
  }
  
  /**
   * 特定の条件に一致するノードを検索する
   */
  public findNodes(predicate: (node: INode) => boolean): INode[] {
    return [];
  }
  
  /**
   * ルートノードを取得する
   */
  public getRootNode(): INode {
    return this;
  }
  
  /**
   * 内部のSourceFileオブジェクトを取得する
   */
  public getInternalSourceFile(): SourceFile {
    return this.mockSourceFile;
  }
  
  /**
   * INodeインターフェースの実装
   */
  public getKind(): NodeKind {
    return NodeKind.SourceFile;
  }
  
  public getLocation(): { line: number; column: number; start: number; end: number; lineNumber?: number; columnNumber?: number } {
    return { line: 1, column: 1, start: 0, end: 0, lineNumber: 1, columnNumber: 1 };
  }
  
  public getParent(): INode | null {
    return null;
  }
  
  public getChildren(): INode[] {
    return [];
  }
  
  public findDescendants(predicate: (node: INode) => boolean, recursive: boolean = true): INode[] {
    return [];
  }
  
  public isKind(kind: NodeKind): boolean {
    return kind === NodeKind.SourceFile;
  }
  
  public getInternalNode(): any {
    return this.mockSourceFile;
  }
  
  public getSourceFile(): any {
    return this;
  }
  
  public getAncestors(): INode[] {
    return [];
  }
}

/**
 * ts-mockitoでモックしたSourceFileをISourceFileに変換する
 * @param mockSourceFile モックされたSourceFile
 * @returns ISourceFileインターフェースに適合したアダプター
 */
export function adaptMockSourceFile(mockSourceFile: SourceFile): ISourceFile {
  return new MockSourceFileAdapter(mockSourceFile);
}

/**
 * ts-mockitoのインスタンス関数経由でSourceFileモックをISourceFileに変換する
 * @param mockSourceFile ts-mockitoで作成されたモック
 * @returns ISourceFileインターフェースに適合したアダプター
 */
export function adaptMockSourceFileInstance(mockSourceFile: any): ISourceFile {
  return new MockSourceFileAdapter(instance(mockSourceFile));
}
