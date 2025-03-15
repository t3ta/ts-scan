# CustomApiClientStrategy テストシナリオ一覧

## ApiClientMethodCallDetector 検出シナリオ

1. **シンプルなHTTPクライアントクラスのメソッド呼び出しを検出する**
   - apiClient.get('/api/users')のような一般的なREST APIクライアントのメソッド呼び出しを検出
   - 戻り値としてGETメソッドのエンドポイント情報が正しく抽出される

2. **認証付きAPIクライアントのメソッド呼び出しを検出する**
   - secureApiClient.post('/api/users', { name: "User Name", email: "user@example.com" })のような、
     認証トークンを持つAPIクライアントからのPOSTリクエストを検出
   - リクエストボディからパラメータが正しく抽出される

3. **リクエストメソッド名からHTTPメソッドを推測する**
   - apiClient.fetchUsers()のような、HTTPメソッド名を含まないメソッド呼び出しから
     適切なHTTPメソッド（この場合はGET）を推測する

4. **パス変数を含むURLからパラメータを抽出する**
   - apiClient.get('/api/users/:id')のようなパスパラメータを持つURLから
     idをパラメータとして正しく抽出する

## ServiceMethodDetector 検出シナリオ

5. **ドメイン特化型サービスクラスのメソッド呼び出しを検出する**
   - userService.getUserById("123")のようなドメイン特化型のサービスクラスメソッドから
     '/user/:id' というエンドポイントとGETメソッドを推測する

6. **エンドポイントパスを正しく解析する**
   - userRepository.findUserByEmail("user@example.com")のようなメソッド名から
     '/user/find-by-email'というパスを推測し、emailをクエリパラメータとして抽出する

7. **メソッド名からCRUD操作を推測する**
   - userService.createUser(userData)メソッドからPOSTメソッド、
     userService.updateUser(userData)からPUTメソッド、
     userService.deleteUser(id)からDELETEメソッドを適切に推測する

## HttpPatternDetector 検出シナリオ

8. **RESTスタイルのエンドポイントパターンを検出する**
   - requestApi("/api/users", { method: "GET" })のような汎用的なAPI呼び出し関数から
     エンドポイント情報を抽出する

9. **GraphQLクライアントのラッパーメソッドを検出する**
   - graphqlClient.request("query GetUser { user(id: $id) { id name email } }", { id: "123" })のような
     GraphQLクライアントのラッパーメソッドを検出し、GraphQLエンドポイントとして認識する

10. **this.http パターンを検出する**
    - this.http.get('/api/users')のようなAngularやVue.jsで一般的なコンポーネント内での
      HTTPクライアント呼び出しパターンを検出する

## 統合テスト検出シナリオ

11. **複数のエンドポイント検出結果を統合する**
    - 同じファイル内で複数の検出器が反応した場合に、重複なく正しく結果をマージする

12. **エンドポイント情報を重複除去する**
    - 同じURLと同じHTTPメソッドの複数のエンドポイントを検出した場合に、
      適切に重複を除去しつつ使用箇所情報を保持する

13. **エラーハンドリングが機能する**
    - 検出器がエラーをスローした場合でも、他の検出器は正常に動作し続け、
      エラーログが出力される

## パラメータとレスポンス検出シナリオ

14. **URLからパスパラメータを抽出する**
    - '/api/users/:id'や'/api/users/{id}'のようなURLからidパラメータを抽出する

15. **クエリパラメータを含むURLから適切にパラメータを抽出する**
    - '/api/users?page=1&limit=10'のようなURLからpageとlimitをクエリパラメータとして抽出する

16. **リクエストボディから適切にパラメータを抽出する**
    - { name: "User Name", email: "user@example.com" }のようなオブジェクトリテラルから
      nameとemailをボディパラメータとして抽出する
