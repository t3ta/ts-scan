/**
 * RTK Query エンドポイント定義解析モジュール
 * 
 * RTK Queryのエンドポイント定義を解析してメタデータを抽出します。
 * エンドポイントのパス、メソッド、タグ、パラメータなどの情報を特定します。
 */

import { 
  ArrowFunction,
  CallExpression,
  Node, 
  ObjectLiteralExpression, 
  PropertyAssignment, 
  SourceFile, 
  StringLiteral, 
  SyntaxKind 
} from 'ts-morph';
import { 
  DetectionContext,
  HttpMethod
} from '../../../types';
import { 
  RTKApiMetadata,
  RTKEndpointMetadata,
  EndpointPathInfo 
} from './RtkQueryTypes';
import { logger } from '../../../utils/Logger';
import { NodeTraversal } from '../../../utils/ast/NodeTraversal';
import { UrlNormalizer } from '../../../utils/http/UrlNormalizer';
import { MethodInference } from '../../../utils/http/MethodInference';

/**
 * RTK Queryエンドポイント定義解析クラス
 */
export class RtkEndpointDefinitionParser {
  /**
   * エンドポイントビルダー部分の解析
   * @param configObject createApiの設定オブジェクト
   * @param apiMetadata 構築中のAPIメタデータ
   * @param context 検出コンテキスト
   */
  public parseEndpointBuilder(
    configObject: ObjectLiteralExpression,
    apiMetadata: RTKApiMetadata,
    context: DetectionContext
  ): void {
    const endpointsProp = configObject.getProperty('endpoints');
    if (!endpointsProp || !endpointsProp.isKind(SyntaxKind.PropertyAssignment)) {
      return;
    }
    
    const endpointsValue = (endpointsProp as PropertyAssignment).getInitializer();
    if (!endpointsValue || !endpointsValue.isKind(SyntaxKind.ArrowFunction)) {
      return;
    }
    
    // ビルダー変数名を取得
    const builderParam = endpointsValue.getFirstDescendantByKind(SyntaxKind.Parameter);
    if (builderParam) {
      apiMetadata.builderName = builderParam.getText();
    }
    
    // エンドポイント定義を解析
    const endpointDefs = endpointsValue.getBody();
    if (endpointDefs && endpointDefs.isKind(SyntaxKind.Block)) {
      this.parseEndpointDefinitions(endpointDefs, apiMetadata, context);
    } else if (endpointDefs) {
      // ブロックではない場合（単一のオブジェクトリテラルなど）
      this.parseEndpointDefinitions(endpointDefs, apiMetadata, context);
    }
  }

  /**
   * エンドポイント定義の解析
   * @param endpointsNode エンドポイント定義ノード
   * @param apiMetadata APIメタデータ
   * @param context 検出コンテキスト
   */
  private parseEndpointDefinitions(
    endpointsNode: Node,
    apiMetadata: RTKApiMetadata,
    context: DetectionContext
  ): void {
    // オブジェクトリテラルからのエンドポイント抽出
    const objectLiterals = NodeTraversal.findNodes(
      endpointsNode,
      (node) => node.isKind(SyntaxKind.ObjectLiteralExpression)
    );
    
    for (const objLiteral of objectLiterals) {
      // query, mutationメソッド呼び出しを検索
      const methodCalls = NodeTraversal.findNodes(
        objLiteral, 
        (node) => {
          if (!node.isKind(SyntaxKind.PropertyAccessExpression)) {
            return false;
          }
          const text = node.getText();
          return text.includes('.query') || text.includes('.mutation');
        }
      );
      
      for (const methodCall of methodCalls) {
        try {
          this.extractEndpointFromMethodCall(methodCall, apiMetadata, context);
        } catch (error) {
          logger.error(`[RtkEndpointDefinitionParser] エンドポイント抽出エラー: ${error}`);
        }
      }
    }
  }

  /**
   * エンドポイントメソッド呼び出しからエンドポイント情報を抽出
   * @param node メソッド呼び出しノード
   * @param apiMetadata APIメタデータ
   * @param context 検出コンテキスト
   */
  private extractEndpointFromMethodCall(
    node: Node, 
    apiMetadata: RTKApiMetadata, 
    context: DetectionContext
  ): void {
    // 親のプロパティ代入を見つける
    const propAssignment = node.getFirstAncestorByKind(SyntaxKind.PropertyAssignment);
    if (!propAssignment) {
      return;
    }
    
    // エンドポイント名を取得
    const endpointName = propAssignment.getName();
    
    // クエリかミューテーションかを判定
    const isQuery = node.getText().includes('.query');
    
    // 設定オブジェクトを見つける
    let endpointConfig: ObjectLiteralExpression | undefined;
    
    // メソッド呼び出しの場合
    const callExpr = node.getFirstAncestorByKind(SyntaxKind.CallExpression);
    if (callExpr) {
      const args = callExpr.getArguments();
      if (args.length > 0 && args[0].isKind(SyntaxKind.ObjectLiteralExpression)) {
        endpointConfig = args[0] as ObjectLiteralExpression;
      }
    }
    
    if (!endpointConfig) {
      logger.warn(`[RtkEndpointDefinitionParser] エンドポイント "${endpointName}" の設定が見つかりません`);
      return;
    }
    
    // URLの抽出
    const pathInfo = this.extractEndpointPath(endpointConfig, context);
    if (!pathInfo) {
      logger.warn(`[RtkEndpointDefinitionParser] エンドポイント "${endpointName}" のパスが見つかりません`);
      return;
    }
    
    // 変換処理の使用有無をチェック
    const useTransform = this.checkTransformResponseUsage(endpointConfig);
    
    // タグ情報の抽出
    const providesTags = this.extractTags(endpointConfig, 'providesTags');
    const invalidatesTags = this.extractTags(endpointConfig, 'invalidatesTags');
    
    // エンドポイントメタデータを作成
    const endpointMetadata: RTKEndpointMetadata = {
      name: endpointName,
      path: pathInfo.path,
      method: pathInfo.method || (isQuery ? 'GET' : 'POST'),
      isQuery,
      isMutation: !isQuery,
      node: propAssignment,
      useTransformResponse: useTransform,
      providesTags,
      invalidatesTags
    };
    
    // メタデータに登録
    apiMetadata.endpoints.set(endpointName, endpointMetadata);
    
    logger.debug(`[RtkEndpointDefinitionParser] エンドポイント "${endpointName}" を登録: ${pathInfo.path} [${endpointMetadata.method}]`);
  }

  /**
   * エンドポイント設定からパス情報を抽出
   * @param config エンドポイント設定オブジェクト
   * @param context 検出コンテキスト
   * @returns パス情報（パスとHTTPメソッド）
   */
  private extractEndpointPath(
    config: ObjectLiteralExpression, 
    context: DetectionContext
  ): EndpointPathInfo | undefined {
    // 1. query/url プロパティから直接抽出
    const urlProp = config.getProperty('query') || config.getProperty('url');
    if (urlProp && urlProp.isKind(SyntaxKind.PropertyAssignment)) {
      const initializer = (urlProp as PropertyAssignment).getInitializer();
      if (initializer) {
        // 文字列リテラルの場合
        if (initializer.isKind(SyntaxKind.StringLiteral)) {
          return {
            path: (initializer as StringLiteral).getLiteralValue()
          };
        }
        
        // テンプレートリテラルの場合
        if (initializer.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
          return {
            path: initializer.getText().slice(1, -1) // バッククォートを削除
          };
        }
        
        // 関数の場合（引数からパラメータ情報を抽出できる可能性あり）
        if (initializer.isKind(SyntaxKind.ArrowFunction)) {
          // 関数本体から文字列リテラルを検索
          const stringLiterals = NodeTraversal.findNodes(
            initializer,
            (node) => node.isKind(SyntaxKind.StringLiteral) || 
                     node.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)
          );
          
          if (stringLiterals.length > 0) {
            const literal = stringLiterals[0];
            if (literal.isKind(SyntaxKind.StringLiteral)) {
              return {
                path: (literal as StringLiteral).getLiteralValue()
              };
            }
            if (literal.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
              return {
                path: literal.getText().slice(1, -1) // バッククォートを削除
              };
            }
          }
        }
      }
    }
    
    // 2. methodプロパティからHTTPメソッドを抽出
    let method: HttpMethod | undefined;
    const methodProp = config.getProperty('method');
    if (methodProp && methodProp.isKind(SyntaxKind.PropertyAssignment)) {
      const initializer = (methodProp as PropertyAssignment).getInitializer();
      if (initializer && initializer.isKind(SyntaxKind.StringLiteral)) {
        const methodValue = (initializer as StringLiteral).getLiteralValue().toUpperCase();
        if (MethodInference.isValidHttpMethod(methodValue)) {
          method = methodValue as HttpMethod;
        }
      }
    }
    
    // 3. より複雑なケースをハンドル
    // 設定オブジェクト全体から文字列リテラルを検索
    const stringLiterals = NodeTraversal.findNodes(
      config,
      (node) => node.isKind(SyntaxKind.StringLiteral) || 
               node.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)
    );
    
    for (const literal of stringLiterals) {
      let path: string;
      
      if (literal.isKind(SyntaxKind.StringLiteral)) {
        path = (literal as StringLiteral).getLiteralValue();
      } else { // NoSubstitutionTemplateLiteral
        path = literal.getText().slice(1, -1); // バッククォートを削除
      }
      
      // URLらしい文字列か判定
      if (UrlNormalizer.looksLikeUrl(path)) {
        return { path, method };
      }
    }
    
    return undefined;
  }

  /**
   * transformResponse使用有無のチェック
   * @param config エンドポイント設定オブジェクト
   * @returns 変換処理の使用有無
   */
  private checkTransformResponseUsage(config: ObjectLiteralExpression): boolean {
    // transformResponseプロパティの有無をチェック
    const transformProp = config.getProperty('transformResponse');
    if (transformProp) {
      return true;
    }
    
    // メソッド形式での変換処理チェック
    const nodes = NodeTraversal.findNodes(
      config,
      (node) => {
        if (!node.isKind(SyntaxKind.PropertyAccessExpression)) {
          return false;
        }
        return node.getText().includes('transformResponse');
      }
    );
    
    return nodes.length > 0;
  }

  /**
   * タグ情報の抽出
   * @param config エンドポイント設定オブジェクト
   * @param tagPropertyName タグプロパティ名
   * @returns 抽出されたタグ配列
   */
  private extractTags(config: ObjectLiteralExpression, tagPropertyName: string): string[] | undefined {
    const tagsProp = config.getProperty(tagPropertyName);
    if (!tagsProp || !tagsProp.isKind(SyntaxKind.PropertyAssignment)) {
      return undefined;
    }
    
    const initializer = (tagsProp as PropertyAssignment).getInitializer();
    if (!initializer) {
      return undefined;
    }
    
    // 配列リテラルの場合
    if (initializer.isKind(SyntaxKind.ArrayLiteralExpression)) {
      const tags: string[] = [];
      initializer.forEachChild(child => {
        if (child.isKind(SyntaxKind.StringLiteral)) {
          tags.push((child as StringLiteral).getLiteralValue());
        } else if (child.isKind(SyntaxKind.ObjectLiteralExpression)) {
          // {type: 'Tag'} 形式のケースをハンドル
          const typeProp = (child as ObjectLiteralExpression).getProperty('type');
          if (typeProp && typeProp.isKind(SyntaxKind.PropertyAssignment)) {
            const typeValue = (typeProp as PropertyAssignment).getInitializer();
            if (typeValue && typeValue.isKind(SyntaxKind.StringLiteral)) {
              tags.push((typeValue as StringLiteral).getLiteralValue());
            }
          }
        }
      });
      
      return tags.length > 0 ? tags : undefined;
    }
    
    // 関数の場合
    if (initializer.isKind(SyntaxKind.ArrowFunction)) {
      // 関数内の文字列リテラルを収集
      const stringLiterals = NodeTraversal.findNodes(
        initializer,
        (node) => node.isKind(SyntaxKind.StringLiteral)
      );
      
      const tags = stringLiterals.map(node => (node as StringLiteral).getLiteralValue());
      return tags.length > 0 ? tags : undefined;
    }
    
    return undefined;
  }
}
