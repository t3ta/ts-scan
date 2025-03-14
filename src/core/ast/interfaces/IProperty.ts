/**
 * プロパティの抽象インターフェース
 * 
 * TypeScriptのプロパティ宣言に対する操作を抽象化し、具体的な実装への依存を
 * 排除します。プロパティに関連する高レベルの操作を定義します。
 */

import { INode } from './INode';
import { IType } from './IType';

/**
 * アクセス修飾子
 */
export type AccessModifier = 'public' | 'private' | 'protected' | 'none';

/**
 * プロパティの抽象インターフェース
 */
export interface IProperty extends INode {
  /**
   * プロパティ名を取得する
   * @returns プロパティ名
   */
  getName(): string;
  
  /**
   * プロパティの型を取得する
   * @returns プロパティの型情報（型が明示的に指定されていない場合はnull）
   */
  getType(): IType | null;
  
  /**
   * プロパティが静的（static）かどうかを判定する
   * @returns 静的プロパティであればtrue
   */
  isStatic(): boolean;
  
  /**
   * プロパティが読み取り専用（readonly）かどうかを判定する
   * @returns 読み取り専用プロパティであればtrue
   */
  isReadonly(): boolean;
  
  /**
   * プロパティが省略可能（optional）かどうかを判定する
   * @returns 省略可能プロパティであればtrue
   */
  isOptional(): boolean;
  
  /**
   * プロパティのアクセス修飾子を取得する
   * @returns アクセス修飾子
   */
  getAccessModifier(): AccessModifier;
  
  /**
   * プロパティの初期化子（= の右側）を取得する
   * @returns 初期化子ノード（存在しない場合はnull）
   */
  getInitializer(): INode | null;
  
  /**
   * プロパティが初期化子を持つかどうかを判定する
   * @returns 初期化子を持つ場合はtrue
   */
  hasInitializer(): boolean;
  
  /**
   * プロパティのJSDocコメントを取得する
   * @returns JSDocコメントの文字列（存在しない場合は空文字列）
   */
  getDocumentation(): string;
  
  /**
   * プロパティのデコレータを取得する
   * @returns デコレータのノード配列
   */
  getDecorators(): INode[];
  
  /**
   * プロパティがクラスのプロパティかどうかを判定する
   * @returns クラスプロパティであればtrue
   */
  isClassProperty(): boolean;
  
  /**
   * プロパティがオブジェクトリテラルのプロパティかどうかを判定する
   * @returns オブジェクトリテラルプロパティであればtrue
   */
  isObjectLiteralProperty(): boolean;
}
