/**
 * カスタムAPIクライアント検出戦略
 * 
 * プロジェクト固有のAPIクライアント実装を検出し、エンドポイント情報を抽出します。
 * 複数の検出器を組み合わせて高度な検出ロジックを実現するコンポジットパターンを採用しています。
 */

// ts-morphの直接インポートを避け、抽象インターフェースのみを使用するのだ
import { ISourceFile } from '../../core/ast/interfaces/ISourceFile';
import { BaseDetectionStrategy } from '../common/BaseDetectionStrategy';
import { EndpointInfo, DetectionContext } from '../../types';
import { ApiClientMethodCallDetector } from './custom/ApiClientMethodCallDetector';
import { ServiceMethodDetector } from './custom/ServiceMethodDetector';
import { HttpPatternDetector } from './custom/HttpPatternDetector';
import { logger } from '../../utils/Logger';

/**
 * カスタムAPIクライアント検出戦略
 * プロジェクト固有のHTTPクライアント実装を検出します
 */
export class CustomApiClientStrategy extends BaseDetectionStrategy {
  readonly name = 'CustomApiClientStrategy';
  readonly priority = 30; // 標準HTTPクライアントの次に実行される優先度

  private detectors = [
    new ApiClientMethodCallDetector(),
    new ServiceMethodDetector(),
    new HttpPatternDetector()
  ];

  /**
   * カスタムAPIクライアントからエンドポイントを検出する
   * @param sourceFile 解析対象ソースファイル
   * @param context 検出コンテキスト
   * @returns 検出されたエンドポイント情報配列
   */
  protected performDetection(sourceFile: ISourceFile, context: DetectionContext): EndpointInfo[] {
    logger.debug(`[${this.name}] 検出開始: ${sourceFile.getFilePath()}`);
    
    // 各検出器を順番に実行
    const allEndpoints: EndpointInfo[] = [];
    
    for (const detector of this.detectors) {
      try {
        const endpoints = detector.detectAndExtract(sourceFile, context);
        
        if (endpoints.length > 0) {
          allEndpoints.push(...endpoints);
          logger.debug(`[${this.name}] ${detector.patternName}が${endpoints.length}件のエンドポイントを検出`);
        }
      } catch (error) {
        logger.error(`[${this.name}] ${detector.patternName}実行中にエラーが発生: ${error}`);
      }
    }
    
    // 重複を除去して返却
    const uniqueEndpoints = this.deduplicateEndpoints(allEndpoints);
    logger.debug(`[${this.name}] 検出完了: ${uniqueEndpoints.length}件のエンドポイント`);
    
    return uniqueEndpoints;
  }
  
  /**
   * 検出前の前処理（オーバーライド）
   * @param sourceFile 解析対象ソースファイル
   * @param context 検出コンテキスト
   */
  protected prepareDetection(sourceFile: ISourceFile, context: DetectionContext): void {
    // ファイル内でカスタムAPIクライアントの存在を確認するための前処理
    // 例: import文の解析、クラス定義の収集など
    logger.debug(`[${this.name}] ${sourceFile.getFilePath()} の前処理を実行`);
  }
  
  /**
   * 検出後の後処理（オーバーライド）
   * @param endpoints 検出されたエンドポイント情報配列
   * @param sourceFile 解析対象ソースファイル
   * @param context 検出コンテキスト
   */
  protected finalizeDetection(
    endpoints: EndpointInfo[],
    sourceFile: ISourceFile,
    context: DetectionContext
  ): void {
    super.finalizeDetection(endpoints, sourceFile, context);
    
    // 検出結果の追加処理
    // 例: エンドポイント情報の補完、コード構造からの追加情報抽出など
    if (endpoints.length > 0) {
      logger.debug(`[${this.name}] ${sourceFile.getFilePath()} の後処理を実行`);
    }
  }
}
