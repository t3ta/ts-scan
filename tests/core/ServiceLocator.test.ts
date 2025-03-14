/**
 * ServiceLocatorのユニットテスト
 * 
 * 依存性注入のためのサービスロケーターパターン実装とASTプロバイダー対応のテストを行います。
 */

import { ServiceLocator, ServiceIds } from '../../src/core/ServiceLocator';
import { IASTProvider } from '../../src/core/ast/interfaces/IASTProvider';
import { INode, NodeKind } from '../../src/core/ast/interfaces/INode';
import { IFunction } from '../../src/core/ast/interfaces/IFunction';
import { MockProvider } from '../../src/core/ast/implementations/MockProvider';
import { TsMorphAdapter } from '../../src/core/ast/adapters/TsMorphAdapter';
import { loadASTSnapshot } from '../helpers/ast-helpers';

// 環境変数をモック化
const originalEnv = process.env.NODE_ENV;

describe('ServiceLocator', () => {
  let serviceLocator: ServiceLocator;
  
  beforeEach(() => {
    // 各テスト前に環境変数をリセット
    process.env.NODE_ENV = originalEnv;
    // シングルトンインスタンスをクリア
    serviceLocator = ServiceLocator.getInstance();
    serviceLocator.clear();
  });
  
  afterAll(() => {
    // テスト後に環境変数を元に戻す
    process.env.NODE_ENV = originalEnv;
  });
  
  describe('基本機能', () => {
    it('シングルトンインスタンスを返すこと', () => {
      const instance1 = ServiceLocator.getInstance();
      const instance2 = ServiceLocator.getInstance();
      
      expect(instance1).toBe(instance2);
    });
    
    it('サービスを登録して取得できること', () => {
      // Arrange
      const testService = { test: 'value' };
      serviceLocator.register('testService', testService);
      
      // Act
      const retrieved = serviceLocator.resolve<typeof testService>('testService');
      
      // Assert
      expect(retrieved).toBe(testService);
    });
    
    it('登録されていないサービスを取得しようとすると例外がスローされること', () => {
      expect(() => {
        serviceLocator.resolve('non-existent');
      }).toThrow();
    });
    
    it('既に登録されているサービスを再登録しようとすると例外がスローされること', () => {
      // Arrange
      serviceLocator.register('testService', {});
      
      // Act & Assert
      expect(() => {
        serviceLocator.register('testService', {});
      }).toThrow();
    });
    
    it('override()で既存のサービスを上書きできること', () => {
      // Arrange
      const originalService = { original: true };
      const newService = { new: true };
      serviceLocator.register('testService', originalService);
      
      // Act
      serviceLocator.override('testService', newService);
      const retrieved = serviceLocator.resolve<typeof newService>('testService');
      
      // Assert
      expect(retrieved).toBe(newService);
      expect(retrieved).not.toBe(originalService);
    });
    
    it('has()で登録の有無を確認できること', () => {
      // Arrange
      serviceLocator.register('testService', {});
      
      // Act & Assert
      expect(serviceLocator.has('testService')).toBe(true);
      expect(serviceLocator.has('non-existent')).toBe(false);
    });
    
    it('getRegisteredServiceIds()ですべてのサービスIDを取得できること', () => {
      // Arrange
      serviceLocator.register('service1', {});
      serviceLocator.register('service2', {});
      serviceLocator.register('service3', {});
      
      // Act
      const serviceIds = serviceLocator.getRegisteredServiceIds();
      
      // Assert
      expect(serviceIds).toContain('service1');
      expect(serviceIds).toContain('service2');
      expect(serviceIds).toContain('service3');
      expect(serviceIds.length).toBe(3);
    });
    
    it('clear()ですべてのサービスを削除できること', () => {
      // Arrange
      serviceLocator.register('service1', {});
      serviceLocator.register('service2', {});
      
      // Act
      serviceLocator.clear();
      
      // Assert
      expect(serviceLocator.getRegisteredServiceIds().length).toBe(0);
      expect(serviceLocator.has('service1')).toBe(false);
      expect(serviceLocator.has('service2')).toBe(false);
    });
  });
  
  describe('ASTプロバイダー対応', () => {
    it('registerASTProvider()でASTプロバイダーを登録できること', () => {
      // Arrange
      const mockProvider = new MockProvider();
      
      // Act
      serviceLocator.registerASTProvider(mockProvider);
      
      // Assert
      expect(serviceLocator.has(ServiceIds.AST_PROVIDER)).toBe(true);
      expect(serviceLocator.resolve<IASTProvider>(ServiceIds.AST_PROVIDER)).toBe(mockProvider);
    });
    
    it('プロバイダーを指定せずregisterASTProvider()を呼び出すと自動的にプロバイダーを生成すること', () => {
      // Act
      serviceLocator.registerASTProvider();
      
      // Assert
      expect(serviceLocator.has(ServiceIds.AST_PROVIDER)).toBe(true);
      
      const provider = serviceLocator.resolve<IASTProvider>(ServiceIds.AST_PROVIDER);
      if (process.env.NODE_ENV === 'test') {
        expect(provider).toBeInstanceOf(MockProvider);
      } else {
        expect(provider).toBeInstanceOf(TsMorphAdapter);
      }
    });
    
    it('ASTプロバイダー登録時に型チェッカーも同時に登録されること', () => {
      // Arrange
      const mockProvider = new MockProvider();
      const typeChecker = mockProvider.getTypeChecker();
      
      // Act
      serviceLocator.registerASTProvider(mockProvider);
      
      // Assert
      expect(serviceLocator.has(ServiceIds.TYPE_CHECKER)).toBe(true);
      expect(serviceLocator.resolve(ServiceIds.TYPE_CHECKER)).toBe(typeChecker);
    });
    
    it('getASTProvider()で登録したプロバイダーを取得できること', () => {
      // Arrange
      const mockProvider = new MockProvider();
      serviceLocator.registerASTProvider(mockProvider);
      
      // Act
      const provider = serviceLocator.getASTProvider();
      
      // Assert
      expect(provider).toBe(mockProvider);
    });
    
    it('ASTプロバイダーが登録されていない場合にgetASTProvider()を呼び出すと自動的に登録されること', () => {
      // Act
      const provider = serviceLocator.getASTProvider();
      
      // Assert
      expect(provider).toBeDefined();
      expect(serviceLocator.has(ServiceIds.AST_PROVIDER)).toBe(true);
    });
    
    it('スナップショットを使用したモックプロバイダーを登録して使用できること', () => {
      // Arrange
      const snapshot = loadASTSnapshot('basic-function');
      const mockProvider = new MockProvider([snapshot]);
      
      // Act
      serviceLocator.registerASTProvider(mockProvider);
      const provider = serviceLocator.getASTProvider();
      const sourceFile = provider.parseFile('sample/basic-function.ts');
      
      // Assert
      expect(sourceFile).toBeDefined();

      // デバッグために追加
      console.log('Root node kind:', sourceFile.getRootNode().getKind());
      console.log('Children count:', sourceFile.getRootNode().getChildren().length);
      
      // スナップショットのノード説明を表示
      sourceFile.getRootNode().getChildren().forEach((child, idx) => {
        console.log(`Child ${idx}: kind=${child.getKind()}, text="${child.getText().substring(0, 30)}..."`);
      });

      // 関数を取得して検証
      const functions = sourceFile.findNodes(node => node.getKind() === NodeKind.FunctionDeclaration);
      console.log('Functions found directly:', functions.length);

      // MockNodeのfindDescendantsの動作を手動で検証
      const allNodes: INode[] = [];
      const traverse = (node: INode) => {
        allNodes.push(node);
        node.getChildren().forEach(child => traverse(child));
      };
      traverse(sourceFile.getRootNode());
      console.log('All nodes via manual traversal:', allNodes.length);
      const manualFunctions = allNodes.filter(node => node.getKind() === NodeKind.FunctionDeclaration);
      console.log('Functions via manual traversal:', manualFunctions.length);

      expect(functions.length).toBe(1);
      if (functions.length > 0) {
        const funcNode = functions[0] as IFunction;
        expect(funcNode.getName()).toBe('greet');
      }
    });
  });
});
