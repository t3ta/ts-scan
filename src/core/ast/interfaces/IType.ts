/**
 * 型情報の抽象インターフェース
 * 
 * TypeScriptの型情報に対する操作を抽象化し、具体的な実装への依存を
 * 排除します。型に関連する高レベルの操作を定義します。
 */

/**
 * 基本型の種類
 */
export enum BasicType {
  Any,
  Unknown,
  String,
  Number,
  Boolean,
  Null,
  Undefined,
  Object,
  Array,
  Function,
  Union,
  Intersection,
  Literal,
  Interface,
  Class,
  Enum,
  TypeParameter,
  Custom
}

/**
 * 型情報の抽象インターフェース
 */
export interface IType {
  /**
   * 型の名前を取得する
   * @returns 型の名前
   */
  getName(): string;
  
  /**
   * 型の文字列表現を取得する
   * @returns 型の文字列表現
   */
  getText(): string;
  
  /**
   * 基本的な型の種類を判定する
   * @returns 基本型の種類
   */
  getBasicType(): BasicType;
  
  /**
   * 配列型の場合、要素の型情報を取得する
   * @returns 配列要素の型情報（配列型でない場合はnull）
   */
  getArrayElementType(): IType | null;
  
  /**
   * ユニオン型の場合、構成要素の型情報を取得する
   * @returns ユニオン型の構成要素配列（ユニオン型でない場合は空配列）
   */
  getUnionTypes(): IType[];
  
  /**
   * 特定の型かどうかを判定する
   * @param basicType 判定対象の基本型
   * @returns 指定された型であればtrue
   */
  isType(basicType: BasicType): boolean;
  
  /**
   * プリミティブ型かどうかを判定する
   * @returns プリミティブ型であればtrue
   */
  isPrimitive(): boolean;
  
  /**
   * オブジェクト型かどうかを判定する
   * @returns オブジェクト型であればtrue
   */
  isObject(): boolean;
  
  /**
   * 配列型かどうかを判定する
   * @returns 配列型であればtrue
   */
  isArray(): boolean;
  
  /**
   * リテラル型かどうかを判定する
   * @returns リテラル型であればtrue
   */
  isLiteral(): boolean;
  
  /**
   * ユニオン型かどうかを判定する
   * @returns ユニオン型であればtrue
   */
  isUnion(): boolean;
  
  /**
   * 実装固有の内部型オブジェクトを取得する
   * ※注意: 抽象化を破る操作であり、必要な場合のみ使用すること
   * @returns 内部型オブジェクト
   */
  getInternalType(): any;
}
