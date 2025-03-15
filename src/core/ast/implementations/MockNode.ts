/**
 * モックASTノードの実装
 * 
 * テスト環境でts-morphへの依存なしにASTノードを表現するためのモッククラスです。
 * スナップショットデータを活用してノードの構造をシミュレートします。
 */

import { INode, NodeKind, NodeLocation } from '../interfaces/INode';
import { IFunction } from '../interfaces/IFunction';
import { IParameter } from '../interfaces/IParameter';
import { IType } from '../interfaces/IType';
import { IVariable, VariableDeclarationKind } from '../interfaces/IVariable';
import { ASTNodeSnapshot } from './MockProvider';

/**
 * モックASTノードの実装クラス
 */
export class MockNode implements INode, IFunction, IParameter, IVariable {
  private kind: NodeKind;
  private text: string;
  private location: NodeLocation;
  private parent: INode | null;
  private children: MockNode[] = [];
  private properties: Record<string, any>;
  private sourceFile: any;
  
  /**
   * コンストラクタ
   * @param snapshot ノードのASTスナップショット
   * @param parent 親ノード（ルートノードの場合はnull）
   * @param sourceFile ノードが属するソースファイル
   */
  constructor(
    snapshot: ASTNodeSnapshot,
    parent: INode | null,
    sourceFile: any
  ) {
    this.kind = snapshot.kind;
    this.text = snapshot.text;
    this.parent = parent;
    this.sourceFile = sourceFile;
    this.properties = snapshot.properties || {};
    
    // 位置情報の設定
    this.location = snapshot.location || {
      line: 0,
      column: 0,
      start: 0,
      end: this.text.length
    };
    
    // 子ノードの構築
    if (snapshot.children) {
      this.children = snapshot.children.map(
        childSnapshot => new MockNode(childSnapshot, this, sourceFile)
      );
    }
  }
  
  /**
   * ノードの種類を取得する
   * @returns ノードの種類
   */
  public getKind(): NodeKind {
    return this.kind;
  }
  
  /**
   * ノードの文字列表現を取得する
   * @returns ノードのテキスト
   */
  public getText(): string {
    return this.text;
  }
  
  /**
   * ノードの位置情報を取得する
   * @returns ノードの位置情報
   */
  public getLocation(): NodeLocation {
    return this.location;
  }
  
  /**
   * 親ノードを取得する
   * @returns 親ノード（ルートノードの場合はnull）
   */
  public getParent(): INode | null {
    return this.parent;
  }
  
  /**
   * 子ノードを取得する
   * @returns 子ノードの配列
   */
  public getChildren(): INode[] {
    return this.children;
  }
  
  /**
   * 特定の条件に一致する子孫ノードを検索する
   * @param predicate ノードをフィルタリングするための述語関数
   * @param recursive 再帰的に検索するかどうか
   * @returns 条件に一致するノードの配列
   */
  public findDescendants(predicate: (node: INode) => boolean, recursive: boolean = true): INode[] {
    const result: INode[] = [];
    
    // まず自分自身をチェック
    if (predicate(this)) {
      result.push(this);
    }
    
    // 直接の子ノードに対しても処理を適用
    for (const child of this.children) {
      // 再帰的に検索する場合は子孫も調査
      if (recursive) {
        result.push(...child.findDescendants(predicate, true));
      } else if (predicate(child)) {
        // 再帰なしの場合は直接の子のみを条件で判定
        result.push(child);
      }
    }
    
    return result;
  }
  
  /**
   * 特定の種類のノードかどうかを判定する
   * @param kind 判定対象のノード種類
   * @returns 指定された種類のノードであればtrue
   */
  public isKind(kind: NodeKind): boolean {
    return this.kind === kind;
  }
  
  /**
   * 実装固有の内部ノードオブジェクトを取得する
   * ※注意: 抽象化を破る操作であり、必要な場合のみ使用すること
   * @returns 内部ノードオブジェクト
   */
  public getInternalNode(): any {
    // モック実装では内部ノードとしてthisを返す
    return this;
  }
  
  /**
   * このノードが属するソースファイルを取得する
   * @returns ノードが含まれるソースファイル
   */
  public getSourceFile(): any {
    return this.sourceFile;
  }
  
  /**
   * 特定の名前のプロパティ値を取得する
   * MockNode固有のメソッド: スナップショットから復元したプロパティにアクセスするため
   * @param name プロパティ名
   * @returns プロパティ値（存在しない場合はundefined）
   */
  public getProperty<T>(name: string): T | undefined {
    return this.properties[name] as T;
  }
  
  /**
   * ノードにプロパティを設定する
   * MockNode固有のメソッド: テスト時のモックの振る舞いをカスタマイズするため
   * @param name プロパティ名
   * @param value プロパティ値
   */
  public setProperty<T>(name: string, value: T): void {
    this.properties[name] = value;
  }
  
  /**
   * モックノードの開始位置を取得する
   * @returns ノードの開始位置
   */
  public getStart(): number {
    return this.location.start;
  }
  
  /**
   * モックノードの終了位置を取得する
   * @returns ノードの終了位置
   */
  public getEnd(): number {
    return this.location.end;
  }

  /**
   * IFunctionインターフェースの実装
   */
  getName(): string {
    return this.getProperty<string>('name') || '';
  }

  isAsync(): boolean {
    return this.getProperty<boolean>('isAsync') || false;
  }

  isGenerator(): boolean {
    return this.getProperty<boolean>('isGenerator') || false;
  }

  getParameters(): IParameter[] {
    // プロパティからパラメーター情報を取得
    const params = this.getProperty<ASTNodeSnapshot[]>('parameters');
    if (params && Array.isArray(params)) {
      return params.map(param => new MockNode(param, this as INode, this.sourceFile) as unknown as IParameter);
    }
    
    // パラメーター子ノードを探す
    return this.getChildren()
      .filter(node => node.getKind() === NodeKind.ParameterDeclaration)
      .map(node => node as unknown as IParameter);
  }

  getReturnType(): IType | null {
    // 簡易実装: モックプロバイダーではnullを返す
    // 将来的にはプロパティから型情報を取得できるようにする
    return this.getProperty<IType>('returnType') || null;
  }

  getBody(): INode | undefined {
    // 関数本体のブロックを探す
    return this.getChildren().find(node => node.getKind() === NodeKind.Block);
  }

  isArrowFunction(): boolean {
    return this.getProperty<boolean>('isArrowFunction') || false;
  }

  isMethodDeclaration(): boolean {
    return this.getKind() === NodeKind.MethodDeclaration || this.getProperty<boolean>('isMethodDeclaration') || false;
  }

  getDocumentation(): string {
    return this.getProperty<string>('documentation') || '';
  }

  /**
   * IParameterインターフェースの実装
   */
  getType(): IType | null {
    // 簡易実装: モックプロバイダーではnullを返す
    // 将来的にはプロパティから型情報を取得できるようにする
    return this.getProperty<IType>('type') || null;
  }

  isOptional(): boolean {
    return this.getProperty<boolean>('isOptional') || false;
  }

  isRestParameter(): boolean {
    return this.getProperty<boolean>('isRestParameter') || false;
  }

  getDefaultValue(): INode | null {
    const defaultValue = this.getProperty<ASTNodeSnapshot>('defaultValue');
    if (defaultValue) {
      return new MockNode(defaultValue, this as INode, this.sourceFile);
    }
    return null;
  }

  hasDefaultValue(): boolean {
    return this.getProperty<boolean>('hasDefaultValue') || 
           this.getProperty<ASTNodeSnapshot>('defaultValue') !== undefined;
  }

  /**
   * 変数の初期化子（= の右側）を取得する
   * @returns 初期化子ノード（存在しない場合はundefined）
   */
  getInitializer(): INode | undefined {
    const initializer = this.getProperty<ASTNodeSnapshot>('initializer');
    if (initializer) {
      return new MockNode(initializer, this as INode, this.sourceFile) as INode;
    }
    return undefined;
  }

  getModifiers(): string[] {
    return this.getProperty<string[]>('modifiers') || [];
  }

  /**
   * IVariableインターフェースの実装
   */
  getDeclarationKind(): VariableDeclarationKind {
    return this.getProperty<VariableDeclarationKind>('declarationKind') || VariableDeclarationKind.Let;
  }

  isConst(): boolean {
    return this.getDeclarationKind() === VariableDeclarationKind.Const;
  }

  hasInitializer(): boolean {
    return this.getProperty<boolean>('hasInitializer') || 
           this.getProperty<ASTNodeSnapshot>('initializer') !== undefined;
  }

  isArrayDestructuring(): boolean {
    return this.getProperty<boolean>('isArrayDestructuring') || false;
  }

  isObjectDestructuring(): boolean {
    return this.getProperty<boolean>('isObjectDestructuring') || false;
  }

  hasLiteralInitializer(): boolean {
    const initializer = this.getInitializer();
    if (!initializer) return false;
    
    const kind = initializer.getKind();
    return kind === NodeKind.StringLiteral || 
           kind === NodeKind.NumericLiteral || 
           kind === NodeKind.TrueLiteral || 
           kind === NodeKind.FalseLiteral || 
           kind === NodeKind.NullLiteral ||
           kind === NodeKind.NoSubstitutionTemplateLiteral;
  }

  getLiteralValue(): string {
    const initializer = this.getInitializer();
    if (!initializer || !this.hasLiteralInitializer()) return '';
    
    return initializer.getText();
  }
  
  /**
   * ノード内の式を取得する
   * @returns 式ノード（CallExpressionなどの場合）
   */
  getExpression(): INode {
    // プロパティに保存されている場合はそれを返す
    const expressionNode = this.getProperty<ASTNodeSnapshot>('expression');
    if (expressionNode) {
      return new MockNode(expressionNode, this as INode, this.sourceFile) as INode;
    }

    // 子ノードに式がある場合、最初のノードを返す
    // （簡易実装）
    const children = this.getChildren();
    if (children.length > 0) {
      return children[0];
    }

    // 式が見つからない場合は自身を返す
    return this as INode;
  }
  
  /**
   * このノードの全ての先祖ノードを取得する
   * @returns 先祖ノードの配列
   */
  getAncestors(): INode[] {
    const ancestors: INode[] = [];
    let current = this.getParent();
    
    while (current) {
      ancestors.push(current);
      current = current.getParent();
    }
    
    return ancestors;
  }

  /**
   * 引数ノードの配列を取得する
   * @returns 引数ノードの配列（CallExpressionの場合）
   */
  getArguments(): INode[] {
    // プロパティに保存されている場合はそれを返す
    const args = this.getProperty<ASTNodeSnapshot[]>('arguments');
    if (args && Array.isArray(args)) {
      return args.map(arg => new MockNode(arg, this as INode, this.sourceFile) as INode);
    }

    // コール式の場合、最初のノード以外を引数とみなす
    // （簡易実装）
    if (this.kind === NodeKind.CallExpression) {
      const children = this.getChildren();
      if (children.length > 1) {
        return children.slice(1);
      }
    }

    return [];
  }
}
