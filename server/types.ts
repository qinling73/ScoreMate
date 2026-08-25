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
  amount: number; // positive number representing the deduction magnitude (e.g. 10 means deduct 10)
  note?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: number;
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
  retention: RoomRetention;
  expiresAt?: number | null; // null for permanent
  dissolveCountdownExpiresAt?: number | null; // timestamp when 30s countdown ends
  members: Record<string, Player>;
  logs: ScoreLog[];
  pendingDeductions?: Record<string, DeductionProposal>;
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
  retention?: RoomRetention;
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
  requireApprovalForDeduction?: boolean;
}

export interface DeductionResponsePayload {
  proposalId: string;
  accepted: boolean;
  responderUserId: string;
}

export interface RoomActionPayload {
  action: 'reset_scores' | 'kick_player' | 'change_mode' | 'set_initial_score' | 'set_retention' | 'close_room';
  targetUserId?: string;
  mode?: GameMode;
  initialScore?: number;
  retention?: RoomRetention;
}

