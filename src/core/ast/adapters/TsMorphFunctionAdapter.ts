/**
 * ts-morphの関数宣言向けアダプター実装
 * 
 * ts-morphの関数宣言オブジェクトを抽象インターフェースIFunctionに適合させる
 * アダプタークラスです。
 */

import {
  FunctionDeclaration,
  ArrowFunction,
  FunctionExpression,
  MethodDeclaration,
  Node as TsMorphNode
} from 'ts-morph';
import { IFunction } from '../interfaces/IFunction';
import { IParameter } from '../interfaces/IParameter';
import { IType } from '../interfaces/IType';
import { INode } from '../interfaces/INode';
import { TsMorphNodeAdapter } from './TsMorphNodeAdapter';
import { TsMorphParameterAdapter } from './TsMorphParameterAdapter';
import { TsMorphTypeAdapter } from './TsMorphTypeAdapter';

/**
 * 関数宣言の種類を表すユニオン型
 */
type FunctionLike = FunctionDeclaration | ArrowFunction | FunctionExpression | MethodDeclaration;

/**
 * ts-morphの関数宣言向けアダプタークラス
 */
export class TsMorphFunctionAdapter extends TsMorphNodeAdapter implements IFunction {
  private functionNode: FunctionLike;
  
  /**
   * コンストラクタ
   * @param functionNode ts-morphの関数宣言オブジェクト
   */
  constructor(functionNode: FunctionLike) {
    super(functionNode);
    this.functionNode = functionNode;
  }
  
  /**
   * 関数名を取得する
   * @returns 関数名（無名関数の場合は空文字列）
   */
  public getName(): string {
    // FunctionDeclarationとMethodDeclarationはgetNameが使える
    if (
      this.functionNode instanceof FunctionDeclaration ||
      this.functionNode instanceof MethodDeclaration
    ) {
      return this.functionNode.getName() || '';
    }
    
    // Arrow関数と関数式は名前がない場合がある
    return '';
  }
  
  /**
   * 関数が非同期関数かどうかを判定する
   * @returns 非同期関数であればtrue
   */
  public isAsync(): boolean {
    return this.functionNode.isAsync();
  }
  
  /**
   * 関数がジェネレーター関数かどうかを判定する
   * @returns ジェネレーター関数であればtrue
   */
  public isGenerator(): boolean {
    // ArrowFunctionはジェネレーターにならない
    if (this.functionNode instanceof ArrowFunction) {
      return false;
    }
    
    // 他の関数型はisGeneratorメソッドを持つ
    return (this.functionNode as any).isGenerator?.() || false;
  }
  
  /**
   * 関数のパラメータを取得する
   * @returns パラメータの配列
   */
  public getParameters(): IParameter[] {
    const parameters = this.functionNode.getParameters();
    return parameters.map(param => new TsMorphParameterAdapter(param));
  }
  
  /**
   * 関数の戻り値の型を取得する
   * @returns 戻り値の型情報（型が明示的に指定されていない場合はnull）
   */
  public getReturnType(): IType | null {
    const returnType = this.functionNode.getReturnType();
    if (!returnType) {
      return null;
    }
    return new TsMorphTypeAdapter(returnType);
  }
  
  /**
   * 関数の本体部分のノードを取得する
   * @returns 関数本体のノード
   */
  public getBody(): INode | null {
    const body = this.functionNode.getBody();
    if (!body) {
      return null;
    }
    return new TsMorphNodeAdapter(body);
  }
  
  /**
   * 関数がArrow Function（アロー関数）かどうかを判定する
   * @returns アロー関数であればtrue
   */
  public isArrowFunction(): boolean {
    return this.functionNode instanceof ArrowFunction;
  }
  
  /**
   * 関数がメソッド宣言かどうかを判定する
   * @returns メソッド宣言であればtrue
   */
  public isMethodDeclaration(): boolean {
    return this.functionNode instanceof MethodDeclaration;
  }
  
  /**
   * 関数のJSDocコメントを取得する（存在する場合）
   * @returns JSDocコメントの文字列（存在しない場合は空文字列）
   */
  public getDocumentation(): string {
    const jsDocs = this.functionNode.getJsDocs();
    if (jsDocs.length === 0) {
      return '';
    }
    
    // すべてのJSDocを連結
    return jsDocs.map(doc => doc.getInnerText()).join('\n');
  }
  
  /**
   * 内部のts-morphの関数ノードを取得する
   * @returns ts-morphの関数ノード
   */
  public getInternalNode(): FunctionLike {
    return this.functionNode;
  }
}
