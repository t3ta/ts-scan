import { Node, SyntaxKind, SourceFile, Expression, ParameterDeclaration } from 'ts-morph';
import { ISourceFile } from '../../core/ast/interfaces/ISourceFile';
import { INode, NodeKind } from '../../core/ast/interfaces/INode';
import { logger } from '../Logger';
import { NodeTraversal } from './NodeTraversal';
import { NodeExtractors } from './NodeExtractors';

export interface ObjectProperty {
  name: string;
  value: Expression | undefined;
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
  public static extractJsonContentFromBody(node: Node): { [key: string]: any } | undefined {
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
   * ノードから値を抽出するヘルパー関数
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
   * ソースファイル内の変数宣言を検索する関数
   * @deprecated 抽象化層のため使用を推奨しない。代わりにISourceFile.findNodesを使用する。
   */
  public static findVariableDeclarations(sourceFile: SourceFile | ISourceFile, variableName: string): Node[] {
    // ISourceFileの場合は空の配列を返す
    if ('getRootNode' in sourceFile) {
      // ISourceFileの実装場合は、findNodesを使用するように読者に促す
      console.warn('findVariableDeclarationsは抽象化レイヤーと互換性がありません。ISourceFile.findNodesを使用してください。');
      return [];
    }
    
    // SourceFileの場合
    return sourceFile
      .getDescendantsOfKind(SyntaxKind.VariableDeclaration)
      .filter(decl => decl.getName() === variableName);
  }

  /**
   * ノード位置情報を安全に取得する関数
   */
  public static getNodeLocation(node: Node): { line: number; column: number; sourceFile: string } {
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
  public static getPropertyFromObjectLiteral(node: Node | INode, propertyName: string): Expression | undefined {
    return this.extractPropertyValue(node, propertyName);
  }

  /**
   * オブジェクトリテラルからプロパティ値を抽出する関数
   */
  public static extractPropertyValue(node: Node | INode, propertyName: string): Expression | undefined {
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
    if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
      return node.getBody();
    }
    return undefined;
  }

  /**
   * 戻り値の型情報を抽出する関数
   */
  public static extractReturnType(node: Node): string | undefined {
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
  public static findAwaitExpression(node: Node): Node | undefined {
    return NodeTraversal.findFirstAncestor(
      node,
      n => n.getKind() === SyntaxKind.AwaitExpression
    );
  }

  /**
   * 代入式を探索する関数
   */
  public static findAssignmentExpression(node: Node): Node | undefined {
    return NodeTraversal.findFirstAncestor(
      node,
      n => n.getKind() === SyntaxKind.BinaryExpression &&
           n.getFirstDescendantByKind(SyntaxKind.EqualsToken) !== undefined
    );
  }

  /**
   * 変数の型アノテーションを抽出する関数
   */
  public static extractVariableTypeAnnotation(node: Node): string | undefined {
    if (Node.isVariableDeclaration(node)) {
      const typeNode = node.getTypeNode();
      return typeNode?.getText();
    }
    return undefined;
  }

  /**
   * ノードの開始位置の行と列を取得する関数
   */
  public static getStartLineAndColumn(node: Node): { line: number; column: number } {
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
    // ts-morphのNodeの場合は元の実装を使用
    if (node instanceof Node) {
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
    // INodeの場合は簡易実装を使用
    else {
      // IFunctionインターフェースを実装しているか確認
      if ('getName' in node && typeof node.getName === 'function') {
        const name = node.getName();
        return name || '(無名関数)';
      }

      // ソースファイル名をコンテキストとして使用
      const sourceFile = node.getSourceFile();
      if (sourceFile && typeof sourceFile.getFileName === 'function') {
        return sourceFile.getFileName().replace(/\.[^/.]+$/, '');
      }

      return 'unknown';
    }
  }
}
