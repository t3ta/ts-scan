/**
 * ロギングユーティリティ
 * 
 * アプリケーション全体で一貫したロギングを提供するモジュールです。
 * 異なるログレベルをサポートし、必要に応じてフォーマットや出力先を制御できます。
 */

import * as chalk from 'chalk';
import { ILogger } from '../types';

/**
 * ログレベル定義
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

/**
 * ロガー実装クラス
 */
export class Logger implements ILogger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  
  /**
   * プライベートコンストラクタ（シングルトンパターン）
   */
  private constructor() {}
  
  /**
   * ロガーのシングルトンインスタンスを取得
   * @returns ロガーインスタンス
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  /**
   * ログレベルを設定
   * @param level 設定するログレベル
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
  
  /**
   * 現在のログレベルを取得
   * @returns 現在のログレベル
   */
  public getLogLevel(): LogLevel {
    return this.logLevel;
  }
  
  /**
   * デバッグレベルのログを出力
   * @param message ログメッセージ
   */
  public debug(message: string): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.log(chalk.gray(`[DEBUG] ${message}`));
    }
  }
  
  /**
   * 情報レベルのログを出力
   * @param message ログメッセージ
   */
  public info(message: string): void {
    if (this.logLevel <= LogLevel.INFO) {
      console.log(chalk.blue(`[INFO] ${message}`));
    }
  }
  
  /**
   * 警告レベルのログを出力
   * @param message ログメッセージ
   */
  public warn(message: string): void {
    if (this.logLevel <= LogLevel.WARN) {
      console.log(chalk.yellow(`[WARN] ${message}`));
    }
  }
  
  /**
   * エラーレベルのログを出力
   * @param message ログメッセージ
   */
  public error(message: string): void {
    if (this.logLevel <= LogLevel.ERROR) {
      console.error(chalk.red(`[ERROR] ${message}`));
    }
  }
  
  /**
   * 成功メッセージを出力
   * @param message ログメッセージ
   */
  public success(message: string): void {
    if (this.logLevel <= LogLevel.INFO) {
      console.log(chalk.green(`[SUCCESS] ${message}`));
    }
  }
  
  /**
   * セクション区切りを出力（ヘッダー）
   * @param title セクションタイトル
   */
  public section(title: string): void {
    if (this.logLevel <= LogLevel.INFO) {
      console.log(chalk.cyan(`\n===== ${title} =====`));
    }
  }
  
  /**
   * タイムスタンプ付きのログメッセージを出力
   * @param level ログレベル文字列
   * @param message ログメッセージ
   * @param color 色関数
   */
  private logWithTimestamp(level: string, message: string, color: chalk.ChalkFunction): void {
    const timestamp = new Date().toISOString();
    console.log(color(`[${timestamp}] [${level}] ${message}`));
  }
}

// デフォルトロガーインスタンスをエクスポート
export const logger = Logger.getInstance();
