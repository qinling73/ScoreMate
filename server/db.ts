import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Room, Session, Player, ScoreLog, GameMode } from './types.js';

interface DatabaseSchema {
  rooms: Record<string, Room>; // key: roomId
  roomCodeMap: Record<string, string>; // code -> roomId
  sessions: Record<string, Session>; // token -> Session
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

const AVATAR_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#14b8a6',
  '#f97316', '#e11d48'
];

class Database {
  private data: DatabaseSchema = {
    rooms: {},
    roomCodeMap: {},
    sessions: {},
  };
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          rooms: parsed.rooms || {},
          roomCodeMap: parsed.roomCodeMap || {},
          sessions: parsed.sessions || {},
        };
        console.log(`[DB] Loaded ${Object.keys(this.data.rooms).length} rooms from ${DB_FILE}`);
      } else {
        this.persistImmediate();
      }
    } catch (err) {
      console.error('[DB] Failed to load database, initializing fresh state:', err);
      this.data = { rooms: {}, roomCodeMap: {}, sessions: {} };
    }
  }

  private persist() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.persistImmediate();
    }, 100);
  }

  private persistImmediate() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error('[DB] Persist error:', err);
    }
  }

  public generateRoomCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude confusing chars (0,1,I,O)
    let code = '';
    for (let attempt = 0; attempt < 100; attempt++) {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (!this.data.roomCodeMap[code]) {
        return code;
      }
    }
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  public createRoom(params: {
    nickname: string;
    roomTitle?: string;
    mode?: GameMode;
    initialScore?: number;
  }): { room: Room; token: string; player: Player } {
    const roomId = 'rm_' + crypto.randomBytes(8).toString('hex');
    const code = this.generateRoomCode();
    const userId = 'usr_' + crypto.randomBytes(8).toString('hex');
    const token = 'tok_' + crypto.randomBytes(16).toString('hex');
    const initialScore = typeof params.initialScore === 'number' ? params.initialScore : 0;
    const mode = params.mode || 'free';
    const now = Date.now();

    const hostPlayer: Player = {
      id: userId,
      nickname: params.nickname.trim(),
      score: initialScore,
      isHost: true,
      isOnline: true,
      joinedAt: now,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    };

    const newRoom: Room = {
      id: roomId,
      code: code,
      title: params.roomTitle?.trim() || `${params.nickname.trim()}的记分房间`,
      mode: mode,
      initialScore: initialScore,
      hostId: userId,
      createdAt: now,
      updatedAt: now,
      status: 'active',
      members: {
        [userId]: hostPlayer,
      },
      logs: [],
    };

    const session: Session = {
      token,
      userId,
      roomId,
      nickname: params.nickname.trim(),
      createdAt: now,
      lastActiveAt: now,
    };

    this.data.rooms[roomId] = newRoom;
    this.data.roomCodeMap[code] = roomId;
    this.data.sessions[token] = session;
    this.persist();

    return { room: newRoom, token, player: hostPlayer };
  }

  public joinRoom(params: {
    roomCode: string;
    nickname: string;
    token?: string;
  }): { room: Room; token: string; player: Player } | { error: string } {
    const code = params.roomCode.trim().toUpperCase();
    const roomId = this.data.roomCodeMap[code] || (this.data.rooms[code] ? code : null);

    if (!roomId || !this.data.rooms[roomId]) {
      return { error: '房间不存在或房间码错误' };
    }

    const room = this.data.rooms[roomId];
    if (room.status === 'closed') {
      return { error: '该房间已被房主解散' };
    }

    const now = Date.now();

    // Check if user has an existing session token for this room
    if (params.token && this.data.sessions[params.token]) {
      const sess = this.data.sessions[params.token];
      if (sess.roomId === roomId && room.members[sess.userId]) {
        sess.lastActiveAt = now;
        room.members[sess.userId].isOnline = true;
        if (params.nickname && params.nickname.trim() !== '') {
          room.members[sess.userId].nickname = params.nickname.trim();
          sess.nickname = params.nickname.trim();
        }
        room.updatedAt = now;
        this.persist();
        return { room, token: params.token, player: room.members[sess.userId] };
      }
    }

    // Check if nickname already exists in room
    const existingPlayer = Object.values(room.members).find(
      (m) => m.nickname.toLowerCase() === params.nickname.trim().toLowerCase()
    );

    if (existingPlayer) {
      // Re-claim this player identity and create fresh token
      const newToken = 'tok_' + crypto.randomBytes(16).toString('hex');
      this.data.sessions[newToken] = {
        token: newToken,
        userId: existingPlayer.id,
        roomId,
        nickname: existingPlayer.nickname,
        createdAt: now,
        lastActiveAt: now,
      };
      existingPlayer.isOnline = true;
      room.updatedAt = now;
      this.persist();
      return { room, token: newToken, player: existingPlayer };
    }

    // New player join
    const userId = 'usr_' + crypto.randomBytes(8).toString('hex');
    const newToken = 'tok_' + crypto.randomBytes(16).toString('hex');
    const colorIndex = Object.keys(room.members).length % AVATAR_COLORS.length;

    const newPlayer: Player = {
      id: userId,
      nickname: params.nickname.trim(),
      score: room.initialScore,
      isHost: Object.keys(room.members).length === 0,
      isOnline: true,
      joinedAt: now,
      avatarColor: AVATAR_COLORS[colorIndex],
    };

    if (newPlayer.isHost) {
      room.hostId = userId;
    }

    room.members[userId] = newPlayer;
    room.updatedAt = now;

    this.data.sessions[newToken] = {
      token: newToken,
      userId,
      roomId,
      nickname: newPlayer.nickname,
      createdAt: now,
      lastActiveAt: now,
    };

    this.persist();
    return { room, token: newToken, player: newPlayer };
  }

  public getSession(token: string): Session | null {
    if (!token) return null;
    return this.data.sessions[token] || null;
  }

  public getRoom(roomIdOrCode: string): Room | null {
    if (!roomIdOrCode) return null;
    const direct = this.data.rooms[roomIdOrCode];
    if (direct) return direct;
    const byCode = this.data.roomCodeMap[roomIdOrCode.toUpperCase()];
    if (byCode && this.data.rooms[byCode]) return this.data.rooms[byCode];
    return null;
  }

  public setUserOnline(roomId: string, userId: string, isOnline: boolean) {
    const room = this.data.rooms[roomId];
    if (room && room.members[userId]) {
      room.members[userId].isOnline = isOnline;
      this.persist();
    }
  }

  public submitScore(params: {
    roomId: string;
    fromUserId: string;
    targetUserIds: string[];
    amount: number;
    note?: string;
  }): { room: Room; newLogs: ScoreLog[] } | { error: string } {
    const room = this.data.rooms[params.roomId];
    if (!room) return { error: '房间不存在' };
    if (room.status === 'closed') return { error: '房间已解散' };

    const fromUser = room.members[params.fromUserId];
    if (!fromUser) return { error: '给分玩家不存在于房间中' };

    const validTargets = params.targetUserIds.filter((id) => room.members[id]);
    if (validTargets.length === 0) return { error: '请选择至少一名有效受分玩家' };

    const amount = Number(params.amount);
    if (isNaN(amount) || amount === 0) return { error: '分数必须为非零数值' };

    const now = Date.now();
    const newLogs: ScoreLog[] = [];

    // Mode: Free vs Zero-sum
    if (room.mode === 'zero_sum') {
      // In zero-sum mode: if giving +amount to each target, fromUser loses amount * count
      const totalCost = amount * validTargets.length;
      fromUser.score -= totalCost;
    }

    for (const targetId of validTargets) {
      const targetUser = room.members[targetId];
      targetUser.score += amount;

      const log: ScoreLog = {
        id: 'log_' + crypto.randomBytes(8).toString('hex'),
        roomId: room.id,
        fromUserId: fromUser.id,
        fromNickname: fromUser.nickname,
        toUserId: targetUser.id,
        toNickname: targetUser.nickname,
        amount: amount,
        mode: room.mode,
        note: params.note?.trim() || undefined,
        timestamp: now,
      };

      room.logs.unshift(log);
      newLogs.push(log);
    }

    // Keep maximum 500 logs per room
    if (room.logs.length > 500) {
      room.logs = room.logs.slice(0, 500);
    }

    room.updatedAt = now;
    this.persist();

    return { room, newLogs };
  }

  public handleHostAction(params: {
    roomId: string;
    hostUserId: string;
    action: 'reset_scores' | 'kick_player' | 'change_mode' | 'set_initial_score' | 'close_room';
    targetUserId?: string;
    mode?: GameMode;
    initialScore?: number;
  }): { room: Room; message: string } | { error: string } {
    const room = this.data.rooms[params.roomId];
    if (!room) return { error: '房间不存在' };

    if (room.hostId !== params.hostUserId) {
      return { error: '仅房主有权执行此管理操作' };
    }

    const now = Date.now();

    switch (params.action) {
      case 'reset_scores': {
        const resetScore = typeof params.initialScore === 'number' ? params.initialScore : room.initialScore;
        for (const uid in room.members) {
          room.members[uid].score = resetScore;
        }
        const log: ScoreLog = {
          id: 'log_' + crypto.randomBytes(8).toString('hex'),
          roomId: room.id,
          fromUserId: params.hostUserId,
          fromNickname: room.members[params.hostUserId]?.nickname || '房主',
          toUserId: 'all',
          toNickname: '全员',
          amount: 0,
          mode: room.mode,
          note: `房主重置全员分数为 ${resetScore}`,
          timestamp: now,
        };
        room.logs.unshift(log);
        room.updatedAt = now;
        this.persist();
        return { room, message: `全员分数已重置为 ${resetScore}` };
      }

      case 'kick_player': {
        if (!params.targetUserId || !room.members[params.targetUserId]) {
          return { error: '目标玩家不存在' };
        }
        if (params.targetUserId === room.hostId) {
          return { error: '房主无法踢出自己' };
        }
        const kickedName = room.members[params.targetUserId].nickname;
        delete room.members[params.targetUserId];
        const log: ScoreLog = {
          id: 'log_' + crypto.randomBytes(8).toString('hex'),
          roomId: room.id,
          fromUserId: params.hostUserId,
          fromNickname: room.members[params.hostUserId]?.nickname || '房主',
          toUserId: params.targetUserId,
          toNickname: kickedName,
          amount: 0,
          mode: room.mode,
          note: `房主将玩家【${kickedName}】移出房间`,
          timestamp: now,
        };
        room.logs.unshift(log);
        room.updatedAt = now;
        this.persist();
        return { room, message: `已将玩家 ${kickedName} 移出房间` };
      }

      case 'change_mode': {
        if (!params.mode || (params.mode !== 'free' && params.mode !== 'zero_sum')) {
          return { error: '无效的记分模式' };
        }
        room.mode = params.mode;
        const modeName = params.mode === 'free' ? '自由模式 (赠分不扣己)' : '零和/筹码模式 (转分互扣)';
        const log: ScoreLog = {
          id: 'log_' + crypto.randomBytes(8).toString('hex'),
          roomId: room.id,
          fromUserId: params.hostUserId,
          fromNickname: room.members[params.hostUserId]?.nickname || '房主',
          toUserId: 'room',
          toNickname: '房间规则',
          amount: 0,
          mode: room.mode,
          note: `切换记分模式为：${modeName}`,
          timestamp: now,
        };
        room.logs.unshift(log);
        room.updatedAt = now;
        this.persist();
        return { room, message: `模式已切换为 ${modeName}` };
      }

      case 'set_initial_score': {
        if (typeof params.initialScore !== 'number') {
          return { error: '无效的初始分数' };
        }
        room.initialScore = params.initialScore;
        room.updatedAt = now;
        this.persist();
        return { room, message: `新进成员初始分已设置为 ${params.initialScore}` };
      }

      case 'close_room': {
        room.status = 'closed';
        room.updatedAt = now;
        this.persist();
        return { room, message: '房间已成功解散' };
      }

      default:
        return { error: '未知管理指令' };
    }
  }
}

export const db = new Database();
