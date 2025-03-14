/**
 * ts-morphのパラメータ向けアダプター実装
 * 
 * ts-morphのパラメータオブジェクトを抽象インターフェースIParameterに適合させる
 * アダプタークラスです。
 */

import { ParameterDeclaration } from 'ts-morph';
import { IParameter } from '../interfaces/IParameter';
import { IType } from '../interfaces/IType';
import { INode } from '../interfaces/INode';
import { TsMorphNodeAdapter } from './TsMorphNodeAdapter';
import { TsMorphTypeAdapter } from './TsMorphTypeAdapter';

/**
 * ts-morphのパラメータ向けアダプタークラス
 */
export class TsMorphParameterAdapter extends TsMorphNodeAdapter implements IParameter {
  private parameterNode: ParameterDeclaration;
  
  /**
   * コンストラクタ
   * @param parameterNode ts-morphのパラメータオブジェクト
   */
  constructor(parameterNode: ParameterDeclaration) {
    super(parameterNode);
    this.parameterNode = parameterNode;
  }
  
  /**
   * パラメータ名を取得する
   * @returns パラメータ名
   */
  public getName(): string {
    const nameNode = this.parameterNode.getNameNode();
    return nameNode.getText();
  }
  
  /**
   * パラメータの型を取得する
   * @returns パラメータの型情報（型が明示的に指定されていない場合はnull）
   */
  public getType(): IType | null {
    // 型注釈があれば型情報を返す
    const typeNode = this.parameterNode.getTypeNode();
    if (typeNode) {
      return new TsMorphTypeAdapter(this.parameterNode.getType());
    }
    
    // 明示的な型指定がなければnull
    return null;
  }
  
  /**
   * パラメータが省略可能かどうかを判定する
   * @returns 省略可能なパラメータであればtrue
   */
  public isOptional(): boolean {
    return this.parameterNode.isOptional();
  }
  
  /**
   * パラメータがrest parameterかどうかを判定する (...args)
   * @returns rest parameterであればtrue
   */
  public isRestParameter(): boolean {
    // ts-morphのバージョンによってはisRestParameterメソッドを使用
    if (typeof this.parameterNode.isRestParameter === 'function') {
      return this.parameterNode.isRestParameter();
    }
    
    // 代替手段としてドット3つのトークンがあるかをチェック
    const hasDotDotDotToken = this.parameterNode.compilerNode.dotDotDotToken !== undefined;
    return hasDotDotDotToken;
  }
  
  /**
   * パラメータのデフォルト値を取得する
   * @returns デフォルト値のノード（デフォルト値がない場合はnull）
   */
  public getDefaultValue(): INode | null {
    const initializer = this.parameterNode.getInitializer();
    if (!initializer) {
      return null;
    }
    return new TsMorphNodeAdapter(initializer);
  }
  
  /**
   * パラメータがデフォルト値を持つかどうかを判定する
   * @returns デフォルト値を持つ場合はtrue
   */
  public hasDefaultValue(): boolean {
    return this.parameterNode.getInitializer() !== undefined;
  }
  
  /**
   * パラメータの初期化子ノード（= の右側）を取得する
   * @returns 初期化子ノード（存在しない場合はnull）
   */
  public getInitializer(): INode | null {
    return this.getDefaultValue();
  }
  
  /**
   * パラメータの修飾子を取得する（public, private, protected, readonly など）
   * @returns 修飾子の配列
   */
  public getModifiers(): string[] {
    return this.parameterNode.getModifiers().map(modifier => modifier.getText());
  }
  
  /**
   * 内部のts-morphのパラメータノードを取得する
   * @returns ts-morphのパラメータノード
   */
  public getInternalNode(): ParameterDeclaration {
    return this.parameterNode;
  }
}
