/**
 * ts-morph向けアダプター実装
 * 
 * ts-morphライブラリを抽象インターフェースに適合させるアダプタークラスです。
 * 抽象化レイヤーとts-morphの実装の間のブリッジとして機能します。
 */

import {
  Project,
  SourceFile as TsMorphSourceFile,
  Node as TsMorphNode,
  SyntaxKind,
  FunctionDeclaration,
  ClassDeclaration,
  InterfaceDeclaration,
  VariableDeclaration,
  ImportDeclaration
} from 'ts-morph';
import { IASTProvider } from '../interfaces/IASTProvider';
import { ISourceFile } from '../interfaces/ISourceFile';
import { TsMorphSourceFileAdapter } from './TsMorphSourceFileAdapter';

/**
 * ts-morph向けアダプタークラス
 */
export class TsMorphAdapter implements IASTProvider {
  private project: Project;
  
  /**
   * コンストラクタ
   * @param tsConfigFilePath オプションのtsconfig.jsonのパス
   */
  constructor(tsConfigFilePath?: string) {
    try {
      // プロジェクトの初期化
      this.project = new Project({
        tsConfigFilePath,
        skipAddingFilesFromTsConfig: true
      });
    } catch (error) {
      throw new Error(`ts-morphプロジェクトの初期化に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * 文字列からソースファイルを解析する
   * @param code 解析対象のTypeScriptコード
   * @param fileName オプションのファイル名
   * @returns アダプターでラップされたソースファイル
   */
  public parseCode(code: string, fileName: string = 'unnamed.ts'): ISourceFile {
    try {
      const sourceFile = this.project.createSourceFile(fileName, code);
      return new TsMorphSourceFileAdapter(sourceFile);
    } catch (error) {
      throw new Error(`コードの解析に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * ファイルパスからソースファイルを解析する
   * @param filePath ファイルのパス
   * @returns アダプターでラップされたソースファイル
   */
  public parseFile(filePath: string): ISourceFile {
    try {
      // ファイルが既にプロジェクトに追加されているか確認
      let sourceFile = this.project.getSourceFile(filePath);
      
      // 存在しない場合は追加
      if (!sourceFile) {
        sourceFile = this.project.addSourceFileAtPath(filePath);
      }
      
      return new TsMorphSourceFileAdapter(sourceFile);
    } catch (error) {
      throw new Error(`ファイル '${filePath}' の解析に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * 複数のファイルパスからソースファイルを解析する
   * @param filePaths ファイルパスの配列
   * @returns アダプターでラップされたソースファイルの配列
   */
  public parseFiles(filePaths: string[]): ISourceFile[] {
    try {
      // ファイルをプロジェクトに追加
      const sourceFiles = this.project.addSourceFilesAtPaths(filePaths);
      
      // アダプターでラップ
      return sourceFiles.map(sourceFile => new TsMorphSourceFileAdapter(sourceFile));
    } catch (error) {
      throw new Error(`複数ファイルの解析に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * プロジェクトの型チェッカーを取得する
   * @returns ts-morphの型チェッカー
   */
  public getTypeChecker(): any {
    return this.project.getTypeChecker();
  }
  
  /**
   * プロバイダーの状態をリセットする
   * 一時リソースの解放やキャッシュのクリアを行う
   */
  public reset(): void {
    // プロジェクトのリセット（ファイルを削除）
    for (const sourceFile of this.project.getSourceFiles()) {
      this.project.removeSourceFile(sourceFile);
    }
  }
  
  /**
   * 基礎となるts-morphプロジェクトインスタンスを取得する
   * 高度なカスタマイズやアダプターでサポートされていない機能にアクセスするため
   * @returns ts-morphのプロジェクトインスタンス
   */
  public getProject(): Project {
    return this.project;
  }
}

/**
 * TsMorphAdapterのファクトリー関数
 * @param tsConfigFilePath オプションのtsconfig.jsonのパス
 * @returns TsMorphAdapterのインスタンス
 */
export function createTsMorphAdapter(tsConfigFilePath?: string): IASTProvider {
  return new TsMorphAdapter(tsConfigFilePath);
}
