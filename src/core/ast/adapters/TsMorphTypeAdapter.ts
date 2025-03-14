/**
 * ts-morphの型情報向けアダプター実装
 * 
 * ts-morphの型情報オブジェクトを抽象インターフェースITypeに適合させる
 * アダプタークラスです。
 */

import { Type as TsMorphType } from 'ts-morph';
import { IType, BasicType } from '../interfaces/IType';

/**
 * ts-morphの型情報向けアダプタークラス
 */
export class TsMorphTypeAdapter implements IType {
  private typeNode: TsMorphType;
  
  /**
   * コンストラクタ
   * @param typeNode ts-morphの型情報オブジェクト
   */
  constructor(typeNode: TsMorphType) {
    this.typeNode = typeNode;
  }
  
  /**
   * 型の名前を取得する
   * @returns 型の名前
   */
  public getName(): string {
    return this.typeNode.getText();
  }
  
  /**
   * 型の文字列表現を取得する
   * @returns 型の文字列表現
   */
  public getText(): string {
    return this.typeNode.getText();
  }
  
  /**
   * 基本的な型の種類を判定する
   * @returns 基本型の種類
   */
  public getBasicType(): BasicType {
    // ts-morphの型情報から基本型を判定
    if (this.typeNode.isAny()) {
      return BasicType.Any;
    } else if (this.typeNode.isUnknown()) {
      return BasicType.Unknown;
    } else if (this.typeNode.isString()) {
      return BasicType.String;
    } else if (this.typeNode.isNumber()) {
      return BasicType.Number;
    } else if (this.typeNode.isBoolean()) {
      return BasicType.Boolean;
    } else if (this.typeNode.isNull()) {
      return BasicType.Null;
    } else if (this.typeNode.isUndefined()) {
      return BasicType.Undefined;
    } else if (this.typeNode.isObject()) {
      return BasicType.Object;
    } else if (this.typeNode.isArray()) {
      return BasicType.Array;
    } else if (this.isFunction()) {
      return BasicType.Function;
    } else if (this.typeNode.isUnion()) {
      return BasicType.Union;
    } else if (this.typeNode.isIntersection()) {
      return BasicType.Intersection;
    } else if (this.typeNode.isLiteral()) {
      return BasicType.Literal;
    } else if (this.typeNode.isInterface()) {
      return BasicType.Interface;
    } else if (this.typeNode.isClass()) {
      return BasicType.Class;
    } else if (this.typeNode.isEnum()) {
      return BasicType.Enum;
    } else if (this.typeNode.isTypeParameter()) {
      return BasicType.TypeParameter;
    }
    
    // 上記以外はカスタム型
    return BasicType.Custom;
  }
  
  /**
   * 関数型かどうかを判定する
   * ts-morphに直接的なisFunction()メソッドがないため、テキスト内容に基づいて判定
   */
  private isFunction(): boolean {
    const text = this.typeNode.getText();
    return text.includes('=>') || text.startsWith('Function') || text.includes('function');
  }
  
  /**
   * 配列型の場合、要素の型情報を取得する
   * @returns 配列要素の型情報（配列型でない場合はnull）
   */
  public getArrayElementType(): IType | null {
    if (!this.typeNode.isArray()) {
      return null;
    }
    
    const arrayType = this.typeNode.getArrayElementType();
    if (!arrayType) {
      return null;
    }
    
    return new TsMorphTypeAdapter(arrayType);
  }
  
  /**
   * ユニオン型の場合、構成要素の型情報を取得する
   * @returns ユニオン型の構成要素配列（ユニオン型でない場合は空配列）
   */
  public getUnionTypes(): IType[] {
    if (!this.typeNode.isUnion()) {
      return [];
    }
    
    return this.typeNode.getUnionTypes().map(type => new TsMorphTypeAdapter(type));
  }
  
  /**
   * 特定の型かどうかを判定する
   * @param basicType 判定対象の基本型
   * @returns 指定された型であればtrue
   */
  public isType(basicType: BasicType): boolean {
    return this.getBasicType() === basicType;
  }
  
  /**
   * プリミティブ型かどうかを判定する
   * @returns プリミティブ型であればtrue
   */
  public isPrimitive(): boolean {
    return (
      this.typeNode.isString() ||
      this.typeNode.isNumber() ||
      this.typeNode.isBoolean() ||
      this.typeNode.isUndefined() ||
      this.typeNode.isNull() ||
      this.typeNode.isStringLiteral() ||
      this.typeNode.isNumberLiteral() ||
      this.typeNode.isBooleanLiteral()
    );
  }
  
  /**
   * オブジェクト型かどうかを判定する
   * @returns オブジェクト型であればtrue
   */
  public isObject(): boolean {
    return this.typeNode.isObject();
  }
  
  /**
   * 配列型かどうかを判定する
   * @returns 配列型であればtrue
   */
  public isArray(): boolean {
    return this.typeNode.isArray();
  }
  
  /**
   * リテラル型かどうかを判定する
   * @returns リテラル型であればtrue
   */
  public isLiteral(): boolean {
    return this.typeNode.isLiteral();
  }
  
  /**
   * ユニオン型かどうかを判定する
   * @returns ユニオン型であればtrue
   */
  public isUnion(): boolean {
    return this.typeNode.isUnion();
  }
  
  /**
   * 実装固有の内部型オブジェクトを取得する
   * @returns 内部型オブジェクト
   */
  public getInternalType(): any {
    return this.typeNode;
  }
}
