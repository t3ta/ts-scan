/**
 * ts-morphのインターフェース宣言向けアダプター実装
 * 
 * ts-morphのインターフェース宣言オブジェクトを抽象インターフェースIInterfaceに適合させる
 * アダプタークラスです。
 */

import {
  InterfaceDeclaration,
  PropertySignature,
  MethodSignature,
  Type
} from 'ts-morph';
import { IInterface, IMethodSignature } from '../interfaces/IInterface';
import { IProperty } from '../interfaces/IProperty';
import { IType } from '../interfaces/IType';
import { TsMorphNodeAdapter } from './TsMorphNodeAdapter';
import { TsMorphTypeAdapter } from './TsMorphTypeAdapter';

/**
 * インターフェースのプロパティシグネチャの簡易アダプター
 */
class SimpleTsMorphPropertyAdapter extends TsMorphNodeAdapter implements IProperty {
  private propertyNode: PropertySignature;
  
  constructor(propertyNode: PropertySignature) {
    super(propertyNode);
    this.propertyNode = propertyNode;
  }
  
  getName(): string {
    return this.propertyNode.getName();
  }
  
  getType(): IType | null {
    return new TsMorphTypeAdapter(this.propertyNode.getType());
  }
  
  isStatic(): boolean {
    return false; // インターフェースのプロパティはstaticにできない
  }
  
  isReadonly(): boolean {
    return this.propertyNode.isReadonly();
  }
  
  isOptional(): boolean {
    return this.propertyNode.hasQuestionToken();
  }
  
  getAccessModifier(): any {
    return 'none'; // インターフェースのプロパティはアクセス修飾子を持たない
  }
  
  getInitializer(): any {
    return null; // インターフェースのプロパティは初期化子を持たない
  }
  
  hasInitializer(): boolean {
    return false;
  }
  
  getDocumentation(): string {
    const jsDocs = this.propertyNode.getJsDocs();
    if (jsDocs.length === 0) {
      return '';
    }
    return jsDocs.map(doc => doc.getInnerText()).join('\n');
  }
  
  getDecorators(): any[] {
    return []; // インターフェースのプロパティはデコレータを持たない
  }
  
  isClassProperty(): boolean {
    return false;
  }
  
  isObjectLiteralProperty(): boolean {
    return false;
  }
}

/**
 * インターフェースのメソッドシグネチャアダプター
 */
class TsMorphMethodSignatureAdapter implements IMethodSignature {
  private methodNode: MethodSignature;
  
  constructor(methodNode: MethodSignature) {
    this.methodNode = methodNode;
  }
  
  getName(): string {
    return this.methodNode.getName();
  }
  
  getParameters(): { name: string; type: IType | null; optional: boolean }[] {
    return this.methodNode.getParameters().map(param => ({
      name: param.getName(),
      type: param.getType() ? new TsMorphTypeAdapter(param.getType()) : null,
      optional: param.isOptional()
    }));
  }
  
  getReturnType(): IType | null {
    const returnType = this.methodNode.getReturnType();
    if (!returnType) {
      return null;
    }
    return new TsMorphTypeAdapter(returnType);
  }
  
  isOptional(): boolean {
    return this.methodNode.hasQuestionToken();
  }
}

/**
 * ts-morphのインターフェース宣言向けアダプタークラス
 */
export class TsMorphInterfaceAdapter extends TsMorphNodeAdapter implements IInterface {
  private interfaceNode: InterfaceDeclaration;
  
  /**
   * コンストラクタ
   * @param interfaceNode ts-morphのインターフェース宣言オブジェクト
   */
  constructor(interfaceNode: InterfaceDeclaration) {
    super(interfaceNode);
    this.interfaceNode = interfaceNode;
  }
  
  /**
   * インターフェース名を取得する
   * @returns インターフェース名
   */
  public getName(): string {
    return this.interfaceNode.getName();
  }
  
  /**
   * インターフェースのJSDocコメントを取得する
   * @returns JSDocコメントの文字列（存在しない場合は空文字列）
   */
  public getDocumentation(): string {
    const jsDocs = this.interfaceNode.getJsDocs();
    if (jsDocs.length === 0) {
      return '';
    }
    
    return jsDocs.map(doc => doc.getInnerText()).join('\n');
  }
  
  /**
   * インターフェースのプロパティを取得する
   * @returns インターフェースプロパティの配列
   */
  public getProperties(): IProperty[] {
    const properties = this.interfaceNode.getProperties();
    return properties.map(prop => new SimpleTsMorphPropertyAdapter(prop));
  }
  
  /**
   * インターフェースのメソッドシグネチャを取得する
   * @returns メソッドシグネチャの配列
   */
  public getMethodSignatures(): IMethodSignature[] {
    const methods = this.interfaceNode.getMethods();
    return methods.map(method => new TsMorphMethodSignatureAdapter(method));
  }
  
  /**
   * インターフェースの継承元を取得する
   * @returns 継承元インターフェースの型情報配列
   */
  public getExtends(): IType[] {
    const extended = this.interfaceNode.getExtends();
    return extended.map(ext => new TsMorphTypeAdapter(ext.getType()));
  }
  
  /**
   * インターフェース宣言にジェネリック型パラメータがあるかどうかを判定する
   * @returns ジェネリック型パラメータがあればtrue
   */
  public hasTypeParameters(): boolean {
    return this.interfaceNode.getTypeParameters().length > 0;
  }
  
  /**
   * インターフェースのジェネリック型パラメータを取得する
   * @returns ジェネリック型パラメータの配列
   */
  public getTypeParameters(): { name: string; constraint?: IType; default?: IType }[] {
    return this.interfaceNode.getTypeParameters().map(param => {
      const constraint = param.getConstraint();
      const defaultType = param.getDefault();
      
      return {
        name: param.getName(),
        constraint: constraint ? new TsMorphTypeAdapter(constraint.getType()) : undefined,
        default: defaultType ? new TsMorphTypeAdapter(defaultType.getType()) : undefined
      };
    });
  }
  
  /**
   * インターフェースの修飾子を取得する（export, default など）
   * @returns 修飾子の配列
   */
  public getModifiers(): string[] {
    return this.interfaceNode.getModifiers().map(mod => mod.getText());
  }
  
  /**
   * 特定の名前のメンバー（プロパティまたはメソッド）を取得する
   * @param name メンバー名
   * @returns 対応するメンバー（存在しない場合はnull）
   */
  public getMember(name: string): (IProperty | IMethodSignature) | null {
    // プロパティを検索
    const property = this.getProperties().find(prop => prop.getName() === name);
    if (property) {
      return property;
    }
    
    // メソッドを検索
    const method = this.getMethodSignatures().find(method => method.getName() === name);
    if (method) {
      return method;
    }
    
    return null;
  }
  
  /**
   * インデックスシグネチャを持つかどうかを判定する
   * @returns インデックスシグネチャを持つ場合はtrue
   */
  public hasIndexSignature(): boolean {
    return this.interfaceNode.getIndexSignatures().length > 0;
  }
  
  /**
   * 内部のts-morphのインターフェースノードを取得する
   * @returns ts-morphのインターフェースノード
   */
  public getInternalNode(): InterfaceDeclaration {
    return this.interfaceNode;
  }
}
