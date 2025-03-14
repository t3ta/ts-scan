/**
 * ファイルシステム関連ユーティリティ
 * 
 * ファイルシステム操作に関する共通機能を提供します。
 * ディレクトリ検証やtsconfig.json管理などのヘルパー関数を含みます。
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './Logger';

/**
 * 指定されたパスがディレクトリかどうかを判定
 * @param dirPath 判定対象パス
 * @returns ディレクトリの場合true
 */
export function isDirectory(dirPath: string): boolean {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch (error) {
    return false;
  }
}

/**
 * 指定されたパスがファイルかどうかを判定
 * @param filePath 判定対象パス
 * @returns ファイルの場合true
 */
export function isFile(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch (error) {
    return false;
  }
}

/**
 * プロジェクト構造を検証
 * @param directory 検証対象ディレクトリパス
 * @returns 検証結果と検出されたプロジェクト構造情報
 */
export function validateProjectStructure(directory: string): {
  isValid: boolean;
  detectedStructure: string[];
  confidence: number;
} {
  const structureIndicators = [
    { name: 'React', paths: ['src/components', 'src/App.tsx', 'src/index.tsx'] },
    { name: 'Next.js', paths: ['pages', 'components', 'next.config.js'] },
    { name: 'Angular', paths: ['src/app', 'angular.json'] },
    { name: 'Vue', paths: ['src/components', 'src/App.vue', 'vue.config.js'] },
    { name: 'TypeScript', paths: ['tsconfig.json', 'src/**/*.ts'] }
  ];
  
  let totalScore = 0;
  const detectedStructure: string[] = [];
  
  // 各プロジェクト構造インジケータを評価
  for (const indicator of structureIndicators) {
    let matchCount = 0;
    
    for (const indicatorPath of indicator.paths) {
      const fullPath = path.join(directory, indicatorPath);
      
      // ワイルドカードを含むパターンの場合
      if (indicatorPath.includes('*')) {
        try {
          const baseDir = path.join(directory, indicatorPath.split('*')[0]);
          if (isDirectory(baseDir)) {
            matchCount++;
          }
        } catch (error) {
          // ワイルドカードパターン評価エラーは無視
        }
      } else if (fs.existsSync(fullPath)) {
        matchCount++;
      }
    }
    
    const matchRatio = matchCount / indicator.paths.length;
    
    if (matchRatio > 0.3) {
      detectedStructure.push(indicator.name);
      totalScore += matchRatio;
    }
  }
  
  const confidence = detectedStructure.length > 0 ? totalScore / detectedStructure.length : 0;
  
  return {
    isValid: confidence > 0.4,
    detectedStructure,
    confidence
  };
}

/**
 * ディレクトリツリーからtsconfig.jsonを検索
 * @param directory 検索開始ディレクトリ
 * @returns 見つかった場合はパス、見つからない場合はundefined
 */
export function findTsConfigFile(directory: string): string | undefined {
  // 直下のtsconfig.jsonを確認
  const directTsConfig = path.join(directory, 'tsconfig.json');
  if (isFile(directTsConfig)) {
    return directTsConfig;
  }
  
  // srcディレクトリ内を確認
  const srcTsConfig = path.join(directory, 'src', 'tsconfig.json');
  if (isFile(srcTsConfig)) {
    return srcTsConfig;
  }
  
  // 親ディレクトリを確認（最大3階層まで）
  let currentDir = directory;
  for (let i = 0; i < 3; i++) {
    const parentDir = path.dirname(currentDir);
    
    // ルートディレクトリに到達した場合は終了
    if (parentDir === currentDir) {
      break;
    }
    
    const parentTsConfig = path.join(parentDir, 'tsconfig.json');
    if (isFile(parentTsConfig)) {
      return parentTsConfig;
    }
    
    currentDir = parentDir;
  }
  
  return undefined;
}

/**
 * 一時的なtsconfig.jsonを生成
 * @param directory 対象ディレクトリ
 * @returns 生成したファイルのパス
 */
export function generateTemporaryTsConfig(directory: string): string {
  const tempTsConfigPath = path.join(directory, 'tsconfig.temp.json');
  
  const tsConfig = {
    "compilerOptions": {
      "target": "ES2020",
      "module": "CommonJS",
      "moduleResolution": "node",
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "resolveJsonModule": true,
      "jsx": "react-jsx",
      "baseUrl": ".",
      "paths": {
        "*": ["*", "src/*"]
      }
    },
    "include": [
      "**/*.ts",
      "**/*.tsx"
    ],
    "exclude": [
      "node_modules"
    ]
  };
  
  fs.writeFileSync(tempTsConfigPath, JSON.stringify(tsConfig, null, 2));
  logger.info(`一時的なtsconfig.jsonを生成しました: ${tempTsConfigPath}`);
  
  return tempTsConfigPath;
}

/**
 * ディレクトリ内のファイル一覧を取得
 * @param directory 対象ディレクトリ
 * @param pattern マッチングパターン（正規表現）
 * @param recursive サブディレクトリも含めるかどうか
 * @returns ファイルパスの配列
 */
export function listFiles(
  directory: string, 
  pattern?: RegExp, 
  recursive: boolean = true
): string[] {
  if (!isDirectory(directory)) {
    return [];
  }
  
  let results: string[] = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    
    if (entry.isDirectory() && recursive) {
      results = results.concat(listFiles(fullPath, pattern, recursive));
    } else if (entry.isFile()) {
      if (!pattern || pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }
  
  return results;
}

/**
 * 対象ディレクトリから指定された拡張子のファイルを検索
 * @param directory 対象ディレクトリ
 * @param extensions 拡張子リスト（.jsなど）
 * @param recursive サブディレクトリも含めるかどうか
 * @returns ファイルパスの配列
 */
export function findFilesByExtension(
  directory: string, 
  extensions: string[], 
  recursive: boolean = true
): string[] {
  const extPattern = new RegExp(`\\.(${extensions.map(e => e.replace(/^\./, '')).join('|')})$`);
  return listFiles(directory, extPattern, recursive);
}

/**
 * JSONファイルを読み込む
 * @param filePath JSONファイルパス
 * @returns パースされたJSONオブジェクト、失敗時はnull
 */
export function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!isFile(filePath)) {
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    logger.error(`JSONファイル読み込みエラー (${filePath}): ${error}`);
    return null;
  }
}

/**
 * JSONファイルを書き込む
 * @param filePath 書き込み先ファイルパス
 * @param data 書き込むデータ
 * @param pretty 整形するかどうか
 * @returns 書き込み成功の場合true
 */
export function writeJsonFile(filePath: string, data: any, pretty: boolean = true): boolean {
  try {
    const content = pretty ? 
      JSON.stringify(data, null, 2) : 
      JSON.stringify(data);
    
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    logger.error(`JSONファイル書き込みエラー (${filePath}): ${error}`);
    return false;
  }
}

/**
 * ディレクトリが存在しない場合に作成
 * @param dirPath 作成するディレクトリパス
 * @returns ディレクトリ作成成功の場合true
 */
export function ensureDirectoryExists(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      return true;
    }
    return true;
  } catch (error) {
    logger.error(`ディレクトリ作成エラー (${dirPath}): ${error}`);
    return false;
  }
}
