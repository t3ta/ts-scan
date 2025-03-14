/**
 * TsMorphAdapterのユニットテスト
 * 
 * ts-morphライブラリを抽象インターフェースに適合させるアダプタークラスのテストを行います。
 */

import { TsMorphAdapter } from '../../../src/core/ast/adapters/TsMorphAdapter';
import { NodeKind } from '../../../src/core/ast/interfaces/INode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 一時ファイルのパス
let tempDir: string;
let tempFilePath: string;

describe('TsMorphAdapter', () => {
  beforeAll(() => {
    // 一時ディレクトリを作成
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-scan-tests-'));
    tempFilePath = path.join(tempDir, 'test-file.ts');
    
    // テスト用のTypeScriptコードを一時ファイルに書き込む
    const testCode = `
      /**
       * テスト関数
       * @param name 名前
       * @returns 挨拶文
       */
      function greet(name: string): string {
        return \`Hello, \${name}!\`;
      }
      
      interface User {
        id: number;
        name: string;
        email?: string;
      }
      
      class UserManager {
        private users: User[] = [];
        
        constructor() {}
        
        addUser(user: User): void {
          this.users.push(user);
        }
        
        findUserById(id: number): User | undefined {
          return this.users.find(u => u.id === id);
        }
      }
      
      export { greet, User, UserManager };
    `;
    
    fs.writeFileSync(tempFilePath, testCode, 'utf-8');
  });
  
  afterAll(() => {
    // テスト終了後に一時ファイルとディレクトリを削除
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
  });
  
  describe('初期化', () => {
    it('正常に初期化できること', () => {
      const adapter = new TsMorphAdapter();
      expect(adapter).toBeDefined();
    });
  });
  
  describe('parseCode', () => {
    it('コード文字列からソースファイルを解析できること', () => {
      // Arrange
      const adapter = new TsMorphAdapter();
      const code = 'function test() { return 42; }';
      
      // Act
      const sourceFile = adapter.parseCode(code, 'test.ts');
      
      // Assert
      expect(sourceFile).toBeDefined();
      expect(sourceFile.getFileName()).toBe('test.ts');
      expect(sourceFile.getText()).toContain('function test()');
      
      // 関数を取得して内容を確認
      const functions = sourceFile.getFunctions();
      expect(functions.length).toBe(1);
      expect(functions[0].getName()).toBe('test');
    });
    
    it('複雑なコードを正しく解析できること', () => {
      // Arrange
      const adapter = new TsMorphAdapter();
      const code = `
        interface Person {
          name: string;
          age: number;
        }
        
        class Employee implements Person {
          name: string;
          age: number;
          salary: number;
          
          constructor(name: string, age: number, salary: number) {
            this.name = name;
            this.age = age;
            this.salary = salary;
          }
          
          getDetails(): string {
            return \`\${this.name}, \${this.age}, \${this.salary}\`;
          }
        }
      `;
      
      // Act
      const sourceFile = adapter.parseCode(code);
      
      // Assert
      const interfaces = sourceFile.getInterfaces();
      expect(interfaces.length).toBe(1);
      expect(interfaces[0].getName()).toBe('Person');
      
      const classes = sourceFile.getClasses();
      expect(classes.length).toBe(1);
      expect(classes[0].getName()).toBe('Employee');
      expect(classes[0].getMethods().length).toBe(1);
      expect(classes[0].getMethods()[0].getName()).toBe('getDetails');
    });
  });
  
  describe('parseFile', () => {
    it('ファイルパスからソースファイルを解析できること', () => {
      // Arrange
      const adapter = new TsMorphAdapter();
      
      // Act
      const sourceFile = adapter.parseFile(tempFilePath);
      
      // Assert
      expect(sourceFile).toBeDefined();
      expect(sourceFile.getFileName()).toBe('test-file.ts');
      
      // ファイル内の要素を確認
      const functions = sourceFile.getFunctions();
      expect(functions.length).toBe(1);
      expect(functions[0].getName()).toBe('greet');
      
      const interfaces = sourceFile.getInterfaces();
      expect(interfaces.length).toBe(1);
      expect(interfaces[0].getName()).toBe('User');
      
      const classes = sourceFile.getClasses();
      expect(classes.length).toBe(1);
      expect(classes[0].getName()).toBe('UserManager');
    });
    
    it('存在しないファイルを指定すると例外がスローされること', () => {
      // Arrange
      const adapter = new TsMorphAdapter();
      const nonExistentPath = path.join(tempDir, 'non-existent.ts');
      
      // Act & Assert
      expect(() => {
        adapter.parseFile(nonExistentPath);
      }).toThrow();
    });
  });
  
  describe('parseFiles', () => {
    it('複数のファイルを一度に解析できること', () => {
      // Arrange
      const adapter = new TsMorphAdapter();
      const anotherFilePath = path.join(tempDir, 'another-file.ts');
      fs.writeFileSync(anotherFilePath, 'const x = 42;', 'utf-8');
      
      try {
        // Act
        const sourceFiles = adapter.parseFiles([tempFilePath, anotherFilePath]);
        
        // Assert
        expect(sourceFiles.length).toBe(2);
        expect(sourceFiles[0].getFileName()).toBe('test-file.ts');
        expect(sourceFiles[1].getFileName()).toBe('another-file.ts');
      } finally {
        // Cleanup
        if (fs.existsSync(anotherFilePath)) {
          fs.unlinkSync(anotherFilePath);
        }
      }
    });
  });
  
  describe('getTypeChecker', () => {
    it('型チェッカーを取得できること', () => {
      // Arrange
      const adapter = new TsMorphAdapter();
      
      // Act
      const typeChecker = adapter.getTypeChecker();
      
      // Assert
      expect(typeChecker).toBeDefined();
    });
  });
  
  describe('reset', () => {
    it('プロバイダーの状態をリセットできること', () => {
      // Arrange
      const adapter = new TsMorphAdapter();
      adapter.parseFile(tempFilePath);
      
      // Act
      adapter.reset();
      
      // プロジェクト内のファイル数が0になっていることを確認
      const project = adapter.getProject();
      expect(project.getSourceFiles().length).toBe(0);
    });
  });
  
  describe('ノード処理', () => {
    it('ノードの種類を正しく判別できること', () => {
      // Arrange
      const adapter = new TsMorphAdapter();
      const code = `
        function test() { return 42; }
        const x = 10;
        class MyClass {}
      `;
      
      // Act
      const sourceFile = adapter.parseCode(code);
      const nodes = sourceFile.findNodes(() => true);
      
      // Assert
      // 関数宣言ノードを探す
      const functionNode = nodes.find(node => node.isKind(NodeKind.FunctionDeclaration));
      expect(functionNode).toBeDefined();
      
      // 変数宣言ノードを探す
      const variableNode = nodes.find(node => node.isKind(NodeKind.VariableDeclaration));
      expect(variableNode).toBeDefined();
      
      // クラス宣言ノードを探す
      const classNode = nodes.find(node => node.isKind(NodeKind.ClassDeclaration));
      expect(classNode).toBeDefined();
    });
  });
});
