/**
 * Fetch API を使用したHTTPリクエストのサンプルコード集
 * テスト用フィクスチャーデータとして利用
 */

// 1. 基本的なfetch APIの使用
export function basicFetchUsage() {
  // シンプルなGETリクエスト
  fetch('https://api.example.com/users')
    .then(response => response.json())
    .then(data => {
      console.log(data);
    });
  
  // 完全なURL（クエリパラメータ付き）
  fetch('https://api.example.com/users?page=1&limit=10')
    .then(response => response.json())
    .then(data => {
      console.log(data);
    });
  
  // POSTリクエスト
  fetch('https://api.example.com/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'John Doe',
      email: 'john@example.com'
    })
  })
    .then(response => response.json())
    .then(data => {
      const userId = data.id;
      return userId;
    });
  
  // PUTリクエスト
  fetch('https://api.example.com/users/123', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Jane Doe',
      email: 'jane@example.com'
    })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    });
  
  // DELETEリクエスト
  fetch('https://api.example.com/users/123', {
    method: 'DELETE'
  });
  
  // PATCHリクエスト
  fetch('https://api.example.com/users/123', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Jane Smith'
    })
  });
}

// 2. window.fetch または global.fetch の使用
export function prefixedFetchCalls() {
  // window.fetchの使用
  window.fetch('https://api.example.com/products')
    .then(response => response.json())
    .then(data => {
      console.log(data);
    });
  
  // global.fetchの使用（Node.js環境など）
  if (typeof global !== 'undefined') {
    global.fetch('https://api.example.com/categories')
      .then(response => response.json())
      .then(data => {
        console.log(data);
      });
  }
  
  // self.fetchの使用（Service Worker環境など）
  if (typeof self !== 'undefined') {
    self.fetch('https://api.example.com/orders')
      .then(response => response.json())
      .then(data => {
        console.log(data);
      });
  }
}

// 3. 様々なオプションを使用したfetch呼び出し
export function fetchWithOptions() {
  // カスタムヘッダー
  fetch('https://api.example.com/secure-data', {
    headers: {
      'Authorization': 'Bearer token123',
      'X-API-Key': 'secret-api-key',
      'Accept': 'application/json'
    }
  });
  
  // モード指定
  fetch('https://api.example.com/cors-data', {
    mode: 'cors'
  });
  
  // キャッシュ制御
  fetch('https://api.example.com/cached-data', {
    cache: 'no-cache'
  });
  
  // クレデンシャル含める
  fetch('https://api.example.com/auth-data', {
    credentials: 'include'
  });
  
  // リダイレクト制御
  fetch('https://api.example.com/redirected-data', {
    redirect: 'follow'
  });
  
  // シグナル（Abortコントローラー）
  const controller = new AbortController();
  const signal = controller.signal;
  
  fetch('https://api.example.com/long-operation', {
    signal
  });
  
  // 5秒後にリクエストをキャンセル
  setTimeout(() => {
    controller.abort();
  }, 5000);
}

// 4. 様々なレスポンス処理パターン
export function responseHandlingPatterns() {
  // JSONレスポンス
  fetch('https://api.example.com/data')
    .then(response => response.json())
    .then(data => {
      console.log(data);
    });
  
  // テキストレスポンス
  fetch('https://api.example.com/text-data')
    .then(response => response.text())
    .then(text => {
      console.log(text);
    });
  
  // Blobレスポンス（バイナリデータ）
  fetch('https://api.example.com/image.png')
    .then(response => response.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      // blobを使った処理
    });
  
  // ArrayBufferレスポンス
  fetch('https://api.example.com/binary-data')
    .then(response => response.arrayBuffer())
    .then(buffer => {
      // ArrayBufferを使った処理
    });
  
  // FormDataレスポンス
  fetch('https://api.example.com/form-data')
    .then(response => response.formData())
    .then(formData => {
      // FormDataを使った処理
    });
  
  // レスポンスステータスとヘッダーの確認
  fetch('https://api.example.com/status-check')
    .then(response => {
      console.log('Status:', response.status);
      console.log('OK:', response.ok);
      console.log('Content-Type:', response.headers.get('content-type'));
      return response.json();
    })
    .then(data => {
      console.log(data);
    });
}

// 5. エラーハンドリング
export function errorHandling() {
  fetch('https://api.example.com/might-fail')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('Success:', data);
    })
    .catch(error => {
      console.error('Error:', error.message);
    });
  
  // 様々なエラー状態の処理
  fetch('https://api.example.com/error-cases')
    .then(response => {
      if (response.status === 404) {
        throw new Error('Resource not found');
      } else if (response.status === 401) {
        throw new Error('Unauthorized');
      } else if (response.status === 500) {
        throw new Error('Server error');
      } else if (!response.ok) {
        throw new Error('Unknown error');
      }
      return response.json();
    })
    .catch(error => {
      if (error.name === 'TypeError') {
        console.error('Network error or CORS issue');
      } else {
        console.error('Error:', error.message);
      }
    });
}

// 6. async/await構文
export async function asyncAwaitUsage() {
  try {
    // 基本的なGETリクエスト
    const response = await fetch('https://api.example.com/users');
    const data = await response.json();
    console.log(data);
    
    // POSTリクエスト
    const createResponse = await fetch('https://api.example.com/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com'
      })
    });
    
    const newUser = await createResponse.json();
    return newUser.id;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

// 7. 複雑なケース - パラメータを含むURLパス
export function complexUrlPatterns() {
  // 動的セグメントを含むURL
  const userId = 123;
  
  fetch(`https://api.example.com/users/${userId}`)
    .then(response => response.json())
    .then(user => {
      console.log(user);
    });
  
  // 複数のパスパラメータ
  const companyId = 456;
  const productId = 789;
  
  fetch(`https://api.example.com/companies/${companyId}/products/${productId}`)
    .then(response => response.json())
    .then(product => {
      console.log(product);
    });
  
  // 混合パラメータ（パスとクエリ）
  fetch(`https://api.example.com/users/${userId}?include=orders&status=active`)
    .then(response => response.json())
    .then(userData => {
      console.log(userData);
    });
}

// 8. カスタムラッパー関数
export function customFetchWrappers() {
  // シンプルなラッパー
  function apiGet(endpoint: string) {
    return fetch(`https://api.example.com/${endpoint}`)
      .then(response => response.json());
  }
  
  apiGet('users')
    .then(data => {
      console.log(data);
    });
  
  // メソッド名にHTTPメソッドを含むラッパー
  function apiPost(endpoint: string, data: any) {
    return fetch(`https://api.example.com/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
      .then(response => response.json());
  }
  
  apiPost('users', { name: 'John Doe' })
    .then(data => {
      console.log(data);
    });
  
  // RESTful APIクライアント
  class ApiClient {
    private baseUrl: string;
    
    constructor(baseUrl: string) {
      this.baseUrl = baseUrl;
    }
    
    getUser(id: number) {
      return fetch(`${this.baseUrl}/users/${id}`)
        .then(response => response.json());
    }
    
    createUser(userData: { name: string; email: string }) {
      return fetch(`${this.baseUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })
        .then(response => response.json());
    }
    
    updateUser(id: number, userData: Partial<{ name: string; email: string }>) {
      return fetch(`${this.baseUrl}/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })
        .then(response => response.json());
    }
    
    deleteUser(id: number) {
      return fetch(`${this.baseUrl}/users/${id}`, {
        method: 'DELETE'
      })
        .then(response => response.ok);
    }
  }
  
  const apiClient = new ApiClient('https://api.example.com');
  apiClient.getUser(123)
    .then(user => {
      console.log(user);
    });
}
