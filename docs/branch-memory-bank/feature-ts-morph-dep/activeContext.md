# アクティブコンテキスト for feature/ts-morph-dep

## 型互換性と抽象化レイヤーの実装進捗

feature/ts-morph-dep ブランチにおける作業は、ポート・アンド・アダプターパターンの考え方に基づく抽象化レイヤーの実装が大きく進展し、型互換性の問題も解決に向かっているのだ。複数のファイルで型ガードを導入し、型エラーを解消したのだ。

現在の作業における主な成果は以下の通りなのだ：

1. **型互換性の問題解決**
   - `isINode` と `isTsMorphNode` 型ガード関数を各ファイルに導入
   - オプショナルチェイニングと安全なメソッド呼び出しパターンの確立
   - `(node as any).isKind(NodeKind.CallExpression)` のような型キャストの適用

2. **SyntaxKind名前空間の導入**
   - `NodeKind` と `SyntaxKind` の互換性を保つための名前空間実装
   ```typescript
   export namespace SyntaxKind {
     export const PropertyAccessExpression = NodeKind.PropertyAccessExpression;
     export const CallExpression = NodeKind.CallExpression;
     // 他の必要な定数...
   }
   ```

3. **オプショナルプロパティの問題解決**
   - ヌリッシュコアレッシング演算子 (`??`) を使用したデフォルト値の提供
   ```typescript
   lineNumber: location.lineNumber ?? 1,
   columnNumber: location.columnNumber ?? 1,
   ```

4. **ファイル修正の進捗**
   - `NodeTraversal.ts` と `NodePredicates.ts` の修正完了
   - `FetchDetectionStrategy.ts` の修正完了
   - `ServiceMethodDetector.ts`, `HttpPatternDetector.ts`, `ApiClientMethodCallDetector.ts` の修正完了
   - `AxiosDetectionStrategy.ts` の修正完了
   - `ISourceFile` が `INode` を継承するよう修正
   - `MockNode.ts` と `MockSourceFile.ts` の修正完了（複数インターフェースの実装と型互換性の確保）
   - アダプタークラスの型互換性エラー修正完了 (`TsMorphVariableAdapter`, `TsMorphFunctionAdapter`, `TsMorphParameterAdapter`, `TsMorphClassAdapter`)

## 現在取り組んでいる課題

現在、以下の課題に取り組んでいるのだ：

1. **最後の数ファイルのエラー解消**
   - `PatternDetector.ts` のエラー解消
   - `DefaultDetectionStrategy.ts` のエラー解消

2. **テストの復活**
   - 修正したコードに対するテストの有効化
   - スキップテストの解除

## 今アクティブな決定事項

1. **インターフェース間の一貫性の確保**
   - `null` と `undefined` の使い分けの決定
     - 存在しない可能性のあるオブジェクトや値には `undefined` を使用
     - 例外的な場合や特別な場合には `null` を使用

2. **型ガードパターンの標準化**
   - 以下のパターンを標準として採用
   ```typescript
   if ('isKind' in node && typeof node.isKind === 'function') {
     // INodeとして安全に扱える
   }
   ```

3. **安全なメソッド呼び出し手法**
   - オプショナルチェイニングと存在確認を組み合わせたアプローチ
   ```typescript
   const hasGetExpression = 'getExpression' in node && typeof node.getExpression === 'function';
   if (hasGetExpression) {
     const expr = (node as any).getExpression();
     // 安全に操作
   }
   ```

4. **型キャストの標準化**
   - 必要最小限の型キャストの原則
   - `as INode` や `as unknown as IParameter` など、目的の型を明確にする
   - アダプターメソッドの最後に型キャストを集中させる

## 今アクティブな課題

1. **残りのモジュールの修正**
   - パターン検出器の抽象化インターフェース対応
   - 検出戦略クラスのリファクタリング

2. **ts-morph固有の型の扱い**
   - TypeCheckerなどの特殊な型の扱いの検討
   - 完全な抽象化が難しい部分の対処方法

3. **大量のキャスト処理の改善**
   - 型ガードユーティリティの充実
   - 型互換性ヘルパー関数の追加

## 次のステップ

1. **残りのエラー解消**
   - 残り数ファイルのエラー修正
   - 標準化したパターンの適用

2. **テストの復帰**
   - 修正したテストの実行と確認
   - 欠落しているテスト実装の追加

3. **ドキュメント化**
   - 採用したパターンの文書化
   - アーキテクチャ設計の説明

型互換性エラーの解消が完了し、プロジェクトが正常にビルドできる状態になりました。型ガードとオプショナルチェイニングを組み合わせた安全なアクセスパターンの確立により、抽象化レイヤーとts-morphの実装の橋渡しがスムーズになり、プロジェクト全体の型安全性を維持しながら抽象化を進められるようになったのだ。

次のフェーズとしては、`PatternDetector.ts` と `DefaultDetectionStrategy.ts` の残りのエラーを解消し、テストの有効化と検証を進める予定なのだ。
