/**
 * ASTテスト用ヘルパー
 * 
 * テスト時にts-morphへの依存を回避しながらASTを操作するための
 * ヘルパー関数群を提供します。
 */

import * as path from 'path';
import * as fs from 'fs';
import { IASTProvider } from '../../src/core/ast/interfaces/IASTProvider';
import { MockProvider, ASTSnapshot } from '../../src/core/ast/implementations/MockProvider';
import { createASTProvider } from '../../src/core/ast/factories/ASTProviderFactory';
import { ServiceLocator, ServiceIds } from '../../src/core/ServiceLocator';

/**
 * スナップショットディレクトリのデフォルトパス
 */
const DEFAULT_SNAPSHOT_DIR = path.resolve(__dirname, '../fixtures/ast-snapshots');

/**
 * スナップショットファイルを読み込む
 * @param name スナップショット名（拡張子なし）
 * @param snapshotDir スナップショットディレクトリ
 * @returns 読み込まれたASTスナップショット
 */
export function loadASTSnapshot(
  name: string,
  snapshotDir: string = DEFAULT_SNAPSHOT_DIR
): ASTSnapshot {
  const snapshotPath = path.join(snapshotDir, `${name}.json`);
  
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(`スナップショットファイル '${snapshotPath}' が見つかりません`);
  }
  
  const content = fs.readFileSync(snapshotPath, 'utf-8');
  return JSON.parse(content) as ASTSnapshot;
}

/**
 * 複数のスナップショットファイルを読み込む
 * @param names スナップショット名の配列
 * @param snapshotDir スナップショットディレクトリ
 * @returns 読み込まれたASTスナップショットの配列
 */
export function loadASTSnapshots(
  names: string[],
  snapshotDir: string = DEFAULT_SNAPSHOT_DIR
): ASTSnapshot[] {
  return names.map(name => loadASTSnapshot(name, snapshotDir));
}

/**
 * モックASTプロバイダーを作成する
 * @param snapshots 使用するASTスナップショット（単一または配列）
 * @returns モックASTプロバイダーのインスタンス
 */
export function createMockASTProvider(
  snapshots: ASTSnapshot | ASTSnapshot[]
): IASTProvider {
  const snapshotArray = Array.isArray(snapshots) ? snapshots : [snapshots];
  return new MockProvider(snapshotArray);
}

/**
 * テスト用のServiceLocatorにモックASTプロバイダーを登録する
 * @param snapshots 使用するASTスナップショット（単一または配列）
 * @param serviceLocator 使用するServiceLocator（省略時は新規作成）
 * @returns 設定されたServiceLocator
 */
export function setupMockASTProviderInServiceLocator(
  snapshots: ASTSnapshot | ASTSnapshot[],
  serviceLocator: ServiceLocator = ServiceLocator.getInstance()
): ServiceLocator {
  const mockProvider = createMockASTProvider(
    Array.isArray(snapshots) ? snapshots : [snapshots]
  );
  
  serviceLocator.register(ServiceIds.AST_PROVIDER, mockProvider);
  serviceLocator.register(ServiceIds.TYPE_CHECKER, mockProvider.getTypeChecker());
  
  return serviceLocator;
}

/**
 * コード文字列からモックプロバイダーを作成する
 * この関数は一時的にts-morphを使用してスナップショットを生成し、
 * それをもとにモックプロバイダーを作成する
 * @param code TypeScriptコード
 * @param fileName オプションのファイル名
 * @returns モックASTプロバイダーのインスタンス
 */
export function createMockASTProviderFromCode(
  code: string,
  fileName: string = 'temp.ts'
): IASTProvider {
  // 実際のプロバイダーを作成してコードを解析
  const realProvider = createASTProvider();
  const sourceFile = realProvider.parseCode(code, fileName);
  
  // スナップショット生成のためのシリアライズ処理
  // 注: 本来であればSnapshotUtilsを使うべきだが、循環参照を避けるため簡易実装
  const snapshot: ASTSnapshot = {
    filePath: sourceFile.getFilePath(),
    fileName: sourceFile.getFileName(),
    text: sourceFile.getText(),
    kind: sourceFile.getRootNode().getKind(),
    children: [] // 簡略化のため子ノードは空配列
  };
  
  // モックプロバイダーを作成して返す
  return createMockASTProvider(snapshot);
}

/**
 * モックの型チェッカーを簡易的に作成する
 * @returns モックの型チェッカーオブジェクト
 */
export function createMockTypeChecker(): any {
  return {
    getTypeAtLocation: () => ({
      getText: () => 'any',
      isObject: () => false,
      isArray: () => false,
      isEnum: () => false,
      isClass: () => false
    }),
    getSymbolAtLocation: () => null,
    getContextualType: () => null
  };
}

/**
 * テスト用にテンポラリのASTスナップショットディレクトリを作成する
 * @returns 作成されたテンポラリディレクトリのパス
 */
export function createTempSnapshotDirectory(): string {
  const tempDir = path.join(DEFAULT_SNAPSHOT_DIR, `temp-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

/**
 * テンポラリのASTスナップショットディレクトリを削除する
 * @param tempDir 削除するディレクトリ
 */
export function cleanupTempSnapshotDirectory(tempDir: string): void {
  if (fs.existsSync(tempDir) && tempDir.includes('temp-')) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
