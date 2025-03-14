/**
 * インターフェース宣言の抽象インターフェース
 * 
 * TypeScriptのインターフェース宣言に対する操作を抽象化し、具体的な実装への依存を
 * 排除します。インターフェースに関連する高レベルの操作を定義します。
 */

import { INode } from './INode';
import { IProperty } from './IProperty';
import { IType } from './IType';

/**
 * メソッドシグネチャの抽象インターフェース
 */
export interface IMethodSignature {
  /**
   * メソッド名を取得する
   * @returns メソッド名
   */
  getName(): string;
  
  /**
   * メソッドのパラメータ定義を取得する
   * @returns パラメータ定義の配列
   */
  getParameters(): { name: string; type: IType | null; optional: boolean }[];
  
  /**
   * メソッドの戻り値の型を取得する
   * @returns 戻り値の型情報（型が明示的に指定されていない場合はnull）
   */
  getReturnType(): IType | null;
  
  /**
   * メソッドが省略可能かどうかを判定する
   * @returns 省略可能なメソッドであればtrue
   */
  isOptional(): boolean;
}

/**
 * インターフェース宣言の抽象インターフェース
 */
export interface IInterface extends INode {
  /**
   * インターフェース名を取得する
   * @returns インターフェース名
   */
  getName(): string;
  
  /**
   * インターフェースのJSDocコメントを取得する
   * @returns JSDocコメントの文字列（存在しない場合は空文字列）
   */
  getDocumentation(): string;
  
  /**
   * インターフェースのプロパティを取得する
   * @returns インターフェースプロパティの配列
   */
  getProperties(): IProperty[];
  
  /**
   * インターフェースのメソッドシグネチャを取得する
   * @returns メソッドシグネチャの配列
   */
  getMethodSignatures(): IMethodSignature[];
  
  /**
   * インターフェースの継承元を取得する
   * @returns 継承元インターフェースの型情報配列
   */
  getExtends(): IType[];
  
  /**
   * インターフェース宣言にジェネリック型パラメータがあるかどうかを判定する
   * @returns ジェネリック型パラメータがあればtrue
   */
  hasTypeParameters(): boolean;
  
  /**
   * インターフェースのジェネリック型パラメータを取得する
   * @returns ジェネリック型パラメータの配列
   */
  getTypeParameters(): { name: string; constraint?: IType; default?: IType }[];
  
  /**
   * インターフェースの修飾子を取得する（export, default など）
   * @returns 修飾子の配列
   */
  getModifiers(): string[];
  
  /**
   * 特定の名前のメンバー（プロパティまたはメソッド）を取得する
   * @param name メンバー名
   * @returns 対応するメンバー（存在しない場合はnull）
   */
  getMember(name: string): (IProperty | IMethodSignature) | null;
  
  /**
   * インデックスシグネチャを持つかどうかを判定する
   * @returns インデックスシグネチャを持つ場合はtrue
   */
  hasIndexSignature(): boolean;
}
