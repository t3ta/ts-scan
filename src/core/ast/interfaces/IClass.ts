/**
 * クラス宣言の抽象インターフェース
 * 
 * TypeScriptのクラス宣言に対する操作を抽象化し、具体的な実装への依存を
 * 排除します。クラスに関連する高レベルの操作を定義します。
 */

import { INode } from './INode';
import { IFunction } from './IFunction';
import { IProperty } from './IProperty';
import { IType } from './IType';

/**
 * クラス宣言の抽象インターフェース
 */
export interface IClass extends INode {
  /**
   * クラス名を取得する
   * @returns クラス名
   */
  getName(): string;
  
  /**
   * クラスのJSDocコメントを取得する
   * @returns JSDocコメントの文字列（存在しない場合は空文字列）
   */
  getDocumentation(): string;
  
  /**
   * クラスのプロパティを取得する
   * @returns クラスプロパティの配列
   */
  getProperties(): IProperty[];
  
  /**
   * クラスのメソッドを取得する
   * @returns クラスメソッドの配列（コンストラクタ以外）
   */
  getMethods(): IFunction[];
  
  /**
   * クラスのコンストラクタを取得する
   * @returns コンストラクタメソッド（存在しない場合はnull）
   */
  getConstructor(): IFunction | null;
  
  /**
   * クラスの継承元（親クラス）を取得する
   * @returns 親クラスの型情報（継承がない場合はnull）
   */
  getBaseClass(): IType | null;
  
  /**
   * クラスが実装するインターフェースを取得する
   * @returns 実装インターフェースの型情報配列
   */
  getImplements(): IType[];
  
  /**
   * クラスが抽象クラスかどうかを判定する
   * @returns 抽象クラスであればtrue
   */
  isAbstract(): boolean;
  
  /**
   * クラス宣言にジェネリック型パラメータがあるかどうかを判定する
   * @returns ジェネリック型パラメータがあればtrue
   */
  hasTypeParameters(): boolean;
  
  /**
   * クラスの修飾子を取得する（export, default など）
   * @returns 修飾子の配列
   */
  getModifiers(): string[];
  
  /**
   * 静的メンバー（プロパティとメソッド）を取得する
   * @returns 静的メンバーの配列
   */
  getStaticMembers(): (IProperty | IFunction)[];
  
  /**
   * 特定の名前のメンバー（プロパティまたはメソッド）を取得する
   * @param name メンバー名
   * @returns 対応するメンバー（存在しない場合はnull）
   */
  getMember(name: string): (IProperty | IFunction) | null;
}
