/**
 * ソースファイルの抽象インターフェース
 * 
 * TypeScriptのソースファイルに対する操作を抽象化し、具体的な実装への依存を
 * 排除します。AST解析における高レベルの操作を定義します。
 */

import { INode } from './INode';
import { IFunction } from './IFunction';
import { IClass } from './IClass';
import { IInterface } from './IInterface';
import { IVariable } from './IVariable';
import { IImportDeclaration } from './IImportDeclaration';

/**
 * TypeScriptソースファイルの抽象インターフェース
 */
export interface ISourceFile extends INode {
  /**
   * ファイルパスを取得する
   * @returns ファイルの絶対パス
   */
  getFilePath(): string;
  
  /**
   * ファイル名を取得する
   * @returns ファイル名（パスなし）
   */
  getFileName(): string;
  
  /**
   * ソースファイルのテキスト内容を取得する
   * @returns ファイルの完全なテキスト
   */
  getText(): string;
  
  /**
   * ソースファイル内のすべての関数宣言を取得する
   * @returns 関数宣言の配列
   */
  getFunctions(): IFunction[];
  
  /**
   * ソースファイル内のすべてのクラス宣言を取得する
   * @returns クラス宣言の配列
   */
  getClasses(): IClass[];
  
  /**
   * ソースファイル内のすべてのインターフェース宣言を取得する
   * @returns インターフェース宣言の配列
   */
  getInterfaces(): IInterface[];
  
  /**
   * ソースファイル内のすべての変数宣言を取得する
   * @returns 変数宣言の配列
   */
  getVariables(): IVariable[];
  
  /**
   * ソースファイル内のすべてのインポート宣言を取得する
   * @returns インポート宣言の配列
   */
  getImportDeclarations(): IImportDeclaration[];
  
  /**
   * 特定の条件に一致するノードを検索する
   * @param predicate ノードをフィルタリングするための述語関数
   * @returns 条件に一致するノードの配列
   */
  findNodes(predicate: (node: INode) => boolean): INode[];
  
  /**
   * ソースファイルのルートノードを取得する
   * @returns ルートノード
   */
  getRootNode(): INode;
}
