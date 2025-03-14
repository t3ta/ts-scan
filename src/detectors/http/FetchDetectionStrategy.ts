/**
 * Fetch API 検出戦略
 *
 * ブラウザ標準のFetch APIを使用したHTTPリクエストを検出し、
 * エンドポイント情報を抽出します。様々な呼び出しパターンに対応します。
 */

import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import { BaseDetectionStrategy } from '../common/BaseDetectionStrategy';
import { BasePatternDetector } from '../common/PatternDetector';
import { EndpointInfo, DetectionContext, HttpMethod, UsageLocation, ParameterUsage, ResponseUsage } from '../../types';
import { NodePredicates } from '../../utils/ast/NodePredicates';
import { NodeExtractors } from '../../utils/ast/NodeExtractors';
import { NodeExtractorsExtended } from '../../utils/ast/NodeExtractorsExtended';
import { ServiceIds } from '../../core/ServiceLocator';
import { MethodInference } from '../../utils/http/MethodInference';
import { logger } from '../../utils/Logger';

/**
 * 標準的なfetch呼び出しを検出するパターン
 */
class StandardFetchCallDetector extends BasePatternDetector {
  readonly patternName = 'StandardFetchCall';

  /**
   * 標準的なfetch呼び出しを検出
   */
  public canHandle(node: Node): boolean {
    if (!node.isKind(SyntaxKind.CallExpression)) {
      return false;
    }

    const expression = node.getExpression();

    // パターン1: fetch(url, options)
    if (expression.getText() === 'fetch') {
      return true;
    }

    // パターン2: window.fetch(url, options)
    if (
      expression.isKind(SyntaxKind.PropertyAccessExpression) &&
      expression.getExpression().getText() === 'window' &&
      expression.getName() === 'fetch'
    ) {
      return true;
    }

    // パターン3: self.fetch(url, options)
    if (
      expression.isKind(SyntaxKind.PropertyAccessExpression) &&
      expression.getExpression().getText() === 'self' &&
      expression.getName() === 'fetch'
    ) {
      return true;
    }

    // パターン4: global.fetch(url, options)
    if (
      expression.isKind(SyntaxKind.PropertyAccessExpression) &&
      expression.getExpression().getText() === 'global' &&
      expression.getName() === 'fetch'
    ) {
      return true;
    }

    return false;
  }

  /**
   * fetch呼び出しからエンドポイント情報を抽出
   */
  public extractEndpoints(node: Node, context: DetectionContext): EndpointInfo[] {
    if (!Node.isCallExpression(node)) {
      return [];
    }

    const callExpr = node;
    const args = callExpr.getArguments();

    if (args.length === 0) {
      return [];
    }

    // URLを抽出 (第1引数)
    const urlArg = args[0];
    const urlValue = NodeExtractorsExtended.extractStringValue(urlArg);

    if (!urlValue) {
      return [];
    }

    // 使用箇所情報の作成
    const location = this.createUsageLocation(node, context.sourceFile);

    // デフォルトのHTTPメソッドはGET
    let methodValue: HttpMethod = 'GET';
    let params: ParameterUsage[] = [];

    // オプション引数がある場合、メソッドとパラメータを抽出
    if (args.length > 1 && args[1].isKind(SyntaxKind.ObjectLiteralExpression)) {
      const optionsObj = args[1];

      // methodプロパティからHTTPメソッドを抽出
      const methodNode = NodeExtractorsExtended.extractPropertyValue(optionsObj, 'method');
      if (methodNode) {
        const methodText = NodeExtractorsExtended.extractStringValue(methodNode);
        if (methodText) {
          methodValue = methodText.toUpperCase() as HttpMethod;
        }
      }

      // bodyプロパティからリクエストボディを抽出
      const bodyNode = NodeExtractorsExtended.extractPropertyValue(optionsObj, 'body');
      if (bodyNode) {
        // JSONオブジェクトを解析して取得
        if (bodyNode.isKind?.(SyntaxKind.ObjectLiteralExpression)) {
          const bodyProps = NodeExtractorsExtended.extractObjectProperties(bodyNode);

          params = [...params, ...bodyProps.map((prop: { name: string }) => ({
            name: prop.name,
            type: 'body' as 'body' | 'path' | 'query' | 'header' | 'unknown',
            locations: [location]
          }))];
        }

        // 直接オブジェクトリテラルの場合
        if (bodyNode.isKind(SyntaxKind.ObjectLiteralExpression)) {
          const objProps = NodeExtractorsExtended.extractObjectProperties(bodyNode);

          params = [
            ...params,
            ...objProps.map((prop: { name: string }) => ({
              name: prop.name,
              type: 'body' as 'body' | 'path' | 'query' | 'header' | 'unknown',
              locations: [location]
            }))
          ];
        }
      }

      // headersプロパティからヘッダーを抽出
      const headersNode = NodeExtractorsExtended.extractPropertyValue(optionsObj, 'headers');
      if (headersNode && headersNode.isKind?.(SyntaxKind.ObjectLiteralExpression)) {
        const headerProps = NodeExtractorsExtended.extractObjectProperties(headersNode);

        params = [
          ...params,
          ...headerProps.map((prop: { name: string }) => ({
            name: prop.name,
            type: 'header' as 'body' | 'path' | 'query' | 'header' | 'unknown',
            locations: [location]
          }))
        ];
      }
    }

    // URLからクエリパラメータを抽出
    const queryParams = NodeExtractorsExtended.extractQueryParameters(urlValue);
    for (const paramName of queryParams) {
      params.push({
        name: paramName,
        type: 'query' as 'body' | 'path' | 'query' | 'header' | 'unknown',
        locations: [location]
      });
    }

    // URLからパスパラメータを抽出
    const pathParams = NodeExtractors.extractPathParameters(urlValue);
    for (const paramName of pathParams) {
      params.push({
        name: paramName,
        type: 'path' as 'body' | 'path' | 'query' | 'header' | 'unknown',
        required: true,
        locations: [location]
      });
    }

    // レスポンス処理の情報を抽出
    let responseHandling: ResponseUsage[] = [];

    // thenメソッドチェーンを検出
    const parentChain = NodeExtractorsExtended.findMethodChain(node);
    if (parentChain) {
      let foundFirstThen = false;
      let foundJsonMethod = false;

      for (const chainNode of parentChain) {
        // .json()メソッドを検出
        if (NodePredicates.isMethodCall?.(chainNode, 'json')) {
          foundJsonMethod = true;
        }

        // thenメソッドを検出
        if (NodePredicates.isMethodCall?.(chainNode, 'then')) {
          const thenArgs = chainNode.isKind(SyntaxKind.CallExpression) ? chainNode.getArguments() : [];

          if (thenArgs.length > 0) {
            // 最初のthenは通常レスポンスオブジェクトを解析する処理
            if (!foundFirstThen) {
              foundFirstThen = true;

              // .json()を呼んでいるかチェック
              if (foundJsonMethod) {
                responseHandling.push({
                  type: 'transformation',
                  location: location
                });
              }
            } else {
              // 2番目以降のthenはレスポンスデータ処理
              const callbackBody = NodeExtractorsExtended.extractCallbackBody(thenArgs[0]);

              if (callbackBody) {
                // 型付け情報を探す
                const typeInfo = NodeExtractorsExtended.extractTypeAnnotation(callbackBody);

                if (typeInfo && typeInfo.length > 0) {
                  responseHandling.push({
                    type: 'typed',
                    typeName: typeInfo[0].typeName,
                    location: location
                  });
                } else {
                  // 変換処理のあるレスポンス処理を検出
                  const transformationDetected = NodeExtractorsExtended.detectResponseTransformation(callbackBody);

                  responseHandling.push({
                    type: transformationDetected ? 'transformation' : 'direct',
                    location: location
                  });
                }
              }
            }
          }
        }
      }
    }

    // async/awaitパターンの検出
    if (responseHandling.length === 0) {
      // 簡略化された実装: async/awaitパターンの検出は複雑なため、
      // デフォルトではレスポンス処理不明として処理
      responseHandling.push({
        type: 'unknown',
        location: location
      });
    }

    // エンドポイント情報の構築
    const endpointBuilder = context.serviceLocator?.resolve<any>(ServiceIds.ENDPOINT_BUILDER);

    if (!endpointBuilder) {
      return [];
    }

    const endpoint = endpointBuilder.buildEndpoint(
      urlValue,
      methodValue,
      location,
      params,
      responseHandling,
      'fetch'
    );

    return [endpoint];
  }

  /**
   * 使用箇所の詳細情報を作成
   */
  private createUsageLocation(node: Node, sourceFile: SourceFile, context?: string): UsageLocation {
    // 行番号と列番号のデフォルト値を設定
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
}

/**
 * カスタムfetch関数呼び出し（ラッパー関数など）を検出するパターン
 */
class CustomFetchWrapperDetector extends BasePatternDetector {
  readonly patternName = 'CustomFetchWrapper';

  /**
   * カスタムfetchラッパー関数呼び出しを検出
   */
  public canHandle(node: Node): boolean {
    if (!node.isKind(SyntaxKind.CallExpression)) {
      return false;
    }

    const expression = node.getExpression();
    const functionName = expression.getText();

    // fetchっぽい名前を持つ関数呼び出しを検出
    return (
      functionName !== 'fetch' &&
      functionName !== 'window.fetch' &&
      functionName !== 'self.fetch' &&
      functionName !== 'global.fetch' &&
      (
        functionName.includes('fetch') ||
        functionName.includes('request') ||
        functionName.includes('http') ||
        functionName.includes('api') ||
        functionName.includes('call')
      )
    );
  }

  /**
   * カスタムfetchラッパーからエンドポイント情報を抽出
   * 簡略化した実装に変更
   */
  public extractEndpoints(node: Node, context: DetectionContext): EndpointInfo[] {
    if (!Node.isCallExpression(node)) {
      return [];
    }

    const callExpr = node;
    const args = callExpr.getArguments();

    if (args.length === 0) {
      return [];
    }

    // 関数名からHTTPメソッドを推測
    const functionName = (callExpr.getExpression && callExpr.getExpression()) ?
                         callExpr.getExpression().getText() : '';
    const methodValue = MethodInference.inferMethodFromName(functionName);

    // 最初の引数がURL文字列である可能性を確認
    const firstArg = args[0];
    const urlValue = NodeExtractorsExtended.extractStringValue(firstArg);

    if (!urlValue) {
      return [];
    }

    // 使用箇所情報の作成
    const location = this.createUsageLocation(callExpr, context.sourceFile);

    // パラメータの抽出
    let params: ParameterUsage[] = [];

    // URLからクエリパラメータとパスパラメータを抽出
    const queryParams = NodeExtractorsExtended.extractQueryParameters(urlValue);
    for (const paramName of queryParams) {
      params.push({
        name: paramName,
        type: 'query' as 'body' | 'path' | 'query' | 'header' | 'unknown',
        locations: [location]
      });
    }

    const pathParams = NodeExtractors.extractPathParameters(urlValue);
    for (const paramName of pathParams) {
      params.push({
        name: paramName,
        type: 'path' as 'body' | 'path' | 'query' | 'header' | 'unknown',
        required: true,
        locations: [location]
      });
    }

    // レスポンス処理情報
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
      methodValue,
      location,
      params,
      responseHandling,
      'fetch'
    );

    return [endpoint];
  }

  /**
   * 使用箇所の詳細情報を作成
   */
  private createUsageLocation(node: Node, sourceFile: SourceFile, context?: string): UsageLocation {
    // 行番号と列番号のデフォルト値を設定
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
}

/**
 * Fetch API検出戦略本体
 */
export class FetchDetectionStrategy extends BaseDetectionStrategy {
  readonly name = 'FetchDetectionStrategy';
  readonly priority = 10; // 最も基本的なHTTP呼び出しなので最も高い優先度を設定

  private detectors: BasePatternDetector[] = [
    new StandardFetchCallDetector(),
    new CustomFetchWrapperDetector()
  ];

  /**
   * ファイル内のFetch呼び出しからエンドポイントを検出
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
}
