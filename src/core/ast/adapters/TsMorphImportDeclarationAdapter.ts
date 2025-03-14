/**
 * ts-morphのインポート宣言向けアダプター実装
 * 
 * ts-morphのインポート宣言オブジェクトを抽象インターフェースIImportDeclarationに適合させる
 * アダプタークラスです。
 */

import {
  ImportDeclaration,
  ImportSpecifier
} from 'ts-morph';
import { 
  IImportDeclaration, 
  ImportSpecifier as IImportSpecifier,
  ImportSpecifierKind
} from '../interfaces/IImportDeclaration';
import { TsMorphNodeAdapter } from './TsMorphNodeAdapter';

/**
 * ts-morphのインポート宣言向けアダプタークラス
 */
export class TsMorphImportDeclarationAdapter extends TsMorphNodeAdapter implements IImportDeclaration {
  private importNode: ImportDeclaration;
  
  /**
   * コンストラクタ
   * @param importNode ts-morphのインポート宣言オブジェクト
   */
  constructor(importNode: ImportDeclaration) {
    super(importNode);
    this.importNode = importNode;
  }
  
  /**
   * インポート元のモジュールパスを取得する
   * @returns モジュールパスの文字列
   */
  public getModulePath(): string {
    return this.importNode.getModuleSpecifierValue();
  }
  
  /**
   * すべてのインポート指定子を取得する
   * @returns インポート指定子の配列
   */
  public getImportSpecifiers(): IImportSpecifier[] {
    const result: IImportSpecifier[] = [];
    
    // デフォルトインポートの処理
    const defaultImport = this.getDefaultImport();
    if (defaultImport) {
      result.push({
        name: defaultImport,
        kind: ImportSpecifierKind.Default
      });
    }
    
    // 名前空間インポートの処理
    const namespaceImport = this.getNamespaceImport();
    if (namespaceImport) {
      result.push({
        name: namespaceImport,
        kind: ImportSpecifierKind.Namespace
      });
    }
    
    // 名前付きインポートの処理
    const namedImports = this.getNamedImports();
    for (const namedImport of namedImports) {
      result.push({
        name: namedImport.name,
        alias: namedImport.alias,
        kind: ImportSpecifierKind.Named
      });
    }
    
    return result;
  }
  
  /**
   * デフォルトインポートの名前を取得する
   * @returns デフォルトインポートの名前（存在しない場合はnull）
   */
  public getDefaultImport(): string | null {
    const defaultImport = this.importNode.getDefaultImport();
    return defaultImport ? defaultImport.getText() : null;
  }
  
  /**
   * 名前空間インポートの名前を取得する
   * @returns 名前空間インポートの名前（存在しない場合はnull）
   */
  public getNamespaceImport(): string | null {
    const namespaceImport = this.importNode.getNamespaceImport();
    return namespaceImport ? namespaceImport.getText() : null;
  }
  
  /**
   * 名前付きインポートをすべて取得する
   * @returns 名前付きインポートの配列
   */
  public getNamedImports(): { name: string; alias?: string }[] {
    const namedImports = this.importNode.getNamedImports();
    
    return namedImports.map(namedImport => {
      const name = namedImport.getName();
      const alias = namedImport.getAliasNode()?.getText() || undefined;
      
      return { name, alias };
    });
  }
  
  /**
   * 特定の名前のエンティティがインポートされているかを判定する
   * @param name 確認する名前
   * @returns インポートされていればtrue
   */
  public hasNamedImport(name: string): boolean {
    const namedImports = this.getNamedImports();
    return namedImports.some(namedImport => 
      namedImport.name === name || namedImport.alias === name
    );
  }
  
  /**
   * インポートがサイドエフェクトのみ（import 'module'）かどうかを判定する
   * @returns サイドエフェクトのみのインポートであればtrue
   */
  public isSideEffectImport(): boolean {
    return (
      !this.getDefaultImport() && 
      !this.getNamespaceImport() && 
      this.getNamedImports().length === 0
    );
  }
  
  /**
   * インポート宣言の種類を判定する
   * @returns インポート宣言の種類の配列
   */
  public getImportKinds(): ImportSpecifierKind[] {
    const kinds: ImportSpecifierKind[] = [];
    
    if (this.getDefaultImport()) {
      kinds.push(ImportSpecifierKind.Default);
    }
    
    if (this.getNamespaceImport()) {
      kinds.push(ImportSpecifierKind.Namespace);
    }
    
    if (this.getNamedImports().length > 0) {
      kinds.push(ImportSpecifierKind.Named);
    }
    
    return kinds;
  }
  
  /**
   * 型インポートかどうかを判定する (import type { X } from 'module')
   * @returns 型インポートであればtrue
   */
  public isTypeOnly(): boolean {
    return this.importNode.isTypeOnly();
  }
  
  /**
   * 内部のts-morphのインポートノードを取得する
   * @returns ts-morphのインポートノード
   */
  public getInternalNode(): ImportDeclaration {
    return this.importNode;
  }
}
