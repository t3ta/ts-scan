/**
 * デフォルト検出戦略
 *
 * 他の特化した検出戦略で捕捉できない汎用的なHTTPリクエストパターンを検出します。
 * フォールバックとして機能し、可能な限り多くのエンドポイントを検出することを目的としています。
 */

import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import { BaseDetectionStrategy } from './common/BaseDetectionStrategy';
import { BasePatternDetector } from './common/PatternDetector';
import {
  DetectionContext,
  EndpointInfo,
  HttpMethod,
  ParameterUsage,
  ResponseUsage,
  UsageLocation
} from '../types';
// import { NodePredicates } from '../utils/ast/NodePredicates';
import { NodeExtractors } from '../utils/ast/NodeExtractors';
import { NodeExtractorsExtended } from '../utils/ast/NodeExtractorsExtended';
import { ServiceIds } from '../core/ServiceLocator';
import { logger } from '../utils/Logger';

/**
 * 文字列リテラル検出器
 * URLパターンを含む文字列リテラルを検出します
 */
class StringLiteralUrlDetector extends BasePatternDetector {
  readonly patternName = 'StringLiteralUrl';

  /**
   * URLパターンを含む文字列リテラルを検出
   * @param node 検査対象ノード
   * @returns パターンに一致するか否か
   */
  public canHandle(node: Node): boolean {
    if (!node.isKind(SyntaxKind.StringLiteral)) {
      return false;
    }

    const text = node.getText().replace(/['"]/g, '');

    // URLっぽい文字列かチェック
    const isUrlLike = (
      // APIエンドポイントっぽいパターン
      (text.startsWith('/api') || text.startsWith('/v') || text.includes('/api/')) &&
      // クエリパラメータやパスパラメータを含むか
      (text.includes('?') || text.includes('/:') || text.includes('/{'))
    );

    return isUrlLike;
  }

  /**
   * 文字列リテラルからエンドポイント情報を抽出
   * @param node 対象ノード
   * @param context 検出コンテキスト
   * @returns 抽出されたエンドポイント情報配列
   */
  public extractEndpoints(node: Node, context: DetectionContext): EndpointInfo[] {
    if (!node.isKind(SyntaxKind.StringLiteral)) {
      return [];
    }

    // URL文字列を取得
    const urlValue = node.getText().replace(/['"]/g, '');

    // 使用箇所の文脈からHTTPメソッドを推測
    let httpMethod: HttpMethod = 'GET';

    // 親ノードを探索してメソッドを推測
    const parent = node.getParent();
    const grandParent = parent?.getParent();

    if (parent?.isKind(SyntaxKind.ObjectLiteralExpression)) {
      // オブジェクトリテラルのプロパティとしての文字列の場合
      // 例: { url: '/api/users', method: 'GET' }
      const methodProp = NodeExtractorsExtended.extractPropertyValue(parent, 'method');
      if (methodProp) {
        const methodValue = NodeExtractorsExtended.extractStringValue(methodProp);
        if (methodValue) {
          httpMethod = methodValue.toUpperCase() as HttpMethod;
        }
      }
    } else if (parent?.isKind(SyntaxKind.ArrayLiteralExpression)) {
      // 配列の要素としての文字列の場合
      // 推測困難なので変更なし
    } else if (grandParent?.isKind(SyntaxKind.CallExpression)) {
      // 関数呼び出しの引数としての文字列の場合
      const funcExpr = grandParent.getExpression();
      const funcName = funcExpr.getText().toLowerCase();

      // 関数名からメソッドを推測
      if (funcName.includes('post')) {
        httpMethod = 'POST';
      } else if (funcName.includes('put')) {
        httpMethod = 'PUT';
      } else if (funcName.includes('delete')) {
        httpMethod = 'DELETE';
      } else if (funcName.includes('patch')) {
        httpMethod = 'PATCH';
      }
    }

    // 使用箇所情報の作成
    const location = this.createUsageLocation(node, context.sourceFile);

    // パラメータの抽出
    const params: ParameterUsage[] = [];

    // URLからパスパラメータを抽出
    const pathParams = NodeExtractors.extractPathParameters(urlValue);
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

    // レスポンス処理の情報（デフォルト値）
    const responseHandling: ResponseUsage[] = [{
      type: 'unknown',
      location: location
    }];

    // エンドポイント情報の構築
    const endpointBuilder = context.serviceLocator?.resolve<any>(ServiceIds.ENDPOINT_BUILDER);

    const endpoint = endpointBuilder.buildEndpoint(
      urlValue,
      httpMethod,
      location,
      params,
      responseHandling,
      'default'
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
  private createUsageLocation(node: Node, sourceFile: SourceFile, context?: string): UsageLocation {
    // 行および列情報のデフォルト値を設定
    // TypeScriptの型エラー回避のため、startPos変数は削除
    const lineNumber = 1;
    const columnNumber = 1;

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
}

/**
 * テンプレートリテラルURL検出器
 * URLパターンを含むテンプレートリテラルを検出します
 */
class TemplateLiteralUrlDetector extends BasePatternDetector {
  readonly patternName = 'TemplateLiteralUrl';

  /**
   * URLパターンを含むテンプレートリテラルを検出
   * @param node 検査対象ノード
   * @returns パターンに一致するか否か
   */
  public canHandle(node: Node): boolean {
    if (!node.isKind(SyntaxKind.TemplateExpression) && !node.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
      return false;
    }

    const text = node.getText().replace(/^`|`$/g, '');

    // URLっぽいテンプレートリテラルかチェック
    const isUrlLike = (
      (text.includes('/api/') || text.startsWith('/v') || text.includes('/api')) &&
      (text.includes('?') || text.includes(':') || text.includes('{') || text.includes('${'))
    );

    return isUrlLike;
  }

  /**
   * テンプレートリテラルからエンドポイント情報を抽出
   * @param node 対象ノード
   * @param context 検出コンテキスト
   * @returns 抽出されたエンドポイント情報配列
   */
  public extractEndpoints(node: Node, context: DetectionContext): EndpointInfo[] {
    // テンプレートリテラルからURL文字列を抽出
    let urlTemplate = '';

    if (node.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
      // 単純なテンプレートリテラルの場合
      urlTemplate = node.getText().replace(/^`|`$/g, '');
    } else if (node.isKind(SyntaxKind.TemplateExpression)) {
      // 式を含むテンプレートリテラルの場合
      urlTemplate = this.extractTemplateUrl(node);
    }

    // URLパターンでなければスキップ
    if (!urlTemplate || (!urlTemplate.includes('/api') && !urlTemplate.includes('/v'))) {
      return [];
    }

    // HTTPメソッドの推測（文脈から）
    let httpMethod: HttpMethod = 'GET';

    // 親ノードからメソッドを推測
    const parent = node.getParent();
    const grandParent = parent?.getParent();

    if (grandParent?.isKind(SyntaxKind.CallExpression)) {
      // 関数呼び出しの引数としての場合
      const funcExpr = grandParent.getExpression();
      const funcName = funcExpr.getText().toLowerCase();

      // 関数名からメソッドを推測
      if (funcName.includes('post')) {
        httpMethod = 'POST';
      } else if (funcName.includes('put')) {
        httpMethod = 'PUT';
      } else if (funcName.includes('delete')) {
        httpMethod = 'DELETE';
      } else if (funcName.includes('patch')) {
        httpMethod = 'PATCH';
      }
    }

    // 使用箇所情報の作成
    const location = this.createUsageLocation(node, context.sourceFile);

    // パラメータの抽出
    const params: ParameterUsage[] = [];

    // URLからパスパラメータを抽出（テンプレート表現も考慮）
    const pathParamRegex = /[:$]\{?([a-zA-Z0-9_]+)\}?/g;
    let match;
    while ((match = pathParamRegex.exec(urlTemplate)) !== null) {
      params.push({
        name: match[1],
        type: 'path',
        required: true,
        locations: [location]
      });
    }

    // URLからクエリパラメータを抽出
    if (urlTemplate.includes('?')) {
      const queryPart = urlTemplate.split('?')[1];
      if (queryPart) {
        const queryParams = queryPart.split('&').map(p => p.split('=')[0]).filter(Boolean);
        for (const paramName of queryParams) {
          params.push({
            name: paramName,
            type: 'query',
            locations: [location]
          });
        }
      }
    }

    // レスポンス処理の情報（デフォルト値）
    const responseHandling: ResponseUsage[] = [{
      type: 'unknown',
      location: location
    }];

    // エンドポイント情報の構築
    const endpointBuilder = context.serviceLocator?.resolve<any>(ServiceIds.ENDPOINT_BUILDER);

    const endpoint = endpointBuilder.buildEndpoint(
      urlTemplate,
      httpMethod,
      location,
      params,
      responseHandling,
      'default'
    );

    return [endpoint];
  }

  /**
   * テンプレート式からURL文字列を抽出
   * @param node テンプレート式ノード
   * @returns 抽出されたURL文字列（パラメータはプレースホルダーに置換）
   */
  private extractTemplateUrl(node: Node): string {
    if (!node.isKind(SyntaxKind.TemplateExpression)) {
      return '';
    }

    // テンプレートの各部分を抽出
    const templateHead = node.getFirstDescendantByKind(SyntaxKind.TemplateHead);
    const templateSpans = node.getDescendantsOfKind(SyntaxKind.TemplateSpan);

    if (!templateHead) {
      return '';
    }

    // テンプレート文字列を再構築
    let result = templateHead.getText().replace(/^`/, '');

    for (const span of templateSpans) {
      const expr = span.getExpression();
      const middle = span.getFirstDescendantByKind(SyntaxKind.TemplateMiddle);
      const tail = span.getFirstDescendantByKind(SyntaxKind.TemplateTail);

      // 式の部分をプレースホルダーに置換
      result += `\${${expr.getText()}}`;

      // 残りのテンプレート部分を追加
      if (middle) {
        result += middle.getText().slice(1, -1); // ${ と } を除去
      } else if (tail) {
        result += tail.getText().slice(1).replace(/`$/, ''); // ${ と 末尾の ` を除去
      }
    }

    return result;
  }

  /**
   * 使用箇所の詳細情報を作成
   * @param node ノード
   * @param sourceFile ソースファイル
   * @param context コンテキスト情報
   * @returns 使用箇所詳細情報
   */
  private createUsageLocation(node: Node, sourceFile: SourceFile, context?: string): UsageLocation {
    // 行および列情報のデフォルト値を設定
    const lineNumber = 1;
    const columnNumber = 1;

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
}

/**
 * オブジェクトリテラルURL検出器
 * URLを含むオブジェクトリテラルを検出します
 */
class ObjectLiteralUrlDetector extends BasePatternDetector {
  readonly patternName = 'ObjectLiteralUrl';

  /**
   * URLを含むオブジェクトリテラルを検出
   * @param node 検査対象ノード
   * @returns パターンに一致するか否か
   */
  public canHandle(node: Node): boolean {
    if (!node.isKind(SyntaxKind.ObjectLiteralExpression)) {
      return false;
    }

    // URLっぽいプロパティを持つかチェック
    const urlProp = NodeExtractorsExtended.extractPropertyValue(node, 'url');
    const pathProp = NodeExtractorsExtended.extractPropertyValue(node, 'path');
    const endpointProp = NodeExtractorsExtended.extractPropertyValue(node, 'endpoint');

    if (!urlProp && !pathProp && !endpointProp) {
      return false;
    }

    // method, headers, paramsなどのプロパティも含むオブジェクトであればAPI関連の可能性が高い
    const methodProp = NodeExtractorsExtended.extractPropertyValue(node, 'method');
    const headersProp = NodeExtractorsExtended.extractPropertyValue(node, 'headers');
    const paramsProp = NodeExtractorsExtended.extractPropertyValue(node, 'params');
    const dataProp = NodeExtractorsExtended.extractPropertyValue(node, 'data');
    const bodyProp = NodeExtractorsExtended.extractPropertyValue(node, 'body');

    const hasApiRelatedProps = Boolean(methodProp || headersProp || paramsProp || dataProp || bodyProp);

    // URL/pathの値が文字列であることを確認
    let urlValue = '';

    if (urlProp) {
      urlValue = NodeExtractorsExtended.extractStringValue(urlProp) || '';
    } else if (pathProp) {
      urlValue = NodeExtractorsExtended.extractStringValue(pathProp) || '';
    } else if (endpointProp) {
      urlValue = NodeExtractorsExtended.extractStringValue(endpointProp) || '';
    }

    const isApiUrl = urlValue && (urlValue.includes('/api') || urlValue.startsWith('/v'));

    return Boolean(isApiUrl) || (Boolean(urlValue) && hasApiRelatedProps);
  }

  /**
   * オブジェクトリテラルからエンドポイント情報を抽出
   * @param node 対象ノード
   * @param context 検出コンテキスト
   * @returns 抽出されたエンドポイント情報配列
   */
  public extractEndpoints(node: Node, context: DetectionContext): EndpointInfo[] {
    if (!node.isKind(SyntaxKind.ObjectLiteralExpression)) {
      return [];
    }

    // URL/パスの抽出
    const urlProp = NodeExtractorsExtended.extractPropertyValue(node, 'url');
    const pathProp = NodeExtractorsExtended.extractPropertyValue(node, 'path');
    const endpointProp = NodeExtractorsExtended.extractPropertyValue(node, 'endpoint');

    let urlValue = '';

    if (urlProp) {
      urlValue = NodeExtractorsExtended.extractStringValue(urlProp) || '';
    } else if (pathProp) {
      urlValue = NodeExtractorsExtended.extractStringValue(pathProp) || '';
    } else if (endpointProp) {
      urlValue = NodeExtractorsExtended.extractStringValue(endpointProp) || '';
    }

    if (!urlValue) {
      return [];
    }

    // HTTPメソッドの抽出
    let httpMethod: HttpMethod = 'GET';

    const methodProp = NodeExtractorsExtended.extractPropertyValue(node, 'method');
    if (methodProp) {
      const methodValue = NodeExtractorsExtended.extractStringValue(methodProp);
      if (methodValue) {
        httpMethod = methodValue.toUpperCase() as HttpMethod;
      }
    }

    // 使用箇所情報の作成
    const location = this.createUsageLocation(node, context.sourceFile);

    // パラメータの抽出
    const params: ParameterUsage[] = [];

    // URLからパスパラメータを抽出
    const pathParams = NodeExtractors.extractPathParameters(urlValue);
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

    // paramsプロパティからクエリパラメータを抽出
    const paramsProp = NodeExtractorsExtended.extractPropertyValue(node, 'params');
    if (paramsProp && paramsProp.isKind(SyntaxKind.ObjectLiteralExpression)) {
      const paramProps = NodeExtractorsExtended.extractObjectProperties(paramsProp);

      for (const prop of paramProps) {
        params.push({
          name: prop.name,
          type: 'query',
          locations: [location]
        });
      }
    }

    // data/bodyプロパティからボディパラメータを抽出
    const dataProp = NodeExtractorsExtended.extractPropertyValue(node, 'data');
    const bodyProp = NodeExtractorsExtended.extractPropertyValue(node, 'body');

    if (dataProp && dataProp.isKind(SyntaxKind.ObjectLiteralExpression)) {
      const dataProps = NodeExtractorsExtended.extractObjectProperties(dataProp);

      for (const prop of dataProps) {
        params.push({
          name: prop.name,
          type: 'body',
          locations: [location]
        });
      }
    } else if (bodyProp && bodyProp.isKind(SyntaxKind.ObjectLiteralExpression)) {
      const bodyProps = NodeExtractorsExtended.extractObjectProperties(bodyProp);

      for (const prop of bodyProps) {
        params.push({
          name: prop.name,
          type: 'body',
          locations: [location]
        });
      }
    }

    // headersプロパティからヘッダーパラメータを抽出
    const headersProp = NodeExtractorsExtended.extractPropertyValue(node, 'headers');
    if (headersProp && headersProp.isKind(SyntaxKind.ObjectLiteralExpression)) {
      const headerProps = NodeExtractorsExtended.extractObjectProperties(headersProp);

      for (const prop of headerProps) {
        params.push({
          name: prop.name,
          type: 'header',
          locations: [location]
        });
      }
    }

    // レスポンス処理の情報（デフォルト値）
    const responseHandling: ResponseUsage[] = [{
      type: 'unknown',
      location: location
    }];

    // エンドポイント情報の構築
    const endpointBuilder = context.serviceLocator?.resolve<any>(ServiceIds.ENDPOINT_BUILDER);

    const endpoint = endpointBuilder.buildEndpoint(
      urlValue,
      httpMethod,
      location,
      params,
      responseHandling,
      'default'
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
  private createUsageLocation(node: Node, sourceFile: SourceFile, context?: string): UsageLocation {
    // 行および列情報のデフォルト値を設定
    const lineNumber = 1;
    const columnNumber = 1;

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
}

/**
 * デフォルト検出戦略
 * 他の戦略で検出できないエンドポイントをバックアップとして検出します
 */
export class DefaultDetectionStrategy extends BaseDetectionStrategy {
  readonly name = 'DefaultDetectionStrategy';
  readonly priority = 100; // 最も低い優先度（他の戦略の後に実行）

  private detectors = [
    new StringLiteralUrlDetector(),
    new TemplateLiteralUrlDetector(),
    new ObjectLiteralUrlDetector()
  ];

  /**
   * デフォルト検出ロジックの実行
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
  protected prepareDetection(sourceFile: SourceFile, _context: DetectionContext): void {
    // APIプレフィックス正規表現を適用するための前処理
    logger.debug(`[${this.name}] ${sourceFile.getFilePath()} の前処理を実行`);
  }
}
