/**
 * ts-morphの変数宣言向けアダプター実装
 * 
 * ts-morphの変数宣言オブジェクトを抽象インターフェースIVariableに適合させる
 * アダプタークラスです。
 */

import {
  VariableDeclaration,
  VariableDeclarationKind as TsMorphVarKind,
  SyntaxKind
} from 'ts-morph';
import { IVariable, VariableDeclarationKind } from '../interfaces/IVariable';
import { IType } from '../interfaces/IType';
import { INode } from '../interfaces/INode';
import { TsMorphNodeAdapter } from './TsMorphNodeAdapter';
import { TsMorphTypeAdapter } from './TsMorphTypeAdapter';

/**
 * ts-morphの変数宣言種類を抽象層の変数宣言種類に変換
 */
function convertVarKindToAbstractKind(kind: TsMorphVarKind): VariableDeclarationKind {
  switch (kind) {
    case TsMorphVarKind.Var:
      return VariableDeclarationKind.Var;
    case TsMorphVarKind.Let:
      return VariableDeclarationKind.Let;
    case TsMorphVarKind.Const:
      return VariableDeclarationKind.Const;
    default:
      return VariableDeclarationKind.Var;
  }
}

/**
 * ts-morphの変数宣言向けアダプタークラス
 */
export class TsMorphVariableAdapter extends TsMorphNodeAdapter implements IVariable {
  private variableNode: VariableDeclaration;
  
  /**
   * コンストラクタ
   * @param variableNode ts-morphの変数宣言オブジェクト
   */
  constructor(variableNode: VariableDeclaration) {
    super(variableNode);
    this.variableNode = variableNode;
  }
  
  /**
   * 変数名を取得する
   * @returns 変数名
   */
  public getName(): string {
    return this.variableNode.getName();
  }
  
  /**
   * 変数の型を取得する
   * @returns 変数の型情報（型が明示的に指定されていない場合はnull）
   */
  public getType(): IType | null {
    const typeNode = this.variableNode.getTypeNode();
    if (typeNode) {
      return new TsMorphTypeAdapter(this.variableNode.getType());
    }
    return null;
  }
  
  /**
   * 変数宣言の種類を取得する (var, let, const)
   * @returns 変数宣言の種類
   */
  public getDeclarationKind(): VariableDeclarationKind {
    const varStatement = this.variableNode.getVariableStatement();
    if (!varStatement) {
      return VariableDeclarationKind.Let; // デフォルト値
    }
    
    const declarationKind = varStatement.getDeclarationKind();
    return convertVarKindToAbstractKind(declarationKind);
  }
  
  /**
   * 変数が定数 (const) かどうかを判定する
   * @returns 定数であればtrue
   */
  public isConst(): boolean {
    return this.getDeclarationKind() === VariableDeclarationKind.Const;
  }
  
  /**
   * 変数の初期化子（= の右側）を取得する
   * @returns 初期化子ノード（存在しない場合はnull）
   */
  public getInitializer(): INode | null {
    const initializer = this.variableNode.getInitializer();
    if (!initializer) {
      return null;
    }
    return new TsMorphNodeAdapter(initializer);
  }
  
  /**
   * 変数が初期化子を持つかどうかを判定する
   * @returns 初期化子を持つ場合はtrue
   */
  public hasInitializer(): boolean {
    return this.variableNode.getInitializer() !== undefined;
  }
  
  /**
   * 変数のJSDocコメントを取得する
   * @returns JSDocコメントの文字列（存在しない場合は空文字列）
   */
  public getDocumentation(): string {
    const varStatement = this.variableNode.getVariableStatement();
    if (!varStatement) {
      return '';
    }
    
    const jsDocs = varStatement.getJsDocs();
    if (jsDocs.length === 0) {
      return '';
    }
    
    return jsDocs.map(doc => doc.getInnerText()).join('\n');
  }
  
  /**
   * 変数の修飾子を取得する（export など）
   * @returns 修飾子の配列
   */
  public getModifiers(): string[] {
    const varStatement = this.variableNode.getVariableStatement();
    if (!varStatement) {
      return [];
    }
    
    return varStatement.getModifiers().map(mod => mod.getText());
  }
  
  /**
   * 変数宣言が配列分解（destructuring）かどうかを判定する
   * @returns 配列分解宣言であればtrue
   */
  public isArrayDestructuring(): boolean {
    const namingNode = this.variableNode.getNameNode();
    if (!namingNode) return false;
    
    // 直接kindNameをチェックする方法
    return namingNode.getKindName() === 'ArrayBindingPattern';
  }
  
  /**
   * 変数宣言がオブジェクト分解（destructuring）かどうかを判定する
   * @returns オブジェクト分解宣言であればtrue
   */
  public isObjectDestructuring(): boolean {
    const namingNode = this.variableNode.getNameNode();
    if (!namingNode) return false;
    
    // 直接kindNameをチェックする方法
    return namingNode.getKindName() === 'ObjectBindingPattern';
  }
  
  /**
   * 初期化子の値がリテラルかどうかを判定する
   * @returns 初期化子がリテラルであればtrue
   */
  public hasLiteralInitializer(): boolean {
    const initializer = this.variableNode.getInitializer();
    if (!initializer) {
      return false;
    }
    
    const kind = initializer.getKind();
    const kindName = initializer.getKindName();
    
    return kindName.includes('Literal');
  }
  
  /**
   * リテラル初期化子の場合、その値を文字列として取得する
   * @returns リテラル値の文字列表現（リテラルでない場合はnull）
   */
  public getLiteralValue(): string | null {
    if (!this.hasLiteralInitializer()) {
      return null;
    }
    
    const initializer = this.variableNode.getInitializer();
    return initializer ? initializer.getText() : null;
  }
  
  /**
   * 内部のts-morphの変数ノードを取得する
   * @returns ts-morphの変数ノード
   */
  public getInternalNode(): VariableDeclaration {
    return this.variableNode;
  }
}
