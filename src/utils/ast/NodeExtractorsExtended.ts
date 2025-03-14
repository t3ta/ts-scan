import { Node, SyntaxKind, SourceFile, Expression, ParameterDeclaration, TypeChecker } from 'ts-morph';
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
   * INodeインターフェースを持つオブジェクトかどうかを判別する型ガード
   * @param node 検査対象ノード
   * @returns INodeインターフェースを持つオブジェクトならtrue
   */
  private static isINode(node: Node | INode): node is INode {
    return 'isKind' in node && typeof node.isKind === 'function';
  }

  /**
   * ts-morph Nodeかどうかを判別する型ガード
   * @param node 検査対象ノード
   * @returns ts-morph Nodeならtrue
   */
  private static isTsMorphNode(node: Node | INode): node is Node {
    return !('isKind' in node);
  }

  /**
   * 型安全なノード変換（互換性問題用）
   * @param node INodeまたはNode
   * @returns ts-morph Node
   * @throws {Error} INodeをts-morph Nodeに変換できない場合
   */
  private static asNode<T extends Node>(node: Node | INode): T {
    if (this.isTsMorphNode(node)) {
      return node as T;
    }
    if (typeof (node as INode).getInternalNode === 'function') {
      const internalNode = (node as INode).getInternalNode();
      if (internalNode) {
        return internalNode as T;
      }
    }
    throw new Error('Cannot convert INode to ts-morph Node: internal node not available');
  }
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
    try {
      // INodeの場合
      if (this.isINode(node)) {
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
      const tsNode = this.asNode(node);
      if (!Node.isObjectLiteralExpression(tsNode)) {
        return undefined;
      }

      const result: { [key: string]: any } = {};
      const properties = tsNode.getProperties();

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
    } catch (error) {
      logger.warn(`Error extracting JSON content: ${error}`);
      return undefined;
    }
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
    try {
      // INodeの場合
      if (this.isINode(node)) {
        const location = node?.getLocation?.();
        const sourceFile = node?.getSourceFile?.();

        if (location) {
          return {
            line: location.line,
            column: location.column,
            sourceFile: typeof sourceFile?.getFilePath === 'function' ?
              sourceFile.getFilePath() :
              'unknown'
          };
        }
        // 位置情報がない場合はデフォルト値
        return {
          line: 1,
          column: 0,
          sourceFile: 'unknown'
        };
      }

      // ts-morph Node の場合
      const tsNode = this.asNode(node);
      const sourceFile = tsNode.getSourceFile();
      const { line, column } = sourceFile.getLineAndColumnAtPos(tsNode.getStart());

      return {
        line,
        column,
        sourceFile: sourceFile.getFilePath()
      };
    } catch (error) {
      logger.warn(`Error getting node location: ${error}`);
      return {
        line: 1,
        column: 0,
        sourceFile: 'unknown'
      };
    }
  }

  /**
   * 文字列値を安全に抽出する関数
   */
  public static extractStringValue(node: Node | INode | undefined): string | null {
    try {
      if (!node) return null;

      // INodeの場合
      if (this.isINode(node)) {
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
      try {
        const stringLiteral = this.asNode<import('ts-morph').StringLiteral>(node);
        return stringLiteral.getText().replace(/['"]/g, '');
      } catch {
        try {
          const propertyAssignment = this.asNode<import('ts-morph').PropertyAssignment>(node);
          const initializer = propertyAssignment.getInitializer();
          if (Node.isStringLiteral(initializer)) {
            return initializer.getText().replace(/['"]/g, '');
          }
        } catch {
          // 型変換に失敗した場合は無視
        }
      }

      return null;
    } catch (error) {
      logger.warn(`Error extracting string value: ${error}`);
      return null;
    }
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
    try {
      // INodeの場合
      if (this.isINode(node)) {
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
      try {
        const objLiteral = this.asNode<import('ts-morph').ObjectLiteralExpression>(node);
        const property = objLiteral.getProperties()
          .find(p => Node.isPropertyAssignment(p) && p.getName() === propertyName) as import('ts-morph').PropertyAssignment | undefined;

        if (property) {
          return property.getInitializer();
        }
      } catch {
        // 型変換に失敗した場合は無視
      }

      return undefined;
    } catch (error) {
      logger.warn(`Error extracting property value: ${error}`);
      return undefined;
    }
  }

  /**
   * オブジェクトリテラルから全プロパティを抽出する関数
   */
  public static extractObjectProperties(node: Node | INode): ObjectProperty[] {
    try {
      // INodeの場合
      if (this.isINode(node)) {
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

            // 値部分のノードを探す
            const valueNodes = child.getChildren();
            // 最初のノードはプロパティ名、2番目はコロン、3番目が値
            const value = valueNodes.length >= 3 ? valueNodes[2] : undefined;

            properties.push({
              name: propName,
              value: value
            });
          }
        }

        return properties;
      }

      // ts-morph Node の場合
      try {
        const objLiteral = this.asNode<import('ts-morph').ObjectLiteralExpression>(node);
        return objLiteral.getProperties()
          .filter(Node.isPropertyAssignment)
          .map(prop => ({
            name: prop.getName(),
            value: prop.getInitializer()
          }));
      } catch {
        logger.debug('Failed to convert node to ObjectLiteralExpression');
        return [];
      }
    } catch (error) {
      logger.warn(`Error extracting object properties: ${error}`);
      return [];
    }
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
    try {
      // INodeの場合
      if (this.isINode(node)) {
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
      try {
        const block = this.asNode<import('ts-morph').Block>(node);

        // 複数のステートメントがある場合は変換処理とみなす
        if (block.getStatements().length > 1) {
          return true;
        }

        // 配列メソッドの変換を検出
        const hasTransformation = block.getDescendants().some(n => {
          if (Node.isCallExpression(n)) {
            const expr = n.getExpression();
            if (Node.isPropertyAccessExpression(expr)) {
              const methodName = expr.getName();
              return ['map', 'filter', 'reduce', 'transform'].includes(methodName);
            }
          }
          return false;
        });

        return hasTransformation;
      } catch (e) {
        logger.debug(`Failed to analyze block node: ${e instanceof Error ? e.message : String(e)}`);
        return false;
      }
    } catch (error) {
      logger.warn(`Error detecting response transformation: ${error}`);
      return false;
    }
  }

  /**
   * メソッドチェーンを解析する関数
   * INodeインターフェースにも対応
   */
  public static findMethodChain(node: Node | INode): (Node | INode)[] {
    try {
      const chain: (Node | INode)[] = [];

      // INodeの場合
      if (this.isINode(node)) {
        let current: INode = node;
        while (current) {
          chain.push(current);

          // コール式の場合
          if (current.isKind(NodeKind.CallExpression)) {
            const expression = current.getExpression?.();
            if (expression && this.isINode(expression)) {
              current = expression;
              continue;
            }
          }
          // プロパティアクセス式の場合
          else if (current.isKind(NodeKind.PropertyAccessExpression)) {
            const expression = current.getExpression?.();
            if (expression && this.isINode(expression)) {
              current = expression;
              continue;
            }
          }
          break;
        }
        return chain;
      }

      // ts-morphのNodeの場合
      try {
        const tsNode = this.asNode<Node>(node);
        let currentNode: Node | undefined = tsNode;

        // チェーンの追跡
        while (currentNode) {
          chain.push(currentNode);

          if (Node.isCallExpression(currentNode)) {
            currentNode = currentNode.getExpression() || undefined;
          } else if (Node.isPropertyAccessExpression(currentNode)) {
            currentNode = currentNode.getExpression() || undefined;
          } else {
            break;
          }
        }

        return chain;
      } catch (e) {
        logger.debug(`Failed to analyze method chain: ${e instanceof Error ? e.message : String(e)}`);
        return [node];
      }
    } catch (error) {
      logger.warn(`Error finding method chain: ${error}`);
      return [node];
    }
  }

  /**
   * コールバック関数のボディを抽出する関数
   */
  public static extractCallbackBody(node: Node | INode): Node | INode | undefined {
    try {
      // INodeの場合
      if (this.isINode(node)) {
        if (node.isKind(NodeKind.ArrowFunction)) {
          // ボディメソッドが実装されている場合
          if (typeof node.getBody === 'function') {
            const body = node.getBody();
            if (body) return body;
          }

          // メソッドがない場合はテキスト解析で代用
          const text = node.getText();
          const arrowIndex = text.indexOf('=>');

          if (arrowIndex >= 0 && arrowIndex < text.length - 2) {
            const bodyText = text.substring(arrowIndex + 2).trim();

            // ブロックボディの場合
            if (bodyText.startsWith('{') && bodyText.endsWith('}')) {
              // ボディを表すノードを探す
              const blockNode = node.getChildren().find(child =>
                child.isKind(NodeKind.Block)
              );
              if (blockNode) return blockNode;
            }

            // 式ボディの場合
            return node; // ボディだけを分離するのが難しいので、親ノードを返す
          }
        }

        return undefined;
      }

      // ts-morph Node の場合
      try {
        const tsNode = this.asNode<Node>(node);
        if (Node.isArrowFunction(tsNode)) {
          const body = tsNode.getBody();
          return body || undefined;
        }
        if (Node.isFunctionExpression(tsNode)) {
          const body = tsNode.getBody();
          return body || undefined;
        }
      } catch (e) {
        logger.debug(`Failed to extract callback body: ${e instanceof Error ? e.message : String(e)}`);
      }

      return undefined;
    } catch (error) {
      logger.warn(`Error extracting callback body: ${error}`);
      return undefined;
    }
  }

  /**
   * 戻り値の型情報を抽出する関数
   */
  public static extractReturnType(node: Node | INode): string | undefined {
    try {
      // INodeの場合
      if (this.isINode(node)) {
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
      try {
        const tsNode = this.asNode<Node>(node);
        let current: Node | undefined = tsNode;

        // 親をたどって関数コンテキストを探索
        while (current) {
          if (Node.isMethodDeclaration(current)) {
            const returnTypeNode = current.getReturnTypeNode();
            return returnTypeNode?.getText();
          }
          if (Node.isFunctionDeclaration(current)) {
            const returnTypeNode = current.getReturnTypeNode();
            return returnTypeNode?.getText();
          }
          current = current.getParent();
        }
      } catch (e) {
        logger.debug(`Failed to extract return type: ${e instanceof Error ? e.message : String(e)}`);
      }

      return undefined;
    } catch (error) {
      logger.warn(`Error extracting return type: ${error}`);
      return undefined;
    }
  }

  /**
   * await式を探索する関数
   */
  public static findAwaitExpression(node: Node | INode): Node | INode | undefined {
    try {
      // INodeの場合
      if (this.isINode(node)) {
        // NodeKind.AwaitExpressionのフォールバックとしてテキスト判定
        const awaitNode = NodeTraversal.findFirstAncestor(
          node,
          n => n.getText().trim().startsWith('await ')
        );

        return awaitNode;
      }

      // ts-morph Node の場合
      try {
        const tsNode = this.asNode<Node>(node);
        let current: Node | undefined = tsNode;

        while (current) {
          try {
            if (Node.isAwaitExpression(current)) {
              return current;
            }
          } catch {
            // 型チェックに失敗した場合は続行
          }
          current = current.getParent();
        }
      } catch (e) {
        logger.debug(`Failed to find await expression: ${e instanceof Error ? e.message : String(e)}`);
      }

      return undefined;
    } catch (error) {
      logger.warn(`Error finding await expression: ${error}`);
      return undefined;
    }
  }

  /**
   * 代入式を探索する関数
   */
  public static findAssignmentExpression(node: Node | INode): Node | INode | undefined {
    try {
      // INodeの場合
      if (this.isINode(node)) {
        // ただの代入式のみを検出（アロー関数は除外）
        const assignmentNode = NodeTraversal.findFirstAncestor(
          node,
          n => n.getText().includes('=') && !n.getText().includes('=>')
        );
        return assignmentNode;
      }

      // ts-morph Node の場合
      const tsNode = this.asNode(node);
      let current: Node | undefined = tsNode;

      while (current) {
        const kind = current.getKind();
        if (kind === SyntaxKind.BinaryExpression) {
          const firstChild = current.getFirstChild();
          const operator = firstChild?.getNextSibling();
          if (operator?.getKind() === SyntaxKind.EqualsToken) {
            return current;
          }
        }
        current = current.getParent();
      }

      return undefined;
    } catch (error) {
      logger.warn(`Error finding assignment expression: ${error}`);
      return undefined;
    }
  }

  /**
   * 変数の型アノテーションを抽出する関数
   */
  public static extractVariableTypeAnnotation(node: Node | INode): string | undefined {
    try {
      // INodeの場合
      if (this.isINode(node)) {
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
      const tsNode = this.asNode(node);
      if (Node.isVariableDeclaration(tsNode)) {
        const typeNode = tsNode.getTypeNode();
        if (typeNode) {
          return typeNode.getText();
        }
      }

      return undefined;
    } catch (error) {
      logger.warn(`Error extracting variable type annotation: ${error}`);
      return undefined;
    }
  }

  /**
   * ノードの開始位置の行と列を取得する関数
   */
  public static getStartLineAndColumn(node: Node | INode): { line: number; column: number } {
    try {
      // INodeの場合
      if (this.isINode(node)) {
        if ('getLocation' in node && typeof node.getLocation === 'function') {
          const location = node.getLocation();
          if (location) {
            return {
              line: location.line,
              column: location.column
            };
          }
        }
        // getLocationを持たない場合はデフォルト値を返す
        return { line: 1, column: 0 };
      }

      // ts-morph Node の場合
      try {
        const tsNode = this.asNode<Node>(node);
        const sourceFile = tsNode.getSourceFile();
        const start = tsNode.getStart();
        if (typeof start !== 'number') {
          logger.debug('Failed to get start position');
          return { line: 1, column: 0 };
        }
        const position = sourceFile.getLineAndColumnAtPos(start);
        return {
          line: position.line,
          column: position.column
        };
      } catch (e) {
        logger.debug(`Failed to get position: ${e instanceof Error ? e.message : String(e)}`);
        return { line: 1, column: 0 };
      }
    } catch (error) {
      logger.warn(`Error getting start line and column: ${error}`);
      return { line: 1, column: 0 };
    }
  }

  /**
   * 型アノテーション情報を抽出する関数
   */
  public static extractTypeAnnotation(node: Node | INode): TypeAnnotationInfo[] {
    const typeInfos: TypeAnnotationInfo[] = [];

    // INodeの場合
    if (this.isINode(node)) {
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
    try {
      const tsNode = this.asNode(node);

      // 変数宣言のチェック
      if (Node.isVariableDeclaration(tsNode)) {
        const typeNode = tsNode.getTypeNode();
        if (typeNode) {
          typeInfos.push({
            typeName: typeNode.getText(),
            location: this.getNodeLocation(typeNode)
          });
        }
      }

      // パラメータ宣言のチェック
      if (Node.isParameterDeclaration(tsNode)) {
        const typeNode = tsNode.getTypeNode();
        if (typeNode) {
          typeInfos.push({
            typeName: typeNode.getText(),
            location: this.getNodeLocation(typeNode)
          });
        }
      }

      return typeInfos;
    } catch (error) {
      logger.warn(`Error extracting type annotation: ${error}`);
      return [];
    }
  }

  /**
   * コンテキスト推論の改良された関数
   * INodeインターフェースにも対応
   */
  public static inferNodeContext(node: Node | INode): string {
    // INodeの場合
    if (this.isINode(node)) {
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

    try {
      // ts-morph Node の場合
      const tsNode = this.asNode(node);
      let current: Node | undefined = tsNode;

      // 関数コンテキストを探す
      while (current) {
        if (Node.isFunctionDeclaration(current)) {
          const name = current.getName();
          return name || '(無名関数)';
        }
        if (Node.isMethodDeclaration(current)) {
          const name = current.getName();
          return name || '(無名メソッド)';
        }
        if (Node.isArrowFunction(current)) {
          const parent = current.getParent();
          if (Node.isVariableDeclaration(parent)) {
            const name = parent.getName();
            return name || '(アロー関数)';
          }
          return '(アロー関数)';
        }
        current = current.getParent();
      }

      // 関数が見つからなければ、クラスコンテキストを探す
      current = tsNode;
      while (current) {
        if (Node.isClassDeclaration(current)) {
          const name = current.getName();
          return name || '(無名クラス)';
        }
        current = current.getParent();
      }

      // クラスも見つからなければ、ファイル名を返す
      const sourceFile = tsNode.getSourceFile();
      return sourceFile.getBaseName().replace(/\.[^/.]+$/, '');
    } catch (error) {
      logger.warn(`Error inferring node context: ${error}`);
      return 'unknown';
    }
  }

  /**
   * TypeCheckerを使用して型情報を取得する関数
   * @param node 対象ノード
   * @param typeChecker 利用するTypeChecker
   * @returns 型名または空文字
   */
  public static getTypeFromChecker(node: Node | INode, typeChecker: TypeChecker): string {
    try {
      // INodeの場合
      if (this.isINode(node)) {
        const internalNode = typeof node.getInternalNode === 'function' ? node.getInternalNode() : null;
        if (!internalNode) {
          logger.debug('Internal node not available for INode');
          return '';
        }

        try {
          const type = typeChecker.getTypeAtLocation(internalNode);
          if (!type) {
            logger.debug('No type information available for node');
            return '';
          }
          return type.getText();
        } catch (e) {
          logger.debug(`Error getting type from internal node: ${e instanceof Error ? e.message : String(e)}`);
          return '';
        }
      }

      // ts-morph Nodeの場合
      const tsNode = this.asNode(node);
      if (!tsNode) {
        logger.debug('Failed to convert to ts-morph Node');
        return '';
      }

      try {
        const type = typeChecker.getTypeAtLocation(tsNode);
        if (!type) {
          logger.debug('No type information available for ts-morph node');
          return '';
        }
        return type.getText();
      } catch (error) {
        logger.debug(`Error getting type from ts-morph node: ${error instanceof Error ? error.message : String(error)}`);
        return '';
      }
    } catch (error) {
      logger.warn(`Type checker error: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }
}
