export type GameMode = 'free' | 'zero_sum';

export type RoomRetention = 'offline_30s' | '1h' | '24h' | 'permanent';

export interface Player {
  id: string;
  nickname: string;
  avatar?: string;
  avatarColor: string;
  score: number;
  isHost: boolean;
  isOnline: boolean;
  joinedAt: number;
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

export interface DeductionProposal {
  id: string;
  roomId: string;
  fromUserId: string;
  fromNickname: string;
  targetUserId: string;
  targetNickname: string;
  amount: number;
  note?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: number;
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
  retention: RoomRetention;
  expiresAt?: number | null;
  dissolveCountdownExpiresAt?: number | null;
  members: Record<string, Player>;
  logs: ScoreLog[];
  pendingDeductions?: Record<string, DeductionProposal>;
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

export interface ServerRoomSummary {
  id: string;
  code: string;
  title: string;
  mode: GameMode;
  hostNickname: string;
  memberCount: number;
  onlineCount: number;
  status: 'active' | 'closed';
  retention: RoomRetention;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number | null;
  dissolveCountdownExpiresAt?: number | null;
}

