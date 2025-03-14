/**
 * ASTProviderFactoryのユニットテスト
 * 
 * 実行環境やコンテキストに応じた適切なASTプロバイダーを生成するファクトリークラスの
 * テストを行います。
 */

import { 
  ASTProviderFactory, 
  EnvironmentType, 
  createASTProvider 
} from '../../../src/core/ast/factories/ASTProviderFactory';
import { MockProvider } from '../../../src/core/ast/implementations/MockProvider';
import { TsMorphAdapter } from '../../../src/core/ast/adapters/TsMorphAdapter';
import { loadASTSnapshot } from '../../helpers/ast-helpers';

// 環境変数をモック化
const originalEnv = process.env.NODE_ENV;

describe('ASTProviderFactory', () => {
  beforeEach(() => {
    // 各テスト前に環境変数をリセット
    process.env.NODE_ENV = originalEnv;
    // ファクトリーのキャッシュをクリア
    ASTProviderFactory.getInstance().clearCache();
  });
  
  afterAll(() => {
    // テスト後に環境変数を元に戻す
    process.env.NODE_ENV = originalEnv;
  });
  
  describe('getInstance', () => {
    it('シングルトンインスタンスを返すこと', () => {
      const instance1 = ASTProviderFactory.getInstance();
      const instance2 = ASTProviderFactory.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
  
  describe('環境検出とプロバイダー作成', () => {
    it('テスト環境ではモックプロバイダーを作成すること', () => {
      // テスト環境を設定
      process.env.NODE_ENV = 'test';
      const factory = ASTProviderFactory.getInstance();
      
      // 環境タイプを再検出
      factory.setEnvironmentType(EnvironmentType.Test);
      
      const provider = factory.createProvider();
      expect(provider).toBeInstanceOf(MockProvider);
    });
    
    it('本番環境ではts-morphアダプターを作成すること', () => {
      // 本番環境を設定
      process.env.NODE_ENV = 'production';
      const factory = ASTProviderFactory.getInstance();
      
      // 環境タイプを再検出
      factory.setEnvironmentType(EnvironmentType.Production);
      
      const provider = factory.createProvider();
      expect(provider).toBeInstanceOf(TsMorphAdapter);
    });
    
    it('開発環境ではts-morphアダプターを作成すること', () => {
      // 開発環境を設定
      process.env.NODE_ENV = 'development';
      const factory = ASTProviderFactory.getInstance();
      
      // 環境タイプを再検出
      factory.setEnvironmentType(EnvironmentType.Development);
      
      const provider = factory.createProvider();
      expect(provider).toBeInstanceOf(TsMorphAdapter);
    });
  });
  
  describe('キャッシング機能', () => {
    it('同じキャッシュキーで複数回作成しても同じインスタンスを返すこと', () => {
      const factory = ASTProviderFactory.getInstance();
      
      const provider1 = factory.createProvider({ cacheKey: 'test-key' });
      const provider2 = factory.createProvider({ cacheKey: 'test-key' });
      
      expect(provider1).toBe(provider2);
    });
    
    it('異なるキャッシュキーでは異なるインスタンスを返すこと', () => {
      const factory = ASTProviderFactory.getInstance();
      
      const provider1 = factory.createProvider({ cacheKey: 'key1' });
      const provider2 = factory.createProvider({ cacheKey: 'key2' });
      
      expect(provider1).not.toBe(provider2);
    });
    
    it('clearCache()でキャッシュがクリアされること', () => {
      const factory = ASTProviderFactory.getInstance();
      
      const provider1 = factory.createProvider({ cacheKey: 'test-key' });
      factory.clearCache();
      const provider2 = factory.createProvider({ cacheKey: 'test-key' });
      
      expect(provider1).not.toBe(provider2);
    });
  });
  
  describe('明示的なプロバイダー作成', () => {
    it('環境設定に関わらずcreateA0ockProviderでモックプロバイダーを作成できること', () => {
      // 本番環境を設定
      process.env.NODE_ENV = 'production';
      const factory = ASTProviderFactory.getInstance();
      factory.setEnvironmentType(EnvironmentType.Production);
      
      const provider = factory.createMockProvider();
      expect(provider).toBeInstanceOf(MockProvider);
    });
    
    it('環境設定に関わらずcreateTsMorphProviderでts-morphアダプターを作成できること', () => {
      // テスト環境を設定
      process.env.NODE_ENV = 'test';
      const factory = ASTProviderFactory.getInstance();
      factory.setEnvironmentType(EnvironmentType.Test);
      
      const provider = factory.createTsMorphProvider();
      expect(provider).toBeInstanceOf(TsMorphAdapter);
    });
  });
  
  describe('ヘルパー関数', () => {
    it('createASTProviderがデフォルトファクトリーを使用してプロバイダーを作成すること', () => {
      const provider = createASTProvider();
      
      // 現在の環境に応じたプロバイダータイプをチェック
      if (process.env.NODE_ENV === 'test') {
        expect(provider).toBeInstanceOf(MockProvider);
      } else {
        expect(provider).toBeInstanceOf(TsMorphAdapter);
      }
    });
  });
  
  describe('スナップショットの使用', () => {
    it('スナップショットを指定してモックプロバイダーを作成できること', () => {
      // 基本関数のスナップショットを読み込み
      const snapshot = loadASTSnapshot('basic-function');
      
      const factory = ASTProviderFactory.getInstance();
      const provider = factory.createMockProvider([snapshot]);
      
      // プロバイダーのタイプをチェック
      expect(provider).toBeInstanceOf(MockProvider);
      
      // スナップショットからコードを解析できることを確認
      const sourceFile = provider.parseFile('sample/basic-function.ts');
      
      // 関数を取得
      const functions = sourceFile.getFunctions();
      expect(functions.length).toBe(1);
      expect(functions[0].getName()).toBe('greet');
    });
  });
});
