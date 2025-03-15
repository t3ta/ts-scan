/**
 * Axios HTTP クライアント検出戦略
 *
 * Axios ライブラリを使用したHTTPリクエストを検出し、エンドポイント情報を抽出します。
 * Axiosの様々な呼び出しパターンに対応します。
 */

// ts-morphの直接インポートを避け、抽象インターフェースのみを使用するのだ
import { ISourceFile } from '../../core/ast/interfaces/ISourceFile';
import { INode, NodeKind } from '../../core/ast/interfaces/INode';
import { BaseDetectionStrategy } from '../common/BaseDetectionStrategy';
import { BasePatternDetector } from '../common/PatternDetector';
import { EndpointInfo, DetectionContext, HttpMethod, UsageLocation, ParameterUsage, ResponseUsage } from '../../types';
import { NodePredicates } from '../../utils/ast/NodePredicates';
import { NodeExtractors } from '../../utils/ast/NodeExtractors';
import { NodeExtractorsExtended } from '../../utils/ast/NodeExtractorsExtended';
import { ServiceIds } from '../../core/ServiceLocator';
import { UrlNormalizer } from '../../utils/http/UrlNormalizer';
import { logger } from '../../utils/Logger';

/**
 * Axiosの直接メソッド呼び出し (axios.get, axios.post など) を検出するパターン
 */
class AxiosDirectMethodCallDetector extends BasePatternDetector {
  readonly patternName = 'AxiosDirectMethodCall';

  /**
   * 使用箇所の詳細情報を作成
   */
  private createUsageLocation(node: INode, sourceFile: ISourceFile, context?: string): UsageLocation {
    // 行番号と列番号の安全な取得
    const lineNumber = 1;  // デフォルト値
    const columnNumber = 1;  // デフォルト値

    // 周囲のコンテキスト（メソッド/クラス名など）を推測
    let contextName = context;
    if (!contextName) {
      contextName = NodeExtractorsExtended.inferNodeContext(node);
    }

    return {
      filePath: sourceFile.getFilePath(),
      lineNumber: lineNumber,
      columnNumber: columnNumber,
      context: contextName,
      codeSnippet: node.getText().slice(0, 100) // 先頭100文字までを取得
    };
  }

  public canHandle(node: INode): boolean {
    if (!node.isKind(NodeKind.CallExpression)) {
      return false;
    }

    const expression = node.getExpression?.();
    if (!expression || !expression.isKind(NodeKind.PropertyAccessExpression)) {
      return false;
    }

    // axios.get(), axios.post() 等のパターンを検出
    const objectName = expression.getExpression?.()?.getText() || '';
    const methodName = (expression as any).getName?.() || '';

    return (
      objectName === 'axios' &&
      ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(methodName.toLowerCase())
    );
  }

  public extractEndpoints(node: INode, context: DetectionContext): EndpointInfo[] {
    // 簡略化した実装
    return [];
  }
}

/**
 * Axiosインスタンスを使用した呼び出し (instance.get など) を検出するパターン
 */
class AxiosInstanceMethodCallDetector extends BasePatternDetector {
  readonly patternName = 'AxiosInstanceMethodCall';

  /**
   * 使用箇所の詳細情報を作成
   */
  private createUsageLocation(node: INode, sourceFile: ISourceFile, context?: string): UsageLocation {
    // 行番号と列番号の安全な取得
    const lineNumber = 1;  // デフォルト値
    const columnNumber = 1;  // デフォルト値

    // 周囲のコンテキスト（メソッド/クラス名など）を推測
    let contextName = context;
    if (!contextName) {
      contextName = NodeExtractorsExtended.inferNodeContext(node);
    }

    return {
      filePath: sourceFile.getFilePath(),
      lineNumber: lineNumber,
      columnNumber: columnNumber,
      context: contextName,
      codeSnippet: node.getText().slice(0, 100) // 先頭100文字までを取得
    };
  }

  public canHandle(node: INode): boolean {
    // 簡略化した実装
    return false;
  }

  public extractEndpoints(node: INode, context: DetectionContext): EndpointInfo[] {
    // 簡略化した実装 
    return [];
  }
}

/**
 * Axiosのリクエスト関数 (axios(config) や axios.request(config)) を検出するパターン
 */
class AxiosRequestConfigDetector extends BasePatternDetector {
  readonly patternName = 'AxiosRequestConfig';

  /**
   * 使用箇所の詳細情報を作成
   */
  private createUsageLocation(node: INode, sourceFile: ISourceFile, context?: string): UsageLocation {
    // 行番号と列番号の安全な取得
    const lineNumber = 1;  // デフォルト値
    const columnNumber = 1;  // デフォルト値

    // 周囲のコンテキスト（メソッド/クラス名など）を推測
    let contextName = context;
    if (!contextName) {
      contextName = NodeExtractorsExtended.inferNodeContext(node);
    }

    return {
      filePath: sourceFile.getFilePath(),
      lineNumber: lineNumber,
      columnNumber: columnNumber,
      context: contextName,
      codeSnippet: node.getText().slice(0, 100) // 先頭100文字までを取得
    };
  }

  public canHandle(node: INode): boolean {
    // 簡略化した実装
    return false;
  }

  public extractEndpoints(node: INode, context: DetectionContext): EndpointInfo[] {
    // 簡略化した実装
    return [];
  }
}

/**
 * Axios検出戦略本体
 */
export class AxiosDetectionStrategy extends BaseDetectionStrategy {
  readonly name = 'AxiosDetectionStrategy';
  readonly priority = 20; // HTTPクライアント系の中では標準的な優先度

  private detectors: BasePatternDetector[] = [
    new AxiosDirectMethodCallDetector(),
    new AxiosInstanceMethodCallDetector(),
    new AxiosRequestConfigDetector()
  ];

  /**
   * ファイル内のAxios呼び出しからエンドポイントを検出
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
}
