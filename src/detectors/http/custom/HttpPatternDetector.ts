/**
 * HTTP固有パターン検出器
 *
 * 特定のHTTPリクエストパターンを検出し、エンドポイント情報を抽出します。
 * カスタムHTTPクライアントに特化した検出ロジックを提供します。
 */

// ts-morphの直接インポートを避け、抽象インターフェースのみを使用するのだ
import { INode, NodeKind } from '../../../core/ast/interfaces/INode';
import { ISourceFile } from '../../../core/ast/interfaces/ISourceFile';
import { BasePatternDetector } from '../../common/PatternDetector';
import {
  DetectionContext,
  EndpointInfo,
  HttpMethod,
  ParameterType,
  ParameterUsage,
  ResponseUsage,
  UsageLocation
} from '../../../types';
import { NodePredicates } from '../../../utils/ast/NodePredicates';
import { NodeExtractorsExtended } from '../../../utils/ast/NodeExtractorsExtended';
import { MethodInference } from '../../../utils/http/MethodInference';
import { ServiceIds } from '../../../core/ServiceLocator';
import { logger } from '../../../utils/Logger';

/**
 * HTTP固有パターン検出器
 * プロジェクト固有のHTTPリクエストパターンを検出します
 */
export class HttpPatternDetector extends BasePatternDetector {
  readonly patternName = 'HttpPattern';

  /**
   * HTTP固有パターンを検出
   * @param node 検査対象ノード
   * @returns パターンに一致するか否か
   */
  public canHandle(node: INode): boolean {
    if (!node.isKind(NodeKind.CallExpression)) {
      return false;
    }

    const expression = node.getExpression?.();
    if (!expression) return false;

    // HTTP固有パターンのチェック
    // 1. フルパス関数呼び出し: callApi('/api/users', options)
    if (expression.isKind(NodeKind.Identifier)) {
      const funcName = expression.getText().toLowerCase();
      const isHttpLike = (
        funcName.includes('http') ||
        funcName.includes('api') ||
        funcName.includes('request') ||
        funcName.includes('call') ||
        funcName.includes('fetch')
      );

      if (isHttpLike) {
        return true;
      }
    }

    // 2. クラスメソッド呼び出し: this.http.get('/api/users')
    if (expression.isKind(NodeKind.PropertyAccessExpression)) {
      const propExpr = expression;
      const objExpr = propExpr.getExpression?.();
      if (!objExpr) return false;

      // this.http パターン
      if (objExpr.isKind(NodeKind.PropertyAccessExpression)) {
        const nestedObjExpr = objExpr;
        const nestedObj = nestedObjExpr.getExpression?.();
        if (!nestedObj) return false;

        if (nestedObj.getText() === 'this') {
          const propName = (nestedObjExpr as any).getName?.()?.toLowerCase() || '';

          const isHttpLike = (
            propName.includes('http') ||
            propName.includes('api') ||
            propName.includes('client') ||
            propName.includes('service')
          );

          if (isHttpLike) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * HTTP固有パターンからエンドポイント情報を抽出
   * @param node 対象ノード
   * @param context 検出コンテキスト
   * @returns 抽出されたエンドポイント情報配列
   */
  public extractEndpoints(node: INode, context: DetectionContext): EndpointInfo[] {
    if (!node.isKind(NodeKind.CallExpression)) {
      return [];
    }

    // 引数を取得
    const args = node.getArguments?.() || [];

    if (args.length === 0) {
      return [];
    }

    // URL/パスを抽出（第一引数と仮定）
    const urlArg = args[0];
    const urlValue = NodeExtractorsExtended.extractStringValue(urlArg);

    if (!urlValue) {
      return [];
    }

    // HTTPメソッドを推測
    let httpMethod: HttpMethod = 'GET';

    // 1. 関数名/メソッド名からHTTPメソッドを推測
    const expression = node.getExpression?.();
    if (!expression) return [];

    if (expression.isKind(NodeKind.Identifier)) {
      // 通常の関数呼び出しの場合
      const funcName = expression.getText();
      httpMethod = MethodInference.inferMethodFromName(funcName);
    } else if (expression.isKind(NodeKind.PropertyAccessExpression)) {
      // メソッド呼び出しの場合
      const methodName = (expression as any).getName?.() || '';

      if (['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(methodName.toLowerCase())) {
        httpMethod = methodName.toUpperCase() as HttpMethod;
      } else {
        httpMethod = MethodInference.inferMethodFromName(methodName);
      }
    }

    // 使用箇所情報の作成
    const location = this.createUsageLocation(node, context.sourceFile);

    // パラメータの抽出
    const params: ParameterUsage[] = [];

    // URLからパスパラメータを抽出
    const pathParams = NodeExtractorsExtended.extractPathParameters(urlValue);
    for (const paramName of pathParams) {
      params.push({
        name: paramName,
        type: 'path',
        required: true,
        locations: [location]
      });
    }

    // URLからクエリパラメータを抽出
    const queryParams = NodeExtractorsExtended.extractQueryParameters(urlValue);
    for (const paramName of queryParams) {
      params.push({
        name: paramName,
        type: 'query',
        locations: [location]
      });
    }

    // レスポンス処理の情報を抽出 - 簡略化バージョン
    const responseHandling: ResponseUsage[] = [{
      type: 'unknown',
      location: location
    }];

    // エンドポイント情報の構築
    const endpointBuilder = context.serviceLocator?.resolve<any>(ServiceIds.ENDPOINT_BUILDER);
    
    if (!endpointBuilder) {
      return [];
    }

    const endpoint = endpointBuilder.buildEndpoint(
      urlValue,
      httpMethod,
      location,
      params,
      responseHandling,
      'custom-client'
    );

    return [endpoint];
  }

  /**
   * 使用箇所の詳細情報を作成
   * @param node ノード
   * @param sourceFile ソースファイル
   * @param context コンテキスト情報
   * @returns 使用箇所詳細情報
   */
  private createUsageLocation(node: INode, sourceFile: ISourceFile, context?: string): UsageLocation {
    const location = node.getLocation?.() || { lineNumber: 1, columnNumber: 1 };

    // 周囲のコンテキスト（メソッド/クラス名など）を推測
    let contextName = context;
    if (!contextName) {
      contextName = NodeExtractorsExtended.inferNodeContext(node);
    }

    return {
      filePath: sourceFile.getFilePath(),
      lineNumber: location.lineNumber ?? 1, // デフォルト値を使用
      columnNumber: location.columnNumber ?? 1, // デフォルト値を使用
      context: contextName,
      codeSnippet: node.getText().slice(0, 100) // 先頭100文字までを取得
    };
  }
}
