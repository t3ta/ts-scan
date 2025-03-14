/**
 * JSONレポーター
 * 
 * 解析結果をJSON形式で出力するレポーター実装です。
 * 詳細な解析データを構造化された形式で保存します。
 */

import * as fs from 'fs';
import * as path from 'path';
import { IReporter, AnalysisResult } from '../types';
import { logger } from '../utils/Logger';
import { ensureDirectoryExists } from '../utils/fs-helper';

/**
 * JSON形式レポーター実装クラス
 */
export class JsonReporter implements IReporter {
  /**
   * 解析結果をJSON形式で出力
   * @param result 解析結果
   * @param outputPath 出力先ファイルパス
   * @returns 出力成功の場合true
   */
  public async generateReport(result: AnalysisResult, outputPath?: string): Promise<boolean> {
    try {
      const filePath = outputPath || './output/analysis-result.json';
      
      // 出力先ディレクトリの確保
      const outputDir = path.dirname(filePath);
      ensureDirectoryExists(outputDir);
      
      // 出力データの準備
      const outputData = this.prepareOutputData(result);
      
      // JSON形式で出力
      fs.writeFileSync(filePath, JSON.stringify(outputData, null, 2), 'utf8');
      
      return true;
    } catch (error) {
      logger.error(`JSONレポート生成中にエラーが発生: ${error}`);
      return false;
    }
  }
  
  /**
   * 出力データの準備
   * @param result 解析結果
   * @returns JSON出力用データ
   */
  private prepareOutputData(result: AnalysisResult): any {
    // 現在時刻（解析時刻）の更新
    const analyzedAt = new Date();
    
    // ファイルパスの相対パス化
    const processedEndpoints = result.endpoints.map(endpoint => {
      // 使用箇所のファイルパスを相対パスに変換
      const processedUsageLocations = endpoint.usageLocations.map(location => {
        if (location.filePath && result.configuration.targetDirectory) {
          return {
            ...location,
            filePath: path.relative(result.configuration.targetDirectory, location.filePath)
          };
        }
        return location;
      });
      
      // パラメータ使用箇所のファイルパスを相対パスに変換
      const processedParameters = endpoint.parametersUsed.map(param => {
        const processedParamLocations = param.locations.map(location => {
          if (location.filePath && result.configuration.targetDirectory) {
            return {
              ...location,
              filePath: path.relative(result.configuration.targetDirectory, location.filePath)
            };
          }
          return location;
        });
        
        return {
          ...param,
          locations: processedParamLocations
        };
      });
      
      // レスポンス処理のファイルパスを相対パスに変換
      const processedResponseHandling = endpoint.responseHandling.map(handling => {
        if (handling.location && handling.location.filePath && result.configuration.targetDirectory) {
          return {
            ...handling,
            location: {
              ...handling.location,
              filePath: path.relative(result.configuration.targetDirectory, handling.location.filePath)
            }
          };
        }
        return handling;
      });
      
      return {
        ...endpoint,
        usageLocations: processedUsageLocations,
        parametersUsed: processedParameters,
        responseHandling: processedResponseHandling
      };
    });
    
    // 解析対象ファイルの相対パス化
    const processedAnalyzedFiles = result.analyzedFiles.map(filePath => {
      if (result.configuration.targetDirectory) {
        return path.relative(result.configuration.targetDirectory, filePath);
      }
      return filePath;
    });
    
    return {
      endpoints: processedEndpoints,
      statistics: result.statistics,
      analyzedAt,
      configuration: {
        ...result.configuration,
        // 絶対パスを相対パスに変換
        targetDirectory: path.basename(result.configuration.targetDirectory)
      },
      analyzedFiles: processedAnalyzedFiles,
      errors: result.errors,
      metadata: {
        version: '2.0.0',
        generatedBy: 'endpoint-analyzer-2',
        generationDate: analyzedAt.toISOString()
      }
    };
  }
}
