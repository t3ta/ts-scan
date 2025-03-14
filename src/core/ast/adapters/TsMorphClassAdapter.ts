/**
 * ts-morphのクラス宣言向けアダプター実装
 * 
 * ts-morphのクラス宣言オブジェクトを抽象インターフェースIClassに適合させる
 * アダプタークラスです。
 */

import {
  ClassDeclaration,
  PropertyDeclaration,
  MethodDeclaration,
  ConstructorDeclaration,
  SyntaxKind
} from 'ts-morph';
import { IClass } from '../interfaces/IClass';
import { IFunction } from '../interfaces/IFunction';
import { IProperty } from '../interfaces/IProperty';
import { IType } from '../interfaces/IType';
import { INode } from '../interfaces/INode';
import { TsMorphNodeAdapter } from './TsMorphNodeAdapter';
import { TsMorphFunctionAdapter } from './TsMorphFunctionAdapter';
import { TsMorphTypeAdapter } from './TsMorphTypeAdapter';
import { TsMorphParameterAdapter } from './TsMorphParameterAdapter';

/**
 * クラス宣言の簡易プロパティアダプター（実装簡略化のため）
 */
class SimpleTsMorphPropertyAdapter extends TsMorphNodeAdapter implements IProperty {
  private propertyNode: PropertyDeclaration;
  
  constructor(propertyNode: PropertyDeclaration) {
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
    return this.propertyNode.isStatic();
  }
  
  isReadonly(): boolean {
    return this.propertyNode.isReadonly();
  }
  
  isOptional(): boolean {
    return this.propertyNode.hasQuestionToken();
  }
  
  getAccessModifier(): any {
    // ts-morphのバージョンによってはアクセサメソッドが異なるため、直接モディファイアを確認
    const modifiers = this.propertyNode.getModifiers();
    
    for (const modifier of modifiers) {
      const modifierText = modifier.getText();
      if (modifierText === 'private') return 'private';
      if (modifierText === 'protected') return 'protected'; 
      if (modifierText === 'public') return 'public';
    }
    
    return 'none';
  }
  
  getInitializer(): any {
    const initializer = this.propertyNode.getInitializer();
    return initializer ? new TsMorphNodeAdapter(initializer) : null;
  }
  
  hasInitializer(): boolean {
    return this.propertyNode.getInitializer() !== undefined;
  }
  
  getDocumentation(): string {
    const jsDocs = this.propertyNode.getJsDocs();
    if (jsDocs.length === 0) {
      return '';
    }
    return jsDocs.map(doc => doc.getInnerText()).join('\n');
  }
  
  getDecorators(): any[] {
    return this.propertyNode.getDecorators().map(dec => new TsMorphNodeAdapter(dec));
  }
  
  isClassProperty(): boolean {
    return true;
  }
  
  isObjectLiteralProperty(): boolean {
    return false;
  }
}

/**
 * メソッド用のTsMorphFunctionAdapterラッパー
 */
class MethodAdapter extends TsMorphFunctionAdapter {
  constructor(method: MethodDeclaration) {
    super(method);
  }
}

/**
 * コンストラクタ用のTsMorphFunctionAdapterラッパー
 */
class ConstructorAdapter extends TsMorphNodeAdapter implements IFunction {
  private constructorNode: ConstructorDeclaration;
  
  constructor(constructorNode: ConstructorDeclaration) {
    super(constructorNode);
    this.constructorNode = constructorNode;
  }
  
  getName(): string {
    return 'constructor';
  }
  
  isAsync(): boolean {
    return false;
  }
  
  isGenerator(): boolean {
    return false;
  }
  
  getParameters(): any[] {
    const params = this.constructorNode.getParameters();
    return params.map(param => new TsMorphParameterAdapter(param));
  }
  
  getReturnType(): IType | null {
    // コンストラクタは常にクラスインスタンスを返す
    return null;
  }
  
  getBody(): INode | null {
    const body = this.constructorNode.getBody();
    return body ? new TsMorphNodeAdapter(body) : null;
  }
  
  isArrowFunction(): boolean {
    return false;
  }
  
  isMethodDeclaration(): boolean {
    return false;
  }
  
  getDocumentation(): string {
    const jsDocs = this.constructorNode.getJsDocs();
    if (jsDocs.length === 0) {
      return '';
    }
    return jsDocs.map(doc => doc.getInnerText()).join('\n');
  }
}

/**
 * ts-morphのクラス宣言向けアダプタークラス
 */
export class TsMorphClassAdapter extends TsMorphNodeAdapter implements IClass {
  private classNode: ClassDeclaration;
  
  /**
   * コンストラクタ
   * @param classNode ts-morphのクラス宣言オブジェクト
   */
  constructor(classNode: ClassDeclaration) {
    super(classNode);
    this.classNode = classNode;
  }
  
  /**
   * クラス名を取得する
   * @returns クラス名
   */
  public getName(): string {
    return this.classNode.getName() || '';
  }
  
  /**
   * クラスのJSDocコメントを取得する
   * @returns JSDocコメントの文字列（存在しない場合は空文字列）
   */
  public getDocumentation(): string {
    const jsDocs = this.classNode.getJsDocs();
    if (jsDocs.length === 0) {
      return '';
    }
    
    // すべてのJSDocを連結
    return jsDocs.map(doc => doc.getInnerText()).join('\n');
  }
  
  /**
   * クラスのプロパティを取得する
   * @returns クラスプロパティの配列
   */
  public getProperties(): IProperty[] {
    const properties = this.classNode.getProperties();
    return properties.map(prop => new SimpleTsMorphPropertyAdapter(prop));
  }
  
  /**
   * クラスのメソッドを取得する
   * @returns クラスメソッドの配列（コンストラクタ以外）
   */
  public getMethods(): IFunction[] {
    const methods = this.classNode.getMethods().filter(method => {
      // コンストラクタを除外する
      return method.getKind() !== SyntaxKind.Constructor;
    });
    return methods.map(method => new MethodAdapter(method));
  }
  
  /**
   * クラスのコンストラクタを取得する
   * @returns コンストラクタメソッド（存在しない場合はnull）
   */
  public getConstructor(): IFunction | null {
    const constructors = this.classNode.getConstructors();
    const constructor = constructors.length > 0 ? constructors[0] : null;
    if (!constructor) {
      return null;
    }
    return new ConstructorAdapter(constructor);
  }
  
  /**
   * クラスの継承元（親クラス）を取得する
   * @returns 親クラスの型情報（継承がない場合はnull）
   */
  public getBaseClass(): IType | null {
    const baseClass = this.classNode.getBaseClass();
    if (!baseClass) {
      return null;
    }
    return new TsMorphTypeAdapter(baseClass.getType());
  }
  
  /**
   * クラスが実装するインターフェースを取得する
   * @returns 実装インターフェースの型情報配列
   */
  public getImplements(): IType[] {
    const implementations = this.classNode.getImplements();
    return implementations.map(impl => new TsMorphTypeAdapter(impl.getType()));
  }
  
  /**
   * クラスが抽象クラスかどうかを判定する
   * @returns 抽象クラスであればtrue
   */
  public isAbstract(): boolean {
    return this.classNode.isAbstract();
  }
  
  /**
   * クラス宣言にジェネリック型パラメータがあるかどうかを判定する
   * @returns ジェネリック型パラメータがあればtrue
   */
  public hasTypeParameters(): boolean {
    return this.classNode.getTypeParameters().length > 0;
  }
  
  /**
   * クラスの修飾子を取得する（export, default など）
   * @returns 修飾子の配列
   */
  public getModifiers(): string[] {
    return this.classNode.getModifiers().map(mod => mod.getText());
  }
  
  /**
   * 静的メンバー（プロパティとメソッド）を取得する
   * @returns 静的メンバーの配列
   */
  public getStaticMembers(): (IProperty | IFunction)[] {
    const staticProperties = this.getProperties().filter(prop => prop.isStatic());
    const staticMethods = this.getMethods().filter(method => {
      // InternalNodeを使って静的メソッドかどうかを判定
      const internalNode = method.getInternalNode();
      return internalNode && internalNode.isStatic && internalNode.isStatic();
    });
    
    return [...staticProperties, ...staticMethods];
  }
  
  /**
   * 特定の名前のメンバー（プロパティまたはメソッド）を取得する
   * @param name メンバー名
   * @returns 対応するメンバー（存在しない場合はnull）
   */
  public getMember(name: string): (IProperty | IFunction) | null {
    // プロパティを検索
    const property = this.getProperties().find(prop => prop.getName() === name);
    if (property) {
      return property;
    }
    
    // メソッドを検索
    const method = this.getMethods().find(method => method.getName() === name);
    if (method) {
      return method;
    }
    
    return null;
  }
  
  /**
   * 内部のts-morphのクラスノードを取得する
   * @returns ts-morphのクラスノード
   */
  public getInternalNode(): ClassDeclaration {
    return this.classNode;
  }
}
