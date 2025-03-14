/**
 * ASTノードの抽象インターフェース
 * 
 * TypeScriptのASTノードに対する基本的な操作を抽象化し、
 * 実装の詳細を隠蔽します。AST操作の基盤となるインターフェースです。
 */

/**
 * ノードの子観察メソッド
 */
export interface INodeDiagnostics {
  /**
   * 式を取得する
   * @returns ノードが式の場合、その式を返す
   */
  getExpression?(): INode | null;

  /**
   * 引数配列を取得する
   * @returns ノードが関数呼び出しの場合、引数配列を返す
   */
  getArguments?(): INode[];
}

/**
 * ノードの種類を表す列挙型
 * 実際の実装では、ts-morphのSyntaxKindやBabelのNodeTypeなどに
 * マッピングされます。
 */
export enum NodeKind {
  // 基本構造
  SourceFile = 0,
  Block = 1,
  
  // 宣言
  FunctionDeclaration = 5,
  ClassDeclaration,
  InterfaceDeclaration,
  TypeAliasDeclaration,
  VariableDeclaration,
  
  // 式
  CallExpression,
  PropertyAccessExpression,
  ObjectLiteralExpression,
  ArrayLiteralExpression,
  StringLiteral,
  NumericLiteral,
  Identifier = 9,
  
  // 文
  ExpressionStatement,
  ReturnStatement = 19,
  IfStatement,
  ForStatement,
  
  // インポート/エクスポート
  ImportDeclaration,
  ExportDeclaration = 7,
  
  // その他
  Unknown
}

/**
 * ノードの位置情報
 */
export interface NodeLocation {
  line: number;
  column: number;
  start: number;
  end: number;
}

/**
 * ASTノードの基本インターフェース
 */
export interface INode extends INodeDiagnostics {
  /**
   * ノードの種類を取得する
   * @returns ノードの種類
   */
  getKind(): NodeKind;
  
  /**
   * ノードの文字列表現を取得する
   * @returns ノードのテキスト
   */
  getText(): string;
  
  /**
   * ノードの位置情報を取得する
   * @returns ノードの位置情報
   */
  getLocation(): NodeLocation;
  
  /**
   * 親ノードを取得する
   * @returns 親ノード（ルートノードの場合はnull）
   */
  getParent(): INode | null;
  
  /**
   * 子ノードを取得する
   * @returns 子ノードの配列
   */
  getChildren(): INode[];
  
  /**
   * 特定の条件に一致する子孫ノードを検索する
   * @param predicate ノードをフィルタリングするための述語関数
   * @param recursive 再帰的に検索するかどうか
   * @returns 条件に一致するノードの配列
   */
  findDescendants(predicate: (node: INode) => boolean, recursive?: boolean): INode[];
  
  /**
   * 特定の種類のノードかどうかを判定する
   * @param kind 判定対象のノード種類
   * @returns 指定された種類のノードであればtrue
   */
  isKind(kind: NodeKind): boolean;
  
  /**
   * 実装固有の内部ノードオブジェクトを取得する
   * ※注意: 抽象化を破る操作であり、必要な場合のみ使用すること
   * @returns 内部ノードオブジェクト
   */
  getInternalNode(): any;
  
  /**
   * このノードが属するソースファイルを取得する
   * @returns ノードが含まれるソースファイル
   */
  getSourceFile(): any;
}
