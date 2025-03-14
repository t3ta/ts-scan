/**
 * ServiceLocator クラスのユニットテスト
 * 
 * サービスロケーターの各機能を検証します。
 * シングルトンパターンとDIコンテナとしての機能をテストします。
 */

// ts-mockitoはこのテストでは使用していないが、将来の拡張のために設定しておく
import { ServiceLocator, ServiceIds } from '../../src/core/ServiceLocator';

// テスト用のモックサービスクラス
class MockService {
  public getValue(): string {
    return 'mock-value';
  }
}

// テスト用の別のモックサービスクラス
class AnotherMockService {
  public getData(): string {
    return 'another-data';
  }
}

describe('ServiceLocator', () => {
  // 各テスト前にServiceLocatorをクリアする
  beforeEach(() => {
    ServiceLocator.getInstance().clear();
  });

  // シングルトンの動作確認
  describe('getInstance', () => {
    it('常に同じインスタンスを返すこと', () => {
      // Arrange
      const instance1 = ServiceLocator.getInstance();
      const instance2 = ServiceLocator.getInstance();
      
      // Assert
      expect(instance1).toBe(instance2);
    });
  });
  
  // 登録と解決の基本動作
  describe('register と resolve', () => {
    it('登録したサービスを正しく解決できること', () => {
      // Arrange
      const serviceLocator = ServiceLocator.getInstance();
      const mockService = new MockService();
      
      // Act
      serviceLocator.register('mockService', mockService);
      const resolved = serviceLocator.resolve<MockService>('mockService');
      
      // Assert
      expect(resolved).toBe(mockService);
      expect(resolved.getValue()).toBe('mock-value');
    });
    
    it('未登録のサービスを解決しようとすると例外が発生すること', () => {
      // Arrange
      const serviceLocator = ServiceLocator.getInstance();
      
      // Act & Assert
      expect(() => {
        serviceLocator.resolve<MockService>('nonExistentService');
      }).toThrow("サービス 'nonExistentService' が登録されていません");
    });
    
    it('既に登録済みのサービスIDで登録しようとすると例外が発生すること', () => {
      // Arrange
      const serviceLocator = ServiceLocator.getInstance();
      const mockService1 = new MockService();
      const mockService2 = new MockService();
      
      // Act
      serviceLocator.register('mockService', mockService1);
      
      // Assert
      expect(() => {
        serviceLocator.register('mockService', mockService2);
      }).toThrow("サービス 'mockService' は既に登録されています");
    });
  });
  
  // override メソッドのテスト
  describe('override', () => {
    it('既存のサービスを上書きできること', () => {
      // Arrange
      const serviceLocator = ServiceLocator.getInstance();
      const mockService1 = new MockService();
      const mockService2 = new MockService();
      
      // Act
      serviceLocator.register('mockService', mockService1);
      serviceLocator.override('mockService', mockService2);
      const resolved = serviceLocator.resolve<MockService>('mockService');
      
      // Assert
      expect(resolved).toBe(mockService2);
      expect(resolved).not.toBe(mockService1);
    });
    
    it('未登録のサービスIDでもoverrideで登録できること', () => {
      // Arrange
      const serviceLocator = ServiceLocator.getInstance();
      const mockService = new MockService();
      
      // Act
      serviceLocator.override('mockService', mockService);
      const resolved = serviceLocator.resolve<MockService>('mockService');
      
      // Assert
      expect(resolved).toBe(mockService);
    });
  });
  
  // has メソッドのテスト
  describe('has', () => {
    it('登録済みのサービスはtrueを返すこと', () => {
      // Arrange
      const serviceLocator = ServiceLocator.getInstance();
      serviceLocator.register('mockService', new MockService());
      
      // Act & Assert
      expect(serviceLocator.has('mockService')).toBe(true);
    });
    
    it('未登録のサービスはfalseを返すこと', () => {
      // Arrange
      const serviceLocator = ServiceLocator.getInstance();
      
      // Act & Assert
      expect(serviceLocator.has('nonExistentService')).toBe(false);
    });
  });
  
  // getRegisteredServiceIds メソッドのテスト
  describe('getRegisteredServiceIds', () => {
    it('すべての登録済みサービスIDを取得できること', () => {
      // Arrange
      const serviceLocator = ServiceLocator.getInstance();
      serviceLocator.register('service1', new MockService());
      serviceLocator.register('service2', new AnotherMockService());
      
      // Act
      const ids = serviceLocator.getRegisteredServiceIds();
      
      // Assert
      expect(ids.length).toBe(2);
      expect(ids).toContain('service1');
      expect(ids).toContain('service2');
    });
    
    it('サービスが登録されていない場合は空の配列を返すこと', () => {
      // Arrange
      const serviceLocator = ServiceLocator.getInstance();
      
      // Act
      const ids = serviceLocator.getRegisteredServiceIds();
      
      // Assert
      expect(ids).toEqual([]);
    });
  });
  
  // clear メソッドのテスト
  describe('clear', () => {
    it('すべてのサービスが削除されること', () => {
      // Arrange
      const serviceLocator = ServiceLocator.getInstance();
      serviceLocator.register('service1', new MockService());
      serviceLocator.register('service2', new AnotherMockService());
      
      // Act
      serviceLocator.clear();
      
      // Assert
      expect(serviceLocator.getRegisteredServiceIds().length).toBe(0);
      expect(serviceLocator.has('service1')).toBe(false);
      expect(serviceLocator.has('service2')).toBe(false);
    });
  });
  
  // ServiceIds 定数のテスト
  describe('ServiceIds', () => {
    it('定義されたすべてのサービスIDが文字列であること', () => {
      // すべてのサービスIDをループしてチェック
      Object.values(ServiceIds).forEach(id => {
        expect(typeof id).toBe('string');
      });
    });
    
    it('コアサービスのIDが正しく定義されていること', () => {
      expect(ServiceIds.LOGGER).toBe('logger');
      expect(ServiceIds.TYPE_CHECKER).toBe('typeChecker');
    });
  });
});
