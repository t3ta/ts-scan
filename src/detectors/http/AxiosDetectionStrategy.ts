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
    if (!node.isKind(NodeKind.CallExpression)) {
      return [];
    }

    const callExpr = node;
    // getExpressionメソッドが存在するか確認して安全に呼び出す
    const propExpr = callExpr.getExpression?.();

    // HTTPメソッドを取得
    const methodName = propExpr && propExpr.isKind(NodeKind.PropertyAccessExpression)
      ? ((propExpr as any).getName?.() || 'get').toUpperCase() as HttpMethod
      : 'GET';

    // 引数を取得
    const args = callExpr.getArguments?.() || [];

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

    // データ/パラメータの抽出 (第2引数、オブジェクト)
    let params: ParameterUsage[] = [];

    if (args.length > 1 && args[1].isKind(NodeKind.ObjectLiteralExpression)) {
      const configObj = args[1];

      // paramsプロパティからクエリパラメータを抽出
      const paramsNode = NodeExtractorsExtended.extractPropertyValue(configObj, 'params');
      if (paramsNode) {
        params = NodeExtractorsExtended.extractObjectProperties(paramsNode).map((prop: { name: string }) => ({
          name: prop.name,
          type: 'query',
          locations: [location]
        }));
      }

      // dataプロパティからボディパラメータを抽出
      const dataNode = NodeExtractorsExtended.extractPropertyValue(configObj, 'data');
      if (dataNode) {
        const bodyParams = NodeExtractorsExtended.extractObjectProperties(dataNode).map((prop: { name: string }) => ({
          name: prop.name,
          type: 'body',
          locations: [location]
        }));

        // パラメータ型を明示的にキャストして型エラーを回避
        const typedBodyParams = bodyParams.map(p => ({
          ...p,
          type: 'body' as 'body' | 'path' | 'query' | 'header' | 'unknown'
        }));
        params = [...params, ...typedBodyParams];
      }
    }

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

    // レスポンス処理の情報を抽出
    let responseHandling: ResponseUsage[] = [];

    // thenメソッドチェーンを検出
    const methodChain = NodeExtractorsExtended.findMethodChain(node);
    if (methodChain) {
      for (const chainNode of methodChain) {
        if (chainNode.isKind(NodeKind.CallExpression) && (chainNode.getExpression?.()?.getText() || '').endsWith('.then')) {
          const thenArgs = chainNode.getArguments?.() || [];

          if (thenArgs.length > 0) {
            const callbackBody = NodeExtractorsExtended.extractCallbackBody(thenArgs[0]);

            if (callbackBody) {
              // コールバック内での型付け情報を探す
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

    // レスポンス処理が検出されなかった場合はデフォルト値を設定
    if (responseHandling.length === 0) {
      responseHandling.push({
        type: 'unknown',
        location: location
      });
    }

    // エンドポイント情報の構築
    const endpointBuilder = context.serviceLocator?.resolve<any>(ServiceIds.ENDPOINT_BUILDER);

    const endpoint = endpointBuilder.buildEndpoint(
      urlValue,
      methodName,
      location,
      params,
      responseHandling,
      'axios'
    );

    return [endpoint];
  }

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
}

/**
 * Axiosインスタンスを使用した呼び出し (instance.get など) を検出するパターン
 */
class AxiosInstanceMethodCallDetector extends BasePatternDetector {
  readonly patternName = 'AxiosInstanceMethodCall';

  /**
   * Axiosインスタンスメソッド呼び出しを検出
   */
  public canHandle(node: INode): boolean {
    if (!node.isKind(NodeKind.CallExpression)) {
      return false;
    }

    const expression = node.getExpression?.();
    if (!expression || !expression.isKind(NodeKind.PropertyAccessExpression)) {
      return false;
    }

    const methodName = (expression as any).getName?.().toLowerCase() || '';
    const objectExpr = expression.getExpression?.();

    // HTTPメソッド名を持つメソッド呼び出しを検出
    if (!['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(methodName)) {
      return false;
    }

    // オブジェクトがaxiosインスタンスである可能性を判定
    // 1. axios.create()の結果を変数に格納している場合
    // 2. import文でaxiosインスタンスを生成/インポートしている場合
    // 3. カスタムクライアントでaxios互換APIを提供している場合
    const objText = objectExpr?.getText() || '';

    return (
      objText !== 'axios' && // 直接axios.get()は別のパターンでカバー
      // カスタマイズAPIかaxiosっぽい名前を持つインスタンスを検出
      (objText.includes('Client') ||
       objText.includes('Http') ||
       objText.includes('Api') ||
       objText.toLowerCase().includes('axios'))
    );
  }

  /**
   * Axiosインスタンスからエンドポイント情報を抽出
   */
  public extractEndpoints(node: INode, context: DetectionContext): EndpointInfo[] {
    if (!node.isKind(NodeKind.CallExpression)) {
      return [];
    }
    
    const callExpr = node;
    // getExpressionメソッドが存在するか確認して安全に呼び出す
    const propExpr = callExpr.getExpression?.();

    // HTTPメソッドを取得
    const methodName = propExpr && propExpr.isKind(NodeKind.PropertyAccessExpression)
      ? ((propExpr as any).getName?.() || 'get').toUpperCase() as HttpMethod
      : 'GET';

    // インスタンス名を取得（ベースURLの推測に利用）
    const instance = propExpr && propExpr.isKind(NodeKind.PropertyAccessExpression)
      ? propExpr.getExpression?.()
      : undefined;

    let baseUrl = '';

    // インスタンス定義を探索して、baseURLを抽出
    if (instance) {
      const instanceName = instance.getText();

      // 変数宣言を探す - ISourceFileのfindNodesメソッドを使用
      const declarations = context.sourceFile.findNodes(node => 
        node.isKind(NodeKind.VariableDeclaration) && 
        node.getText().includes(instanceName)
      ) || [];

      for (const decl of declarations) {
        // 変数宣言から初期化子を安全に取得
        const initializer = (decl as any).getInitializer?.();

        if (initializer && initializer.isKind(NodeKind.CallExpression)) {
          const expr = initializer.getExpression?.();
          // 型安全なチェック
          const isAxiosCreate = expr &&
                               expr.isKind(NodeKind.PropertyAccessExpression) &&
                               (expr as any).getName?.() === 'create' &&
                               expr.getExpression?.()?.getText() === 'axios';

          if (isAxiosCreate) {
            // axios.create({baseURL: '/api'}) のようなパターンを検出
            const args = initializer.getArguments?.() || [];

            if (args.length > 0 && args[0].isKind(NodeKind.ObjectLiteralExpression)) {
              const configObj = args[0];
              const baseUrlNode = NodeExtractorsExtended.extractPropertyValue(configObj, 'baseURL');

              if (baseUrlNode) {
                const baseUrlValue = NodeExtractorsExtended.extractStringValue(baseUrlNode);
                if (baseUrlValue) {
                  baseUrl = baseUrlValue;
                  break;
                }
              }
            }
          }
        }
      }
    }

    // 引数を取得
    const args = callExpr.getArguments?.() || [];

    if (args.length === 0) {
      return [];
    }

    // URLを抽出 (第1引数)
    const urlArg = args[0];
    const urlValue = NodeExtractorsExtended.extractStringValue(urlArg);

    if (!urlValue) {
      return [];
    }

    // 完全なURLを構築
    const fullUrl = baseUrl ? UrlNormalizer.buildFullPath(baseUrl, urlValue) : urlValue;

    // 使用箇所情報の作成
    const location = this.createUsageLocation(node, context.sourceFile);

    // データ/パラメータの抽出 (第2引数、オブジェクト)
    let params: ParameterUsage[] = [];

    if (args.length > 1 && args[1].isKind(NodeKind.ObjectLiteralExpression)) {
      const configObj = args[1];

      // paramsプロパティからクエリパラメータを抽出
      const paramsNode = NodeExtractorsExtended.extractPropertyValue(configObj, 'params');
      if (paramsNode) {
        params = NodeExtractorsExtended.extractObjectProperties(paramsNode).map((prop: { name: string }) => ({
          name: prop.name,
          type: 'query',
          locations: [location]
        }));
      }

      // dataプロパティからボディパラメータを抽出
      const dataNode = NodeExtractorsExtended.extractPropertyValue(configObj, 'data');
      if (dataNode) {
        const bodyParams = NodeExtractorsExtended.extractObjectProperties(dataNode).map((prop: { name: string }) => ({
          name: prop.name,
          type: 'body',
          locations: [location]
        }));

        // パラメータ型を明示的にキャストして型エラーを回避
        const typedBodyParams = bodyParams.map(p => ({
          ...p,
          type: 'body' as 'body' | 'path' | 'query' | 'header' | 'unknown'
        }));
        params = [...params, ...typedBodyParams];
      }
    }

    // URLからパスパラメータを抽出
    const pathParams = NodeExtractors.extractPathParameters(fullUrl);

    for (const paramName of pathParams) {
      params.push({
        name: paramName,
        type: 'path',
        required: true,
        locations: [location]
      });
    }

    // レスポンス処理の情報を抽出
    let responseHandling: ResponseUsage[] = [];

    // thenメソッドチェーンを検出
    const parentChain = NodeExtractorsExtended.findMethodChain(node);
    if (parentChain) {
      for (const chainNode of parentChain) {
        // thenメソッドを使っているか確認
        const isCallExpr = 'isKind' in chainNode && typeof chainNode.isKind === 'function';
        const hasGetExpression = 'getExpression' in chainNode && typeof chainNode.getExpression === 'function';
        
        let isChainThen = false;
        if (isCallExpr && hasGetExpression) {
          const exprNode = (chainNode as any).getExpression();
          const exprText = exprNode?.getText() || '';
          isChainThen = (chainNode as any).isKind(NodeKind.CallExpression) && exprText.endsWith('.then');
        }
        
        if (isChainThen) {
          const hasArguments = 'getArguments' in chainNode && typeof chainNode.getArguments === 'function';
          const thenArgs = hasArguments ? (chainNode as any).getArguments() || [] : [];

          if (thenArgs.length > 0) {
            const callbackBody = NodeExtractorsExtended.extractCallbackBody(thenArgs[0]);

            if (callbackBody) {
              // コールバック内での型付け情報を探す
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

    // レスポンス処理が検出されなかった場合はデフォルト値を設定
    if (responseHandling.length === 0) {
      responseHandling.push({
        type: 'unknown',
        location: location
      });
    }

    // エンドポイント情報の構築
    const endpointBuilder = context.serviceLocator?.resolve<any>(ServiceIds.ENDPOINT_BUILDER);

    const endpoint = endpointBuilder.buildEndpoint(
      fullUrl,
      methodName,
      location,
      params,
      responseHandling,
      'axios'
    );

    return [endpoint];
  }

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
}

/**
 * Axiosのリクエスト関数 (axios(config) や axios.request(config)) を検出するパターン
 */
class AxiosRequestConfigDetector extends BasePatternDetector {
  readonly patternName = 'AxiosRequestConfig';

  /**
   * Axiosリクエスト設定オブジェクトによる呼び出しを検出
   */
  public canHandle(node: INode): boolean {
    if (!node.isKind(NodeKind.CallExpression)) {
      return false;
    }

    const expression = node.getExpression?.();
    if (!expression) return false;

    // パターン1: axios(config)
    if (expression.getText() === 'axios') {
      return true;
    }

    // パターン2: axios.request(config)
    if (
      expression.isKind(NodeKind.PropertyAccessExpression) &&
      expression.getExpression?.()?.getText() === 'axios' &&
      (expression as any).getName?.() === 'request'
    ) {
      return true;
    }

    // パターン3: axiosInstance.request(config)
    if (
      expression.isKind(NodeKind.PropertyAccessExpression) &&
      (expression as any).getName?.() === 'request'
    ) {
      const objText = expression.getExpression?.()?.getText() || '';

      return (
        objText !== 'axios' &&
        (objText.includes('Client') ||
         objText.includes('Http') ||
         objText.includes('Api') ||
         objText.toLowerCase().includes('axios'))
      );
    }

    return false;
  }

  /**
   * Axiosリクエスト設定からエンドポイント情報を抽出
   */
  public extractEndpoints(node: INode, context: DetectionContext): EndpointInfo[] {
    if (!node.isKind(NodeKind.CallExpression)) {
      return [];
    }
    
    const callExpr = node;
    const args = callExpr.getArguments?.() || [];

    if (args.length === 0) {
      return [];
    }

    // 設定オブジェクトを取得
    const configObj = args[0];
    if (!configObj.isKind(NodeKind.ObjectLiteralExpression)) {
      return [];
    }

    // URLを抽出
    const urlNode = NodeExtractorsExtended.extractPropertyValue(configObj, 'url');
    if (!urlNode) {
      return [];
    }

    const urlValue = NodeExtractorsExtended.extractStringValue(urlNode);
    if (!urlValue) {
      return [];
    }

    // HTTPメソッドを抽出
    const methodNode = NodeExtractorsExtended.extractPropertyValue(configObj, 'method');
    let methodValue: HttpMethod = 'GET';

    if (methodNode) {
      const methodText = NodeExtractorsExtended.extractStringValue(methodNode);
      if (methodText) {
        methodValue = methodText.toUpperCase() as HttpMethod;
      }
    }

    // ベースURLを抽出
    const baseUrlNode = NodeExtractorsExtended.extractPropertyValue(configObj, 'baseURL');
    let baseUrl = '';

    if (baseUrlNode) {
      const baseUrlValue = NodeExtractorsExtended.extractStringValue(baseUrlNode);
      if (baseUrlValue) {
        baseUrl = baseUrlValue;
      }
    }

    // インスタンスからベースURLを抽出（上記で見つからない場合）
    if (!baseUrl) {
      const expression = callExpr.getExpression?.();

      if (expression && expression.isKind(NodeKind.PropertyAccessExpression)) {
        const instance = expression.getExpression?.();
        const instanceName = instance ? instance.getText() : '';

        if (instanceName !== 'axios') {
          // 変数宣言を探す - ISourceFileのfindNodesメソッドを使用
          const declarations = context.sourceFile.findNodes(node => 
            node.isKind(NodeKind.VariableDeclaration) && 
            node.getText().includes(instanceName)
          ) || [];

          for (const decl of declarations) {
            // 変数宣言から初期化子を安全に取得
            const initializer = (decl as any).getInitializer?.();

            if (initializer && initializer.isKind(NodeKind.CallExpression)) {
              const expr = initializer.getExpression?.();
              // 型安全なチェック
              const isAxiosCreate = expr &&
                                   expr.isKind(NodeKind.PropertyAccessExpression) &&
                                   (expr as any).getName?.() === 'create' &&
                                   expr.getExpression?.()?.getText() === 'axios';

              if (isAxiosCreate) {
                const createArgs = initializer.getArguments?.() || [];

                if (createArgs.length > 0 && createArgs[0].isKind(NodeKind.ObjectLiteralExpression)) {
                  const createConfigObj = createArgs[0];
                  const createBaseUrlNode = NodeExtractorsExtended.extractPropertyValue(createConfigObj, 'baseURL');

                  if (createBaseUrlNode) {
                    const createBaseUrlValue = NodeExtractorsExtended.extractStringValue(createBaseUrlNode);
                    if (createBaseUrlValue) {
                      baseUrl = createBaseUrlValue;
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // 完全なURLを構築
    const fullUrl = baseUrl ? UrlNormalizer.buildFullPath(baseUrl, urlValue) : urlValue;

    // 使用箇所情報の作成
    const location = this.createUsageLocation(node, context.sourceFile);

    // パラメータの抽出
    let params: ParameterUsage[] = [];

    // paramsプロパティからクエリパラメータを抽出
    const paramsNode = NodeExtractorsExtended.extractPropertyValue(configObj, 'params');
    if (paramsNode) {
      params = NodeExtractorsExtended.extractObjectProperties(paramsNode).map((prop: { name: string }) => ({
        name: prop.name,
        type: 'query',
        locations: [location]
      }));
    }

    // dataプロパティからボディパラメータを抽出
    const dataNode = NodeExtractorsExtended.extractPropertyValue(configObj, 'data');
    if (dataNode) {
      const bodyParams = NodeExtractorsExtended.extractObjectProperties(dataNode).map((prop: { name: string }) => ({
        name: prop.name,
        type: 'body' as 'body' | 'path' | 'query' | 'header' | 'unknown',
        locations: [location]
      }));

      params = [...params, ...bodyParams];
    }

    // URLからパスパラメータを抽出
    const pathParams = NodeExtractors.extractPathParameters(fullUrl);

    for (const paramName of pathParams) {
      params.push({
        name: paramName,
        type: 'path',
        required: true,
        locations: [location]
      });
    }

    // レスポンス処理の情報を抽出
    let responseHandling: ResponseUsage[] = [];

    // thenメソッドチェーンを検出
    const parentChain = NodeExtractorsExtended.findMethodChain(node);
    if (parentChain) {
      for (const chainNode of parentChain) {
        // thenメソッドを使っているか確認
        const isNodeCallable = 'isKind' in chainNode && typeof chainNode.isKind === 'function';
        const canGetExpression = 'getExpression' in chainNode && typeof chainNode.getExpression === 'function';
        
        let isChainThen = false;
        if (isNodeCallable && canGetExpression) {
          const exprNode = (chainNode as any).getExpression();
          const exprText = exprNode?.getText() || '';
          isChainThen = (chainNode as any).isKind(NodeKind.CallExpression) && exprText.endsWith('.then');
        }
        
        if (isChainThen) {
          const hasArguments = 'getArguments' in chainNode && typeof chainNode.getArguments === 'function';
          const thenArgs = hasArguments ? (chainNode as any).getArguments() || [] : [];

          if (thenArgs.length > 0) {
            const callbackBody = NodeExtractorsExtended.extractCallbackBody(thenArgs[0]);

            if (callbackBody) {
              // コールバック内での型付け情報を探す
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

    // レスポンス処理が検出されなかった場合はデフォルト値を設定
    if (responseHandling.length === 0) {
      responseHandling.push({
        type: 'unknown',
        location: location
      });
    }

    // エンドポイント情報の構築
    const endpointBuilder = context.serviceLocator?.resolve<any>(ServiceIds.ENDPOINT_BUILDER);

    const endpoint = endpointBuilder.buildEndpoint(
      fullUrl,
      methodValue,
      location,
      params,
      responseHandling,
      'axios'
    );

    return [endpoint];
  }

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
