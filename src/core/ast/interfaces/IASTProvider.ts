/**
 * AST（抽象構文木）プロバイダーインターフェース
 * 
 * ts-morphなどの具体的なASTライブラリへの依存を抽象化し、
 * テスト容易性と拡張性を向上させるための中心的なインターフェースです。
 */

import { ISourceFile } from './ISourceFile';

/**
 * AST（抽象構文木）プロバイダーインターフェース
 * TypeScriptコードの解析と操作のための抽象化レイヤー
 */
export interface IASTProvider {
  /**
   * 文字列からソースファイルを解析する
   * @param code 解析対象のTypeScriptコード
   * @param fileName オプションのファイル名
   * @returns 解析されたソースファイル表現
   */
  parseCode(code: string, fileName?: string): ISourceFile;
  
  /**
   * ファイルパスからソースファイルを解析する
   * @param filePath ファイルのパス
   * @returns 解析されたソースファイル表現
   */
  parseFile(filePath: string): ISourceFile;
  
  /**
   * 複数のファイルパスからソースファイルを解析する
   * @param filePaths ファイルパスの配列
   * @returns 解析されたソースファイル表現の配列
   */
  parseFiles(filePaths: string[]): ISourceFile[];
  
  /**
   * プロジェクトの型チェッカーを取得する
   * 型情報が利用可能な場合、型チェッカーを取得する
   * @returns 型チェッカーオブジェクト（実装依存の型）
   */
  getTypeChecker(): any;
  
  /**
   * プロバイダーの状態をリセットする
   * 一時リソースの解放やキャッシュのクリアを行う
   */
  reset(): void;
}
