/**
 * HTTP固有パターン検出器
 * 
 * 特定のHTTPリクエストパターンを検出し、エンドポイント情報を抽出します。
 * カスタムHTTPクライアントに特化した検出ロジックを提供します。
 */

import { Node, SourceFile, SyntaxKind } from 'ts-morph';
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
  public canHandle(node: Node): boolean {
    if (!node.isKind(SyntaxKind.CallExpression)) {
      return false;
    }
    
    const expression = node.getExpression();
    
    // HTTP固有パターンのチェック
    // 1. フルパス関数呼び出し: callApi('/api/users', options)
    if (expression.isKind(SyntaxKind.Identifier)) {
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
    if (expression.isKind(SyntaxKind.PropertyAccessExpression)) {
      const propExpr = expression;
      const objExpr = propExpr.getExpression();
      
      // this.http パターン
      if (objExpr.isKind(SyntaxKind.PropertyAccessExpression)) {
        const nestedObjExpr = objExpr;
        const nestedObj = nestedObjExpr.getExpression();
        
        if (nestedObj.getText() === 'this') {
          const propName = nestedObjExpr.getName().toLowerCase();
          
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
  public extractEndpoints(node: Node, context: DetectionContext): EndpointInfo[] {
    const callExpr = node;
    
    if (!callExpr.isKind(SyntaxKind.CallExpression)) {
      return [];
    }
    
    // 引数を取得
    const args = callExpr.getArguments();
    
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
    let httpMethod: HttpMethod;
    
    // 1. 関数名/メソッド名からHTTPメソッドを推測
    const expression = callExpr.getExpression();
    
    if (expression.isKind(SyntaxKind.Identifier)) {
      // 通常の関数呼び出しの場合
      const funcName = expression.getText();
      httpMethod = MethodInference.inferMethodFromName(funcName);
    } else if (expression.isKind(SyntaxKind.PropertyAccessExpression)) {
      // メソッド呼び出しの場合
      const methodName = expression.isKind(SyntaxKind.PropertyAccessExpression) ? 
        expression.getName() : '';
      
      if (['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(methodName.toLowerCase())) {
        httpMethod = methodName.toUpperCase() as HttpMethod;
      } else {
        httpMethod = MethodInference.inferMethodFromName(methodName);
      }
    } else {
      // デフォルトはGET
      httpMethod = 'GET';
    }
    
    // 2. 第2引数のオプションからHTTPメソッドを抽出（上書き）
    if (args.length > 1 && args[1].isKind(SyntaxKind.ObjectLiteralExpression)) {
      const optionsObj = args[1];
      const methodNode = NodeExtractorsExtended.getPropertyFromObjectLiteral(optionsObj, 'method');
      
      if (methodNode) {
        const methodText = NodeExtractorsExtended.extractStringValue(methodNode);
        if (methodText) {
          httpMethod = methodText.toUpperCase() as HttpMethod;
        }
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
    
    // オプション引数からパラメータを抽出
    if (args.length > 1) {
      const optionsArg = args[1];
      
      if (optionsArg.isKind(SyntaxKind.ObjectLiteralExpression)) {
        // paramsプロパティからクエリパラメータを抽出
        const paramsNode = NodeExtractorsExtended.getPropertyFromObjectLiteral(optionsArg, 'params');
        if (paramsNode && paramsNode.isKind(SyntaxKind.ObjectLiteralExpression)) {
          const queryProps = NodeExtractorsExtended.extractObjectProperties(paramsNode);
          
          for (const prop of queryProps) {
            params.push({
              name: prop.name,
              type: 'query',
              locations: [location]
            });
          }
        }
        
        // dataプロパティからボディパラメータを抽出
        const dataNode = NodeExtractorsExtended.getPropertyFromObjectLiteral(optionsArg, 'data');
        if (dataNode && dataNode.isKind(SyntaxKind.ObjectLiteralExpression)) {
          const bodyProps = NodeExtractorsExtended.extractObjectProperties(dataNode);
          
          for (const prop of bodyProps) {
            params.push({
              name: prop.name,
              type: 'body',
              locations: [location]
            });
          }
        } else if (dataNode) {
          // dataプロパティ自体がオブジェクトリテラルでない場合
          params.push({
            name: 'data',
            type: 'body',
            locations: [location]
          });
        }
        
        // bodyプロパティからボディパラメータを抽出 (fetch APIスタイル)
        const bodyNode = NodeExtractorsExtended.getPropertyFromObjectLiteral(optionsArg, 'body');
        if (bodyNode) {
          if (bodyNode.isKind(SyntaxKind.ObjectLiteralExpression)) {
            const bodyProps = NodeExtractorsExtended.extractObjectProperties(bodyNode);
            
            for (const prop of bodyProps) {
              params.push({
                name: prop.name,
                type: 'body',
                locations: [location]
              });
            }
          } else {
            // JSONストリングを抽出
            const jsonContent = NodeExtractorsExtended.extractJsonContentFromBody(bodyNode);
            if (jsonContent && jsonContent.length > 0) {
              for (const prop of jsonContent) {
                params.push({
                  name: prop,
                  type: 'body',
                  locations: [location]
                });
              }
            } else {
              // 抽出できなかった場合は汎用的なパラメータとして扱う
              params.push({
                name: 'body',
                type: 'body',
                locations: [location]
              });
            }
          }
        }
        
        // headersプロパティからヘッダーパラメータを抽出
        const headersNode = NodeExtractorsExtended.getPropertyFromObjectLiteral(optionsArg, 'headers');
        if (headersNode && headersNode.isKind(SyntaxKind.ObjectLiteralExpression)) {
          const headerProps = NodeExtractorsExtended.extractObjectProperties(headersNode);
          
          for (const prop of headerProps) {
            params.push({
              name: prop.name,
              type: 'header',
              locations: [location]
            });
          }
        }
      } else if (
        httpMethod !== 'GET' && 
        !['GET', 'HEAD', 'OPTIONS'].includes(httpMethod) && 
        optionsArg.isKind(SyntaxKind.Identifier)
      ) {
        // 第2引数が識別子で、GETメソッド以外の場合はボディデータと推測
        params.push({
          name: optionsArg.getText(),
          type: 'body',
          locations: [location]
        });
      }
    }
    
    // レスポンス処理の情報を抽出
    const responseHandling = this.extractResponseHandling(node, location);
    
    // エンドポイント情報の構築
    const endpointBuilder = context.serviceLocator?.resolve(ServiceIds.ENDPOINT_BUILDER);
    
    const endpoint = endpointBuilder?.buildEndpoint(
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
  private extractResponseHandling(node: Node, location: UsageLocation): ResponseUsage[] {
    // thenメソッドチェーンを検出
    const parentChain = NodeExtractorsExtended.findMethodChain(node);
    if (parentChain) {
      for (const chainNode of parentChain) {
        if (NodePredicates.isMethodCall(chainNode, 'then')) {
          const thenArgs = chainNode.isKind(SyntaxKind.CallExpression) ? chainNode.getArguments() : [];
          
          if (thenArgs.length > 0) {
            const callbackBody = NodeExtractorsExtended.extractCallbackBody(thenArgs[0]);
            
            if (callbackBody) {
              // 型付け情報を探す
              const typeInfo = NodeExtractorsExtended.extractTypeAnnotations(callbackBody);
              
              if (typeInfo && typeInfo.length > 0) {
                return [{
                  type: 'typed',
                  typeName: typeInfo[0].typeName,
                  location: location
                }];
              } else {
                // 変換処理の有無を確認
                const transformationDetected = NodeExtractorsExtended.detectResponseTransformation(callbackBody);
                
                return [{
                  type: transformationDetected ? 'transformation' : 'direct',
                  location: location
                }];
              }
            }
          }
        }
      }
    }
    
    // async/awaitパターンの検出
    const awaitParent = NodeExtractorsExtended.findAwaitExpression(node);
    if (awaitParent) {
      // 変数への代入を探す
      const assignment = NodeExtractorsExtended.findAssignmentExpression(awaitParent);
      if (assignment) {
        // 型付け情報を探す
        const typeInfo = NodeExtractorsExtended.extractVariableTypeAnnotation(assignment);
        if (typeInfo) {
          return [{
            type: 'typed',
            typeName: typeInfo,
            location: location
          }];
        }
      }
    }
    
    // デフォルト値
    return [{
      type: 'unknown',
      location: location
    }];
  }
  
  /**
   * 使用箇所の詳細情報を作成
   * @param node ノード
   * @param sourceFile ソースファイル
   * @param context コンテキスト情報
   * @returns 使用箇所詳細情報
   */
  private createUsageLocation(node: Node, sourceFile: SourceFile, context?: string): UsageLocation {
    const lineAndColumn = NodeExtractorsExtended.getStartLineAndColumn(node);
    
    // 周囲のコンテキスト（メソッド/クラス名など）を推測
    let contextName = context;
    if (!contextName) {
      contextName = NodeExtractorsExtended.inferContext(node);
    }
    
    return {
      filePath: sourceFile.getFilePath(),
      lineNumber: lineAndColumn.line,
      columnNumber: lineAndColumn.column,
      context: contextName,
      codeSnippet: node.getText().slice(0, 100) // 先頭100文字までを取得
    };
  }
}
