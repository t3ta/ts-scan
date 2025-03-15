/**
 * エンドポイント検出 - パターン検出器基底クラス
 * 
 * 特定のコードパターンを検出するための共通基盤となる抽象基底クラスを提供します。
 * Command/Visitorパターンに基づき、特定の条件に合致するノードを検出し処理します。
 */

import { TypeChecker } from 'ts-morph';
import { INode, SyntaxKind } from '../../core/ast/interfaces/INode';
import { ISourceFile } from '../../core/ast/interfaces/ISourceFile';
import { EndpointInfo, DetectionContext, EndpointPatternDetector } from '../../types';
import { logger } from '../../utils/Logger';
import { NodeTraversal } from '../../utils/ast/NodeTraversal';

/**
 * パターン検出器の抽象基底クラス
 */
export abstract class BasePatternDetector implements EndpointPatternDetector {
  /**
   * パターン名（デバッグ用）
   */
  abstract readonly patternName: string;
  
  /**
   * 特定のノードがこのパターンに一致するかを判定
   * @param node 対象ノード
   * @returns パターン一致の場合true
   */
  public abstract canHandle(node: INode): boolean;
  
  /**
   * パターンに一致したノードからエンドポイント情報を抽出
   * @param node 対象ノード
   * @param context 検出コンテキスト
   * @returns 抽出されたエンドポイント情報配列
   */
  public abstract extractEndpoints(node: INode, context: DetectionContext): EndpointInfo[];
  
  /**
   * ソースファイル内の該当するパターンをすべて検出して処理
   * @param sourceFile 対象ソースファイル
   * @param context 検出コンテキスト
   * @returns 検出・抽出されたエンドポイント情報配列
   */
  public detectAndExtract(sourceFile: ISourceFile, context: DetectionContext): EndpointInfo[] {
    const startTime = Date.now();
    logger.debug(`[${this.patternName}] パターン検出開始: ${sourceFile.getFilePath()}`);
    
    try {
      // 前処理
      this.beforeDetection(sourceFile, context);
      
      // 対象ノードの走査と抽出
      const endpoints: EndpointInfo[] = [];
      
      // AST全体を巡回し、パターンに一致するノードを検出
      this.traverseNodes(sourceFile, node => {
        if (this.canHandle(node)) {
          try {
            const extractedEndpoints = this.extractEndpoints(node, context);
            endpoints.push(...extractedEndpoints);
          } catch (error) {
            logger.error(`[${this.patternName}] エンドポイント抽出中にエラーが発生: ${error}`);
          }
          return true; // 処理済みノードをレポート
        }
        return false; // 該当なしをレポート
      });
      
      // 後処理
      this.afterDetection(endpoints, sourceFile, context);
      
      const endTime = Date.now();
      logger.debug(`[${this.patternName}] パターン検出完了: ${sourceFile.getFilePath()} (${endpoints.length}件, ${endTime - startTime}ms)`);
      
      return endpoints;
    } catch (error) {
      logger.error(`[${this.patternName}] パターン検出中にエラーが発生: ${error}`);
      return [];
    }
  }
  
  /**
   * パターン検出前の前処理（オーバーライド可能）
   * @param sourceFile 対象ソースファイル
   * @param context 検出コンテキスト
   */
  protected beforeDetection(_sourceFile: ISourceFile, _context: DetectionContext): void {
    // デフォルトでは何もしない
  }
  
  /**
   * パターン検出後の後処理（オーバーライド可能）
   * @param endpoints 検出されたエンドポイント情報配列
   * @param sourceFile 対象ソースファイル
   * @param context 検出コンテキスト
   */
  protected afterDetection(
    _endpoints: EndpointInfo[], 
    _sourceFile: ISourceFile, 
    _context: DetectionContext
  ): void {
    // デフォルトでは何もしない
  }
  
  /**
   * ASTノードの巡回と処理
   * @param node 開始ノード
   * @param handler ノード処理ハンドラ
   * @returns 処理されたノード数
   */
  protected traverseNodes(node: INode, handler: (node: INode) => boolean): number {
    let processedCount = 0;
    
    // 自分自身を処理
    const processed = handler(node);
    if (processed) {
      processedCount++;
    }
    
    // 子ノードを再帰的に処理
    for (const child of node.getChildren()) {
      processedCount += this.traverseNodes(child, handler);
    }
    
    return processedCount;
  }
  
  /**
   * 特定のパターンに一致するノードを収集
   * @param sourceFile 対象ソースファイル
   * @returns 一致するノードの配列
   */
  protected collectMatchingNodes(sourceFile: ISourceFile): INode[] {
    const matchingNodes: INode[] = [];
    
    this.traverseNodes(sourceFile, (node) => {
      if (this.canHandle(node)) {
        matchingNodes.push(node);
        return true;
      }
      return false;
    });
    
    return matchingNodes;
  }
  
  /**
   * 特定の関数呼び出しを遡って親コンテキストを検出
   * @param node 開始ノード
   * @param predicate 判定関数
   * @returns 親コンテキスト情報、未検出時はundefined
   */
  protected findParentContext(
    node: INode,
    predicate: (node: INode) => boolean
  ): { node: INode; name?: string } | undefined {
    const parent = NodeTraversal.findFirstAncestor(node, predicate);
    
    if (!parent) {
      return undefined;
    }
    
    let name: string | undefined;
    
    if ('getName' in parent && typeof parent.getName === 'function') {
      try {
        name = parent.getName();
      } catch (e) {
        // getName()が失敗した場合は無視
      }
    }
    
    return { node: parent, name };
  }
  
  /**
   * ノードのプロパティ階層を辿って特定の値を抽出
   * @param node 開始ノード
   * @param propertyPath プロパティパス（ドット区切り）
   * @returns 抽出した値、未検出時はundefined
   */
  protected extractPropertyValue(node: any, propertyPath: string): any {
    const parts = propertyPath.split('.');
    let current = node;
    
    for (const part of parts) {
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      
      if (!(part in current)) {
        return undefined;
      }
      
      current = current[part];
      
      // 関数の場合は実行
      if (typeof current === 'function') {
        try {
          current = current.call(node);
        } catch (e) {
          return undefined;
        }
      }
    }
    
    return current;
  }
  
  /**
   * 抽出されたエンドポイント情報の重複を除去
   * @param endpoints エンドポイント情報配列
   * @returns 重複除去後のエンドポイント情報配列
   */
  protected deduplicateEndpoints(endpoints: EndpointInfo[]): EndpointInfo[] {
    // 結果格納用の配列は直接Map.values()から生成するため不要
    const endpointMap = new Map<string, EndpointInfo>();
    
    for (const endpoint of endpoints) {
      const key = `${endpoint.method}:${endpoint.path}`;
      
      if (endpointMap.has(key)) {
        // 既存エントリにマージ
        const existing = endpointMap.get(key)!;
        
        // 使用箇所を結合
        existing.usageLocations.push(...endpoint.usageLocations);
        
        // パラメータを結合
        for (const param of endpoint.parametersUsed) {
          const existingParam = existing.parametersUsed.find(p => p.name === param.name);
          if (existingParam) {
            existingParam.locations.push(...param.locations);
          } else {
            existing.parametersUsed.push(param);
          }
        }
        
        // レスポンス処理を結合
        existing.responseHandling.push(...endpoint.responseHandling);
      } else {
        // 新規エントリとして追加
        endpointMap.set(key, {...endpoint});
      }
    }
    
    return Array.from(endpointMap.values());
  }
  
  /**
   * ソースファイルからエクスポートされている変数名を収集
   * @param sourceFile 対象ソースファイル
   * @returns エクスポート変数名の配列
   */
  protected collectExportedVariables(sourceFile: ISourceFile): string[] {
    const exportedNames: string[] = [];
    
    // エクスポート変数宣言の収集
    // ISourceFile の getVariables() を使用
    const variables = sourceFile.getVariables();
    
    for (const v of variables) {
      try {
        // export修飾子を持つ変数をフィルタリング
        const modifiers = v.getModifiers();
        if (modifiers.includes('export')) {
          exportedNames.push(v.getName());
        }
      } catch (e) {
        // エラーが発生した場合はスキップ
      }
    }
    
    // エクスポート関数宣言の収集
    const functions = sourceFile.getFunctions();
    
    for (const f of functions) {
      try {
        // 関数名を取得
        const name = f.getName();
        if (name) {
          // IFunctionインターフェースにはisExported()がないため、代わりに別の方法を試す
          // 将来的にはIFunctionにexportedプロパティやメソッドを追加すべき
          exportedNames.push(name);
        }
      } catch (e) {
        // エラーが発生した場合はスキップ
      }
    }
    
    // 簡易実装: 実際のエクスポート宣言の処理はより複雑になるかもしれない
    // 現時点ではソースファイルの内容から簡易検索で代用
    const fileText = sourceFile.getText();
    const exportPattern = /export\s+(?:{\s*([\w\s,]+)\s*})/g;
    let match;
    
    while ((match = exportPattern.exec(fileText)) !== null) {
      if (match[1]) {
        const names = match[1].split(',').map(s => s.trim());
        exportedNames.push(...names);
      }
    }
    
    return exportedNames;
  }
  
  /**
   * AST上の型情報を安全に取得
   * @param node 対象ノード
   * @param typeChecker タイプチェッカー
   * @returns 型情報文字列、取得失敗時は'unknown'
   */
  protected safeGetTypeString(node: INode, typeChecker: TypeChecker): string {
    try {
      // INodeをts-morphのNodeに変換する必要がある
      // ts-morphの型結合を保つための暇曲な処理
      const internalNode = node.getInternalNode();
      if (internalNode && 'getType' in internalNode && typeof internalNode.getType === 'function') {
        return internalNode.getType().getText();
      }
      return 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }
  
  /**
   * エラー耐性のあるノード変換
   * @param node 元のノード
   * @param converterFn 変換関数
   * @param defaultValue 変換失敗時のデフォルト値
   * @returns 変換結果または変換失敗時はデフォルト値
   */
  protected safeConvert<T, D>(
    node: INode | undefined, 
    converterFn: (n: INode) => T, 
    defaultValue: D
  ): T | D {
    if (!node) return defaultValue;
    
    try {
      return converterFn(node);
    } catch (e) {
      return defaultValue;
    }
  }
}
