# FetchDetectionStrategy テストシナリオ一覧

## 基本的なFetch呼び出し検出シナリオ

1. **基本的なfetch()呼び出しを検出する**
   - `fetch('/api/users')` のような標準的なfetch API呼び出しを検出
   - 戻り値としてGETメソッドのエンドポイント情報が正しく抽出される

2. **window.fetch()呼び出しを検出する**
   - `window.fetch('/api/users')` のようなグローバルオブジェクト経由のfetch呼び出しを検出
   - 戻り値としてGETメソッドのエンドポイント情報が正しく抽出される

3. **オプション付きのfetch呼び出しを検出する**
   - `fetch('/api/users', { method: 'POST', body: JSON.stringify(data) })` のように
     オプションを含むfetch呼び出しを検出
   - HTTPメソッドやボディパラメータが正しく抽出される

4. **カスタムフェッチラッパー関数を検出する**
   - `fetchJson('/api/users')` のようなカスタムラッパー関数を検出
   - 関数名からHTTPメソッドを適切に推測する

## HTTPメソッド推測シナリオ

5. **名前にHTTPメソッドを含む関数からメソッドを推測する**
   - `fetchGet('/api/users')` からGETメソッド、
     `fetchPost('/api/users', data)` からPOSTメソッド、
     `fetchPut('/api/users/123', data)` からPUTメソッドを推測する

6. **関数名からHTTPメソッドを推測できない場合のデフォルト動作を検証する**
   - `fetchData('/api/users')` のような関数からデフォルトでGETメソッドを推測する

## レスポンス処理検出シナリオ

7. **thenチェーンのレスポンス処理を検出する**
   - `fetch('/api/users').then(response => response.json())` のような
     Promiseチェーンを使ったレスポンス処理を検出する

8. **json()メソッド変換を検出する**
   - `const response = await fetch('/api/users'); const data = await response.json();` のような
     JSON変換処理を検出する

9. **async/await処理パターンを検出する**
   - ```
     async function fetchUsers() {
       const response = await fetch('/api/users');
       return await response.json();
     }
     ``` 
     のようなasync/awaitパターンを検出する

## パラメータ抽出シナリオ

10. **URLからクエリパラメータを抽出する**
    - `/api/users?page=1&limit=10` からページとリミットパラメータを抽出する

11. **URLからパスパラメータを抽出する**
    - `/api/users/:id` や `/api/users/{id}` からIDパラメータを抽出する

12. **リクエストボディからパラメータを抽出する**
    - `fetch('/api/users', { method: 'POST', body: JSON.stringify({ name, email }) })` から
      nameとemailパラメータを抽出する

13. **ヘッダーからパラメータを抽出する**
    - `fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } })` から
      認証情報を抽出する

## エラー処理・エッジケースシナリオ

14. **エラーハンドリングが機能することを検証する**
    - 検出中にエラーが発生した場合でも、適切に処理されログが出力される

15. **複雑なURLパスやテンプレートリテラルの解析を検証する**
    - `` fetch(`/api/users/${userId}/posts/${postId}`) `` のような複雑なURLパスからも
      正しくパスパラメータが抽出される

16. **複数の同様のAPIコール間での重複を適切に処理することを検証する**
    - 同じエンドポイントへの複数の呼び出しが検出される場合に、適切に情報が統合される
