/**
 * グラフ生成ユーティリティ
 * 
 * Markdown形式のレポートで使用するASCIIアートグラフと
 * Mermaidグラフ生成用の機能を提供します。
 */

/**
 * 水平バーグラフのASCIIアート生成
 * @param data 表示データ（ラベルと値のペア）
 * @param maxWidth グラフの最大幅（文字数、デフォルト: 40）
 * @returns 生成されたASCIIアートグラフ文字列
 */
export function generateAsciiBarGraph(
  data: Array<{ label: string; value: number }>,
  maxWidth: number = 40
): string {
  if (data.length === 0) return '';
  
  // 最大値を取得
  const maxValue = Math.max(...data.map(item => item.value));
  
  // ラベルの最大長を計算
  const maxLabelLength = Math.max(...data.map(item => item.label.length));
  
  // 結果文字列の構築
  let result = '';
  
  for (const { label, value } of data) {
    // 値が0の場合は特別処理
    if (value === 0) {
      result += `${label.padEnd(maxLabelLength)} | 0\n`;
      continue;
    }
    
    // バーの長さを計算
    const barLength = Math.max(1, Math.round((value / maxValue) * maxWidth));
    const bar = '█'.repeat(barLength);
    
    // パディングを追加
    const paddedLabel = label.padEnd(maxLabelLength);
    
    // 行を追加
    result += `${paddedLabel} | ${bar} ${value}\n`;
  }
  
  return result;
}

/**
 * Mermaid形式の円グラフ生成
 * @param data 表示データ（ラベルと値のペア）
 * @param title グラフタイトル
 * @returns Mermaid形式のグラフ定義
 */
export function generateMermaidPieChart(
  data: Array<{ label: string; value: number }>,
  title: string
): string {
  let result = '```mermaid\npie';
  
  // タイトル追加
  result += `\n    title ${title}`;
  
  // データポイントの追加
  for (const { label, value } of data) {
    if (value > 0) {
      result += `\n    "${label}" : ${value}`;
    }
  }
  
  result += '\n```\n';
  return result;
}

/**
 * Mermaid形式の棒グラフ生成
 * @param data 表示データ（ラベルと値のペア）
 * @param title グラフタイトル
 * @param xLabel X軸ラベル
 * @param yLabel Y軸ラベル
 * @returns Mermaid形式のグラフ定義
 */
export function generateMermaidBarChart(
  data: Array<{ label: string; value: number }>,
  title: string,
  xLabel: string = '',
  yLabel: string = ''
): string {
  let result = '```mermaid\n%%{init: {\'theme\': \'default\', \'themeVariables\': {\'primaryColor\': \'#3498db\'}}}%%\nbar';
  
  // タイトル追加
  result += `\n    title ${title}`;
  
  // 軸ラベル追加
  if (xLabel) result += `\n    x-axis [${xLabel}]`;
  if (yLabel) result += `\n    y-axis [${yLabel}]`;
  
  // データポイントの追加
  for (const { label, value } of data) {
    if (value > 0) {
      result += `\n    "${label}" : ${value}`;
    }
  }
  
  result += '\n```\n';
  return result;
}

/**
 * Mermaid形式のフローチャート生成（エンドポイント関係図）
 * @param relationships エンドポイント間の関係データ
 * @param title グラフタイトル
 * @returns Mermaid形式のグラフ定義
 */
export function generateMermaidFlowchart(
  relationships: Array<{ from: string; to: string; label?: string }>,
  title: string
): string {
  let result = '```mermaid\nflowchart LR';
  
  // タイトルコメント
  result += `\n    %% ${title}`;
  
  // 一意のノードIDを取得
  const nodes = new Set<string>();
  for (const { from, to } of relationships) {
    nodes.add(from);
    nodes.add(to);
  }
  
  // ノード定義
  for (const node of nodes) {
    const safeId = node.replace(/[^a-zA-Z0-9]/g, '_');
    result += `\n    ${safeId}["${node}"]`;
  }
  
  // 関係の定義
  for (const { from, to, label } of relationships) {
    const fromId = from.replace(/[^a-zA-Z0-9]/g, '_');
    const toId = to.replace(/[^a-zA-Z0-9]/g, '_');
    
    if (label) {
      result += `\n    ${fromId} -- "${label}" --> ${toId}`;
    } else {
      result += `\n    ${fromId} --> ${toId}`;
    }
  }
  
  result += '\n```\n';
  return result;
}

/**
 * Mermaid形式のクラス図生成（エンドポイント分類図）
 * @param categories カテゴリと所属エンドポイント
 * @param title グラフタイトル
 * @returns Mermaid形式のグラフ定義
 */
export function generateMermaidClassDiagram(
  categories: Record<string, string[]>,
  title: string
): string {
  let result = '```mermaid\nclassDiagram';
  
  // タイトルコメント
  result += `\n    %% ${title}`;
  
  // 各カテゴリの定義
  for (const [category, endpoints] of Object.entries(categories)) {
    const safeCategory = category.replace(/[^a-zA-Z0-9]/g, '_');
    
    result += `\n    class ${safeCategory} {`;
    
    // 各エンドポイントをメソッドとして表示
    for (const endpoint of endpoints) {
      result += `\n        ${endpoint}()`;
    }
    
    result += '\n    }';
  }
  
  result += '\n```\n';
  return result;
}
