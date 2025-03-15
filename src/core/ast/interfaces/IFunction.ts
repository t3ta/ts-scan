/**
 * 関数宣言の抽象インターフェース
 * 
 * TypeScriptの関数宣言に対する操作を抽象化し、具体的な実装への依存を
 * 排除します。関数に関連する高レベルの操作を定義します。
 */

import { INode } from './INode';
import { IParameter } from './IParameter';
import { IType } from './IType';

/**
 * 関数宣言の抽象インターフェース
 */
export interface IFunction extends INode {
  /**
   * 関数名を取得する
   * @returns 関数名（無名関数の場合は空文字列）
   */
  getName(): string;
  
  /**
   * 関数が非同期関数かどうかを判定する
   * @returns 非同期関数であればtrue
   */
  isAsync(): boolean;
  
  /**
   * 関数がジェネレーター関数かどうかを判定する
   * @returns ジェネレーター関数であればtrue
   */
  isGenerator(): boolean;
  
  /**
   * 関数のパラメータを取得する
   * @returns パラメータの配列
   */
  getParameters(): IParameter[];
  
  /**
   * 関数の戻り値の型を取得する
   * @returns 戻り値の型情報（型が明示的に指定されていない場合はnull）
   */
  getReturnType(): IType | null;
  
  /**
   * 関数の本体部分のノードを取得する
   * @returns 関数本体のノード
   */
  getBody(): INode | undefined;
  
  /**
   * 関数がArrow Function（アロー関数）かどうかを判定する
   * @returns アロー関数であればtrue
   */
  isArrowFunction(): boolean;
  
  /**
   * 関数がメソッド宣言かどうかを判定する
   * @returns メソッド宣言であればtrue
   */
  isMethodDeclaration(): boolean;
  
  /**
   * 関数のJSDocコメントを取得する（存在する場合）
   * @returns JSDocコメントの文字列（存在しない場合は空文字列）
   */
  getDocumentation(): string;
}
