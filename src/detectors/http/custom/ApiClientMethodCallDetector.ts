/**
 * APIクライアントメソッド呼び出し検出器
 *
 * カスタムAPIクライアントのメソッド呼び出しパターンを検出し、エンドポイント情報を抽出します。
 * 例: apiClient.get('/users'), httpService.fetchUsers() など様々なパターンに対応します。
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
import { NodeExtractors } from '../../../utils/ast/NodeExtractors';
import { NodeExtractorsExtended } from '../../../utils/ast/NodeExtractorsExtended';
import { MethodInference } from '../../../utils/http/MethodInference';
import { ServiceIds } from '../../../core/ServiceLocator';
// logger は警告が出ているが、将来的に使用する可能性があるため残しておく
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { logger } from '../../../utils/Logger';

/**
 * APIクライアントメソッド呼び出し検出器
 * 一般的なAPIクライアントパターンを検出します
 */
export class ApiClientMethodCallDetector extends BasePatternDetector {
  readonly patternName = 'ApiClientMethodCall';

  /**
   * APIクライアントメソッド呼び出しを検出
   * @param node 検査対象ノード
   * @returns パターンに一致するか否か
   */
  public canHandle(node: INode): boolean {
    if (!node.isKind(NodeKind.CallExpression)) {
      return false;
    }

    const expression = node.getExpression?.();
    if (!expression || !expression.isKind(NodeKind.PropertyAccessExpression)) {
      return false;
    }

    const objExpr = expression.getExpression?.();
    if (!objExpr) return false;

    const methodName = (expression as any).getName?.()?.toLowerCase() || '';

    // オブジェクト名がAPIクライアントっぽいかチェック
    const objName = objExpr.getText().toLowerCase();
    const isApiClientLike = (
      objName.includes('api') ||
      objName.includes('http') ||
      objName.includes('client') ||
      objName.includes('service') ||
      objName.includes('facade') ||
      objName.includes('gateway') ||
      objName.includes('repository')
    );

    if (!isApiClientLike) {
      return false;
    }

    // メソッド名が以下のいずれかに該当するかチェック
    // 1. HTTPメソッド名と一致
    const isHttpMethod = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(methodName);

    // 2. fetch/request/call で始まる
    const isRequestMethod = (
      methodName.startsWith('fetch') ||
      methodName.startsWith('get') ||
      methodName.startsWith('create') ||
      methodName.startsWith('update') ||
      methodName.startsWith('delete') ||
      methodName.startsWith('request') ||
      methodName.startsWith('call')
    );

    return isHttpMethod || isRequestMethod;
  }

  /**
   * APIクライアントメソッド呼び出しからエンドポイント情報を抽出
   * @param node 対象ノード
   * @param context 検出コンテキスト
   * @returns 抽出されたエンドポイント情報配列
   */
  public extractEndpoints(node: INode, context: DetectionContext): EndpointInfo[] {
    if (!node.isKind(NodeKind.CallExpression)) {
      return [];
    }

    const callExpr = node;
    const propExpr = callExpr.getExpression?.();

    if (!propExpr || !propExpr.isKind(NodeKind.PropertyAccessExpression)) {
      return [];
    }

    // オブジェクト名とメソッド名を取得
    const objExpr = propExpr.getExpression?.();
    if (!objExpr) return [];

    const methodName = (propExpr as any).getName?.() || '';
    const objName = objExpr.getText();

    // HTTPメソッドを取得/推測
    let httpMethod: HttpMethod;

    // 1. メソッド名がHTTPメソッドと一致する場合
    if (['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(methodName.toLowerCase())) {
      httpMethod = methodName.toUpperCase() as HttpMethod;
    } else {
      // 2. メソッド名からHTTPメソッドを推測
      httpMethod = MethodInference.inferMethodFromName(methodName);
    }

    // 引数を取得
    const args = callExpr.getArguments?.() || [];

    // URLを推測
    let urlValue: string | null = null;

    // 1. 第1引数が文字列リテラルの場合はURLとして扱う
    if (args.length > 0) {
      urlValue = NodeExtractorsExtended.extractStringValue(args[0]);
    }

    // 2. 文字列が見つからない場合はメソッド名からURLを推測
    if (!urlValue) {
      urlValue = this.inferUrlFromMethodName(methodName);
    }

    // URLが見つからない場合は検出不能
    if (!urlValue) {
      return [];
    }

    // 使用箇所情報の作成
    const location = this.createUsageLocation(node, context.sourceFile);

    // パラメータの抽出
    const params: ParameterUsage[] = [];

    // URLからパスパラメータとクエリパラメータを抽出
    const pathParams = NodeExtractors.extractPathParameters(urlValue);
    for (const paramName of pathParams) {
      params.push({
        name: paramName,
        type: 'path',
        required: true,
        locations: [location]
      });
    }

    const queryParams = NodeExtractorsExtended.extractQueryParameters(urlValue);
    for (const paramName of queryParams) {
      params.push({
        name: paramName,
        type: 'query',
        locations: [location]
      });
    }

    // 2番目以降の引数からパラメータを抽出
    if (args.length > 1) {
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];

        if (arg.isKind(NodeKind.ObjectLiteralExpression)) {
          const objProps = NodeExtractorsExtended.extractObjectProperties(arg);

          // POSTやPUTの第2引数はデータ本体、GETの第2引数はクエリパラメータと推測
          const paramType: ParameterType = (httpMethod === 'GET') ? 'query' : 'body';

          for (const prop of objProps) {
            params.push({
              name: prop.name,
              type: paramType,
              locations: [location]
            });
          }
        }
      }
    }

    // レスポンス処理の情報を抽出
    const responseHandling = this.extractResponseHandling(node, location);

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
   * レスポンス処理情報を抽出する
   * @param node 対象ノード
   * @param location 使用箇所情報
   * @returns レスポンス処理情報
   */
  private extractResponseHandling(node: INode, location: UsageLocation): ResponseUsage[] {
    // 簡易版レスポンス処理情報
    return [{
      type: 'unknown',
      location: location
    }];
  }

  /**
   * メソッド名からURLを推測
   * @param methodName メソッド名
   * @returns 推測されたURL
   */
  private inferUrlFromMethodName(methodName: string): string | null {
    // メソッド名が特定の接頭辞を持つ場合、それを除去してURLを推測
    let endpoint = methodName.toLowerCase();

    // 接頭辞を除去
    const prefixes = ['fetch', 'get', 'create', 'update', 'delete', 'retrieve', 'request', 'call'];
    for (const prefix of prefixes) {
      if (endpoint.startsWith(prefix)) {
        endpoint = endpoint.substring(prefix.length);
        break;
      }
    }

    // 先頭文字を小文字化
    if (endpoint.length > 0) {
      endpoint = endpoint.charAt(0).toLowerCase() + endpoint.substring(1);
    }

    // キャメルケースをケバブケースに変換（例: getUserData → user-data）
    endpoint = endpoint.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

    // By や For などの単語を除去
    endpoint = endpoint.replace(/[-_]?by[-_]?/g, '/');
    endpoint = endpoint.replace(/[-_]?for[-_]?/g, '/');

    // 空文字列の場合はnullを返す
    if (!endpoint || endpoint === '') {
      return null;
    }

    // 先頭に / を追加
    if (!endpoint.startsWith('/')) {
      endpoint = '/' + endpoint;
    }

    return endpoint;
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
      lineNumber: location.lineNumber,
      columnNumber: location.columnNumber,
      context: contextName,
      codeSnippet: node.getText().slice(0, 100) // 先頭100文字までを取得
    };
  }
}
