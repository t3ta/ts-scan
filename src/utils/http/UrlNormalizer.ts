/**
 * HTTP関連ユーティリティ - URL正規化モジュール
 * 
 * エンドポイントURLの正規化と標準化を行うユーティリティを提供します。
 * 様々な形式のURLを一貫した形式に変換することで、重複検出などの処理を容易にします。
 */

import { logger } from '../Logger';

/**
 * URL正規化ユーティリティクラス
 */
export class UrlNormalizer {
  /**
   * URLパスを正規化する
   * @param path 正規化対象のURLパス
   * @returns 正規化されたURLパス
   */
  public static normalize(path: string | null): string {
    if (!path) return '';
    
    try {
      // 1. URLオブジェクト変換前の前処理
      let processedPath = path.trim();
      
      // バックスラッシュをスラッシュに変換（Windowsパス対応）
      processedPath = processedPath.replace(/\\/g, '/');
      
      // 相対パスの場合はスラッシュを先頭に追加
      if (!processedPath.startsWith('/') && 
          !processedPath.startsWith('http://') && 
          !processedPath.startsWith('https://')) {
        processedPath = `/${processedPath}`;
      }
      
      // 完全なURLの場合はパス部分のみを抽出
      if (processedPath.startsWith('http://') || processedPath.startsWith('https://')) {
        try {
          const url = new URL(processedPath);
          processedPath = url.pathname + url.search;
        } catch (e) {
          // URL解析に失敗した場合は元のパスを使用
          logger.debug(`URL解析失敗: ${processedPath}`);
        }
      }
      
      // 2. パスの正規化処理
      // 末尾のスラッシュを削除
      processedPath = processedPath.replace(/\/+$/, '');
      
      // 連続するスラッシュを単一のスラッシュに置換
      processedPath = processedPath.replace(/\/+/g, '/');
      
      // クエリパラメータを分離
      const [pathPart, queryPart] = processedPath.split('?');
      
      // 3. ファイル拡張子の処理（.jsonなどを削除）
      const pathWithoutExt = pathPart.replace(/\.(json|xml|txt|html)$/, '');
      
      // 4. 最終的なパスの組み立て
      let normalizedPath = pathWithoutExt;
      
      // クエリパラメータが存在する場合は再付加
      if (queryPart) {
        normalizedPath += `?${queryPart}`;
      }
      
      return normalizedPath;
    } catch (error) {
      logger.error(`URL正規化中にエラーが発生: ${error}`);
      return path || '';
    }
  }
  
  /**
   * ベースURLとパスを結合して完全なパスを構築
   * @param baseUrl ベースURL
   * @param path パス部分
   * @returns 完全なURLパス
   */
  public static buildFullPath(baseUrl: string, path: string): string {
    if (!path) return baseUrl;
    
    // 絶対URLの場合はそのまま返す
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    
    // ${baseUrl} パターンの解決
    if (path.includes('${baseUrl}')) {
      return path.replace('${baseUrl}', baseUrl);
    }
    
    // ベースURLとパスの間にスラッシュがちょうど1つになるように調整
    const baseWithSlash = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const pathWithoutSlash = path.startsWith('/') ? path.substring(1) : path;
    
    return `${baseWithSlash}${pathWithoutSlash}`;
  }
  
  /**
   * URLパターン内のパラメータをプレースホルダーに変換
   * @param urlPattern URLパターン
   * @returns パラメータがプレースホルダーに置換されたURL
   */
  public static normalizePathParams(urlPattern: string): string {
    if (!urlPattern) return '';
    
    // :param 形式のパラメータを {param} 形式に統一
    let normalized = urlPattern.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
    
    // 数値パラメータをパターン化（例: /users/123 → /users/{id}）
    normalized = normalized.replace(/\/(\d+)(?=\/|$)/g, '/{id}');
    
    return normalized;
  }
  
  /**
   * URLからAPIバージョンを抽出
   * @param url URL文字列
   * @returns APIバージョン文字列、検出できない場合はundefined
   */
  public static extractApiVersion(url: string): string | undefined {
    if (!url) return undefined;
    
    // /api/v1/, /api/v2/ などのパターンを検出
    const versionMatch = url.match(/\/api\/v(\d+)(?:\/|$)/i);
    if (versionMatch && versionMatch[1]) {
      return `v${versionMatch[1]}`;
    }
    
    // /v1/, /v2/ などのパターンを検出
    const shortVersionMatch = url.match(/\/v(\d+)(?:\/|$)/i);
    if (shortVersionMatch && shortVersionMatch[1]) {
      return `v${shortVersionMatch[1]}`;
    }
    
    return undefined;
  }
  
  /**
   * URLからベースパスを抽出
   * @param url URL文字列
   * @returns ベースパス（/api/v1 など）、検出できない場合は空文字列
   */
  public static extractBasePath(url: string): string {
    if (!url) return '';
    
    // /api/v1/... パターン
    const apiVersionMatch = url.match(/^(\/api\/v\d+)(?:\/|$)/i);
    if (apiVersionMatch && apiVersionMatch[1]) {
      return apiVersionMatch[1];
    }
    
    // /api/... パターン
    const apiMatch = url.match(/^(\/api)(?:\/|$)/i);
    if (apiMatch && apiMatch[1]) {
      return apiMatch[1];
    }
    
    // /v1/... パターン
    const versionMatch = url.match(/^(\/v\d+)(?:\/|$)/i);
    if (versionMatch && versionMatch[1]) {
      return versionMatch[1];
    }
    
    return '';
  }
  
  /**
   * URLからリソース名を抽出
   * @param url URL文字列
   * @returns リソース名、検出できない場合はundefined
   */
  public static extractResourceName(url: string): string | undefined {
    if (!url) return undefined;
    
    // ベースパスを除去
    const basePath = this.extractBasePath(url);
    const resourcePath = basePath ? url.substring(basePath.length) : url;
    
    // 先頭のスラッシュを除去
    const normalizedPath = resourcePath.startsWith('/') ? resourcePath.substring(1) : resourcePath;
    
    // 最初のパスセグメントを取得
    const segments = normalizedPath.split('/');
    if (segments.length > 0 && segments[0]) {
      return segments[0];
    }
    
    return undefined;
  }
  
  /**
   * 2つのURLパスが実質的に同じかを判定（パラメータ位置などを無視）
   * @param path1 1つ目のパス
   * @param path2 2つ目のパス
   * @returns 実質的に同じパスの場合はtrue
   */
  public static isSameEndpoint(path1: string, path2: string): boolean {
    if (!path1 || !path2) return false;
    
    // 両方のパスを正規化
    const normalized1 = this.normalizePathParams(this.normalize(path1));
    const normalized2 = this.normalizePathParams(this.normalize(path2));
    
    // 完全一致の場合
    if (normalized1 === normalized2) return true;
    
    // パラメータプレースホルダー名の違いを無視した比較
    // 例: /users/{id}/posts と /users/{userId}/posts は同じと見なす
    const pattern1 = normalized1.replace(/{[^}]+}/g, '{param}');
    const pattern2 = normalized2.replace(/{[^}]+}/g, '{param}');
    
    return pattern1 === pattern2;
  }
}
