/**
 * インポート宣言の抽象インターフェース
 * 
 * TypeScriptのインポート宣言に対する操作を抽象化し、具体的な実装への依存を
 * 排除します。インポートに関連する高レベルの操作を定義します。
 */

import { INode } from './INode';

/**
 * インポート指定子の種類
 */
export enum ImportSpecifierKind {
  Named,      // 名前付きインポート: import { X } from 'module'
  Default,    // デフォルトインポート: import X from 'module'
  Namespace   // 名前空間インポート: import * as X from 'module'
}

/**
 * インポート指定子の情報
 */
export interface ImportSpecifier {
  /**
   * インポートされる名前
   */
  name: string;
  
  /**
   * ローカルでの別名（存在する場合）
   */
  alias?: string;
  
  /**
   * インポート指定子の種類
   */
  kind: ImportSpecifierKind;
}

/**
 * インポート宣言の抽象インターフェース
 */
export interface IImportDeclaration extends INode {
  /**
   * インポート元のモジュールパスを取得する
   * @returns モジュールパスの文字列
   */
  getModulePath(): string;
  
  /**
   * すべてのインポート指定子を取得する
   * @returns インポート指定子の配列
   */
  getImportSpecifiers(): ImportSpecifier[];
  
  /**
   * デフォルトインポートの名前を取得する
   * @returns デフォルトインポートの名前（存在しない場合はnull）
   */
  getDefaultImport(): string | null;
  
  /**
   * 名前空間インポートの名前を取得する
   * @returns 名前空間インポートの名前（存在しない場合はnull）
   */
  getNamespaceImport(): string | null;
  
  /**
   * 名前付きインポートをすべて取得する
   * @returns 名前付きインポートの配列
   */
  getNamedImports(): { name: string; alias?: string }[];
  
  /**
   * 特定の名前のエンティティがインポートされているかを判定する
   * @param name 確認する名前
   * @returns インポートされていればtrue
   */
  hasNamedImport(name: string): boolean;
  
  /**
   * インポートがサイドエフェクトのみ（import 'module'）かどうかを判定する
   * @returns サイドエフェクトのみのインポートであればtrue
   */
  isSideEffectImport(): boolean;
  
  /**
   * インポート宣言の種類を判定する
   * @returns インポート宣言の種類の配列
   */
  getImportKinds(): ImportSpecifierKind[];
  
  /**
   * 型インポートかどうかを判定する (import type { X } from 'module')
   * @returns 型インポートであればtrue
   */
  isTypeOnly(): boolean;
}
