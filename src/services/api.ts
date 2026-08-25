import { GameMode, Room, Player, ScoreLog } from '../types';

const TOKEN_STORAGE_KEY = 'score_app_token';
const USER_STORAGE_KEY = 'score_app_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function removeStoredToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

export function getStoredNickname(): string {
  return localStorage.getItem('score_app_nickname') || '';
}

export function setStoredNickname(nickname: string) {
  localStorage.setItem('score_app_nickname', nickname);
}

/**
 * Universal Request Adapter Interface
 * Ready to be swapped with `wx.request` in WeChat Mini-Program runtime.
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '网络请求错误，请稍后重试');
  }

  return data as T;
}

export const api = {
  // Create room
  async createRoom(params: {
    nickname: string;
    roomTitle?: string;
    mode?: GameMode;
    initialScore?: number;
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
    if (params.nickname) setStoredNickname(params.nickname);
    return res;
  },

  // Join room
  async joinRoom(params: {
    nickname: string;
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
    if (params.nickname) setStoredNickname(params.nickname);
    return res;
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

  // Host action via HTTP
  async executeHostAction(roomId: string, payload: {
    action: 'reset_scores' | 'kick_player' | 'change_mode' | 'set_initial_score' | 'close_room';
    targetUserId?: string;
    mode?: GameMode;
    initialScore?: number;
    hostUserId?: string;
  }): Promise<{ message: string; room: Room }> {
    return request<{ message: string; room: Room }>(`/api/room/${roomId}/action`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
