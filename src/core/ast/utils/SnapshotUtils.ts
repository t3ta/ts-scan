/**
 * ASTスナップショットユーティリティ
 * 
 * AST構造をシリアライズ可能な形式でキャプチャし、テスト環境での再利用を
 * 可能にするためのユーティリティ関数群です。ts-morph依存性の分離に貢献します。
 */

import { 
  Project, 
  SourceFile, 
  Node as TsMorphNode, 
  SyntaxKind 
} from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';
import { NodeKind } from '../interfaces/INode';
import { ASTSnapshot, ASTNodeSnapshot } from '../implementations/MockProvider';
import { convertSyntaxKindToNodeKind } from '../adapters/TsMorphNodeAdapter';

/**
 * ノードの子孫を最大どの深さまで処理するかのデフォルト値
 */
const DEFAULT_MAX_DEPTH = 15;

/**
 * スナップショットの保存先ディレクトリのデフォルト値
 */
const DEFAULT_SNAPSHOT_DIR = path.resolve(__dirname, '../../../../tests/fixtures/ast-snapshots');

/**
 * ts-morphのノードをシリアライズ可能なスナップショットオブジェクトに変換する
 * @param node 変換対象のts-morphノード
 * @param maxDepth 最大処理深度
 * @param currentDepth 現在の深度
 * @param propertyExtractors 特定のノード種類に対する追加プロパティ抽出関数
 * @returns シリアライズ可能なASTノードスナップショット
 */
export function serializeNode(
  node: TsMorphNode,
  maxDepth: number = DEFAULT_MAX_DEPTH,
  currentDepth: number = 0,
  propertyExtractors: Record<SyntaxKind, (node: any) => Record<string, any>> = {}
): ASTNodeSnapshot {
  // 深さ制限を超えた場合は子ノードを処理しない
  const shouldProcessChildren = currentDepth < maxDepth;
  
  // ノードの位置情報を取得
  const sourceFile = node.getSourceFile();
  const start = node.getStart();
  const end = node.getEnd();
  const { line, column } = sourceFile.getLineAndColumnAtPos(start);
  
  // 基本情報の抽出
  const kind = convertSyntaxKindToNodeKind(node.getKind());
  const text = node.getText();
  
  // プロパティ抽出関数が定義されている場合は追加プロパティを抽出
  const nodeKind = node.getKind();
  const extractorFn = propertyExtractors[nodeKind];
  const extraProperties = extractorFn ? extractorFn(node) : {};
  
  // ノードのスナップショット作成
  const snapshot: ASTNodeSnapshot = {
    kind,
    text,
    location: {
      line,
      column,
      start,
      end
    },
    properties: extraProperties,
    children: []
  };
  
  // 子ノードを再帰的に処理
  if (shouldProcessChildren) {
    snapshot.children = node
      .getChildren()
      .map(child => serializeNode(
        child, 
        maxDepth, 
        currentDepth + 1, 
        propertyExtractors
      ));
  }
  
  return snapshot;
}

/**
 * ソースファイルからASTスナップショットを生成する
 * @param sourceFile 対象のソースファイル
 * @param propertyExtractors 特定のノード種類に対する追加プロパティ抽出関数
 * @returns ソースファイルのASTスナップショット
 */
export function createSourceFileSnapshot(
  sourceFile: SourceFile,
  propertyExtractors: Record<SyntaxKind, (node: any) => Record<string, any>> = {}
): ASTSnapshot {
  return {
    filePath: sourceFile.getFilePath(),
    fileName: sourceFile.getBaseName(),
    text: sourceFile.getFullText(),
    kind: NodeKind.SourceFile,
    children: sourceFile
      .getChildren()
      .map(child => serializeNode(child, DEFAULT_MAX_DEPTH, 0, propertyExtractors))
  };
}

/**
 * コード文字列からASTスナップショットを生成する
 * @param code 解析対象のTypeScriptコード
 * @param fileName オプションのファイル名
 * @param propertyExtractors 特定のノード種類に対する追加プロパティ抽出関数
 * @returns コードのASTスナップショット
 */
export function createSnapshotFromCode(
  code: string,
  fileName: string = 'snapshot.ts',
  propertyExtractors: Record<SyntaxKind, (node: any) => Record<string, any>> = {}
): ASTSnapshot {
  const project = new Project();
  const sourceFile = project.createSourceFile(fileName, code);
  return createSourceFileSnapshot(sourceFile, propertyExtractors);
}

/**
 * ファイルパスからASTスナップショットを生成する
 * @param filePath 対象のファイルパス
 * @param propertyExtractors 特定のノード種類に対する追加プロパティ抽出関数
 * @returns ファイルのASTスナップショット
 */
export function createSnapshotFromFile(
  filePath: string,
  propertyExtractors: Record<SyntaxKind, (node: any) => Record<string, any>> = {}
): ASTSnapshot {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(filePath);
  return createSourceFileSnapshot(sourceFile, propertyExtractors);
}

/**
 * ASTスナップショットをJSONファイルとして保存する
 * @param snapshot 保存するASTスナップショット
 * @param outputPath 保存先のファイルパス
 */
export function saveSnapshotToFile(snapshot: ASTSnapshot, outputPath: string): void {
  // 出力ディレクトリが存在しない場合は作成
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // スナップショットをJSON形式で保存
  fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2), 'utf-8');
}

/**
 * ファイルからASTスナップショットを読み込む
 * @param filePath スナップショットファイルのパス
 * @returns 読み込んだASTスナップショット
 */
export function loadSnapshotFromFile(filePath: string): ASTSnapshot {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as ASTSnapshot;
}

/**
 * コード文字列からスナップショットを生成してファイルに保存する
 * @param code 解析対象のTypeScriptコード
 * @param outputName 出力ファイル名（拡張子なし）
 * @param snapshotDir スナップショット保存ディレクトリ
 */
export function generateAndSaveCodeSnapshot(
  code: string,
  outputName: string,
  snapshotDir: string = DEFAULT_SNAPSHOT_DIR
): string {
  const snapshot = createSnapshotFromCode(code);
  const outputPath = path.join(snapshotDir, `${outputName}.json`);
  saveSnapshotToFile(snapshot, outputPath);
  return outputPath;
}

/**
 * ファイルからスナップショットを生成して保存する
 * @param sourceFilePath 解析対象のTypeScriptファイルパス
 * @param outputName 出力ファイル名（拡張子なし、省略時はソースファイル名を使用）
 * @param snapshotDir スナップショット保存ディレクトリ
 */
export function generateAndSaveFileSnapshot(
  sourceFilePath: string,
  outputName?: string,
  snapshotDir: string = DEFAULT_SNAPSHOT_DIR
): string {
  const snapshot = createSnapshotFromFile(sourceFilePath);
  const baseName = outputName || path.basename(sourceFilePath, path.extname(sourceFilePath));
  const outputPath = path.join(snapshotDir, `${baseName}.json`);
  saveSnapshotToFile(snapshot, outputPath);
  return outputPath;
}
