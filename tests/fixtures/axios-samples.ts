/**
 * Axiosライブラリを使用したAPIリクエストのサンプルコード集
 * テスト用フィクスチャーデータとして利用
 */

import axios from 'axios';

// 1. 直接メソッド呼び出し
export function directMethodCall() {
  // GET リクエスト
  axios.get('/api/users')
    .then(response => {
      return response.data;
    });
  
  // GET リクエストとクエリパラメータ
  axios.get('/api/users', { params: { page: 1, limit: 10 } })
    .then(response => {
      console.log(response.data);
    });
  
  // POST リクエスト
  axios.post('/api/users', {
    name: 'John Doe',
    email: 'john@example.com'
  }).then(response => {
    const userId = response.data.id;
    return userId;
  });
  
  // PUT リクエスト
  axios.put('/api/users/123', {
    name: 'Jane Doe',
    email: 'jane@example.com'
  });
  
  // DELETE リクエスト
  axios.delete('/api/users/123');
  
  // PATCH リクエスト
  axios.patch('/api/users/123', {
    name: 'Jane Smith'
  });
}

// 2. インスタンスを使用したメソッド呼び出し
export function instanceMethodCall() {
  // インスタンス作成
  const apiClient = axios.create({
    baseURL: '/api/v2',
    timeout: 1000,
    headers: {'X-Custom-Header': 'foobar'}
  });
  
  // GET リクエスト
  apiClient.get('/users')
    .then(response => {
      return response.data;
    });
  
  // GET リクエストとパスパラメータ
  apiClient.get('/users/:id', { params: { id: 123 } })
    .then(response => {
      console.log(response.data);
    });
  
  // POST リクエスト
  apiClient.post('/users', {
    name: 'John Doe',
    email: 'john@example.com'
  });
  
  // カスタムヘッダー付きリクエスト
  apiClient.get('/products', {
    headers: {
      'Authorization': 'Bearer token123'
    }
  });
}

// 3. リクエスト設定オブジェクトを使用した呼び出し
export function requestConfigCall() {
  // 設定オブジェクトによる呼び出し
  axios({
    method: 'get',
    url: '/api/products',
    params: {
      category: 'electronics',
      inStock: true
    }
  }).then(response => {
    return response.data;
  });
  
  // request メソッドによる呼び出し
  axios.request({
    method: 'post',
    url: '/api/orders',
    data: {
      productId: 456,
      quantity: 2
    }
  });
  
  // ベースURL付き設定
  axios({
    method: 'put',
    baseURL: '/api/v3',
    url: '/settings',
    data: {
      theme: 'dark',
      notifications: true
    }
  });
}

// 4. 型情報付きのレスポンス処理
interface User {
  id: number;
  name: string;
  email: string;
}

export function typedResponses() {
  // 型アサーションによる型付け
  axios.get('/api/users/123')
    .then(response => {
      const user = response.data as User;
      return user.name;
    });
  
  // ジェネリクスによる型付け
  axios.get<User>('/api/users/123')
    .then(response => {
      const user = response.data;
      return user.email;
    });
    
  // 変換処理を含むレスポンス処理
  axios.get('/api/users')
    .then(response => {
      const users = response.data.map((user: User) => ({
        fullName: user.name,
        contact: user.email
      }));
      return users;
    });
}

// 5. エラーハンドリング
export function errorHandling() {
  axios.get('/api/users/123')
    .then(response => {
      return response.data;
    })
    .catch(error => {
      if (error.response) {
        // サーバーからのエラーレスポンス
        console.error('Server Error:', error.response.status);
      } else if (error.request) {
        // リクエストは送信されたがレスポンスがない
        console.error('No Response Error');
      } else {
        // リクエスト設定エラー
        console.error('Request Error:', error.message);
      }
    });
}

// 6. 非同期/await構文
export async function asyncAwaitUsage() {
  try {
    // GET リクエスト
    const response = await axios.get('/api/users');
    return response.data;
    
    // POST リクエスト
    const createResponse = await axios.post('/api/users', {
      name: 'John Doe',
      email: 'john@example.com'
    });
    return createResponse.data.id;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// 7. 複雑なケース - URLテンプレートリテラル
export function templateLiteralUrls() {
  const userId = 123;
  const version = 'v2';
  
  // テンプレートリテラルを使用したURL
  axios.get(`/api/${version}/users/${userId}`)
    .then(response => {
      return response.data;
    });
  
  // 複数パラメータを含むテンプレート
  const companyId = 456;
  axios.get(`/api/companies/${companyId}/users/${userId}/profile`)
    .then(response => {
      return response.data;
    });
}

// 8. カスタムAPIクライアント（Axios互換）
export class CustomApiClient {
  private client;
  
  constructor() {
    this.client = axios.create({
      baseURL: '/api/custom',
      timeout: 5000
    });
  }
  
  getUser(id: number) {
    return this.client.get(`/users/${id}`);
  }
  
  createUser(userData: { name: string; email: string }) {
    return this.client.post('/users', userData);
  }
  
  updateUser(id: number, userData: Partial<{ name: string; email: string }>) {
    return this.client.put(`/users/${id}`, userData);
  }
  
  deleteUser(id: number) {
    return this.client.delete(`/users/${id}`);
  }
}
