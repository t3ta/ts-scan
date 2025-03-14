/**
 * ベースジェネレーター
 * 
 * Markdownレポートの各セクションを生成するジェネレーターの基底クラスです。
 * 共通ユーティリティメソッドを提供します。
 */

// 型定義のインポート
import { FormatUtils } from '../utils/FormatUtils';

/**
 * Markdownセクションジェネレーター基底クラス
 */
export abstract class BaseGenerator {
  /**
   * 百分率の計算
   * @param value 値
   * @param total 合計
   * @returns 百分率（小数点第一位まで）
   */
  protected calculatePercentage(value: number, total: number): string {
    return FormatUtils.calculatePercentage(value, total);
  }
  
  /**
   * 検出元名のフォーマット
   * @param source 検出元ID
   * @returns フォーマットされた検出元名
   */
  protected formatSourceName(source: string): string {
    return FormatUtils.formatSourceName(source);
  }
  
  /**
   * パラメータ種別のフォーマット
   * @param type パラメータ種別ID
   * @returns フォーマットされたパラメータ種別名
   */
  protected formatParameterType(type: string): string {
    return FormatUtils.formatParameterType(type);
  }
  
  /**
   * レスポンス処理種別のフォーマット
   * @param type レスポンス処理種別ID
   * @returns フォーマットされたレスポンス処理種別名
   */
  protected formatResponseHandlingType(type: string): string {
    return FormatUtils.formatResponseHandlingType(type);
  }
  
  /**
   * 最も多いHTTPメソッドを特定
   * @param methodDistribution HTTPメソッド分布
   * @returns 最も多いHTTPメソッド
   */
  protected getMostFrequentMethod(methodDistribution: Record<string, number>): string {
    return FormatUtils.getMostFrequentMethod(methodDistribution);
  }
}
