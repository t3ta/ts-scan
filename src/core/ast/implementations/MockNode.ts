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
import { ASTNodeSnapshot } from './MockProvider';

/**
 * モックASTノードの実装クラス
 */
export class MockNode implements INode, IFunction {
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
    // 簡易実装: パラメーター子ノードを探す
    return [];
  }

  getReturnType(): IType | null {
    return null;
  }

  getBody(): INode | null {
    // 関数本体のブロックを探す
    return this.getChildren().find(node => node.getKind() === NodeKind.Block) || null;
  }

  isArrowFunction(): boolean {
    return false;
  }

  isMethodDeclaration(): boolean {
    return false;
  }

  getDocumentation(): string {
    return '';
  }
  
  /**
   * ノード内の式を取得する
   * @returns 式ノード（CallExpressionなどの場合）
   */
  getExpression(): INode | null {
    // プロパティに保存されている場合はそれを返す
    const expressionNode = this.getProperty<ASTNodeSnapshot>('expression');
    if (expressionNode) {
      return new MockNode(expressionNode, this, this.sourceFile);
    }

    // 子ノードに式がある場合、最初のノードを返す
    // （簡易実装）
    const children = this.getChildren();
    if (children.length > 0) {
      return children[0];
    }

    return null;
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
      return args.map(arg => new MockNode(arg, this, this.sourceFile));
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
