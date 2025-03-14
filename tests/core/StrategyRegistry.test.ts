/**
 * StrategyRegistry クラスのユニットテスト
 * 
 * 戦略レジストリの各機能を検証します。
 * 戦略の登録、解除、優先度管理などの機能をテストします。
 */

import { mock, instance, when, verify } from 'ts-mockito';
import { StrategyRegistry } from '../../src/core/StrategyRegistry';
import { ServiceLocator, ServiceIds } from '../../src/core/ServiceLocator';
import { 
  EndpointDetectionStrategy, 
  DetectionContext, 
  EndpointInfo,
  ServiceLocator as IServiceLocator
} from '../../src/types';
import { SourceFile } from 'ts-morph';
import { logger } from '../../src/utils/Logger';

// モックのロガーを設定
jest.mock('../../src/utils/Logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    section: jest.fn()
  }
}));

// モック戦略クラスの実装
class MockStrategy implements EndpointDetectionStrategy {
  constructor(
    public readonly name: string,
    public readonly priority: number
  ) {}
  
  public detect(_sourceFile: SourceFile, _context: DetectionContext): EndpointInfo[] {
    return [];
  }
}

describe('StrategyRegistry', () => {
  let serviceLocator: ServiceLocator;
  let registry: StrategyRegistry;
  let mockServiceLocator: IServiceLocator;
  
  // 各テスト前の共通セットアップ
  beforeEach(() => {
    // ServiceLocatorのリセット
    serviceLocator = ServiceLocator.getInstance();
    serviceLocator.clear();
    
    // モックServiceLocatorの作成 (ts-mockitoを使用)
    mockServiceLocator = mock<IServiceLocator>();
    
    // StrategyRegistryの初期化
    registry = new StrategyRegistry(serviceLocator);
    
    // モックのリセット
    jest.clearAllMocks();
  });
  
  // 戦略の登録と取得
  describe('registerStrategy と getStrategy', () => {
    it('戦略を登録して取得できること', () => {
      // Arrange
      const mockStrategy = new MockStrategy('test-strategy', 10);
      
      // Act
      registry.registerStrategy(mockStrategy);
      const retrievedStrategy = registry.getStrategy('test-strategy');
      
      // Assert
      expect(retrievedStrategy).toBe(mockStrategy);
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('test-strategy'));
    });
    
    it('同じ名前の戦略を複数回登録しようとするとエラーになること', () => {
      // Arrange
      const mockStrategy1 = new MockStrategy('test-strategy', 10);
      const mockStrategy2 = new MockStrategy('test-strategy', 20);
      
      // Act
      registry.registerStrategy(mockStrategy1);
      
      // Assert
      expect(() => {
        registry.registerStrategy(mockStrategy2);
      }).toThrow("戦略 'test-strategy' は既に登録されています");
    });
    
    it('存在しない戦略を取得しようとするとundefinedが返ること', () => {
      // Act
      const retrievedStrategy = registry.getStrategy('non-existent-strategy');
      
      // Assert
      expect(retrievedStrategy).toBeUndefined();
    });
  });
  
  // 戦略の解除
  describe('unregisterStrategy', () => {
    it('登録済みの戦略を解除できること', () => {
      // Arrange
      const mockStrategy = new MockStrategy('test-strategy', 10);
      registry.registerStrategy(mockStrategy);
      
      // Act
      const result = registry.unregisterStrategy('test-strategy');
      
      // Assert
      expect(result).toBe(true);
      expect(registry.getStrategy('test-strategy')).toBeUndefined();
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('解除しました'));
    });
    
    it('存在しない戦略を解除しようとするとfalseが返ること', () => {
      // Act
      const result = registry.unregisterStrategy('non-existent-strategy');
      
      // Assert
      expect(result).toBe(false);
    });
  });
  
  // すべての戦略取得（優先度順）
  describe('getAllStrategies', () => {
    it('優先度順にソートされた戦略リストを返すこと', () => {
      // Arrange
      const strategy1 = new MockStrategy('strategy1', 30);
      const strategy2 = new MockStrategy('strategy2', 10);
      const strategy3 = new MockStrategy('strategy3', 20);
      
      registry.registerStrategy(strategy1);
      registry.registerStrategy(strategy2);
      registry.registerStrategy(strategy3);
      
      // Act
      const strategies = registry.getAllStrategies();
      
      // Assert
      expect(strategies).toHaveLength(3);
      expect(strategies[0]).toBe(strategy2); // 優先度 10
      expect(strategies[1]).toBe(strategy3); // 優先度 20
      expect(strategies[2]).toBe(strategy1); // 優先度 30
    });
    
    it('戦略が登録されていない場合は空配列を返すこと', () => {
      // Act
      const strategies = registry.getAllStrategies();
      
      // Assert
      expect(strategies).toEqual([]);
    });
  });
  
  // 戦略数の取得
  describe('getStrategyCount', () => {
    it('登録されている戦略数を正確に返すこと', () => {
      // Arrange
      registry.registerStrategy(new MockStrategy('strategy1', 10));
      registry.registerStrategy(new MockStrategy('strategy2', 20));
      
      // Act & Assert
      expect(registry.getStrategyCount()).toBe(2);
      
      // さらに登録して確認
      registry.registerStrategy(new MockStrategy('strategy3', 30));
      expect(registry.getStrategyCount()).toBe(3);
      
      // 解除して確認
      registry.unregisterStrategy('strategy2');
      expect(registry.getStrategyCount()).toBe(2);
    });
  });
  
  // すべての戦略の削除
  describe('clearAllStrategies', () => {
    it('すべての戦略が削除されること', () => {
      // Arrange
      registry.registerStrategy(new MockStrategy('strategy1', 10));
      registry.registerStrategy(new MockStrategy('strategy2', 20));
      registry.registerStrategy(new MockStrategy('strategy3', 30));
      
      // Act
      registry.clearAllStrategies();
      
      // Assert
      expect(registry.getStrategyCount()).toBe(0);
      expect(registry.getAllStrategies()).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith('すべての戦略を削除しました');
    });
  });
  
  // 戦略優先度の更新
  describe('updateStrategyPriority', () => {
    it('戦略の優先度を更新できること', () => {
      // Arrange
      const strategy = new MockStrategy('test-strategy', 10);
      registry.registerStrategy(strategy);
      
      // Act
      const result = registry.updateStrategyPriority('test-strategy', 50);
      
      // Assert
      expect(result).toBe(true);
      
      // getAllStrategiesで優先度が反映されているか確認
      const strategies = registry.getAllStrategies();
      expect(strategies[0].priority).toBe(50);
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('優先度を 50 に更新'));
    });
    
    it('存在しない戦略の優先度を更新しようとするとfalseが返ること', () => {
      // Act
      const result = registry.updateStrategyPriority('non-existent-strategy', 50);
      
      // Assert
      expect(result).toBe(false);
    });
  });
  
  // サービスロケータからの戦略登録
  describe('registerAllStrategiesFromServiceLocator', () => {
    it('サービスロケータから戦略を登録できること', () => {
      // Arrange - ts-mockitoを使用したセットアップ
      // モックServiceLocatorの設定
      const mockLocator = mock<IServiceLocator>();
      const strategy1 = new MockStrategy('axios-strategy', 10);
      const strategy2 = new MockStrategy('fetch-strategy', 20);
      
      when(mockLocator.getRegisteredServiceIds()).thenReturn([
        ServiceIds.AXIOS_STRATEGY,
        ServiceIds.FETCH_STRATEGY,
        'otherService'
      ]);
      
      when(mockLocator.resolve<EndpointDetectionStrategy>(ServiceIds.AXIOS_STRATEGY))
        .thenReturn(strategy1);
      
      when(mockLocator.resolve<EndpointDetectionStrategy>(ServiceIds.FETCH_STRATEGY))
        .thenReturn(strategy2);
      
      // 新しいレジストリをモックサービスロケータで初期化
      const registryWithMock = new StrategyRegistry(instance(mockLocator));
      
      // Act
      registryWithMock.registerAllStrategiesFromServiceLocator();
      
      // Assert
      expect(registryWithMock.getStrategyCount()).toBe(2);
      expect(registryWithMock.getStrategy('axios-strategy')).toBe(strategy1);
      expect(registryWithMock.getStrategy('fetch-strategy')).toBe(strategy2);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('登録された戦略数: 2'));

      // サービスIDの取得が呼ばれたことを検証
      verify(mockLocator.getRegisteredServiceIds()).once();
    });
    
    it('サービスロケータからの戦略解決中にエラーが発生した場合も処理を継続すること', () => {
      // Arrange - ts-mockitoを使用したモックセットアップ
      const mockLocator = mock<IServiceLocator>();
      const strategy = new MockStrategy('axios-strategy', 10);
      
      when(mockLocator.getRegisteredServiceIds()).thenReturn([
        ServiceIds.AXIOS_STRATEGY,
        ServiceIds.FETCH_STRATEGY
      ]);
      
      when(mockLocator.resolve<EndpointDetectionStrategy>(ServiceIds.AXIOS_STRATEGY))
        .thenReturn(strategy);
      
      when(mockLocator.resolve<EndpointDetectionStrategy>(ServiceIds.FETCH_STRATEGY))
        .thenThrow(new Error('テストエラー'));
      
      // 新しいレジストリをモックサービスロケータで初期化
      const registryWithMock = new StrategyRegistry(instance(mockLocator));
      
      // Act
      registryWithMock.registerAllStrategiesFromServiceLocator();
      
      // Assert
      expect(registryWithMock.getStrategyCount()).toBe(1);
      expect(registryWithMock.getStrategy('axios-strategy')).toBe(strategy);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('テストエラー'));
    });
  });
});
