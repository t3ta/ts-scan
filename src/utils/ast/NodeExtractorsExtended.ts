import { Node, SyntaxKind, SourceFile, Expression, ParameterDeclaration } from 'ts-morph';
import { ISourceFile } from '../../core/ast/interfaces/ISourceFile';
import { INode, NodeKind } from '../../core/ast/interfaces/INode';
import { logger } from '../Logger';
import { NodeTraversal } from './NodeTraversal';
import { NodeExtractors } from './NodeExtractors';

export interface ObjectProperty {
  name: string;
  value: Expression | INode | undefined;
}

export interface TypeAnnotationInfo {
  typeName: string;
  location?: { line: number; column: number };
}

export class NodeExtractorsExtended {
  /**
   * モジュールパスを解決する
   * @param sourceFilePath ソースファイルパス
   * @param moduleSpecifier モジュール指定子
   * @returns 解決されたフルパス
   */
  public static resolveModulePath(sourceFilePath: string, moduleSpecifier: string): string {
    return NodeExtractors.resolveModulePath(sourceFilePath, moduleSpecifier);
  }

  /**
   * JSONコンテンツをボディから抽出する関数
   */
  public static extractJsonContentFromBody(node: Node | INode): { [key: string]: any } | undefined {
    // INodeの場合
    if ('isKind' in node && typeof node.isKind === 'function') {
      if (!node.isKind(NodeKind.ObjectLiteralExpression)) {
        return undefined;
      }

      const result: { [key: string]: any } = {};
      const properties = node.getChildren().filter(
        p => p.getText().includes(':') ||
          (p.getText().startsWith('"') && p.getText().includes(':')) ||
          (p.getText().startsWith("'") && p.getText().includes(':'))
      );

      for (const prop of properties) {
        // プロパティ名と値を抽出
        const propText = prop.getText();
        const colonIndex = propText.indexOf(':');

        if (colonIndex > 0) {
          let propName = propText.substring(0, colonIndex).trim();
          // クォートがある場合は除去
          if ((propName.startsWith('"') && propName.endsWith('"')) ||
            (propName.startsWith("'") && propName.endsWith("'"))) {
            propName = propName.substring(1, propName.length - 1);
          }

          // 値部分の抽出
          if (colonIndex < propText.length - 1) {
            const valueText = propText.substring(colonIndex + 1).trim();
            result[propName] = this.extractValueFromText(valueText);
          }
        }
      }

      return result;
    }

    // ts-morph Node の場合
    if (!Node.isObjectLiteralExpression(node)) {
      return undefined;
    }

    const result: { [key: string]: any } = {};
    const properties = node.getProperties();

    for (const prop of properties) {
      if (Node.isPropertyAssignment(prop)) {
        const name = prop.getName();
        const value = prop.getInitializer();
        if (value) {
          result[name] = this.extractValueFromNode(value);
        }
      }
    }

    return result;
  }

  /**
   * ノードから値を抽出するヘルパー関数（ts-morphノード用）
   */
  private static extractValueFromNode(node: Node): any {
    if (Node.isStringLiteral(node)) {
      return node.getText().replace(/['"]/g, '');
    }
    if (Node.isNumericLiteral(node)) {
      return Number(node.getText());
    }
    if (node.getKind() === SyntaxKind.TrueKeyword || node.getKind() === SyntaxKind.FalseKeyword) {
      return node.getText() === 'true';
    }
    if (Node.isObjectLiteralExpression(node)) {
      return this.extractJsonContentFromBody(node);
    }
    if (Node.isArrayLiteralExpression(node)) {
      return node.getElements().map(el => this.extractValueFromNode(el));
    }
    return undefined;
  }

  /**
   * テキストから値を抽出するヘルパー関数（INode用）
   */
  private static extractValueFromText(text: string): any {
    // 文字列リテラルの場合
    if ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))) {
      return text.substring(1, text.length - 1);
    }

    // 数値リテラルの場合
    if (/^-?\d+(\.\d+)?$/.test(text)) {
      return Number(text);
    }

    // ブール値の場合
    if (text === 'true') return true;
    if (text === 'false') return false;

    // オブジェクトリテラルの場合
    if (text.startsWith('{') && text.endsWith('}')) {
      try {
        return JSON.parse(text.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":'));
      } catch (e) {
        // JSONパースに失敗した場合は未定義を返す
        return undefined;
      }
    }

    // 配列リテラルの場合
    if (text.startsWith('[') && text.endsWith(']')) {
      try {
        return JSON.parse(text);
      } catch (e) {
        // JSONパースに失敗した場合は空配列を返す
        return [];
      }
    }

    return undefined;
  }

  /**
   * ソースファイル内の変数宣言を検索する関数
   * @deprecated 抽象化層のため使用を推奨しない。代わりにISourceFile.findNodesを使用する。
   */
  public static findVariableDeclarations(sourceFile: SourceFile | ISourceFile, variableName: string): Node[] | INode[] {
    // ISourceFileの場合は findNodes メソッドを使用
    if ('getRootNode' in sourceFile) {
      return sourceFile.findNodes(
        node => node.isKind(NodeKind.VariableDeclaration) &&
          node.getText().startsWith(variableName)
      );
    }

    // SourceFileの場合
    return sourceFile
      .getDescendantsOfKind(SyntaxKind.VariableDeclaration)
      .filter(decl => decl.getName() === variableName);
  }

  /**
   * ノード位置情報を安全に取得する関数
   */
  public static getNodeLocation(node: Node | INode): { line: number; column: number; sourceFile: string } {
    // INodeの場合
    if ('getLocation' in node && typeof node.getLocation === 'function') {
      const location = node.getLocation();
      const sourceFile = node.getSourceFile();

      return {
        line: location.line,
        column: location.column,
        sourceFile: typeof sourceFile.getFilePath === 'function' ?
          sourceFile.getFilePath() :
          'unknown'
      };
    }

    // ts-morph Node の場合
    const sourceFile = node.getSourceFile();
    const pos = node.getStart();
    const lineAndChar = sourceFile.getLineAndColumnAtPos(pos);

    return {
      line: lineAndChar.line,
      column: lineAndChar.column,
      sourceFile: sourceFile.getFilePath()
    };
  }

  /**
   * 文字列値を安全に抽出する関数
   */
  public static extractStringValue(node: Node | INode | undefined): string | null {
    if (!node) return null;

    // INodeの場合
    if ('isKind' in node && typeof node.isKind === 'function') {
      if (node.isKind(NodeKind.StringLiteral)) {
        const text = node.getText();
        // クォートを取り除く
        if ((text.startsWith('"') && text.endsWith('"')) ||
          (text.startsWith("'") && text.endsWith("'"))) {
          return text.substring(1, text.length - 1);
        }
        return text;
      }

      // プロパティアサインメントに相当する場合
      if (node.getKind() === NodeKind.Unknown && node.getText().includes(':')) {
        const text = node.getText();
        const colonIndex = text.indexOf(':');

        if (colonIndex > 0 && colonIndex < text.length - 1) {
          const valueText = text.substring(colonIndex + 1).trim();

          // 文字列リテラルの場合
          if ((valueText.startsWith('"') && valueText.endsWith('"')) ||
            (valueText.startsWith("'") && valueText.endsWith("'"))) {
            return valueText.substring(1, valueText.length - 1);
          }
        }
      }

      return null;
    }

    // ts-morph Node の場合
    if (Node.isStringLiteral(node)) {
      return node.getText().replace(/['"]/g, '');
    }

    if (Node.isPropertyAssignment(node)) {
      const initializer = node.getInitializer();
      return initializer && Node.isStringLiteral(initializer)
        ? initializer.getText().replace(/['"]/g, '')
        : null;
    }

    return null;
  }

  /**
   * オブジェクトリテラルからプロパティ値を抽出する関数
   */
  public static getPropertyFromObjectLiteral(node: Node | INode, propertyName: string): Expression | INode | undefined {
    return this.extractPropertyValue(node, propertyName);
  }

  /**
   * オブジェクトリテラルからプロパティ値を抽出する関数
   */
  public static extractPropertyValue(node: Node | INode, propertyName: string): Expression | INode | undefined {
    // INodeの場合
    if ('isKind' in node && typeof node.isKind === 'function') {
      if (!node.isKind(NodeKind.ObjectLiteralExpression)) {
        return undefined;
      }

      // getPropertyに相当する操作が実装されていないため、
      // findDescendantsを使用して代替実装
      const children = node.getChildren();

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
    if (!Node.isObjectLiteralExpression(node)) return undefined;

    const properties = node.getProperties();
    for (const prop of properties) {
      if (Node.isPropertyAssignment(prop) && prop.getName() === propertyName) {
        return prop.getInitializer();
      }
    }

    return undefined;
  }

  /**
   * オブジェクトリテラルから全プロパティを抽出する関数
   */
  public static extractObjectProperties(node: Node | INode): ObjectProperty[] {
    // INodeの場合
    if ('isKind' in node && typeof node.isKind === 'function') {
      if (!node.isKind(NodeKind.ObjectLiteralExpression)) {
        return [];
      }

      const properties: ObjectProperty[] = [];
      const children = node.getChildren().filter(
        p => p.getText().includes(':') ||
          (p.getText().startsWith('"') && p.getText().includes(':')) ||
          (p.getText().startsWith("'") && p.getText().includes(':'))
      );

      for (const child of children) {
        // プロパティ名と値を抽出
        const propText = child.getText();
        const colonIndex = propText.indexOf(':');

        if (colonIndex > 0) {
          let propName = propText.substring(0, colonIndex).trim();
          // クォートがある場合は除去
          if ((propName.startsWith('"') && propName.endsWith('"')) ||
            (propName.startsWith("'") && propName.endsWith("'"))) {
            propName = propName.substring(1, propName.length - 1);
          }

          // 値部分を取得
          let value: INode | undefined = undefined;

          // 値部分のノードを探す
          const valueNodes = child.getChildren();
          // 最初のノードはプロパティ名、2番目はコロン、3番目が値
          if (valueNodes.length >= 3) {
            value = valueNodes[2];
          }

          properties.push({
            name: propName,
            value: value as any
          });
        }
      }

      return properties;
    }

    // ts-morph Node の場合
    if (!Node.isObjectLiteralExpression(node)) return [];

    const properties: ObjectProperty[] = [];
    const objectProperties = node.getProperties();

    for (const prop of objectProperties) {
      if (Node.isPropertyAssignment(prop)) {
        properties.push({
          name: prop.getName(),
          value: prop.getInitializer()
        });
      }
    }

    return properties;
  }

  /**
   * URLからクエリパラメータを抽出する関数
   */
  public static extractQueryParameters(urlValue: string): string[] {
    const params: string[] = [];
    try {
      const url = new URL(urlValue.startsWith('http') ? urlValue : `http://example.com${urlValue}`);
      url.searchParams.forEach((value, key) => {
        params.push(key);
      });
    } catch (error) {
      logger.warn(`Invalid URL: ${urlValue}`);
    }
    return params;
  }

  /**
   * URLからパスパラメータを抽出する関数
   */
  public static extractPathParameters(urlValue: string): string[] {
    const params: string[] = [];
    const pathParamRegex = /[:$]\{?([a-zA-Z0-9_]+)\}?/g;
    let match;

    while ((match = pathParamRegex.exec(urlValue)) !== null) {
      params.push(match[1]);
    }

    return params;
  }

  /**
   * レスポンス変換処理の検出
   */
  public static detectResponseTransformation(node: Node | INode): boolean {
    // INodeの場合
    if ('isKind' in node && typeof node.isKind === 'function') {
      if (node.isKind(NodeKind.Block)) {
        // ブロック内のステートメント数を確認
        const children = node.getChildren();
        if (children.length > 3) { // 単純なreturn以外の複数ステートメントがある場合
          return true;
        }

        // 配列メソッドの呼び出しを検出
        const hasArrayTransformation = NodeTraversal.findFirstDescendant(
          node,
          n => {
            if (!n.isKind(NodeKind.CallExpression)) return false;
            const expr = n.getExpression?.();
            if (!expr || !expr.isKind(NodeKind.PropertyAccessExpression)) return false;
            const methodName = expr.getName?.();
            return methodName ? ['map', 'filter', 'reduce', 'transform'].includes(methodName) : false;
          }
        );

        if (hasArrayTransformation) return true;
      }

      return false;
    }

    // ts-morph Node の場合
    if (Node.isBlock(node)) {
      const statements = node.getStatements();
      if (statements.length > 1) {
        return true;
      }
      const hasArrayTransformation = NodeTraversal.findFirstDescendant(
        node,
        n => {
          if (!Node.isCallExpression(n)) return false;
          const expr = n.getExpression();
          if (!Node.isPropertyAccessExpression(expr)) return false;
          const methodName = expr.getName();
          return ['map', 'filter', 'reduce', 'transform'].includes(methodName);
        }
      );
      if (hasArrayTransformation) return true;
    }
    return false;
  }

  /**
   * メソッドチェーンを解析する関数
   * INodeインターフェースにも対応
   */
  public static findMethodChain(node: Node | INode): (Node | INode)[] {
    const chain: (Node | INode)[] = [];
    let current = node;

    // INodeの場合
    if ('getExpression' in current && typeof current.getExpression === 'function') {
      while (current) {
        chain.push(current);

        // コール式の場合
        if (current.isKind(NodeKind.CallExpression)) {
          const expression = current.getExpression();
          if (expression) {
            current = expression;
          } else {
            break;
          }
        }
        // プロパティアクセス式の場合
        else if (current.isKind(NodeKind.PropertyAccessExpression)) {
          const expression = current.getExpression();
          if (expression) {
            current = expression;
          } else {
            break;
          }
        }
        else {
          break;
        }
      }
    }
    // ts-morphのNodeの場合（元の実装）
    else if (current instanceof Node) {
      while (Node.isCallExpression(current as Node) || Node.isPropertyAccessExpression(current as Node)) {
        chain.push(current);

        if (Node.isCallExpression(current as Node)) {
          current = (current as any).getExpression();
        } else {
          current = (current as any).getExpression();
        }
      }
    }

    return chain;
  }

  /**
   * コールバック関数のボディを抽出する関数
   */
  public static extractCallbackBody(node: Node | INode): Node | INode | undefined {
    // INodeの場合
    if ('isKind' in node && typeof node.isKind === 'function') {
      if (node.isKind(NodeKind.ArrowFunction)) {
        // ボディを取得（テキスト解析による簡易実装）
        const text = node.getText();
        const arrowIndex = text.indexOf('=>');

        if (arrowIndex >= 0 && arrowIndex < text.length - 2) {
          const bodyText = text.substring(arrowIndex + 2).trim();

          // ブロックボディの場合
          if (bodyText.startsWith('{') && bodyText.endsWith('}')) {
            // ボディを表すノードを探す
            const children = node.getChildren();
            for (const child of children) {
              if (child.isKind(NodeKind.Block)) {
                return child;
              }
            }
          }

          // 式ボディの場合
          return node; // ボディだけを分離するのが難しいので、親ノードを返す
        }
      }

      return undefined;
    }

    // ts-morph Node の場合
    if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
      return node.getBody();
    }

    return undefined;
  }

  /**
   * 戻り値の型情報を抽出する関数
   */
  public static extractReturnType(node: Node | INode): string | undefined {
    // INodeの場合
    if ('isKind' in node && typeof node.isKind === 'function') {
      const parentFunc = NodeTraversal.findFirstAncestor(
        node,
        n => n.isKind(NodeKind.FunctionDeclaration) || n.isKind(NodeKind.MethodDeclaration)
      );

      if (parentFunc) {
        // テキスト解析による型抽出（簡易実装）
        const text = parentFunc.getText();
        const returnTypeRegex = /\)[\s:]+([^{]+)(?={|\=>)/;
        const match = returnTypeRegex.exec(text);

        if (match && match[1]) {
          return match[1].trim();
        }
      }

      return undefined;
    }

    // ts-morph Node の場合
    const parentFunc = NodeTraversal.findFirstAncestor(
      node,
      n => Node.isMethodDeclaration(n) || Node.isFunctionDeclaration(n)
    );

    if (Node.isMethodDeclaration(parentFunc) || Node.isFunctionDeclaration(parentFunc)) {
      const returnTypeNode = parentFunc.getReturnTypeNode();
      return returnTypeNode?.getText();
    }

    return undefined;
  }

  /**
   * await式を探索する関数
   */
  public static findAwaitExpression(node: Node | INode): Node | INode | undefined {
    // INodeの場合
    if ('isKind' in node && typeof node.isKind === 'function') {
      return NodeTraversal.findFirstAncestor(
        node,
        // AwaitExpressionがNodeKind列挙型に定義されていない場合のフォールバック
        n => n.getText().includes('await ')
      );
    }

    // ts-morph Node の場合
    return NodeTraversal.findFirstAncestor(
      node,
      n => n.getKind() === SyntaxKind.AwaitExpression
    );
  }

  /**
   * 代入式を探索する関数
   */
  public static findAssignmentExpression(node: Node | INode): Node | INode | undefined {
    // INodeの場合
    if ('isKind' in node && typeof node.isKind === 'function') {
      return NodeTraversal.findFirstAncestor(
        node,
        n => n.getText().includes('=') && !n.getText().includes('=>')
      );
    }

    // ts-morph Node の場合
    return NodeTraversal.findFirstAncestor(
      node,
      n => n.getKind() === SyntaxKind.BinaryExpression &&
        n.getFirstDescendantByKind(SyntaxKind.EqualsToken) !== undefined
    );
  }

  /**
   * 変数の型アノテーションを抽出する関数
   */
  public static extractVariableTypeAnnotation(node: Node | INode): string | undefined {
    // INodeの場合
    if ('isKind' in node && typeof node.isKind === 'function') {
      if (node.isKind(NodeKind.VariableDeclaration)) {
        // テキスト解析による型抽出
        const text = node.getText();
        const typeRegex = /[\s:]+([^=]+)(?=\s*=|$)/;
        const match = typeRegex.exec(text);

        if (match && match[1]) {
          return match[1].trim();
        }
      }

      return undefined;
    }

    // ts-morph Node の場合
    if (Node.isVariableDeclaration(node)) {
      const typeNode = node.getTypeNode();
      return typeNode?.getText();
    }

    return undefined;
  }

  /**
   * ノードの開始位置の行と列を取得する関数
   */
  public static getStartLineAndColumn(node: Node | INode): { line: number; column: number } {
    // INodeの場合
    if ('getLocation' in node && typeof node.getLocation === 'function') {
      const location = node.getLocation();
      return {
        line: location.line,
        column: location.column
      };
    }

    // ts-morph Node の場合
    const sourceFile = node.getSourceFile();
    const start = node.getStart();
    const { line, column } = sourceFile.getLineAndColumnAtPos(start);

    return { line, column };
  }

  /**
   * 型アノテーション情報を抽出する関数
   */
  public static extractTypeAnnotation(node: Node | INode): TypeAnnotationInfo[] {
    const typeInfos: TypeAnnotationInfo[] = [];

    // INodeの場合
    if ('isKind' in node && typeof node.isKind === 'function') {
      if (node.isKind(NodeKind.VariableDeclaration) ||
        (node.getKind() === NodeKind.Unknown && node.getText().includes(':'))) {

        // テキスト解析による型抽出
        const text = node.getText();
        const typeRegex = /[\s:]+([^=]+)(?=\s*=|$)/;
        const match = typeRegex.exec(text);

        if (match && match[1]) {
          const typeName = match[1].trim();
          typeInfos.push({
            typeName,
            location: this.getStartLineAndColumn(node)
          });
        }
      }

      return typeInfos;
    }

    // ts-morph Node の場合
    if (Node.isVariableDeclaration(node)) {
      const typeNode = node.getTypeNode();
      if (typeNode) {
        typeInfos.push({
          typeName: typeNode.getText(),
          location: this.getNodeLocation(typeNode)
        });
      }
    }

    if (Node.isParameterDeclaration(node)) {
      const typeNode = node.getTypeNode();
      if (typeNode) {
        typeInfos.push({
          typeName: typeNode.getText(),
          location: this.getNodeLocation(typeNode)
        });
      }
    }

    return typeInfos;
  }

  /**
   * コンテキスト推論の改良された関数
   * INodeインターフェースにも対応
   */
  public static inferNodeContext(node: Node | INode): string {
    // INodeの場合
    if ('isKind' in node && typeof node.isKind === 'function') {
      // 関数コンテキストを探す
      const functionContext = NodeTraversal.findFirstAncestor(
        node,
        n => n.isKind(NodeKind.FunctionDeclaration) ||
          n.isKind(NodeKind.MethodDeclaration) ||
          n.isKind(NodeKind.ArrowFunction)
      );

      if (functionContext) {
        // getName メソッドが実装されている場合
        if ('getName' in functionContext && typeof functionContext.getName === 'function') {
          const name = functionContext.getName();
          if (name) return name;
        }

        // 関数宣言の場合
        if (functionContext.isKind(NodeKind.FunctionDeclaration)) {
          // テキスト解析で名前を抽出
          const text = functionContext.getText();
          const funcNameRegex = /function\s+([a-zA-Z0-9_]+)/;
          const match = funcNameRegex.exec(text);

          if (match && match[1]) {
            return match[1];
          }

          return '(無名関数)';
        }

        // メソッド宣言の場合
        if (functionContext.isKind(NodeKind.MethodDeclaration)) {
          // テキスト解析で名前を抽出
          const text = functionContext.getText();
          const methodNameRegex = /\s*([a-zA-Z0-9_]+)\s*\(/;
          const match = methodNameRegex.exec(text);

          if (match && match[1]) {
            return match[1];
          }

          return '(無名メソッド)';
        }

        // アロー関数の場合
        if (functionContext.isKind(NodeKind.ArrowFunction)) {
          const parent = functionContext.getParent();

          if (parent && parent.isKind(NodeKind.VariableDeclaration)) {
            // 変数名を抽出（テキスト解析）
            const text = parent.getText();
            const varNameRegex = /const\s+([a-zA-Z0-9_]+)\s*=/;
            const match = varNameRegex.exec(text);

            if (match && match[1]) {
              return match[1];
            }
          }

          return '(アロー関数)';
        }
      }

      // クラスコンテキストを探す
      const classContext = NodeTraversal.findFirstAncestor(
        node,
        n => n.isKind(NodeKind.ClassDeclaration)
      );

      if (classContext) {
        // テキスト解析でクラス名を抽出
        const text = classContext.getText();
        const classNameRegex = /class\s+([a-zA-Z0-9_]+)/;
        const match = classNameRegex.exec(text);

        if (match && match[1]) {
          return match[1];
        }

        return '(無名クラス)';
      }

      // ソースファイル名をコンテキストとして使用
      const sourceFile = node.getSourceFile();
      if (sourceFile && typeof sourceFile.getFileName === 'function') {
        const fileName = sourceFile.getFileName();
        return fileName.substring(fileName.lastIndexOf('/') + 1).replace(/\.[^/.]+$/, '');
      }

      return 'unknown';
    }

    // ts-morph Node の場合（元の実装）
    const functionContext = NodeTraversal.findFirstAncestor(
      node,
      n => Node.isFunctionDeclaration(n) ||
        Node.isMethodDeclaration(n) ||
        Node.isArrowFunction(n)
    );

    if (functionContext) {
      if (Node.isFunctionDeclaration(functionContext)) {
        const name = functionContext.getName();
        return name ? name : '(無名関数)';
      }
      if (Node.isMethodDeclaration(functionContext)) {
        const name = functionContext.getName();
        return name ? name : '(無名メソッド)';
      }
      if (Node.isArrowFunction(functionContext)) {
        const parent = functionContext.getParent();
        if (parent && Node.isVariableDeclaration(parent)) {
          const name = parent.getName();
          return name ? name : '(アロー関数)';
        }
        return '(アロー関数)';
      }
    }

    const classContext = NodeTraversal.findFirstAncestor(
      node,
      n => Node.isClassDeclaration(n)
    );

    if (classContext && Node.isClassDeclaration(classContext)) {
      const name = classContext.getName();
      return name ? name : '(無名クラス)';
    }

    const sourceFile = node.getSourceFile();
    return sourceFile.getBaseName().replace(/\.[^/.]+$/, '');
  }
}
