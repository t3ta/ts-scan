/**
 * 拡張エンドポイント定義検出パターン
 * 
 * RTK Queryのエンドポイント定義を検出し、型情報を含む詳細な定義情報を抽出します。
 * 高度な型システム解析を用いて、クエリ/ミューテーションの判別を行います。
 */

import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import { 
  DetectionContext, 
  EndpointInfo,
  EndpointPatternDetector,
  HttpMethod,
  EndpointSource
} from '../../../types';
import { logger } from '../../../utils/Logger';
import { RtkQueryApiParser } from '../parsers/RtkQueryApiParser';
import { RtkQueryTypeDetector } from '../parsers/RtkQueryTypeDetector';
import { RtkQueryEndpointTypeInference } from '../parsers/RtkQueryEndpointTypeInference';
import { EndpointType } from '../parsers/RtkQueryTypeDefinitions';

/**
 * 拡張エンドポイント定義検出クラス
 * 型システムを活用した高精度な検出を提供します
 */
export class EnhancedEndpointDefinitionDetector implements EndpointPatternDetector {
  private apiParser: RtkQueryApiParser;
  private typeDetector: RtkQueryTypeDetector;
  private typeInference: RtkQueryEndpointTypeInference;

  /**
   * コンストラクタ
   * @param apiParser RTK Query API解析インスタンス
   */
  constructor(apiParser: RtkQueryApiParser) {
    this.apiParser = apiParser;
    this.typeDetector = new RtkQueryTypeDetector();
    this.typeInference = new RtkQueryEndpointTypeInference();
  }

  /**
   * パターン適用可否の判定
   * @param node 対象ノード
   * @returns パターンが適用可能かどうか
   */
  public canHandle(node: Node): boolean {
    // 基本的な検出ロジック - エンドポイントビルダーのメソッド呼び出しを検出
    if (Node.isCallExpression(node)) {
      const expression = node.getExpression();
      if (Node.isPropertyAccessExpression(expression)) {
        const propName = expression.getName();
        // メソッド名による判定
        if (propName === 'query' || propName === 'mutation' || propName === 'infiniteQuery') {
          // エンドポイントビルダー関数内に存在するか確認
          return this.isNodeInEndpointsFunction(node);
        }
      }
    }
    
    return false;
  }

  /**
   * ノードがendpoints関数内に存在するか判定
   * @param node 対象ノード
   * @returns endpoints関数内に存在するならtrue
   */
  private isNodeInEndpointsFunction(node: Node): boolean {
    // 親の関数を検索
    const arrowFunc = node.getFirstAncestorByKind(SyntaxKind.ArrowFunction);
    if (!arrowFunc) {
      return false;
    }
    
    // その関数の親がendpointsプロパティに割り当てられているか
    const propAssign = arrowFunc.getFirstAncestorByKind(SyntaxKind.PropertyAssignment);
    if (!propAssign) {
      return false;
    }
    
    return propAssign.getName() === 'endpoints';
  }

  /**
   * エンドポイント情報の抽出
   * @param node 対象ノード（build.query/mutation/infiniteQuery 呼び出し）
   * @param context 検出コンテキスト
   * @returns 抽出されたエンドポイント情報配列
   */
  public extractEndpoints(node: Node, context: DetectionContext): EndpointInfo[] {
    logger.debug(`[EnhancedEndpointDefinitionDetector] 型情報を含むエンドポイント定義からエンドポイント抽出開始`);
    
    try {
      const endpoints: EndpointInfo[] = [];
      const sourceFile = node.getSourceFile();
      
      // エンドポイントタイプの検出
      const endpointType = this.typeDetector.detectEndpointType(node);
      if (!endpointType) {
        logger.warn(`[EnhancedEndpointDefinitionDetector] エンドポイントタイプを検出できませんでした: ${node.getText()}`);
        return [];
      }
      
      // エンドポイント名を抽出
      const endpointName = this.extractEndpointName(node);
      if (!endpointName) {
        logger.warn(`[EnhancedEndpointDefinitionDetector] エンドポイント名を抽出できませんでした`);
        return [];
      }
      
      // エンドポイント設定を抽出
      const endpointConfig = this.extractEndpointConfiguration(node, endpointType);
      
      // 高度な型情報を抽出
      const typeInfo = this.typeInference.inferEndpointTypeInfo(node, endpointType);
      
      // EndpointInfoオブジェクトを構築
      const endpoint = this.constructEndpointInfo(
        endpointName,
        endpointType,
        node,
        sourceFile,
        typeInfo.inputType,
        typeInfo.outputType,
        endpointConfig
      );
      
      if (endpoint) {
        endpoints.push(endpoint);
      }
      
      return endpoints;
    } catch (error) {
      logger.error(`[EnhancedEndpointDefinitionDetector] エンドポイント抽出中にエラー: ${error}`);
      return [];
    }
  }

  /**
   * エンドポイント名を抽出
   * @param node エンドポイント定義ノード
   * @returns エンドポイント名または undefined
   */
  private extractEndpointName(node: Node): string | undefined {
    try {
      // 親のプロパティ代入式を検索
      const propertyAssign = node.getFirstAncestorByKind(SyntaxKind.PropertyAssignment);
      if (propertyAssign) {
        return propertyAssign.getName();
      }
      
      return undefined;
    } catch (error) {
      logger.error(`[EnhancedEndpointDefinitionDetector] エンドポイント名抽出中にエラー: ${error}`);
      return undefined;
    }
  }

  /**
   * エンドポイント設定を抽出
   * @param node エンドポイント定義ノード
   * @param endpointType エンドポイントタイプ
   * @returns エンドポイント設定オブジェクト
   */
  private extractEndpointConfiguration(
    node: Node,
    endpointType: EndpointType
  ): Record<string, any> {
    try {
      // CallExpressionからオブジェクトリテラルを取得
      if (Node.isCallExpression(node)) {
        const firstArg = node.getArguments()[0];
        if (firstArg && Node.isObjectLiteralExpression(firstArg)) {
          const config: Record<string, any> = {};
          
          // queryまたはqueryFnプロパティを検索
          const queryProperty = firstArg.getProperty('query') || firstArg.getProperty('queryFn');
          if (queryProperty && Node.isPropertyAssignment(queryProperty)) {
            const initializer = queryProperty.getInitializer();
            if (initializer) {
              config.queryImplementation = initializer.getText();
              
              // URLパス情報の抽出試行
              const pathInfo = this.extractPathInfo(initializer, endpointType);
              if (pathInfo) {
                config.path = pathInfo.path;
                config.method = pathInfo.method;
              }
            }
          }
          
          // transformResponseプロパティの確認
          const transformProperty = firstArg.getProperty('transformResponse');
          if (transformProperty) {
            config.hasTransform = true;
          }
          
          // タグ関連プロパティの検出
          const providesTagsProp = firstArg.getProperty('providesTags');
          if (providesTagsProp) {
            config.providesTags = providesTagsProp.getText().replace('providesTags:', '').trim();
          }
          
          const invalidatesTagsProp = firstArg.getProperty('invalidatesTags');
          if (invalidatesTagsProp) {
            config.invalidatesTags = invalidatesTagsProp.getText().replace('invalidatesTags:', '').trim();
          }
          
          return config;
        }
      }
      
      return {};
    } catch (error) {
      logger.error(`[EnhancedEndpointDefinitionDetector] エンドポイント設定抽出中にエラー: ${error}`);
      return {};
    }
  }

  /**
   * パス情報を抽出
   * @param queryNode クエリ関数ノード
   * @param endpointType エンドポイントタイプ
   * @returns パス情報またはundefined
   */
  private extractPathInfo(
    queryNode: Node,
    endpointType: EndpointType
  ): { path: string; method?: HttpMethod } | undefined {
    try {
      let path: string | undefined;
      let method: HttpMethod | undefined;
      
      // 文字列リテラルの場合（直接パスを返す場合）
      if (Node.isStringLiteral(queryNode)) {
        path = queryNode.getLiteralValue();
        method = endpointType === EndpointType.Query ? 'GET' : 'POST';
        return { path, method };
      }
      
      // アロー関数の場合
      if (Node.isArrowFunction(queryNode)) {
        const body = queryNode.getBody();
        
        // 関数がオブジェクトリテラルを直接返す場合
        if (Node.isObjectLiteralExpression(body)) {
          return this.extractPathInfoFromRequestObject(body);
        }
        
        // 関数が文字列を直接返す場合
        if (Node.isStringLiteral(body)) {
          path = body.getLiteralValue();
          method = endpointType === EndpointType.Query ? 'GET' : 'POST';
          return { path, method };
        }
        
        // 関数ブロックの場合、returnステートメントを探す
        if (Node.isBlock(body)) {
          const returnStatement = body.getStatements().find(stmt => Node.isReturnStatement(stmt));
          if (returnStatement && Node.isReturnStatement(returnStatement)) {
            const expression = returnStatement.getExpression();
            if (expression) {
              // 文字列リテラルを返す場合
              if (Node.isStringLiteral(expression)) {
                path = expression.getLiteralValue();
                method = endpointType === EndpointType.Query ? 'GET' : 'POST';
                return { path, method };
              }
              
              // オブジェクトリテラルを返す場合
              if (Node.isObjectLiteralExpression(expression)) {
                return this.extractPathInfoFromRequestObject(expression);
              }
            }
          }
        }
      }
      
      return undefined;
    } catch (error) {
      logger.error(`[EnhancedEndpointDefinitionDetector] パス情報抽出中にエラー: ${error}`);
      return undefined;
    }
  }

  /**
   * リクエストオブジェクトからパス情報を抽出
   * @param objExpr オブジェクトリテラル式
   * @returns パス情報またはundefined
   */
  private extractPathInfoFromRequestObject(
    objExpr: Node
  ): { path: string; method?: HttpMethod } | undefined {
    if (!Node.isObjectLiteralExpression(objExpr)) {
      return undefined;
    }
    
    try {
      let path: string | undefined;
      let method: HttpMethod | undefined;
      
      // urlプロパティを探す
      const urlProp = objExpr.getProperty('url');
      if (urlProp && Node.isPropertyAssignment(urlProp)) {
        const initializer = urlProp.getInitializer();
        if (initializer && Node.isStringLiteral(initializer)) {
          path = initializer.getLiteralValue();
        }
      }
      
      // methodプロパティを探す
      const methodProp = objExpr.getProperty('method');
      if (methodProp && Node.isPropertyAssignment(methodProp)) {
        const initializer = methodProp.getInitializer();
        if (initializer && Node.isStringLiteral(initializer)) {
          const methodStr = initializer.getLiteralValue().toUpperCase();
          if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(methodStr)) {
            method = methodStr as HttpMethod;
          }
        }
      }
      
      return path ? { path, method } : undefined;
    } catch (error) {
      logger.error(`[EnhancedEndpointDefinitionDetector] リクエストオブジェクト解析中にエラー: ${error}`);
      return undefined;
    }
  }

  /**
   * EndpointInfoオブジェクトを構築
   * @param endpointName エンドポイント名
   * @param endpointType エンドポイントタイプ
   * @param node 定義ノード
   * @param sourceFile ソースファイル
   * @param inputTypeInfo 入力型情報（任意）
   * @param outputTypeInfo 出力型情報（任意）
   * @param endpointConfig 設定情報（任意）
   * @returns EndpointInfoオブジェクトまたはundefined
   */
  private constructEndpointInfo(
    endpointName: string,
    endpointType: EndpointType,
    node: Node,
    sourceFile: SourceFile,
    inputTypeInfo?: string,
    outputTypeInfo?: string,
    endpointConfig: Record<string, any> = {}
  ): EndpointInfo | undefined {
    try {
      // パス情報がなければ構築できない
      if (!endpointConfig.path) {
        return undefined;
      }
      
      // HTTPメソッドの決定
      const method = endpointConfig.method || (endpointType === EndpointType.Query ? 'GET' : 'POST');
      
      // エンドポイント情報オブジェクトの構築
      const endpointInfo: EndpointInfo = {
        path: endpointConfig.path,
        method,
        parametersUsed: [],
        responseHandling: [],
        source: 'rtk-query' as EndpointSource,
        isDynamic: endpointConfig.path.includes(':'),
        usageLocations: [{
          filePath: sourceFile.getFilePath(),
          lineNumber: node.getStartLineNumber(),
          columnNumber: node.getStart(),
          context: endpointName,
          codeSnippet: node.getText().substring(0, 100) + (node.getText().length > 100 ? '...' : '')
        }]
      };
      
      // RTK Query固有情報の設定
      endpointInfo.rtkQuerySpecific = {
        isQuery: endpointType === EndpointType.Query || endpointType === EndpointType.InfiniteQuery,
        isMutation: endpointType === EndpointType.Mutation,
        transformResponseUsed: endpointConfig.hasTransform || false,
        baseQueryUsed: true
      };
      
      return endpointInfo;
    } catch (error) {
      logger.error(`[EnhancedEndpointDefinitionDetector] エンドポイント情報構築中にエラー: ${error}`);
      return undefined;
    }
  }
}
