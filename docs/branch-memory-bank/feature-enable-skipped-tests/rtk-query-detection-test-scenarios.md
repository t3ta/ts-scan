# RTKQueryDetectionStrategy テストシナリオ一覧

## 基本機能検出シナリオ

1. **正しい名前と優先度を持つことを検証する**
   - 戦略クラスの名前が「RTKQueryDetectionStrategy」であることを確認
   - 優先度が20であることを確認（fetch検出より低く、カスタムAPI検出より高い）

2. **エラーハンドリングが機能することを検証する**
   - 検出処理中に例外が発生した場合でも、空の配列が返され、エラーログが出力される

## createApi検出シナリオ

3. **createApi呼び出しを検出する**
   - `createApi({ ... })` のようなRTK Query API定義を検出
   - API定義から適切なエンドポイント情報を抽出

4. **baseUrlオプションを正しく解析する**
   - `createApi({ baseQuery: fetchBaseQuery({ baseUrl: 'https://api.example.com' }), ... })`
     からベースURLを抽出

5. **複数のエンドポイント定義を正しく解析する**
   - 単一のcreateApi呼び出し内の複数のエンドポイント定義を抽出

## エンドポイント定義検出シナリオ

6. **builder.queryエンドポイントを検出する**
   - `builder.query({ ... })` 形式のクエリエンドポイント定義を検出
   - エンドポイントの種別をクエリとして正しく分類

7. **builder.mutationエンドポイントを検出する**
   - `builder.mutation({ ... })` 形式のミューテーションエンドポイント定義を検出
   - エンドポイントの種別をミューテーションとして正しく分類

8. **builder.infiniteQueryエンドポイントを検出する**
   - `builder.infiniteQuery({ ... })` 形式の無限クエリエンドポイント定義を検出

## エンドポイントフック使用検出シナリオ

9. **useQueryフックの使用を検出する**
   - `const { data } = useGetUsersQuery()` のようなクエリフック使用を検出
   - フック名からエンドポイント情報を適切に推測

10. **useMutationフックの使用を検出する**
    - `const [createUser] = useCreateUserMutation()` のようなミューテーションフック使用を検出
    - フック名からエンドポイント情報を適切に推測

11. **useQueryStateフックの使用を検出する**
    - `const { data } = useGetUsersQueryState()` のようなステートフック使用を検出

## URL・パラメータ解析シナリオ

12. **文字列リテラルURLを正しく解析する**
    - `query: () => '/api/users'` のような文字列リテラルからURLを抽出

13. **URLオブジェクト定義を正しく解析する**
    - `query: () => ({ url: '/api/users', method: 'GET' })` のようなオブジェクト定義から
      URLとHTTPメソッドを抽出

14. **テンプレートリテラルURLを正しく解析する**
    - `` query: (id) => `/api/users/${id}` `` のようなテンプレートリテラルからURLを抽出

15. **動的パスパラメータを抽出する**
    - `/api/users/:id` や `/api/users/${id}` のようなパスから動的パラメータを抽出

16. **クエリパラメータを抽出する**
    - `query: (arg) => ({ url: '/api/users', params: { limit: arg.limit } })` から
      クエリパラメータを抽出

17. **リクエストボディパラメータを抽出する**
    - `query: (data) => ({ url: '/api/users', method: 'POST', body: data })` から
      ボディパラメータを抽出

## 型情報活用シナリオ

18. **ジェネリック型情報からレスポンス型を抽出する**
    - `builder.query<User[], void>({ ... })` のようなジェネリック型パラメータから
      レスポンス型情報を抽出

19. **transformResponse使用を検出する**
    - `transformResponse: (response) => response.data` のようなレスポンス変換処理を検出

## 統合・重複除去シナリオ

20. **複数のエンドポイントを検出して結果を統合する**
    - createApi定義、個別のbuilderメソッド呼び出し、フック使用などから
      全てのエンドポイント情報を統合

21. **重複するエンドポイントを適切にマージする**
    - 同じURLと同じHTTPメソッドのエンドポイントを検出した場合に、
      適切に重複を除去しつつ使用箇所情報を保持
    
22. **クエリとミューテーションを正しく分類する**
    - GETリクエストをクエリとして、その他のリクエストをミューテーションとして
      適切に分類する
