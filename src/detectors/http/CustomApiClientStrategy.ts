/**
 * カスタムAPIクライアント検出戦略
 *
 * プロジェクト固有のAPIクライアント実装を検出し、エンドポイント情報を抽出します。
 * 複数の検出器を組み合わせて高度な検出ロジックを実現するコンポジットパターンを採用しています。
 */

import { Node, SourceFile } from 'ts-morph';
import { BaseDetectionStrategy } from '../common/BaseDetectionStrategy';
import { EndpointInfo, DetectionContext } from '../../types';
import { ApiClientMethodCallDetector } from './custom/ApiClientMethodCallDetector';
import { ServiceMethodDetector } from './custom/ServiceMethodDetector';
import { HttpPatternDetector } from './custom/HttpPatternDetector';
import { logger } from '../../utils/Logger';
import { pathToRegexp } from 'path-to-regexp';

/**
 * カスタムAPIクライアント検出戦略
 * プロジェクト固有のHTTPクライアント実装を検出します
 */
export class CustomApiClientStrategy extends BaseDetectionStrategy {
  readonly name = 'CustomApiClientStrategy';
  readonly priority = 30; // 標準HTTPクライアントの次に実行される優先度

  private readonly detectors: Array<{
    patternName: string;
    detectAndExtract: (sourceFile: SourceFile, context: DetectionContext) => EndpointInfo[];
  }>;

  constructor(detectors?: Array<{
    patternName: string;
    detectAndExtract: (sourceFile: SourceFile, context: DetectionContext) => EndpointInfo[];
  }>) {
    super();
    this.detectors = detectors || this.createDefaultDetectors();
  }

  private createDefaultDetectors() {
    return [
      new ApiClientMethodCallDetector(),
      new ServiceMethodDetector(),
      new HttpPatternDetector()
    ];
  }

  /**
   * カスタムAPIクライアントからエンドポイントを検出する
   * @param sourceFile 解析対象ソースファイル
   * @param context 検出コンテキスト
   * @returns 検出されたエンドポイント情報配列
   */
  protected performDetection(sourceFile: SourceFile, context: DetectionContext): EndpointInfo[] {
    logger.debug(`[${this.name}] 検出開始: ${sourceFile.getFilePath()}`);

    // 各検出器を順番に実行
    const allEndpoints: EndpointInfo[] = [];

    for (const detector of this.detectors) {
      try {
        // 検出器からエンドポイントを取得
        const detectedEndpoints = detector.detectAndExtract(sourceFile, context);

        // エンドポイント情報を解析
        const endpoints = detectedEndpoints.map(endpoint => {
          // パスの解析結果を取得
          const pathIsDynamic = this.isPathDynamic(endpoint.path);

          // デバッグ情報を出力
          const debugInfo = {
            detector: detector.patternName,
            path: endpoint.path,
            originalIsDynamic: endpoint.isDynamic,
            pathIsDynamic,
            finalIsDynamic: endpoint.isDynamic || pathIsDynamic
          };
          logger.debug(`[${this.name}] エンドポイント解析:\n${JSON.stringify(debugInfo, null, 2)}`);

          // 元のisDynamicとパスの解析結果をORで結合
          return {
            ...endpoint,
            isDynamic: endpoint.isDynamic || pathIsDynamic
          };
        });

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
   * パスが動的パラメータを含むかどうかを判定
   * @param path パス
   * @returns 動的パラメータを含む場合はtrue
   */
  private isPathDynamic(path: string): boolean {
    // パスを/で分割して各セグメントをチェック
    const segments = path.split('/').filter(Boolean);

    // パスの解析結果を保持
    const analysis = {
      path,
      segments: segments.map(segment => ({
        value: segment,
        isNumeric: /^\d+$/.test(segment),
        isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment),
        isParameter: /^:[a-zA-Z][a-zA-Z0-9_]*$/.test(segment),
        isBrace: /^{[a-zA-Z][a-zA-Z0-9_]*}$/.test(segment),
        isResource: /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(segment)
      }))
    };

    // 各セグメントを解析
    for (let i = 0; i < analysis.segments.length; i++) {
      const current = analysis.segments[i];
      const prev = i > 0 ? analysis.segments[i - 1] : null;
      const next = i < analysis.segments.length - 1 ? analysis.segments[i + 1] : null;

      // 動的パラメータの判定
      if (
        current.isNumeric || // 数値パラメータ
        current.isUUID || // UUIDパラメータ
        current.isParameter || // :id形式
        current.isBrace // {id}形式
      ) {
        const debugInfo = {
          ...analysis,
          currentSegment: current,
          prevSegment: prev,
          nextSegment: next,
          reason: '動的パラメータを検出',
          isDynamic: true
        };
        logger.debug(`[${this.name}] パス解析詳細:\n${JSON.stringify(debugInfo, null, 2)}`);
        return true;
      }
    }

    const debugInfo = {
      ...analysis,
      reason: '動的パラメータなし',
      isDynamic: false
    };
    logger.debug(`[${this.name}] パス解析詳細:\n${JSON.stringify(debugInfo, null, 2)}`);
    return false;
  }

  /**
   * パスが動的パラメータを含むかどうかを判定（デバッグ用）
   * @param path パス
   * @returns 判定結果の詳細
   */
  private debugPathDynamic(path: string): string {
    const segments = path.split('/').filter(Boolean);
    const results: string[] = [];

    for (const segment of segments) {
      const patterns = [
        { name: ':id形式', pattern: /^:[a-zA-Z][a-zA-Z0-9_]*$/ },
        { name: '{id}形式', pattern: /^{[a-zA-Z][a-zA-Z0-9_]*}$/ },
        { name: '数値パラメータ', pattern: /^\d+$/ },
        { name: 'UUIDパラメータ', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i }
      ];

      const matches = patterns
        .filter(({ pattern }) => pattern.test(segment))
        .map(({ name }) => name);

      results.push(`${segment}: ${matches.length > 0 ? matches.join(', ') : 'マッチなし'}`);
    }

    return `パス: ${path}\n${results.map(r => `  ${r}`).join('\n')}`;
  }

  /**
   * 検出前の前処理（オーバーライド）
   * @param sourceFile 解析対象ソースファイル
   * @param context 検出コンテキスト
   */
  protected prepareDetection(sourceFile: SourceFile, context: DetectionContext): void {
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
    sourceFile: SourceFile,
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
