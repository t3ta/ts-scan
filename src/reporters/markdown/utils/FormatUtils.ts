/**
 * Markdownレポート用フォーマットユーティリティ
 * 
 * レポート生成時に使用する様々なフォーマット関数を提供します。
 * 一貫性のある表示形式を維持するためのヘルパー関数群です。
 */

import { EndpointSource } from '../../../types';

/**
 * MarkdownReporterのユーティリティクラス
 * 静的メソッドのみを提供します
 */
export class FormatUtils {
  /**
   * 百分率の計算
   * @param value 値
   * @param total 合計
   * @returns 百分率（小数点第一位まで）
   */
  public static calculatePercentage(value: number, total: number): string {
    if (total === 0) return '0.0';
    return (value / total * 100).toFixed(1);
  }
  
  /**
   * 検出元名のフォーマット
   * @param source 検出元ID
   * @returns フォーマットされた検出元名
   */
  public static formatSourceName(source: EndpointSource | string): string {
    switch (source) {
      case 'axios':
        return 'Axios';
      case 'fetch':
        return 'Fetch API';
      case 'rtk-query':
        return 'RTK Query';
      case 'custom-client':
        return 'カスタムAPIクライアント';
      case 'default':
        return '一般パターン';
      case 'v2-endpoint':
        return 'V2エンドポイント';
      default:
        return source;
    }
  }
  
  /**
   * パラメータ種別のフォーマット
   * @param type パラメータ種別ID
   * @returns フォーマットされたパラメータ種別名
   */
  public static formatParameterType(type: string): string {
    switch (type) {
      case 'path':
        return 'パス';
      case 'query':
        return 'クエリ';
      case 'body':
        return 'ボディ';
      case 'header':
        return 'ヘッダー';
      default:
        return '不明';
    }
  }
  
  /**
   * レスポンス処理種別のフォーマット
   * @param type レスポンス処理種別ID
   * @returns フォーマットされたレスポンス処理種別名
   */
  public static formatResponseHandlingType(type: string): string {
    switch (type) {
      case 'direct':
        return '直接使用';
      case 'transformation':
        return '変換処理';
      case 'typed':
        return '型付け';
      default:
        return '不明';
    }
  }
  
  /**
   * 最も多いHTTPメソッドを特定
   * @param methodDistribution HTTPメソッド分布
   * @returns 最も多いHTTPメソッド
   */
  public static getMostFrequentMethod(methodDistribution: Record<string, number>): string {
    let maxCount = 0;
    let mostFrequentMethod = '';
    
    for (const [method, count] of Object.entries(methodDistribution)) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequentMethod = method;
      }
    }
    
    return mostFrequentMethod;
  }
}
