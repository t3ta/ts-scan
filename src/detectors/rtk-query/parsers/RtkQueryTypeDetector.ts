/**
 * RTK Query型検出モジュール
 * 
 * RTK Queryの型システムを使用して、エンドポイントの種別（クエリ/ミューテーション）を
 * 型レベルで正確に判定するためのユーティリティを提供します。
 * TypeScriptの高度な型推論機能を活用して静的な型安全性を実現します。
 */

import { Node, SourceFile, Type, Symbol as TsMorphSymbol } from 'ts-morph';
import { logger } from '../../../utils/Logger';
import { EndpointType, QueryEndpointTypes, MutationEndpointTypes, InfiniteQueryEndpointTypes } from './RtkQueryTypeDefinitions';

/**
 * RTK Query型検出クラス
 * エンドポイントの型情報を解析し、その種別を判別します
 */
export class RtkQueryTypeDetector {
  /**
   * エンドポイント定義ノードから型情報を抽出し、エンドポイントタイプを判定します
   * 
   * @param node エンドポイント定義ノード
   * @returns エンドポイントタイプ（クエリまたはミューテーション）
   */
  public detectEndpointType(node: Node): EndpointType | undefined {
    try {
      logger.debug(`[RtkQueryTypeDetector] エンドポイント型検出開始: ${node.getKindName()}`);
      
      // PropertyAccessExpression (builder.query/mutation) の場合の処理
      if (Node.isPropertyAccessExpression(node)) {
        const propertyName = node.getName();
        // 単純なメソッド名による判定（フォールバック）
        if (propertyName === 'query') {
          return EndpointType.Query;
        } else if (propertyName === 'mutation') {
          return EndpointType.Mutation;
        } else if (propertyName === 'infiniteQuery') {
          return EndpointType.InfiniteQuery;
        }
      }
      
      // 型情報が利用可能な場合は型ベースの検出を試みる
      return this.detectEndpointTypeFromTypeSystem(node);
    } catch (error) {
      logger.error(`[RtkQueryTypeDetector] 型検出中にエラー発生: ${error}`);
      return undefined;
    }
  }

  /**
   * 型システムを使用してエンドポイントの種別を検出します
   * 
   * @param node 対象ノード
   * @returns エンドポイントタイプまたはundefined
   */
  private detectEndpointTypeFromTypeSystem(node: Node): EndpointType | undefined {
    try {
      // ノードのType情報を取得
      const typeInfo = node.getType();
      if (!typeInfo) {
        return undefined;
      }
      
      // 型の表示名を取得
      const typeText = typeInfo.getText();
      logger.debug(`[RtkQueryTypeDetector] ノードの型: ${typeText}`);
      
      // 型シグネチャを解析
      if (this.isQueryEndpointType(typeInfo)) {
        return EndpointType.Query;
      } else if (this.isMutationEndpointType(typeInfo)) {
        return EndpointType.Mutation;
      } else if (this.isInfiniteQueryEndpointType(typeInfo)) {
        return EndpointType.InfiniteQuery;
      }
      
      // 型からシンボルを取得
      const symbol = typeInfo.getSymbol();
      if (symbol) {
        const symbolName = symbol.getName();
        logger.debug(`[RtkQueryTypeDetector] シンボル名: ${symbolName}`);
        
        // シンボル名による判定
        if (symbolName.includes('Query')) {
          return EndpointType.Query;
        } else if (symbolName.includes('Mutation')) {
          return EndpointType.Mutation;
        } else if (symbolName.includes('InfiniteQuery')) {
          return EndpointType.InfiniteQuery;
        }
      }
      
      // メソッド呼び出しの場合、呼び出し式を調査
      if (Node.isCallExpression(node)) {
        const expression = node.getExpression();
        if (Node.isPropertyAccessExpression(expression)) {
          const methodName = expression.getName();
          
          if (methodName === 'query') {
            return EndpointType.Query;
          } else if (methodName === 'mutation') {
            return EndpointType.Mutation;
          } else if (methodName === 'infiniteQuery') {
            return EndpointType.InfiniteQuery;
          }
        }
      }
      
      return undefined;
    } catch (error) {
      logger.error(`[RtkQueryTypeDetector] 型システムからの検出中にエラー: ${error}`);
      return undefined;
    }
  }

  /**
   * 型がQueryエンドポイント型かどうかを判定
   * 
   * @param type 検査する型
   * @returns Queryエンドポイント型ならtrue
   */
  private isQueryEndpointType(type: Type): boolean {
    const typeText = type.getText();
    
    // QueryDefinitionタイプチェック
    for (const queryType of QueryEndpointTypes) {
      if (typeText.includes(queryType)) {
        return true;
      }
    }
    
    // インターフェース階層を検査
    const interfaces = this.getBaseInterfaces(type);
    for (const iface of interfaces) {
      const ifaceName = iface.getName();
      for (const queryType of QueryEndpointTypes) {
        if (ifaceName.includes(queryType)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * 型がMutationエンドポイント型かどうかを判定
   * 
   * @param type 検査する型
   * @returns Mutationエンドポイント型ならtrue
   */
  private isMutationEndpointType(type: Type): boolean {
    const typeText = type.getText();
    
    // MutationDefinitionタイプチェック
    for (const mutationType of MutationEndpointTypes) {
      if (typeText.includes(mutationType)) {
        return true;
      }
    }
    
    // インターフェース階層を検査
    const interfaces = this.getBaseInterfaces(type);
    for (const iface of interfaces) {
      const ifaceName = iface.getName();
      for (const mutationType of MutationEndpointTypes) {
        if (ifaceName.includes(mutationType)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * 型がInfiniteQueryエンドポイント型かどうかを判定
   * 
   * @param type 検査する型
   * @returns InfiniteQueryエンドポイント型ならtrue
   */
  private isInfiniteQueryEndpointType(type: Type): boolean {
    const typeText = type.getText();
    
    // InfiniteQueryDefinitionタイプチェック
    if (typeText.includes('InfiniteQueryDefinition') || typeText.includes('build.infiniteQuery')) {
      return true;
    }
    
    // インターフェース階層を検査
    const interfaces = this.getBaseInterfaces(type);
    for (const iface of interfaces) {
      const ifaceName = iface.getName();
      for (const infiniteQueryType of InfiniteQueryEndpointTypes) {
        if (ifaceName.includes(infiniteQueryType)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * 型のベースインターフェースを取得
   * 
   * @param type 対象の型
   * @returns ベースインターフェースのシンボル配列
   */
  private getBaseInterfaces(type: Type): TsMorphSymbol[] {
    try {
      const interfaces: TsMorphSymbol[] = [];
      
      // シンボルの取得
      const symbol = type.getSymbol();
      if (!symbol) {
        return [];
      }
      
      // 宣言ノードを取得
      const declarations = symbol.getDeclarations();
      for (const declaration of declarations) {
        // インターフェース宣言の場合
        if (Node.isInterfaceDeclaration(declaration)) {
          // extends句の処理
          const extendsClause = declaration.getExtends();
          for (const extend of extendsClause) {
            const extendType = extend.getType();
            const extendSymbol = extendType.getSymbol();
            if (extendSymbol) {
              interfaces.push(extendSymbol);
            }
          }
        }
        
        // 型エイリアス宣言の場合
        if (Node.isTypeAliasDeclaration(declaration)) {
          const aliasedType = declaration.getType();
          const aliasedSymbol = aliasedType.getSymbol();
          if (aliasedSymbol) {
            interfaces.push(aliasedSymbol);
          }
        }
      }
      
      return interfaces;
    } catch (error) {
      logger.error(`[RtkQueryTypeDetector] ベースインターフェース取得中にエラー: ${error}`);
      return [];
    }
  }

  /**
   * エンドポイント定義からエンドポイント構成情報を抽出
   * 
   * @param node エンドポイント定義ノード
   * @returns エンドポイント構成情報
   */
  public extractEndpointConfiguration(node: Node): Record<string, any> {
    const configuration: Record<string, any> = {};
    
    try {
      // CallExpressionのみを処理
      if (!Node.isCallExpression(node)) {
        return configuration;
      }
      
      // 最初の引数を取得
      const firstArg = node.getArguments()[0];
      if (!firstArg || !Node.isObjectLiteralExpression(firstArg)) {
        return configuration;
      }
      
      // オブジェクトリテラルのプロパティを解析
      for (const prop of firstArg.getProperties()) {
        if (Node.isPropertyAssignment(prop)) {
          const propName = prop.getName();
          const initializer = prop.getInitializer();
          
          if (initializer) {
            // 文字列リテラルの場合
            if (Node.isStringLiteral(initializer)) {
              configuration[propName] = initializer.getLiteralValue();
            }
            // 数値リテラルの場合
            else if (Node.isNumericLiteral(initializer)) {
              configuration[propName] = initializer.getLiteralValue();
            }
            // ブール値リテラルの場合
            else if (initializer.getKind() === 110 /* TrueKeyword */ || initializer.getKind() === 111 /* FalseKeyword */) {
              configuration[propName] = initializer.getKind() === 110 /* TrueKeyword */;
            }
            // その他の場合はテキスト表現を格納
            else {
              configuration[propName] = initializer.getText();
            }
          }
        }
      }
      
      return configuration;
    } catch (error) {
      logger.error(`[RtkQueryTypeDetector] エンドポイント構成抽出中にエラー: ${error}`);
      return configuration;
    }
  }
}
