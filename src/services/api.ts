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

/**
 * Returns the backend API base URL.
 * Checks localStorage override -> URL query param -> VITE_API_URL environment variable -> default (empty string for relative path)
 */
export function getApiBaseUrl(): string {
  // 1. Stored custom backend URL override
  const stored = localStorage.getItem(API_BASE_URL_STORAGE_KEY);
  if (stored && stored.trim()) {
    return stored.trim().replace(/\/+$/, '');
  }

  // 2. URL query param: ?api=https://xxx or ?backend=https://xxx
  if (typeof window !== 'undefined' && window.location) {
    const searchParams = new URLSearchParams(window.location.search);
    const paramUrl = searchParams.get('api') || searchParams.get('backend');
    if (paramUrl && paramUrl.trim()) {
      const clean = paramUrl.trim().replace(/\/+$/, '');
      localStorage.setItem(API_BASE_URL_STORAGE_KEY, clean);
      return clean;
    }
  }

  // 3. Vite environment variable: VITE_API_URL
  const envUrl = (import.meta as any)?.env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 4. Default: empty string (same origin relative path)
  return '';
}

export function setApiBaseUrl(url: string) {
  if (url && url.trim()) {
    localStorage.setItem(API_BASE_URL_STORAGE_KEY, url.trim().replace(/\/+$/, ''));
  } else {
    localStorage.removeItem(API_BASE_URL_STORAGE_KEY);
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

