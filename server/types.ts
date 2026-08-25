export type GameMode = 'free' | 'zero_sum';

export interface Player {
  id: string;
  nickname: string;
  score: number;
  isHost: boolean;
  isOnline: boolean;
  joinedAt: number;
  avatarColor: string;
}

export interface ScoreLog {
  id: string;
  roomId: string;
  fromUserId: string;
  fromNickname: string;
  toUserId: string;
  toNickname: string;
  amount: number;
  mode: GameMode;
  note?: string;
  timestamp: number;
}

export interface Room {
  id: string;
  code: string; // 6-digit uppercase alphanumeric
  title: string;
  mode: GameMode;
  initialScore: number;
  hostId: string;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'closed';
  members: Record<string, Player>;
  logs: ScoreLog[];
}

export interface Session {
  token: string;
  userId: string;
  roomId: string;
  nickname: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface CreateRoomRequest {
  nickname: string;
  roomTitle?: string;
  mode?: GameMode;
  initialScore?: number;
}

export interface JoinRoomRequest {
  nickname: string;
  roomCode: string;
  token?: string;
}

export interface SubmitScorePayload {
  fromUserId: string;
  targetUserIds: string[];
  amount: number;
  note?: string;
}

export interface RoomActionPayload {
  action: 'reset_scores' | 'kick_player' | 'change_mode' | 'set_initial_score' | 'close_room';
  targetUserId?: string;
  mode?: GameMode;
  initialScore?: number;
}
