/**
 * RTK Queryエンドポイント型推論モジュール
 * 
 * TypeScriptの高度な型システムを活用して、RTK Queryエンドポイントの正確な型情報を推論・抽出します。
 * ジェネリクス型パラメータの解析や型構造の探索機能を提供します。
 */

import { Node, TypeNode } from 'ts-morph';
import { logger } from '../../../utils/Logger';
import { EndpointType, EndpointTypeInfo, EndpointGenericIndexes } from './RtkQueryTypeDefinitions';

/**
 * RTK Queryエンドポイント型推論クラス
 * エンドポイントの型情報を詳細に解析します
 */
export class RtkQueryEndpointTypeInference {
  /**
   * エンドポイント定義からジェネリクス型パラメータを抽出します
   * 
   * @param node エンドポイント定義ノード（build.query/mutationなど）
   * @param endpointType 既知のエンドポイントタイプ
   * @returns ジェネリクス型パラメータのマップ、またはundefined
   */
  public extractGenericParameters(
    node: Node, 
    endpointType: EndpointType
  ): Map<string, string> | undefined {
    try {
      const result = new Map<string, string>();
      
      // コールエクスプレッションの処理
      if (Node.isCallExpression(node)) {
        // プロパティアクセス式を取得
        const expression = node.getExpression();
        if (Node.isPropertyAccessExpression(expression)) {
          // タイプノードを取得
          const typeArguments = node.getTypeArguments();
          
          if (typeArguments.length > 0) {
            // エンドポイントタイプに基づいてジェネリクスパラメータを抽出
            switch (endpointType) {
              case EndpointType.Query:
                this.extractQueryGenericParameters(typeArguments, result);
                break;
              case EndpointType.Mutation:
                this.extractMutationGenericParameters(typeArguments, result);
                break;
              case EndpointType.InfiniteQuery:
                this.extractInfiniteQueryGenericParameters(typeArguments, result);
                break;
            }
          }
        }
      }
      
      return result.size > 0 ? result : undefined;
    } catch (error) {
      logger.error(`[RtkQueryEndpointTypeInference] ジェネリクス型パラメータ抽出エラー: ${error}`);
      return undefined;
    }
  }

  /**
   * クエリエンドポイントのジェネリクスパラメータを抽出
   * 
   * @param typeArguments 型引数ノード配列
   * @param result 結果を格納するマップ
   */
  private extractQueryGenericParameters(
    typeArguments: readonly TypeNode[], 
    result: Map<string, string>
  ): void {
    // ResultTypeパラメータ
    if (typeArguments.length > EndpointGenericIndexes.Query.ResultType) {
      const resultType = typeArguments[EndpointGenericIndexes.Query.ResultType];
      result.set('ResultType', resultType.getText());
    }
    
    // QueryArgパラメータ
    if (typeArguments.length > EndpointGenericIndexes.Query.QueryArg) {
      const queryArg = typeArguments[EndpointGenericIndexes.Query.QueryArg];
      result.set('QueryArg', queryArg.getText());
    }
    
    // BaseQueryパラメータ（オプショナル）
    if (typeArguments.length > EndpointGenericIndexes.Query.BaseQuery) {
      const baseQuery = typeArguments[EndpointGenericIndexes.Query.BaseQuery];
      result.set('BaseQuery', baseQuery.getText());
    }
    
    // TagTypesパラメータ（オプショナル）
    if (typeArguments.length > EndpointGenericIndexes.Query.TagTypes) {
      const tagTypes = typeArguments[EndpointGenericIndexes.Query.TagTypes];
      result.set('TagTypes', tagTypes.getText());
    }
  }

  /**
   * ミューテーションエンドポイントのジェネリクスパラメータを抽出
   * 
   * @param typeArguments 型引数ノード配列
   * @param result 結果を格納するマップ
   */
  private extractMutationGenericParameters(
    typeArguments: readonly TypeNode[], 
    result: Map<string, string>
  ): void {
    // ResultTypeパラメータ
    if (typeArguments.length > EndpointGenericIndexes.Mutation.ResultType) {
      const resultType = typeArguments[EndpointGenericIndexes.Mutation.ResultType];
      result.set('ResultType', resultType.getText());
    }
    
    // QueryArgパラメータ
    if (typeArguments.length > EndpointGenericIndexes.Mutation.QueryArg) {
      const queryArg = typeArguments[EndpointGenericIndexes.Mutation.QueryArg];
      result.set('QueryArg', queryArg.getText());
    }
    
    // BaseQueryパラメータ（オプショナル）
    if (typeArguments.length > EndpointGenericIndexes.Mutation.BaseQuery) {
      const baseQuery = typeArguments[EndpointGenericIndexes.Mutation.BaseQuery];
      result.set('BaseQuery', baseQuery.getText());
    }
    
    // TagTypesパラメータ（オプショナル）
    if (typeArguments.length > EndpointGenericIndexes.Mutation.TagTypes) {
      const tagTypes = typeArguments[EndpointGenericIndexes.Mutation.TagTypes];
      result.set('TagTypes', tagTypes.getText());
    }
  }

  /**
   * 無限クエリエンドポイントのジェネリクスパラメータを抽出
   * 
   * @param typeArguments 型引数ノード配列
   * @param result 結果を格納するマップ
   */
  private extractInfiniteQueryGenericParameters(
    typeArguments: readonly TypeNode[], 
    result: Map<string, string>
  ): void {
    // ResultTypeパラメータ
    if (typeArguments.length > EndpointGenericIndexes.InfiniteQuery.ResultType) {
      const resultType = typeArguments[EndpointGenericIndexes.InfiniteQuery.ResultType];
      result.set('ResultType', resultType.getText());
    }
    
    // QueryArgパラメータ
    if (typeArguments.length > EndpointGenericIndexes.InfiniteQuery.QueryArg) {
      const queryArg = typeArguments[EndpointGenericIndexes.InfiniteQuery.QueryArg];
      result.set('QueryArg', queryArg.getText());
    }
    
    // PageParamパラメータ
    if (typeArguments.length > EndpointGenericIndexes.InfiniteQuery.PageParam) {
      const pageParam = typeArguments[EndpointGenericIndexes.InfiniteQuery.PageParam];
      result.set('PageParam', pageParam.getText());
    }
    
    // BaseQueryパラメータ（オプショナル）
    if (typeArguments.length > EndpointGenericIndexes.InfiniteQuery.BaseQuery) {
      const baseQuery = typeArguments[EndpointGenericIndexes.InfiniteQuery.BaseQuery];
      result.set('BaseQuery', baseQuery.getText());
    }
    
    // TagTypesパラメータ（オプショナル）
    if (typeArguments.length > EndpointGenericIndexes.InfiniteQuery.TagTypes) {
      const tagTypes = typeArguments[EndpointGenericIndexes.InfiniteQuery.TagTypes];
      result.set('TagTypes', tagTypes.getText());
    }
  }

  /**
   * エンドポイント定義ノードから詳細な型情報を抽出
   * 
   * @param node エンドポイント定義ノード
   * @param endpointType エンドポイントタイプ
   * @returns エンドポイント型情報オブジェクト
   */
  public inferEndpointTypeInfo(
    node: Node, 
    endpointType: EndpointType
  ): EndpointTypeInfo {
    const typeInfo: EndpointTypeInfo = {
      type: endpointType
    };
    
    try {
      // ジェネリクスパラメータの抽出
      const genericParams = this.extractGenericParameters(node, endpointType);
      if (genericParams) {
        // 入力型の設定
        if (genericParams.has('QueryArg')) {
          typeInfo.inputType = genericParams.get('QueryArg');
        }
        
        // 出力型の設定
        if (genericParams.has('ResultType')) {
          typeInfo.outputType = genericParams.get('ResultType');
        }
        
        // ベースクエリ型の設定
        if (genericParams.has('BaseQuery')) {
          typeInfo.baseQueryType = genericParams.get('BaseQuery');
        }
      }
      
      // タグタイプの抽出
      if (Node.isCallExpression(node)) {
        const firstArg = node.getArguments()[0];
        if (firstArg && Node.isObjectLiteralExpression(firstArg)) {
          // providesTags/invalidatesTagsプロパティの解析
          const tagTypes = this.extractTagTypes(firstArg);
          if (tagTypes.length > 0) {
            typeInfo.tagTypes = tagTypes;
          }
        }
      }
      
      return typeInfo;
    } catch (error) {
      logger.error(`[RtkQueryEndpointTypeInference] 型情報推論中にエラー: ${error}`);
      return typeInfo;
    }
  }

  /**
   * エンドポイント定義オブジェクトからタグタイプを抽出
   * 
   * @param objExpr オブジェクトリテラル式
   * @returns 抽出されたタグタイプの配列
   */
  private extractTagTypes(objExpr: Node): string[] {
    const tagTypes: string[] = [];
    
    try {
      if (!Node.isObjectLiteralExpression(objExpr)) {
        return tagTypes;
      }
      
      // providesTags/invalidatesTagsプロパティを検索
      const tagProps = objExpr.getProperties().filter(prop => {
        if (Node.isPropertyAssignment(prop)) {
          const name = prop.getName();
          return name === 'providesTags' || name === 'invalidatesTags';
        }
        return false;
      });
      
      for (const prop of tagProps) {
        if (Node.isPropertyAssignment(prop)) {
          const initializer = prop.getInitializer();
          if (initializer) {
            this.extractTagTypesFromValue(initializer, tagTypes);
          }
        }
      }
      
      return [...new Set(tagTypes)]; // 重複除去
    } catch (error) {
      logger.error(`[RtkQueryEndpointTypeInference] タグタイプ抽出中にエラー: ${error}`);
      return tagTypes;
    }
  }

  /**
   * 値からタグタイプを抽出
   * 
   * @param node 値ノード
   * @param result 結果を格納する配列
   */
  private extractTagTypesFromValue(node: Node, result: string[]): void {
    try {
      // 配列リテラルの処理
      if (Node.isArrayLiteralExpression(node)) {
        for (const element of node.getElements()) {
          this.extractTagTypesFromValue(element, result);
        }
        return;
      }
      
      // 文字列リテラルの処理（直接タグ名として使用される場合）
      if (Node.isStringLiteral(node)) {
        result.push(node.getLiteralValue());
        return;
      }
      
      // オブジェクトリテラルの処理（{ type: 'Tag', id: ... } の形式）
      if (Node.isObjectLiteralExpression(node)) {
        const typeProperty = node.getProperty('type');
        if (typeProperty && Node.isPropertyAssignment(typeProperty)) {
          const initializer = typeProperty.getInitializer();
          if (initializer && Node.isStringLiteral(initializer)) {
            result.push(initializer.getLiteralValue());
          }
        }
        return;
      }
      
      // テンプレート文字列の処理
      if (Node.isTemplateExpression(node)) {
        // TemplateExpressionからヘッダーテキストを取得する方法を修正
        // 正規表現によるテキスト抽出で代替
        const text = node.getText();
        const headerMatch = text.match(/`([^$]*)/);
        if (headerMatch && headerMatch[1]) {
          const headText = headerMatch[1].trim();
          if (headText) {
            result.push(headText);
          }
        }
        return;
      }
      
      // プロパティアクセス式の処理（TagType.Tag形式）
      if (Node.isPropertyAccessExpression(node)) {
        result.push(node.getName());
        return;
      }
    } catch (error) {
      logger.error(`[RtkQueryEndpointTypeInference] タグ値抽出中にエラー: ${error}`);
    }
  }

  /**
   * エンドポイント型から入力型と出力型を解析
   * 
   * @param node 対象ノード
   * @returns 入力型と出力型の情報
   */
  public analyzeInputOutputTypes(node: Node): { inputType?: string; outputType?: string } {
    const result: { inputType?: string; outputType?: string } = {};
    
    try {
      // ノードの型情報を取得
      const type = node.getType();
      if (!type) {
        return result;
      }
      
      // 型の文字列表現を取得
      const typeText = type.getText();
      
      // ジェネリクスパラメータを正規表現で抽出
      // build.query<ResultType, QueryArg, ...> パターンを検出
      const genericMatch = typeText.match(/<([^,>]+),\\s*([^,>]+)/);
      if (genericMatch && genericMatch.length >= 3) {
        result.outputType = genericMatch[1].trim();
        result.inputType = genericMatch[2].trim();
      }
      
      // シンボル情報から型パラメータを抽出する代替アプローチ
      if (!result.inputType || !result.outputType) {
        const symbol = type.getSymbol();
        if (symbol) {
          const declarations = symbol.getDeclarations();
          for (const decl of declarations) {
            if (Node.isCallExpression(decl)) {
              const typeArgs = decl.getTypeArguments();
              if (typeArgs.length >= 2) {
                result.outputType = typeArgs[0].getText();
                result.inputType = typeArgs[1].getText();
              }
            }
          }
        }
      }
      
      return result;
    } catch (error) {
      logger.error(`[RtkQueryEndpointTypeInference] 入出力型解析中にエラー: ${error}`);
      return result;
    }
  }

  /**
   * エンドポイント定義から高度な型情報を抽出する
   * 
   * @param node エンドポイント定義ノード
   * @returns 型情報を含むオブジェクト
   */
  public extractAdvancedTypeInfo(node: Node): Record<string, any> {
    const typeInfo: Record<string, any> = {};
    
    try {
      // 型アノテーション情報の抽出
      const type = node.getType();
      if (type) {
        typeInfo.typeAnnotation = type.getText();
      }
      
      // タイプパラメータの抽出
      if (Node.isCallExpression(node)) {
        const typeArgs = node.getTypeArguments();
        if (typeArgs.length > 0) {
          typeInfo.typeParameters = typeArgs.map(arg => arg.getText());
        }
      }
      
      // 型の詳細プロパティ解析
      if (Node.isCallExpression(node)) {
        const firstArg = node.getArguments()[0];
        if (firstArg && Node.isObjectLiteralExpression(firstArg)) {
          // 戻り値型の変換処理（transformResponse）
          const transformProp = firstArg.getProperty('transformResponse');
          if (transformProp) {
            typeInfo.hasTransformResponse = true;
          }
          
          // queryFnの使用有無を検出
          const queryFnProp = firstArg.getProperty('queryFn');
          if (queryFnProp) {
            typeInfo.usesQueryFn = true;
          }
        }
      }
      
      return typeInfo;
    } catch (error) {
      logger.error(`[RtkQueryEndpointTypeInference] 高度な型情報抽出中にエラー: ${error}`);
      return typeInfo;
    }
  }
}
