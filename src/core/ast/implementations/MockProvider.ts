/**
 * モックASTプロバイダーの実装
 * 
 * テスト環境でts-morphへの依存なしにASTを扱うためのモックプロバイダーです。
 * スナップショットデータを活用してASTの構造をシミュレートします。
 */

import { IASTProvider } from '../interfaces/IASTProvider';
import { ISourceFile } from '../interfaces/ISourceFile';
import { MockSourceFile } from './MockSourceFile';
import { NodeKind } from '../interfaces/INode';

/**
 * ASTスナップショットのデータ構造
 */
export interface ASTSnapshot {
  filePath: string;
  fileName: string;
  text: string;
  kind: NodeKind;
  children: ASTNodeSnapshot[];
}

/**
 * ASTノードスナップショットのデータ構造
 */
export interface ASTNodeSnapshot {
  kind: NodeKind;
  text: string;
  location?: {
    line: number;
    column: number;
    start: number;
    end: number;
  };
  children?: ASTNodeSnapshot[];
  properties?: Record<string, any>;
}

/**
 * モックASTプロバイダーの実装クラス
 */
export class MockProvider implements IASTProvider {
  private snapshots: Map<string, ASTSnapshot> = new Map();
  private typeChecker: any = {
    // モックの型チェッカー実装
    getTypeAtLocation: () => ({
      getText: () => 'any',
      isObject: () => false,
      isArray: () => false,
      isEnum: () => false,
      isClass: () => false
    }),
    getSymbolAtLocation: () => null
  };
  
  /**
   * コンストラクタ
   * @param defaultSnapshots デフォルトのASTスナップショット配列
   */
  constructor(defaultSnapshots: ASTSnapshot[] = []) {
    for (const snapshot of defaultSnapshots) {
      this.addSnapshot(snapshot);
    }
  }
  
  /**
   * スナップショットを追加する
   * @param snapshot 追加するASTスナップショット
   */
  public addSnapshot(snapshot: ASTSnapshot): void {
    this.snapshots.set(snapshot.filePath, snapshot);
  }
  
  /**
   * 文字列からソースファイルを解析する（モック実装）
   * @param code 解析対象のTypeScriptコード
   * @param fileName オプションのファイル名
   * @returns モックのソースファイル表現
   */
  public parseCode(code: string, fileName: string = 'unnamed.ts'): ISourceFile {
    // 単純なスナップショットを生成
    const snapshot: ASTSnapshot = {
      filePath: fileName,
      fileName,
      text: code,
      kind: NodeKind.SourceFile,
      children: [] // 実際のパーサーがない場合は空の子ノード配列
    };
    
    return new MockSourceFile(snapshot, this.typeChecker);
  }
  
  /**
   * ファイルパスからソースファイルを解析する（モック実装）
   * @param filePath ファイルのパス
   * @returns モックのソースファイル表現
   */
  public parseFile(filePath: string): ISourceFile {
    // 既存のスナップショットがあれば再利用
    const snapshot = this.snapshots.get(filePath);
    
    if (snapshot) {
      return new MockSourceFile(snapshot, this.typeChecker);
    }
    
    // スナップショットがない場合は空のモックを返す
    return new MockSourceFile({
      filePath,
      fileName: filePath.split('/').pop() || 'unknown.ts',
      text: '',
      kind: NodeKind.SourceFile,
      children: []
    }, this.typeChecker);
  }
  
  /**
   * 複数のファイルパスからソースファイルを解析する（モック実装）
   * @param filePaths ファイルパスの配列
   * @returns モックのソースファイル表現の配列
   */
  public parseFiles(filePaths: string[]): ISourceFile[] {
    return filePaths.map(filePath => this.parseFile(filePath));
  }
  
  /**
   * プロジェクトの型チェッカーを取得する（モック実装）
   * @returns モックの型チェッカーオブジェクト
   */
  public getTypeChecker(): any {
    return this.typeChecker;
  }
  
  /**
   * プロバイダーの状態をリセットする（モック実装）
   */
  public reset(): void {
    this.snapshots.clear();
  }
  
  /**
   * カスタムモック型チェッカーを設定する
   * @param mockTypeChecker モックの型チェッカー
   */
  public setMockTypeChecker(mockTypeChecker: any): void {
    this.typeChecker = mockTypeChecker;
  }
}

/**
 * モックプロバイダーのファクトリー関数
 * スナップショットからモックASTプロバイダーを生成
 * @param snapshots 使用するASTスナップショット配列
 * @returns モックASTプロバイダーインスタンス
 */
export function createMockProvider(snapshots: ASTSnapshot[] = []): IASTProvider {
  return new MockProvider(snapshots);
}
