/**
 * AST関連ユーティリティ - ノード情報抽出モジュール
 * 
 * TypeScriptのASTノードから特定の情報を抽出する関数群を提供します。
 * 複雑な情報抽出処理を共通化し、コードの重複を防止します。
 */

// SyntaxKindは用途を明示するためにインポートしています
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Node, SyntaxKind, SourceFile, TypeChecker } from 'ts-morph';
import { HttpMethod, UsageLocation } from '../../types';
import { logger } from '../Logger';
import { NodeTraversal } from './NodeTraversal';

/**
 * ノード情報抽出ユーティリティクラス
 */
export class NodeExtractors {
  /**
   * HTTPメソッドを抽出
   * @param node 対象ノード
   * @returns HTTPメソッド、推論できない場合はGET
   */
  public static extractHttpMethod(node: Node): HttpMethod {
    // 1. メソッド名から推論: get(), post() 等
    if (Node.isCallExpression(node)) {
      const expression = node.getExpression();
      if (Node.isPropertyAccessExpression(expression)) {
        const methodName = expression.getName().toUpperCase();
        if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(methodName)) {
          return methodName as HttpMethod;
        }
      }
    }
    
    // 2. オブジェクトリテラル内のメソッドプロパティから推論
    if (Node.isObjectLiteralExpression(node)) {
      const methodProp = node.getProperty('method');
      if (methodProp && Node.isPropertyAssignment(methodProp)) {
        const initializer = methodProp.getInitializer();
        
        if (Node.isStringLiteral(initializer)) {
          const methodStr = initializer.getLiteralValue().toUpperCase();
          if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(methodStr)) {
            return methodStr as HttpMethod;
          }
        }
      }
    }
    
    // 3. ノードテキスト内の手がかりから推論
    const nodeText = node.getText().toLowerCase();
    
    if (nodeText.includes('create') || 
        nodeText.includes('add') || 
        nodeText.includes('post') ||
        nodeText.includes('submit')) {
      return 'POST';
    }
    
    if (nodeText.includes('update') || 
        nodeText.includes('edit') || 
        nodeText.includes('modify') ||
        nodeText.includes('put')) {
      return 'PUT';
    }
    
    if (nodeText.includes('delete') || 
        nodeText.includes('remove') || 
        nodeText.includes('destroy')) {
      return 'DELETE';
    }
    
    if (nodeText.includes('patch')) {
      return 'PATCH';
    }
    
    // デフォルトはGET
    return 'GET';
  }
  
  /**
   * 文字列リテラルからURLパスを抽出
   * @param node 対象ノード
   * @returns URLパス、見つからない場合はnull
   */
  public static extractUrlFromStringLiteral(node: Node): string | null {
    if (Node.isStringLiteral(node)) {
      const value = node.getLiteralValue();
      return value;
    }
    
    return null;
  }
  
  /**
   * テンプレートリテラルからURLパスを抽出
   * @param node 対象ノード
   * @returns URLパス、見つからない場合はnull
   */
  public static extractUrlFromTemplateLiteral(node: Node): string | null {
    if (Node.isTemplateExpression(node)) {
      // テンプレートヘッドからベースパスを取得
      let path = node.getHead().getText().replace(/`/g, '');
      
      // 各スパンを処理
      const spans = node.getTemplateSpans();
      for (const span of spans) {
        const expression = span.getExpression();
        
        // 変数式を:paramスタイルのプレースホルダーに置換
        if (Node.isIdentifier(expression)) {
          path += `:${expression.getText()}`;
        } else {
          path += ':{param}';
        }
        
        // リテラル部分を追加
        path += span.getLiteral().getText().replace(/`/g, '');
      }
      
      return path;
    }
    
    if (Node.isNoSubstitutionTemplateLiteral(node)) {
      return node.getLiteralText();
    }
    
    return null;
  }
  
  /**
   * オブジェクトからURLプロパティとメソッドプロパティを抽出
   * @param node 対象ノード
   * @returns URLパスとHTTPメソッド
   */
  public static extractUrlAndMethodFromObject(node: Node): { path: string | null; method: HttpMethod } {
    if (!Node.isObjectLiteralExpression(node)) {
      return { path: null, method: 'GET' };
    }
    
    let path: string | null = null;
    let method: HttpMethod = 'GET';
    
    // URLプロパティの候補
    const urlPropertyNames = ['url', 'path', 'endpoint', 'uri'];
    
    // 各候補を順に試す
    for (const propName of urlPropertyNames) {
      const urlProp = node.getProperty(propName);
      if (urlProp && Node.isPropertyAssignment(urlProp)) {
        const initializer = urlProp.getInitializer();
        
        if (Node.isStringLiteral(initializer)) {
          path = initializer.getLiteralValue();
          break;
        } else if (Node.isTemplateExpression(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer)) {
          path = this.extractUrlFromTemplateLiteral(initializer);
          break;
        }
      }
    }
    
    // メソッドプロパティを抽出
    const methodProp = node.getProperty('method');
    if (methodProp && Node.isPropertyAssignment(methodProp)) {
      const initializer = methodProp.getInitializer();
      
      if (Node.isStringLiteral(initializer)) {
        const methodStr = initializer.getLiteralValue().toUpperCase();
        if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(methodStr)) {
          method = methodStr as HttpMethod;
        }
      }
    }
    
    return { path, method };
  }
  
  /**
   * 関数呼び出しの第一引数からURLを抽出
   * @param node 対象ノード
   * @returns URLパス、見つからない場合はnull
   */
  public static extractUrlFromFirstArgument(node: Node): string | null {
    if (!Node.isCallExpression(node)) {
      return null;
    }
    
    const args = node.getArguments();
    if (args.length === 0) {
      return null;
    }
    
    const firstArg = args[0];
    
    // 文字列リテラルの場合
    if (Node.isStringLiteral(firstArg)) {
      return firstArg.getLiteralValue();
    }
    
    // テンプレートリテラルの場合
    if (Node.isTemplateExpression(firstArg) || Node.isNoSubstitutionTemplateLiteral(firstArg)) {
      return this.extractUrlFromTemplateLiteral(firstArg);
    }
    
    // 変数参照の場合は型チェッカーを使った解析が必要
    
    return null;
  }
  
  /**
   * 使用箇所情報の作成
   * @param node 対象ノード
   * @param sourceFile ソースファイル
   * @param context コンテキスト情報
   * @returns 使用箇所情報
   */
  public static createUsageLocation(node: Node, sourceFile: SourceFile, context?: string): UsageLocation {
    // 関数や変数定義のコンテキストを探す
    if (!context) {
      const parent = NodeTraversal.findFirstAncestor(
        node,
        n => Node.isFunctionDeclaration(n) || 
            Node.isMethodDeclaration(n) || 
            Node.isVariableDeclaration(n)
      );
      
      if (parent) {
        if (Node.isFunctionDeclaration(parent) || Node.isMethodDeclaration(parent)) {
          context = parent.getName() || 'anonymous';
        } else if (Node.isVariableDeclaration(parent)) {
          context = parent.getName();
        }
      }
    }
    
    // スニペットを取得（最大100文字）
    const startPos = node.getStart();
    const snippet = node.getText().substring(0, 100);
    
    return {
      filePath: sourceFile.getFilePath(),
      // 行番号を安全に算出（デフォルトは1行目）
      lineNumber: 1,
      columnNumber: startPos,
      context: context || 'unknown',
      codeSnippet: snippet
    };
  }
  
  /**
   * オブジェクトプロパティ値の抽出
   * @param obj オブジェクトリテラル式
   * @param propertyName プロパティ名
   * @returns プロパティ値、存在しない場合はundefined
   */
  public static extractPropertyValue(obj: Node, propertyName: string): Node | undefined {
    if (!Node.isObjectLiteralExpression(obj)) {
      return undefined;
    }
    
    const property = obj.getProperty(propertyName);
    if (!property || !Node.isPropertyAssignment(property)) {
      return undefined;
    }
    
    return property.getInitializer();
  }
  
  /**
   * 変数名から API名を推定
   * @param variableName 変数名
   * @returns 推定されたAPI名
   */
  public static inferApiNameFromVariable(variableName: string): string {
    // すでにAPI名として良い形式であれば、そのまま返す
    if (variableName === 'api' || 
        variableName.endsWith('Api') || 
        variableName.endsWith('API')) {
      return variableName;
    }
    
    // 末尾にApiを追加
    if (!variableName.toLowerCase().includes('api')) {
      return `${variableName}Api`;
    }
    
    return variableName;
  }
  
  /**
   * ファイル名から機能カテゴリを推定
   * @param filePath ファイルパス
   * @returns 推定された機能カテゴリ
   */
  public static inferFeatureCategoryFromPath(filePath: string): string {
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1];
    
    // Endpointsファイルの場合
    if (fileName.includes('Endpoints') || fileName.includes('endpoints')) {
      return fileName.replace(/Endpoints\.tsx?$|endpoints\.tsx?$|\.tsx?$/i, '');
    }
    
    // APIファイルの場合
    if (fileName.includes('Api') || fileName.includes('API')) {
      return fileName.replace(/Api\.tsx?$|API\.tsx?$|\.tsx?$/i, '');
    }
    
    // featuresディレクトリ構造の場合
    const featuresIndex = parts.findIndex(part => 
      part === 'features' || part === 'modules' || part === 'pages'
    );
    
    if (featuresIndex >= 0 && featuresIndex < parts.length - 1) {
      return parts[featuresIndex + 1];
    }
    
    // デフォルト: ファイル名から拡張子を除去
    return fileName.replace(/\.tsx?$/, '');
  }
  
  /**
   * 引数ノードからパラメータ情報を抽出
   * @param node 対象ノード（関数引数）
   * @param typeChecker タイプチェッカー
   * @returns パラメータ名と型情報のマップ
   */
  public static extractParametersFromNode(
    node: Node, 
    typeChecker: TypeChecker
  ): Map<string, { name: string; type: string }> {
    const parameters = new Map<string, { name: string; type: string }>();
    
    try {
      // オブジェクトリテラルの場合
      if (Node.isObjectLiteralExpression(node)) {
        const properties = node.getProperties();
        
        for (const property of properties) {
          if (Node.isPropertyAssignment(property) || 
              Node.isShorthandPropertyAssignment(property)) {
            
            const propName = property.getName();
            let typeName = 'unknown';
            
            try {
              const propType = typeChecker.getTypeAtLocation(property);
              typeName = propType.getText();
            } catch (e) {
              // 型情報の取得に失敗した場合は無視
            }
            
            parameters.set(propName, { name: propName, type: typeName });
          }
        }
      }
      // 変数・引数の場合
      else if (Node.isIdentifier(node) || Node.isParameterDeclaration?.(node)) {
        const name = Node.isIdentifier(node) ? node.getText() : Node.isParameterDeclaration?.(node) ? node.getName?.() || node.getText() : node.getText();
        let typeName = 'unknown';
        
        try {
          const nodeType = typeChecker.getTypeAtLocation(node);
          typeName = nodeType.getText();
          
          // オブジェクト型の場合はプロパティを展開
          if (typeName.includes('{') && typeName.includes('}')) {
            const properties = nodeType.getProperties();
            
            for (const property of properties) {
              const propName = property.getName();
              let propTypeName = 'unknown';
              
              try {
                const declarations = property.getDeclarations();
                if (declarations && declarations.length > 0) {
                  const propType = typeChecker.getTypeAtLocation(declarations[0]);
                  propTypeName = propType.getText();
                }
              } catch (e) {
                // 型情報の取得に失敗した場合は無視
              }
              
              parameters.set(propName, { name: propName, type: propTypeName });
            }
            
            return parameters; // オブジェクトプロパティを展開したので終了
          }
        } catch (e) {
          // 型情報の取得に失敗した場合は無視
        }
        
        parameters.set(name, { name, type: typeName });
      }
    } catch (error) {
      logger.error(`パラメータ情報抽出中にエラーが発生: ${error}`);
    }
    
    return parameters;
  }
  
  /**
   * URLパスからパスパラメータを抽出
   * @param urlPattern URLパターン文字列
   * @returns パラメータ名の配列
   */
  public static extractPathParameters(urlPattern: string): string[] {
    if (!urlPattern) return [];
    
    const params: string[] = [];
    
    // :param 形式のパラメータ
    const colonParams = urlPattern.match(/:([a-zA-Z0-9_]+)/g);
    if (colonParams) {
      for (const param of colonParams) {
        params.push(param.substring(1)); // ':'を削除
      }
    }
    
    // {param} 形式のパラメータ
    const braceParams = urlPattern.match(/{([a-zA-Z0-9_]+)}/g);
    if (braceParams) {
      for (const param of braceParams) {
        params.push(param.substring(1, param.length - 1)); // '{' と '}'を削除
      }
    }
    
    return params;
  }
  
  /**
   * RTK Query固有の設定情報を抽出
   * @param configObj 設定オブジェクト
   * @returns API情報関連設定
   */
  public static extractRtkQueryConfig(configObj: Node): {
    apiVersion?: number;
    dataApi?: boolean;
    baseUrl?: string;
  } {
    if (!Node.isObjectLiteralExpression(configObj)) {
      return {};
    }
    
    const result: { apiVersion?: number; dataApi?: boolean; baseUrl?: string } = {};
    
    // extraOptionsプロパティの確認
    const extraOptionsProp = configObj.getProperty('extraOptions');
    if (extraOptionsProp && Node.isPropertyAssignment(extraOptionsProp)) {
      const extraOptionsObj = extraOptionsProp.getInitializer();
      if (Node.isObjectLiteralExpression(extraOptionsObj)) {
        // APIバージョンの確認
        const versionProp = extraOptionsObj.getProperty('version');
        if (versionProp && Node.isPropertyAssignment(versionProp)) {
          const versionValue = versionProp.getInitializer();
          if (Node.isNumericLiteral(versionValue)) {
            result.apiVersion = parseInt(versionValue.getText(), 10);
          }
        }
        
        // dataApiフラグの確認
        const dataApiProp = extraOptionsObj.getProperty('dataApi');
        if (dataApiProp && Node.isPropertyAssignment(dataApiProp)) {
          const dataApiValue = dataApiProp.getInitializer();
          if (Node.isTrueLiteral(dataApiValue)) {
            result.dataApi = true;
          }
        }
      }
    }
    
    // baseUrlプロパティの確認
    const baseUrlProp = configObj.getProperty('baseUrl');
    if (baseUrlProp && Node.isPropertyAssignment(baseUrlProp)) {
      const baseUrlValue = baseUrlProp.getInitializer();
      if (Node.isStringLiteral(baseUrlValue)) {
        result.baseUrl = baseUrlValue.getLiteralValue();
      }
    }
    
    return result;
  }
  
  /**
   * 関数呼び出しから引数オブジェクトを抽出
   * @param callExpr 関数呼び出し式
   * @param argIndex 引数インデックス（デフォルト: 0）
   * @returns オブジェクトリテラル、存在しない場合はundefined
   */
  public static extractObjectArgument(callExpr: Node, argIndex: number = 0): Node | undefined {
    if (!Node.isCallExpression(callExpr)) {
      return undefined;
    }
    
    const args = callExpr.getArguments();
    if (args.length <= argIndex) {
      return undefined;
    }
    
    const arg = args[argIndex];
    if (Node.isObjectLiteralExpression(arg)) {
      return arg;
    }
    
    return undefined;
  }
  
  /**
   * RTK Queryエンドポイントビルダーパラメータ名を抽出
   * @param node 対象ノード（通常はArrowFunction）
   * @returns ビルダーパラメータ名、取得できない場合はデフォルト
   */
  public static extractBuilderParamName(node: Node): string {
    if (!Node.isArrowFunction(node)) {
      return 'builder';
    }
    
    const parameters = node.getParameters();
    if (parameters.length === 0) {
      return 'builder';
    }
    
    return parameters[0].getName() || 'builder';
  }
}
