/**
 * RTK Query を使用したAPIエンドポイント定義のサンプルコード集
 * テスト用フィクスチャーデータとして利用
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// 型定義
interface User {
  id: number;
  name: string;
  email: string;
}

interface SearchParams {
  query?: string;
  limit?: number;
  offset?: number;
}

interface CreateUserRequest {
  name: string;
  email: string;
}

interface UpdateUserRequest {
  name?: string;
  email?: string;
}

// 基本的なAPI定義
export const basicApi = createApi({
  reducerPath: 'basicApi',
  baseQuery: fetchBaseQuery({ baseUrl: 'https://api.example.com/' }),
  endpoints: (builder) => ({
    // クエリエンドポイント（GET）
    getUsers: builder.query<User[], void>({
      query: () => 'users'
    }),
    
    // パスパラメータを持つクエリ
    getUserById: builder.query<User, number>({
      query: (id) => `users/${id}`
    }),
    
    // クエリパラメータを持つクエリ
    searchUsers: builder.query<User[], SearchParams>({
      query: (params) => ({
        url: 'users/search',
        params
      })
    }),
    
    // ミューテーションエンドポイント（POST）
    createUser: builder.mutation<User, CreateUserRequest>({
      query: (userData) => ({
        url: 'users',
        method: 'POST',
        body: userData
      })
    }),
    
    // PUTミューテーション
    updateUser: builder.mutation<User, { id: number; data: UpdateUserRequest }>({
      query: ({ id, data }) => ({
        url: `users/${id}`,
        method: 'PUT',
        body: data
      })
    }),
    
    // DELETEミューテーション
    deleteUser: builder.mutation<void, number>({
      query: (id) => ({
        url: `users/${id}`,
        method: 'DELETE'
      })
    })
  })
});

// 高度な機能を使用したAPI定義
export const advancedApi = createApi({
  reducerPath: 'advancedApi',
  baseQuery: fetchBaseQuery({ 
    baseUrl: 'https://api.advanced-example.com/',
    prepareHeaders: (headers) => {
      headers.set('Authorization', 'Bearer token123');
      return headers;
    }
  }),
  tagTypes: ['User', 'Post'],
  endpoints: (builder) => ({
    // transformResponseを使用したクエリ
    getEnhancedUsers: builder.query<{ users: User[]; totalCount: number }, void>({
      query: () => 'users',
      transformResponse: (response: { data: User[]; meta: { total: number } }) => ({
        users: response.data,
        totalCount: response.meta.total
      })
    }),
    
    // 条件付きリクエスト
    getUserPosts: builder.query<any[], { userId: number; includeComments?: boolean }>({
      query: ({ userId, includeComments = false }) => ({
        url: `users/${userId}/posts`,
        params: includeComments ? { include: 'comments' } : {}
      })
    }),
    
    // キャッシュライフサイクルフックを持つミューテーション
    createPost: builder.mutation({
      query: (postData) => ({
        url: 'posts',
        method: 'POST',
        body: postData
      }),
      invalidatesTags: ['Post'],
      onQueryStarted: async (arg, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled;
          // キャッシュの最適化処理等
        } catch (error) {
          // エラーハンドリング
        }
      }
    }),
    
    // 特殊なヘッダーとリクエストオプションを持つエンドポイント
    uploadUserAvatar: builder.mutation({
      query: ({ userId, file }) => {
        const formData = new FormData();
        formData.append('avatar', file);
        
        return {
          url: `users/${userId}/avatar`,
          method: 'POST',
          body: formData,
          headers: {
            // multipart/form-dataはContent-Typeヘッダーの設定が不要
          },
          formData: true
        };
      }
    }),
    
    // 無限クエリ
    infiniteUsers: builder.query({
      query: (page = 1) => `users?page=${page}&limit=10`,
      serializeQueryArgs: ({ endpointName }) => {
        return endpointName;
      },
      merge: (currentCache, newItems) => {
        currentCache.push(...newItems);
      },
      forceRefetch({ currentArg, previousArg }) {
        return currentArg !== previousArg;
      }
    })
  })
});

// カスタムベースクエリを使用したAPI
const customBaseQuery = fetchBaseQuery({
  baseUrl: 'https://custom-api.example.com/',
  timeout: 10000
});

export const customizedApi = createApi({
  reducerPath: 'customizedApi',
  baseQuery: async (args, api, extraOptions) => {
    // カスタム前処理
    console.log('Custom pre-processing', args);
    
    // ベースクエリの実行
    const result = await customBaseQuery(args, api, extraOptions);
    
    // カスタム後処理
    if (result.error) {
      console.error('API Error:', result.error);
    }
    
    return result;
  },
  endpoints: (builder) => ({
    // 単純なエンドポイント
    getData: builder.query({
      query: () => 'data'
    })
  })
});

// インターセプターを使用したAPI
export const interceptedApi = createApi({
  reducerPath: 'interceptedApi',
  baseQuery: fetchBaseQuery({ baseUrl: 'https://intercepted.example.com/' }),
  endpoints: (builder) => ({
    getSecureData: builder.query({
      query: () => ({
        url: 'secure-data',
        method: 'GET',
        responseHandler: (response) => response.text(), // カスタムレスポンスハンドリング
      }),
      transformResponse: (response) => {
        // レスポンス変換処理
        return JSON.parse(response);
      }
    })
  })
});

// APIインスタンスの使用例
export function useApiExample() {
  // フックの使用
  const { data: users, error, isLoading } = basicApi.useGetUsersQuery();
  const { data: user } = basicApi.useGetUserByIdQuery(123);
  
  // ミューテーションフックの使用
  const [createUser, { isLoading: isCreating }] = basicApi.useCreateUserMutation();
  const [updateUser] = basicApi.useUpdateUserMutation();
  const [deleteUser] = basicApi.useDeleteUserMutation();
  
  // 条件付きクエリ
  const { data: userPosts } = advancedApi.useGetUserPostsQuery(
    { userId: 123, includeComments: true },
    { skip: !users }
  );
  
  // ミューテーション実行
  const handleCreateUser = async () => {
    try {
      const user = await createUser({ name: 'New User', email: 'user@example.com' }).unwrap();
      console.log('Created user:', user);
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };
  
  // 高度なフック設定での利用
  const { data: enhancedUsers, refetch } = advancedApi.useGetEnhancedUsersQuery(undefined, {
    pollingInterval: 60000,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
    refetchOnReconnect: true
  });
}

// インラインエンドポイントでのAPI拡張
const extendedApi = basicApi.injectEndpoints({
  endpoints: (builder) => ({
    getUserSettings: builder.query({
      query: (userId) => `users/${userId}/settings`
    }),
    updateUserSettings: builder.mutation({
      query: ({ userId, settings }) => ({
        url: `users/${userId}/settings`,
        method: 'PATCH',
        body: settings
      })
    })
  }),
  overrideExisting: false
});

// API切り替え関数（動的インポート等の実装の代替例）
export function getApiForEnvironment(env: string) {
  switch (env) {
    case 'production':
      return basicApi;
    case 'staging':
      return advancedApi;
    case 'development':
      return customizedApi;
    default:
      return basicApi;
  }
}
