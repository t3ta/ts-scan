/**
 * 変数宣言の抽象インターフェース
 * 
 * TypeScriptの変数宣言に対する操作を抽象化し、具体的な実装への依存を
 * 排除します。変数に関連する高レベルの操作を定義します。
 */

import { INode } from './INode';
import { IType } from './IType';

/**
 * 変数宣言の種類
 */
export enum VariableDeclarationKind {
  Var,
  Let,
  Const
}

/**
 * 変数宣言の抽象インターフェース
 */
export interface IVariable extends INode {
  /**
   * 変数名を取得する
   * @returns 変数名
   */
  getName(): string;
  
  /**
   * 変数の型を取得する
   * @returns 変数の型情報（型が明示的に指定されていない場合はnull）
   */
  getType(): IType | null;
  
  /**
   * 変数宣言の種類を取得する (var, let, const)
   * @returns 変数宣言の種類
   */
  getDeclarationKind(): VariableDeclarationKind;
  
  /**
   * 変数が定数 (const) かどうかを判定する
   * @returns 定数であればtrue
   */
  isConst(): boolean;
  
  /**
   * 変数の初期化子（= の右側）を取得する
   * @returns 初期化子ノード（存在しない場合はundefined）
   */
  getInitializer(): INode | undefined;
  
  /**
   * 変数が初期化子を持つかどうかを判定する
   * @returns 初期化子を持つ場合はtrue
   */
  hasInitializer(): boolean;
  
  /**
   * 変数のJSDocコメントを取得する
   * @returns JSDocコメントの文字列（存在しない場合は空文字列）
   */
  getDocumentation(): string;
  
  /**
   * 変数の修飾子を取得する（export など）
   * @returns 修飾子の配列
   */
  getModifiers(): string[];
  
  /**
   * 変数宣言が配列分解（destructuring）かどうかを判定する
   * @returns 配列分解宣言であればtrue
   */
  isArrayDestructuring(): boolean;
  
  /**
   * 変数宣言がオブジェクト分解（destructuring）かどうかを判定する
   * @returns オブジェクト分解宣言であればtrue
   */
  isObjectDestructuring(): boolean;
  
  /**
   * 初期化子の値がリテラルかどうかを判定する
   * @returns 初期化子がリテラルであればtrue
   */
  hasLiteralInitializer(): boolean;
  
  /**
   * リテラル初期化子の場合、その値を文字列として取得する
   * @returns リテラル値の文字列表現（リテラルでない場合は空文字列）
   */
  getLiteralValue(): string;
}
