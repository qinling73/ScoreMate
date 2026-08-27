import { GameMode, Room, Player, ScoreLog, RoomRetention, ServerRoomSummary, DeductionProposal } from '../types';

const TOKEN_STORAGE_KEY = 'score_app_token';
const USER_STORAGE_KEY = 'score_app_user';
const ROOM_CODE_STORAGE_KEY = 'score_app_room_code';
const ADMIN_KEY_STORAGE_KEY = 'score_app_admin_key';

export function getStoredAdminKey(): string | null {
  return localStorage.getItem(ADMIN_KEY_STORAGE_KEY);
}

export function setStoredAdminKey(key: string) {
  localStorage.setItem(ADMIN_KEY_STORAGE_KEY, key);
}

export function removeStoredAdminKey() {
  localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function getStoredRoomCode(): string | null {
  return localStorage.getItem(ROOM_CODE_STORAGE_KEY);
}

export function setStoredRoomCode(code: string) {
  localStorage.setItem(ROOM_CODE_STORAGE_KEY, code);
}

export function removeStoredToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(ROOM_CODE_STORAGE_KEY);
}

export function getStoredNickname(): string {
  return localStorage.getItem('score_app_nickname') || '';
}

export function setStoredNickname(nickname: string) {
  localStorage.setItem('score_app_nickname', nickname);
}

const API_BASE_URL_STORAGE_KEY = 'score_app_backend_url';

export const DEFAULT_PRODUCTION_BACKEND_URL = 'https://scoremate-sfbw.onrender.com';

export interface ApiDiagnosticsInfo {
  viteEnvValue: string;
  storedOverride: string;
  queryParam: string;
  hostname: string;
  isCloudflarePages: boolean;
  resolvedBaseUrl: string;
  source: 'localStorage' | 'queryParam' | 'viteEnv' | 'cloudflareAutoFallback' | 'sameOrigin';
  reason: string;
}

/**
 * Returns diagnostic metadata about how the API URL was resolved
 */
export function getApiDiagnostics(): ApiDiagnosticsInfo {
  const stored = (typeof localStorage !== 'undefined' ? localStorage.getItem(API_BASE_URL_STORAGE_KEY) : '') || '';
  
  let queryParam = '';
  let hostname = '';
  let isCloudflarePages = false;
  
  if (typeof window !== 'undefined' && window.location) {
    hostname = window.location.hostname || '';
    isCloudflarePages = hostname.endsWith('.pages.dev') || hostname.includes('cloudflare');
    const searchParams = new URLSearchParams(window.location.search);
    queryParam = searchParams.get('api') || searchParams.get('backend') || '';
  }

  const viteEnvValue = import.meta.env.VITE_API_URL || '';

  // Determine active source & URL
  if (stored && stored.trim()) {
    const clean = stored.trim().replace(/\/+$/, '');
    return {
      viteEnvValue,
      storedOverride: stored,
      queryParam,
      hostname,
      isCloudflarePages,
      resolvedBaseUrl: clean,
      source: 'localStorage',
      reason: `使用了浏览器本地缓存的自定义地址 (localStorage: "${clean}")`,
    };
  }

  if (queryParam && queryParam.trim()) {
    const clean = queryParam.trim().replace(/\/+$/, '');
    return {
      viteEnvValue,
      storedOverride: '',
      queryParam,
      hostname,
      isCloudflarePages,
      resolvedBaseUrl: clean,
      source: 'queryParam',
      reason: `使用了 URL 查询参数 (URL ?api="${clean}")`,
    };
  }

  if (viteEnvValue && typeof viteEnvValue === 'string' && viteEnvValue.trim()) {
    const clean = viteEnvValue.trim().replace(/\/+$/, '');
    return {
      viteEnvValue,
      storedOverride: '',
      queryParam,
      hostname,
      isCloudflarePages,
      resolvedBaseUrl: clean,
      source: 'viteEnv',
      reason: `成功读取到构建注入的环境变量 VITE_API_URL ("${clean}")`,
    };
  }

  if (isCloudflarePages) {
    return {
      viteEnvValue,
      storedOverride: '',
      queryParam,
      hostname,
      isCloudflarePages: true,
      resolvedBaseUrl: DEFAULT_PRODUCTION_BACKEND_URL,
      source: 'cloudflareAutoFallback',
      reason: `检测到 Cloudflare Pages 静态环境 (${hostname})，自动启用默认 Render 后端 ("${DEFAULT_PRODUCTION_BACKEND_URL}")`,
    };
  }

  return {
    viteEnvValue,
    storedOverride: '',
    queryParam,
    hostname,
    isCloudflarePages: false,
    resolvedBaseUrl: '',
    source: 'sameOrigin',
    reason: `使用同源相对路径 (同源服务 "${typeof window !== 'undefined' ? window.location.origin : ''}")`,
  };
}

/**
 * Returns the backend API base URL based on resolution priority
 */
export function getApiBaseUrl(): string {
  return getApiDiagnostics().resolvedBaseUrl;
}

export function setApiBaseUrl(url: string) {
  if (url && url.trim()) {
    localStorage.setItem(API_BASE_URL_STORAGE_KEY, url.trim().replace(/\/+$/, ''));
  } else {
    localStorage.removeItem(API_BASE_URL_STORAGE_KEY);
  }
}

/**
 * Actively test connectivity with the target backend
 */
export async function testBackendConnection(customUrl?: string): Promise<{
  ok: boolean;
  latencyMs: number;
  statusCode: number;
  targetUrl: string;
  data?: any;
  error?: string;
  isSleepingWakeup?: boolean;
}> {
  const baseUrl = customUrl !== undefined ? customUrl.trim().replace(/\/+$/, '') : getApiBaseUrl();
  const testUrl = `${baseUrl ? baseUrl : ''}/api/health`;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout for wakeups

    const res = await fetch(testUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // not json
    }

    if (res.ok) {
      return {
        ok: true,
        latencyMs,
        statusCode: res.status,
        targetUrl: testUrl,
        data: json,
      };
    } else {
      return {
        ok: false,
        latencyMs,
        statusCode: res.status,
        targetUrl: testUrl,
        error: `HTTP ${res.status}: ${text.slice(0, 100) || res.statusText}`,
      };
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const isTimeout = err.name === 'AbortError';
    return {
      ok: false,
      latencyMs,
      statusCode: 0,
      targetUrl: testUrl,
      error: isTimeout ? '请求超时（Render 后端可能正在休眠冷启动，需要约 20-30 秒唤醒）' : (err.message || '网络连接失败'),
      isSleepingWakeup: isTimeout,
    };
  }
}

/**
 * Prints clear, readable diagnostic banners into the browser console
 */
export function logApiDiagnostics() {
  const diag = getApiDiagnostics();
  
  console.log(
    '%c🎮 [ScoreMate 计分助手] 启动环境与 API 路由诊断%c',
    'background: #111; color: #FFE66D; font-size: 13px; font-weight: bold; padding: 4px 8px; border-radius: 4px;',
    ''
  );
  
  console.table({
    '1. 构建环境变量 (VITE_API_URL)': diag.viteEnvValue || '❌ 未注入 (为空)',
    '2. 浏览器缓存覆盖 (localStorage)': diag.storedOverride || '无',
    '3. URL 地址参数 (?api=)': diag.queryParam || '无',
    '4. 当前访问域名 (hostname)': diag.hostname,
    '5. 是否 Cloudflare Pages': diag.isCloudflarePages ? '✅ 是' : '否',
    '6. 最终生效后端 API 地址': diag.resolvedBaseUrl || '(同源相对路径)',
    '7. 解析匹配依据': diag.reason,
  });

  if (diag.resolvedBaseUrl) {
    console.log(
      `%c🌐 目标请求端点: %c${diag.resolvedBaseUrl}/api/room/...`,
      'font-weight: bold; color: #4D96FF;',
      'font-weight: bold; color: #2ecc71; text-decoration: underline;'
    );
  } else {
    console.log(
      '%cℹ️ 目标请求端点: 使用同源当前域名的 /api/room/...',
      'color: #888; font-weight: bold;'
    );
  }

  // Ping test in background
  testBackendConnection().then((testRes) => {
    if (testRes.ok) {
      console.log(
        `%c✅ [ScoreMate] 后端连通性测试成功! 延迟: ${testRes.latencyMs}ms | 服务状态: 正常在线`,
        'color: #27ae60; font-weight: bold;'
      );
    } else {
      console.warn(
        `%c⚠️ [ScoreMate] 后端连通性检查未通过: %c${testRes.error}`,
        'color: #e74c3c; font-weight: bold;',
        'color: #c0392b;'
      );
    }
  });

  // Attach to window for easy developer debugging in DevTools
  if (typeof window !== 'undefined') {
    (window as any).__scoreMateDiag = () => {
      console.log('--- ScoreMate 当前诊断详情 ---', getApiDiagnostics());
      return getApiDiagnostics();
    };
    (window as any).__scoreMatePing = testBackendConnection;
  }
}

/**
 * Universal Request Adapter Interface
 * Ready to be swapped with `wx.request` in WeChat Mini-Program runtime.
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const adminKey = getStoredAdminKey();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (adminKey) {
    headers['x-admin-key'] = adminKey;
  }

  const baseUrl = getApiBaseUrl();
  const fullUrl = endpoint.startsWith('http://') || endpoint.startsWith('https://')
    ? endpoint
    : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      ...options,
      headers,
    });
  } catch (networkErr: any) {
    throw new Error(
      `无法连接到后端服务器 (${fullUrl})。请检查后端服务是否启动运行、网络是否通畅，或是否配置了正确的 VITE_API_URL。`
    );
  }

  // Read response as text first to avoid "Unexpected end of JSON input" errors
  const responseText = await response.text();
  let data: any;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch (jsonErr) {
    if (!response.ok) {
      throw new Error(
        `后端服务响应异常 (HTTP ${response.status}): ${responseText.slice(0, 120) || response.statusText}`
      );
    }
    throw new Error(
      `后端未返回有效的JSON数据 (收到非JSON内容)。如果使用了 Cloudflare Pages 等静态托管，请确认已在环境变量配置 VITE_API_URL 指向后端服务器。`
    );
  }

  if (!response.ok) {
    throw new Error(data?.error || `网络请求错误 (HTTP ${response.status})`);
  }

  return data as T;
}

export const api = {
  // Create room
  async createRoom(params: {
    nickname: string;
    avatar?: string;
    roomTitle?: string;
    mode?: GameMode;
    initialScore?: number;
    retention?: RoomRetention;
  }): Promise<{ roomId: string; roomCode: string; token: string; player: Player; room: Room }> {
    const res = await request<{
      roomId: string;
      roomCode: string;
      token: string;
      player: Player;
      room: Room;
    }>('/api/room/create', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (res.token) setStoredToken(res.token);
    if (res.roomCode) setStoredRoomCode(res.roomCode);
    if (params.nickname) setStoredNickname(params.nickname);
    return res;
  },

  // Join room
  async joinRoom(params: {
    nickname: string;
    avatar?: string;
    roomCode: string;
    token?: string;
  }): Promise<{ roomId: string; roomCode: string; token: string; player: Player; room: Room }> {
    const res = await request<{
      roomId: string;
      roomCode: string;
      token: string;
      player: Player;
      room: Room;
    }>('/api/room/join', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (res.token) setStoredToken(res.token);
    if (res.roomCode) setStoredRoomCode(res.roomCode);
    if (params.nickname) setStoredNickname(params.nickname);
    return res;
  },

  // Update player avatar
  async updateAvatar(roomId: string, payload: { userId?: string; avatar: string } | string): Promise<{ success?: boolean; avatar?: string; player?: Player; room: Room }> {
    const bodyObj = typeof payload === 'string' ? { avatar: payload } : payload;
    return request<{ success?: boolean; avatar?: string; player?: Player; room: Room }>(`/api/room/${roomId}/avatar`, {
      method: 'POST',
      body: JSON.stringify(bodyObj),
    });
  },

  // Get room info
  async getRoom(roomId: string): Promise<{ room: Room; leaderboard: Player[] }> {
    return request<{ room: Room; leaderboard: Player[] }>(`/api/room/${roomId}`);
  },

  // Get logs
  async getLogs(roomId: string, limit = 100): Promise<{ logs: ScoreLog[]; total: number }> {
    return request<{ logs: ScoreLog[]; total: number }>(`/api/room/${roomId}/logs?limit=${limit}`);
  },

  // Submit score via HTTP (fallback)
  async submitScore(roomId: string, payload: {
    fromUserId: string;
    targetUserIds: string[];
    amount: number;
    note?: string;
  }): Promise<{ room: Room; newLogs: ScoreLog[] }> {
    return request<{ room: Room; newLogs: ScoreLog[] }>(`/api/room/${roomId}/score`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Respond to deduction proposal via HTTP
  async respondDeduction(roomId: string, payload: {
    proposalId: string;
    accepted: boolean;
    responderUserId: string;
  }): Promise<{ room: Room; proposal: DeductionProposal; newLog?: ScoreLog }> {
    return request<{ room: Room; proposal: DeductionProposal; newLog?: ScoreLog }>(`/api/room/${roomId}/deduction/respond`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Host action via HTTP
  async executeHostAction(roomId: string, payload: {
    action: 'reset_scores' | 'kick_player' | 'change_mode' | 'set_initial_score' | 'set_retention' | 'close_room';
    targetUserId?: string;
    mode?: GameMode;
    initialScore?: number;
    retention?: RoomRetention;
    hostUserId?: string;
  }): Promise<{ message: string; room: Room }> {
    return request<{ message: string; room: Room }>(`/api/room/${roomId}/action`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Admin: Authenticate for /ra path
  async adminAuth(password: string): Promise<{
    success: boolean;
    adminKey: string;
    clientIp?: string;
    isInternal?: boolean;
    message?: string;
  }> {
    const res = await request<{
      success: boolean;
      adminKey: string;
      clientIp?: string;
      isInternal?: boolean;
      message?: string;
    }>('/api/room/admin/auth', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    if (res.success && res.adminKey) {
      setStoredAdminKey(res.adminKey);
    }
    return res;
  },

  // Admin: Check access status (only internal IP has permission, or verified adminKey)
  async checkAdminAccess(): Promise<{
    hasAdminAccess: boolean;
    clientIp?: string;
    isInternal?: boolean;
    reason?: string;
  }> {
    try {
      return await request<{
        hasAdminAccess: boolean;
        clientIp?: string;
        isInternal?: boolean;
        reason?: string;
      }>('/api/room/admin/access-check');
    } catch {
      return { hasAdminAccess: false };
    }
  },

  // Admin: Get all rooms on server
  async getAllRooms(): Promise<{ rooms: ServerRoomSummary[]; total: number }> {
    return request<{ rooms: ServerRoomSummary[]; total: number }>('/api/room/admin/all');
  },

  // Admin: Delete/dissolve room
  async adminDeleteRoom(roomId: string, hardDelete: boolean = true): Promise<{ success: boolean; message: string; roomCode?: string }> {
    return request<{ success: boolean; message: string; roomCode?: string }>(`/api/room/admin/room/${roomId}/delete`, {
      method: 'POST',
      body: JSON.stringify({ hardDelete }),
    });
  },

  // Admin: Update room retention
  async adminUpdateRetention(roomId: string, retention: RoomRetention): Promise<{ success: boolean; room: Room; message: string }> {
    return request<{ success: boolean; room: Room; message: string }>(`/api/room/admin/room/${roomId}/retention`, {
      method: 'POST',
      body: JSON.stringify({ retention }),
    });
  },
};

