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
  code: string;
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

export interface UserSession {
  token: string;
  userId: string;
  nickname: string;
  roomId: string;
}

export interface ScoreUpdateBroadcast {
  room: Room;
  leaderboard: Player[];
  newLogs: ScoreLog[];
  actorUserId: string;
  timestamp: number;
}

export interface RoomActionBroadcast {
  action: string;
  message: string;
  room: Room;
  leaderboard: Player[];
  targetUserId?: string;
  timestamp: number;
}
