/**
 * AST関連ユーティリティ - ノード情報抽出モジュール
 *
 * TypeScriptのASTノードから特定の情報を抽出する関数群を提供します。
 * 複雑な情報抽出処理を共通化し、コードの重複を防止します。
 */

// SyntaxKindは用途を明示するためにインポートしています
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Node, SyntaxKind, SourceFile, TypeChecker } from 'ts-morph';

/**
 * INodeインターフェースを持つオブジェクトかどうかを判別する型ガード
 * @param node 検査対象ノード
 * @returns INodeインターフェースを持つオブジェクトならtrue
 */
function isINode(node: Node | INode): node is INode {
  return 'isKind' in node && typeof node.isKind === 'function';
}

/**
 * ts-morph Nodeかどうかを判別する型ガード
 * @param node 検査対象ノード
 * @returns ts-morph Nodeならtrue
 */
function isTsMorphNode(node: Node | INode): node is Node {
  return !('isKind' in node);
}
import { ISourceFile } from '../../core/ast/interfaces/ISourceFile';
import { INode, NodeKind } from '../../core/ast/interfaces/INode';
import { HttpMethod, UsageLocation } from '../../types';
import { logger } from '../Logger';
import { NodeTraversal } from './NodeTraversal';

/**
 * ノード情報抽出ユーティリティクラス
 */
export class NodeExtractors {
  /**
   * モジュールパスを解決する
   * @param sourceFilePath ソースファイルパス
   * @param moduleSpecifier モジュール指定子
   * @returns 解決されたフルパス
   */
  public static resolveModulePath(sourceFilePath: string, moduleSpecifier: string): string {
    if (!sourceFilePath || !moduleSpecifier) {
      return '';
    }

    // 絶対URLの場合はそのまま返す
    if (moduleSpecifier.startsWith('/') ||
      moduleSpecifier.includes('://')) {
      return moduleSpecifier;
    }

    // 相対URLの解決
    const sourceDirPath = sourceFilePath.substring(0, sourceFilePath.lastIndexOf('/'));
    let resolvedPath = '';

    if (moduleSpecifier.startsWith('./')) {
      resolvedPath = `${sourceDirPath}/${moduleSpecifier.substring(2)}`;
    } else if (moduleSpecifier.startsWith('../')) {
      // 解決が簡単な場合のみ対応
      const parentDir = sourceDirPath.substring(0, sourceDirPath.lastIndexOf('/'));
      resolvedPath = `${parentDir}/${moduleSpecifier.substring(3)}`;
    } else {
      // 単純な名前の場合は同じディレクトリ内と仮定
      resolvedPath = `${sourceDirPath}/${moduleSpecifier}`;
    }

    // 拡張子の付加
    if (!resolvedPath.endsWith('.ts') && !resolvedPath.endsWith('.tsx')) {
      resolvedPath += '.ts';
    }

    return resolvedPath;
  }

  /**
   * HTTPメソッドを抽出
   * @param node 対象ノード
   * @returns HTTPメソッド、推論できない場合はGET
   */
  public static extractHttpMethod(node: Node | INode): HttpMethod {
    // INodeの場合
    if (isINode(node)) {
      // 1. メソッド名から推論: get(), post() 等
      if (node.isKind(NodeKind.CallExpression)) {
        const expression = node.getExpression?.();
        if (expression && expression.isKind(NodeKind.PropertyAccessExpression)) {
          const methodName = expression.getName?.()?.toUpperCase() || '';
          if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(methodName)) {
            return methodName as HttpMethod;
          }
        }
      }

      // 2. オブジェクトリテラル内のメソッドプロパティから推論
      if (node.isKind(NodeKind.ObjectLiteralExpression)) {
        // TODO: INodeインターフェースにgetProperty相当のメソッドを追加する必要がある
        const nodeText = node.getText();
        if (nodeText.includes('"method"') || nodeText.includes("'method'")) {
          if (nodeText.includes('"GET"') || nodeText.includes("'GET'")) return 'GET';
          if (nodeText.includes('"POST"') || nodeText.includes("'POST'")) return 'POST';
          if (nodeText.includes('"PUT"') || nodeText.includes("'PUT'")) return 'PUT';
          if (nodeText.includes('"DELETE"') || nodeText.includes("'DELETE'")) return 'DELETE';
          if (nodeText.includes('"PATCH"') || nodeText.includes("'PATCH'")) return 'PATCH';
          if (nodeText.includes('"OPTIONS"') || nodeText.includes("'OPTIONS'")) return 'OPTIONS';
          if (nodeText.includes('"HEAD"') || nodeText.includes("'HEAD'")) return 'HEAD';
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

    // ts-morph Node の場合（元の実装）
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
  public static extractUrlFromStringLiteral(node: Node | INode): string | null {
    // INodeの場合
    if (isINode(node)) {
      if (node.isKind(NodeKind.StringLiteral)) {
        // INodeインターフェースにはgetLiteralValueメソッドがないため、代替実装
        // クォートを除去して値を抽出
        const text = node.getText();
        if (text.startsWith('"') && text.endsWith('"')) {
          return text.substring(1, text.length - 1);
        }
        if (text.startsWith("'") && text.endsWith("'")) {
          return text.substring(1, text.length - 1);
        }
        return text;
      }
      return null;
    }

    // ts-morph Node の場合
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
  public static extractUrlFromTemplateLiteral(node: Node | INode): string | null {
    // INodeの場合
    if (isINode(node)) {
      if (node.isKind(NodeKind.TemplateExpression)) {
        // INodeインターフェースにはgetHeadやgetTemplateSpansがないため、
        // テキスト処理による代替実装
        const text = node.getText();
        // バッククォートを除去し、テンプレート式を:paramに置換する簡易実装
        return text.replace(/`/g, '')
          .replace(/\${([^}]*)}/g, ':$1');
      }

      // NoSubstitutionTemplateLiteralに相当する場合
      if (node.getText().startsWith('`') && node.getText().endsWith('`')) {
        return node.getText().replace(/`/g, '');
      }

      return null;
    }

    // ts-morph Node の場合
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
  public static extractUrlAndMethodFromObject(node: Node | INode): { path: string | null; method: HttpMethod } {
    // INodeの場合
    if (isINode(node)) {
      if (!node.isKind(NodeKind.ObjectLiteralExpression)) {
        return { path: null, method: 'GET' };
      }

      let path: string | null = null;
      let method: HttpMethod = 'GET';

      // テキスト解析による代替実装
      const nodeText = node.getText();

      // URLプロパティの候補
      const urlPropertyNames = ['url', 'path', 'endpoint', 'uri'];

      for (const propName of urlPropertyNames) {
        // 正規表現でプロパティの値を探す
        const regex = new RegExp(`['"]${propName}['"]\\s*:\\s*['"](.*?)['"]`);
        const match = regex.exec(nodeText);
        if (match && match[1]) {
          path = match[1];
          break;
        }

        // テンプレートリテラルの場合
        if (nodeText.includes(`"${propName}"`) || nodeText.includes(`'${propName}'`)) {
          const propValueRegex = new RegExp(`['"]${propName}['"]\\s*:\\s*\`(.*?)\``);
          const templateMatch = propValueRegex.exec(nodeText);
          if (templateMatch && templateMatch[1]) {
            path = templateMatch[1];
            break;
          }
        }
      }

      // メソッドプロパティを抽出
      const methodRegex = /['"]method['"][\s:]+['"]([A-Z]+)['"]/;
      const methodMatch = methodRegex.exec(nodeText);
      if (methodMatch && methodMatch[1]) {
        const methodStr = methodMatch[1].toUpperCase();
        if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(methodStr)) {
          method = methodStr as HttpMethod;
        }
      }

      return { path, method };
    }

    // ts-morph Node の場合
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
  public static extractUrlFromFirstArgument(node: Node | INode): string | null {
    // INodeの場合
    if (isINode(node)) {
      if (!node.isKind(NodeKind.CallExpression)) {
        return null;
      }

      const args = node.getArguments?.() || [];
      if (args.length === 0) {
        return null;
      }

      const firstArg = args[0];

      // 文字列リテラルの場合
      if (firstArg.isKind(NodeKind.StringLiteral)) {
        return this.extractUrlFromStringLiteral(firstArg);
      }

      // テンプレートリテラルの場合
      if (firstArg.isKind(NodeKind.TemplateExpression) ||
        (firstArg.getText().startsWith('`') && firstArg.getText().endsWith('`'))) {
        return this.extractUrlFromTemplateLiteral(firstArg);
      }

      return null;
    }

    // ts-morph Node の場合
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
  public static createUsageLocation(node: Node | INode, sourceFile: SourceFile | ISourceFile, context?: string): UsageLocation {
    // コンテキスト情報の取得
    if (!context) {
      // INodeの場合
      if (isINode(node)) {
        const parent = NodeTraversal.findFirstAncestor(
          node,
          n => n.isKind(NodeKind.FunctionDeclaration) ||
            n.isKind(NodeKind.MethodDeclaration) ||
            n.isKind(NodeKind.VariableDeclaration)
        );

        if (parent) {
          if ('getName' in parent && typeof parent.getName === 'function') {
            context = parent.getName() || 'anonymous';
          } else {
            context = 'unknown';
          }
        }
      }
      // ts-morph Node の場合
      else if (isTsMorphNode(node)) {
        // ts-morph Nodeの場合はNodeTraversalを使わずに直接親を探索
        let parent: Node | undefined = node.getParent();
        while (parent) {
          if (Node.isFunctionDeclaration(parent) || Node.isMethodDeclaration(parent)) {
            context = parent.getName() || 'anonymous';
            break;
          } else if (Node.isVariableDeclaration(parent)) {
            context = parent.getName();
            break;
          }
          parent = parent.getParent();
        }
      }
    }

    // スニペットを取得（最大100文字）
    const snippet = node.getText().substring(0, 100);

    // ISourceFileの場合
    if ('getRootNode' in sourceFile) {
      return {
        filePath: sourceFile.getFilePath(),
        lineNumber: 1, // ISourceFileにはgetLineAndColumnAtPosが実装されていない場合を想定
        columnNumber: 0,
        context: context || 'unknown',
        codeSnippet: snippet
      };
    }

    // SourceFileの場合
    if (isTsMorphNode(node)) {
      const startPos = node.getStart();
      const { line, column } = sourceFile.getLineAndColumnAtPos(startPos);

      return {
        filePath: sourceFile.getFilePath(),
        lineNumber: line,
        columnNumber: column,
        context: context || 'unknown',
        codeSnippet: snippet
      };
    } else {
      // INodeの場合、正確な位置情報がないのでデフォルト値を使用
      return {
        filePath: sourceFile.getFilePath(),
        lineNumber: 1,
        columnNumber: 0,
        context: context || 'unknown',
        codeSnippet: snippet
      };
    }
  }

  /**
   * オブジェクトプロパティ値の抽出
   * @param obj オブジェクトリテラル式
   * @param propertyName プロパティ名
   * @returns プロパティ値、存在しない場合はundefined
   */
  public static extractPropertyValue(obj: Node | INode, propertyName: string): Node | INode | undefined {
    // INodeの場合
    if (isINode(obj)) {
      if (!obj.isKind(NodeKind.ObjectLiteralExpression)) {
        return undefined;
      }

      // getPropertyに相当する操作が実装されていないため、
      // findDescendantsを使用して代替実装
      const children = obj.getChildren();

      for (const child of children) {
        // PropertyAssignmentに相当する判定
        if (child.getText().startsWith(`"${propertyName}"`) ||
          child.getText().startsWith(`'${propertyName}'`) ||
          child.getText().startsWith(`${propertyName}:`)) {

          // 値部分を抽出（テキスト解析）
          const propText = child.getText();
          const colonIndex = propText.indexOf(':');

          if (colonIndex >= 0 && colonIndex < propText.length - 1) {
            // コロンの後のノードを探す
            const valueNodes = child.getChildren();
            // 最初のノードはプロパティ名、2番目はコロン、3番目が値
            if (valueNodes.length >= 3) {
              return valueNodes[2];
            }
          }
        }
      }

      return undefined;
    }

    // ts-morph Node の場合
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
  node: Node | INode, 
  typeChecker: any // TypeCheckerをanyにして型エラーを回避
  ): Map<string, { name: string; type: string }> {
    const parameters = new Map<string, { name: string; type: string }>();

    try {
      // INodeの場合
      if (isINode(node)) {
        // オブジェクトリテラルの場合
        if (node.isKind(NodeKind.ObjectLiteralExpression)) {
          const properties = node.getChildren().filter(
            p => p.getText().includes(':') ||
              (p.getText().startsWith('"') && p.getText().includes(':')) ||
              (p.getText().startsWith("'") && p.getText().includes(':'))
          );

          for (const property of properties) {
            // プロパティ名を抽出
            const propText = property.getText();
            const colonIndex = propText.indexOf(':');

            if (colonIndex > 0) {
              let propName = propText.substring(0, colonIndex).trim();
              // クォートがある場合は除去
              if ((propName.startsWith('"') && propName.endsWith('"')) ||
                (propName.startsWith("'") && propName.endsWith("'"))) {
                propName = propName.substring(1, propName.length - 1);
              }

              parameters.set(propName, { name: propName, type: 'unknown' });
            }
          }
        }
        // 変数・引数の場合
        else if (node.isKind(NodeKind.Identifier) ||
          (node.getKind() === NodeKind.Unknown && node.getText().includes(':'))) {
          const name = node.getText().split(':')[0].trim();
          parameters.set(name, { name, type: 'unknown' });
        }

        return parameters;
      }

      // ts-morph Node の場合
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
  public static extractRtkQueryConfig(configObj: Node | INode): {
    apiVersion?: number;
    dataApi?: boolean;
    baseUrl?: string;
  } {
    // INodeの場合
    if (isINode(configObj)) {
      if (!configObj.isKind(NodeKind.ObjectLiteralExpression)) {
        return {};
      }

      const result: { apiVersion?: number; dataApi?: boolean; baseUrl?: string } = {};
      const nodeText = configObj.getText();

      // APIバージョンの抽出
      const versionRegex = /['"]version['"][\s:]+(\d+)/;
      const versionMatch = versionRegex.exec(nodeText);
      if (versionMatch && versionMatch[1]) {
        result.apiVersion = parseInt(versionMatch[1], 10);
      }

      // dataApiフラグの抽出
      const dataApiRegex = /['"]dataApi['"][\s:]+true/;
      if (dataApiRegex.test(nodeText)) {
        result.dataApi = true;
      }

      // baseUrlの抽出
      const baseUrlRegex = /['"]baseUrl['"][\s:]+['"]([^'"]+)['"]/;
      const baseUrlMatch = baseUrlRegex.exec(nodeText);
      if (baseUrlMatch && baseUrlMatch[1]) {
        result.baseUrl = baseUrlMatch[1];
      }

      return result;
    }

    // ts-morph Node の場合
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
  public static extractObjectArgument(callExpr: Node | INode, argIndex: number = 0): Node | INode | undefined {
    // INodeの場合
    if (isINode(callExpr)) {
      if (!callExpr.isKind(NodeKind.CallExpression)) {
        return undefined;
      }

      const args = callExpr.getArguments?.() || [];
      if (args.length <= argIndex) {
        return undefined;
      }

      const arg = args[argIndex];
      if (arg.isKind(NodeKind.ObjectLiteralExpression)) {
        return arg;
      }

      return undefined;
    }

    // ts-morph Node の場合
    if (isTsMorphNode(callExpr)) {
      if (!Node.isCallExpression(callExpr)) {
        return undefined;
      }
    } else {
      // INodeの場合はすでに処理済み
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
  public static extractBuilderParamName(node: Node | INode): string {
    // INodeの場合
    if (isINode(node)) {
      if (!node.isKind(NodeKind.ArrowFunction)) {
        return 'builder';
      }

      // 最初の子ノードからパラメータを抽出（簡易実装）
      const children = node.getChildren();
      for (const child of children) {
        const text = child.getText();
        if (text && !text.includes('=>')) {
          // カンマやカッコ、型情報を取り除く
          const cleanedParam = text.replace(/[(),]/g, '').split(':')[0].trim();
          if (cleanedParam) {
            return cleanedParam;
          }
        }
      }

      return 'builder';
    }

    // ts-morph Node の場合
    if (isTsMorphNode(node)) {
      if (!Node.isArrowFunction(node)) {
        return 'builder';
      }
    } else {
      // INodeの場合はすでに処理済み
      return 'builder';
    }

    const parameters = node.getParameters();
    if (parameters.length === 0) {
      return 'builder';
    }

    return parameters[0].getName() || 'builder';
  }
}
