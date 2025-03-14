/**
 * カスタムAPIクライアント実装のサンプルコード集
 * テスト用フィクスチャーデータとして利用
 */

// 1. シンプルなHTTPクライアントクラス
export class HttpClient {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  async get<T>(endpoint: string, params?: Record<string, any>) {
    const url = new URL(endpoint, this.baseUrl);
    
    // クエリパラメータの追加
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json() as Promise<T>;
  }
  
  async post<T, D>(endpoint: string, data: D) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json() as Promise<T>;
  }
  
  async put<T, D>(endpoint: string, data: D) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json() as Promise<T>;
  }
  
  async delete(endpoint: string) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return true;
  }
}

// 2. 認証機能付きAPIクライアント
export class AuthenticatedApiClient {
  private baseUrl: string;
  private token: string | null = null;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  setToken(token: string) {
    this.token = token;
  }
  
  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }
  
  async request<T>(method: string, endpoint: string, data?: any) {
    const options: RequestInit = {
      method,
      headers: this.getHeaders()
    };
    
    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }
    
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }
    
    return response.json() as Promise<T>;
  }
  
  async get<T>(endpoint: string, params?: Record<string, any>) {
    let url = endpoint;
    
    // クエリパラメータの追加
    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        queryParams.append(key, String(value));
      });
      url = `${endpoint}?${queryParams.toString()}`;
    }
    
    return this.request<T>('GET', url);
  }
  
  async post<T>(endpoint: string, data: any) {
    return this.request<T>('POST', endpoint, data);
  }
  
  async put<T>(endpoint: string, data: any) {
    return this.request<T>('PUT', endpoint, data);
  }
  
  async patch<T>(endpoint: string, data: any) {
    return this.request<T>('PATCH', endpoint, data);
  }
  
  async delete<T>(endpoint: string) {
    return this.request<T>('DELETE', endpoint);
  }
}

// 3. ドメイン特化型サービスクラス
interface User {
  id: number;
  name: string;
  email: string;
}

interface Post {
  id: number;
  userId: number;
  title: string;
  body: string;
}

interface Comment {
  id: number;
  postId: number;
  name: string;
  email: string;
  body: string;
}

export class UserService {
  private apiClient: HttpClient;
  
  constructor(baseUrl: string) {
    this.apiClient = new HttpClient(baseUrl);
  }
  
  async getAllUsers() {
    return this.apiClient.get<User[]>('/users');
  }
  
  async getUserById(id: number) {
    return this.apiClient.get<User>(`/users/${id}`);
  }
  
  async getUserPosts(userId: number) {
    return this.apiClient.get<Post[]>(`/users/${userId}/posts`);
  }
  
  async createUser(userData: Omit<User, 'id'>) {
    return this.apiClient.post<User, Omit<User, 'id'>>('/users', userData);
  }
  
  async updateUser(id: number, userData: Partial<User>) {
    return this.apiClient.put<User, Partial<User>>(`/users/${id}`, userData);
  }
  
  async deleteUser(id: number) {
    return this.apiClient.delete(`/users/${id}`);
  }
}

export class PostService {
  private apiClient: HttpClient;
  
  constructor(baseUrl: string) {
    this.apiClient = new HttpClient(baseUrl);
  }
  
  async getAllPosts() {
    return this.apiClient.get<Post[]>('/posts');
  }
  
  async getPostById(id: number) {
    return this.apiClient.get<Post>(`/posts/${id}`);
  }
  
  async getPostComments(postId: number) {
    return this.apiClient.get<Comment[]>(`/posts/${postId}/comments`);
  }
  
  async createPost(postData: Omit<Post, 'id'>) {
    return this.apiClient.post<Post, Omit<Post, 'id'>>('/posts', postData);
  }
  
  async updatePost(id: number, postData: Partial<Post>) {
    return this.apiClient.put<Post, Partial<Post>>(`/posts/${id}`, postData);
  }
  
  async deletePost(id: number) {
    return this.apiClient.delete(`/posts/${id}`);
  }
}

// 4. 機能特化型HTTPクライアント
export class FileUploadClient {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  async uploadFile(path: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }
    
    return response.json();
  }
  
  async uploadUserAvatar(userId: number, file: File) {
    return this.uploadFile(`/users/${userId}/avatar`, file);
  }
  
  async uploadPostImage(postId: number, file: File) {
    return this.uploadFile(`/posts/${postId}/image`, file);
  }
}

// 5. ユーザー側の利用例
export function exampleUsage() {
  // 基本的なHTTPクライアントの使用
  const apiClient = new HttpClient('https://api.example.com');
  
  // データの取得
  apiClient.get<User[]>('/users')
    .then(users => {
      console.log('Users:', users);
    });
  
  // 特定のリソースの取得
  apiClient.get<User>('/users/1')
    .then(user => {
      console.log('User:', user);
    });
  
  // データの作成
  const newUser = {
    name: 'Jane Doe',
    email: 'jane@example.com'
  };
  
  apiClient.post<User, typeof newUser>('/users', newUser)
    .then(createdUser => {
      console.log('Created user:', createdUser);
    });
  
  // データの更新
  const updatedData = {
    email: 'new-email@example.com'
  };
  
  apiClient.put<User, typeof updatedData>('/users/1', updatedData)
    .then(updatedUser => {
      console.log('Updated user:', updatedUser);
    });
  
  // データの削除
  apiClient.delete('/users/1')
    .then(success => {
      console.log('User deleted:', success);
    });
  
  // ドメイン特化型サービスの使用
  const userService = new UserService('https://api.example.com');
  
  // ユーザー一覧の取得
  userService.getAllUsers()
    .then(users => {
      console.log('Users from service:', users);
    });
  
  // ユーザーの投稿を取得
  userService.getUserPosts(1)
    .then(posts => {
      console.log('User posts:', posts);
    });
  
  // 認証付きAPIクライアントの使用
  const authClient = new AuthenticatedApiClient('https://secure-api.example.com');
  authClient.setToken('my-auth-token-123');
  
  // 認証付きリクエスト
  authClient.get<User[]>('/protected/users')
    .then(users => {
      console.log('Protected users:', users);
    });
  
  // ファイルアップロードクライアントの使用
  const uploadClient = new FileUploadClient('https://upload.example.com');
  
  // 仮想的なFileオブジェクト
  const mockFile = new File(['dummy content'], 'avatar.png', { type: 'image/png' });
  
  // アバターのアップロード
  uploadClient.uploadUserAvatar(1, mockFile)
    .then(result => {
      console.log('Avatar upload result:', result);
    });
}

// 6. REST APIスタイルのクライアント
export class RestApiClient {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  resource<T>(resourceName: string) {
    return {
      getAll: (params?: Record<string, any>) => this.getAll<T>(resourceName, params),
      getOne: (id: number | string) => this.getOne<T>(resourceName, id),
      create: (data: any) => this.create<T>(resourceName, data),
      update: (id: number | string, data: any) => this.update<T>(resourceName, id, data),
      delete: (id: number | string) => this.delete(resourceName, id),
      custom: (path: string, method: string, data?: any) => this.custom<T>(resourceName, path, method, data)
    };
  }
  
  private async getAll<T>(resource: string, params?: Record<string, any>): Promise<T[]> {
    let url = `${this.baseUrl}/${resource}`;
    
    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        queryParams.append(key, String(value));
      });
      url = `${url}?${queryParams.toString()}`;
    }
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }
  
  private async getOne<T>(resource: string, id: number | string): Promise<T> {
    const url = `${this.baseUrl}/${resource}/${id}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }
  
  private async create<T>(resource: string, data: any): Promise<T> {
    const url = `${this.baseUrl}/${resource}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }
  
  private async update<T>(resource: string, id: number | string, data: any): Promise<T> {
    const url = `${this.baseUrl}/${resource}/${id}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }
  
  private async delete(resource: string, id: number | string): Promise<boolean> {
    const url = `${this.baseUrl}/${resource}/${id}`;
    const response = await fetch(url, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return true;
  }
  
  private async custom<T>(resource: string, path: string, method: string, data?: any): Promise<T> {
    const url = `${this.baseUrl}/${resource}/${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }
}

// RESTクライアントの使用例
export function restApiExample() {
  const api = new RestApiClient('https://api.example.com');
  
  // ユーザーリソースの操作
  const users = api.resource<User>('users');
  
  // 全ユーザーの取得
  users.getAll()
    .then(allUsers => {
      console.log('All users:', allUsers);
    });
  
  // 特定ユーザーの取得
  users.getOne(1)
    .then(user => {
      console.log('User:', user);
    });
  
  // ユーザーの作成
  users.create({
    name: 'John Doe',
    email: 'john@example.com'
  })
    .then(newUser => {
      console.log('New user:', newUser);
    });
  
  // ユーザーの更新
  users.update(1, {
    name: 'John Updated'
  })
    .then(updatedUser => {
      console.log('Updated user:', updatedUser);
    });
  
  // ユーザーの削除
  users.delete(1)
    .then(success => {
      console.log('User deleted:', success);
    });
  
  // カスタムエンドポイントの呼び出し
  users.custom('1/activate', 'POST')
    .then(result => {
      console.log('User activated:', result);
    });
}

// 7. グラフQLクライアントラッパー
export class GraphQLClient {
  private endpoint: string;
  
  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }
  
  async query<T>(queryString: string, variables?: Record<string, any>): Promise<T> {
    return this.request<T>(queryString, variables);
  }
  
  async mutate<T>(mutationString: string, variables?: Record<string, any>): Promise<T> {
    return this.request<T>(mutationString, variables);
  }
  
  private async request<T>(queryOrMutation: string, variables?: Record<string, any>): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: queryOrMutation,
        variables
      })
    });
    
    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }
    
    return result.data as T;
  }
}

// GraphQLクライアントの使用例
export function graphQLExample() {
  const client = new GraphQLClient('https://api.example.com/graphql');
  
  // クエリ実行
  client.query<{ users: User[] }>(`
    query GetUsers {
      users {
        id
        name
        email
      }
    }
  `)
    .then(result => {
      console.log('Users:', result.users);
    });
  
  // 変数付きクエリ
  client.query<{ user: User }>(`
    query GetUser($id: ID!) {
      user(id: $id) {
        id
        name
        email
      }
    }
  `, { id: 1 })
    .then(result => {
      console.log('User:', result.user);
    });
  
  // ミューテーション実行
  client.mutate<{ createUser: User }>(`
    mutation CreateUser($input: CreateUserInput!) {
      createUser(input: $input) {
        id
        name
        email
      }
    }
  `, {
    input: {
      name: 'Jane Doe',
      email: 'jane@example.com'
    }
  })
    .then(result => {
      console.log('Created user:', result.createUser);
    });
}
