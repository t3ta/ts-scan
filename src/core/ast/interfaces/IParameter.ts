/**
 * パラメータの抽象インターフェース
 * 
 * 関数パラメータに対する操作を抽象化し、具体的な実装への依存を
 * 排除します。パラメータに関連する高レベルの操作を定義します。
 */

import { INode } from './INode';
import { IType } from './IType';

/**
 * パラメータの抽象インターフェース
 */
export interface IParameter extends INode {
  /**
   * パラメータ名を取得する
   * @returns パラメータ名
   */
  getName(): string;
  
  /**
   * パラメータの型を取得する
   * @returns パラメータの型情報（型が明示的に指定されていない場合はnull）
   */
  getType(): IType | null;
  
  /**
   * パラメータが省略可能かどうかを判定する
   * @returns 省略可能なパラメータであればtrue
   */
  isOptional(): boolean;
  
  /**
   * パラメータがrest parameterかどうかを判定する (...args)
   * @returns rest parameterであればtrue
   */
  isRestParameter(): boolean;
  
  /**
   * パラメータのデフォルト値を取得する
   * @returns デフォルト値のノード（デフォルト値がない場合はnull）
   */
  getDefaultValue(): INode | null;
  
  /**
   * パラメータがデフォルト値を持つかどうかを判定する
   * @returns デフォルト値を持つ場合はtrue
   */
  hasDefaultValue(): boolean;
  
  /**
   * パラメータの初期化子ノード（= の右側）を取得する
   * @returns 初期化子ノード（存在しない場合はundefined）
   */
  getInitializer(): INode | undefined;
  
  /**
   * パラメータの修飾子を取得する（public, private, protected, readonly など）
   * @returns 修飾子の配列
   */
  getModifiers(): string[];
}
