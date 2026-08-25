import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Room, Session, Player, ScoreLog, GameMode, RoomRetention, DeductionProposal } from './types.js';

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

export function sanitizeAvatarInput(avatar?: string): string | undefined {
  if (!avatar || typeof avatar !== 'string') return undefined;
  const trimmed = avatar.trim();
  if (!trimmed) return undefined;
  
  // 1. Emoji or short preset (length <= 10)
  if (trimmed.length <= 10) {
    return trimmed;
  }
  
  // 2. Base64 raster image data URL (strict jpeg, png, webp, gif only - no SVG or scripts)
  if (trimmed.startsWith('data:image/')) {
    const isSafeImage = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(trimmed);
    if (isSafeImage && trimmed.length <= 80000) {
      return trimmed;
    }
  }
  
  return undefined;
}

class Database {
  private data: DatabaseSchema = {
    rooms: {},
    roomCodeMap: {},
    sessions: {},
  };
  private saveTimeout: NodeJS.Timeout | null = null;
  private dissolutionTimers: Record<string, NodeJS.Timeout> = {};

  constructor() {
    this.init();
    this.startCleanupTicker();
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
        // Normalize room fields
        for (const rid in this.data.rooms) {
          const rm = this.data.rooms[rid];
          if (!rm.retention) rm.retention = 'offline_30s';
          if (!rm.pendingDeductions) rm.pendingDeductions = {};
          // Reset any dangling countdown on boot
          rm.dissolveCountdownExpiresAt = null;
        }
        console.log(`[DB] Loaded ${Object.keys(this.data.rooms).length} rooms from ${DB_FILE}`);
      } else {
        this.persistImmediate();
      }
    } catch (err) {
      console.error('[DB] Failed to load database, initializing fresh state:', err);
      this.data = { rooms: {}, roomCodeMap: {}, sessions: {} };
    }
  }

  private startCleanupTicker() {
    // Periodic check for expired rooms (1h, 24h)
    setInterval(() => {
      const now = Date.now();
      for (const roomId in this.data.rooms) {
        const room = this.data.rooms[roomId];
        if (room.status === 'active' && room.expiresAt && now > room.expiresAt) {
          console.log(`[DB] Room ${room.code} reached expiration time (${room.retention}), closing.`);
          room.status = 'closed';
          room.updatedAt = now;
          this.persist();
        }
      }
    }, 30000);
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

  public calculateExpiresAt(retention: RoomRetention): number | null {
    const now = Date.now();
    if (retention === '1h') return now + 3600 * 1000;
    if (retention === '24h') return now + 24 * 3600 * 1000;
    if (retention === 'permanent' || retention === 'offline_30s') return null;
    return null;
  }

  public createRoom(params: {
    nickname: string;
    avatar?: string;
    roomTitle?: string;
    mode?: GameMode;
    initialScore?: number;
    retention?: RoomRetention;
  }): { room: Room; token: string; player: Player } {
    const roomId = 'rm_' + crypto.randomBytes(8).toString('hex');
    const code = this.generateRoomCode();
    const userId = 'usr_' + crypto.randomBytes(8).toString('hex');
    const token = 'tok_' + crypto.randomBytes(16).toString('hex');
    const initialScore = typeof params.initialScore === 'number' ? params.initialScore : 0;
    const mode = params.mode || 'free';
    const retention: RoomRetention = params.retention || 'offline_30s';
    const now = Date.now();
    const expiresAt = this.calculateExpiresAt(retention);
    const safeAvatar = sanitizeAvatarInput(params.avatar);

    const hostPlayer: Player = {
      id: userId,
      nickname: params.nickname.trim(),
      avatar: safeAvatar,
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
      retention: retention,
      expiresAt: expiresAt,
      dissolveCountdownExpiresAt: null,
      members: {
        [userId]: hostPlayer,
      },
      logs: [],
      pendingDeductions: {},
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
    avatar?: string;
    token?: string;
  }): { room: Room; token: string; player: Player } | { error: string } {
    const code = params.roomCode.trim().toUpperCase();
    const roomId = this.data.roomCodeMap[code] || (this.data.rooms[code] ? code : null);

    if (!roomId || !this.data.rooms[roomId]) {
      return { error: '房间不存在或房间码错误' };
    }

    const room = this.data.rooms[roomId];
    if (room.status === 'closed') {
      return { error: '该房间已被解散或已过期' };
    }

    const now = Date.now();
    const safeAvatar = sanitizeAvatarInput(params.avatar);

    // Reconnection cancels any pending offline dissolution
    if (room.dissolveCountdownExpiresAt) {
      room.dissolveCountdownExpiresAt = null;
      if (this.dissolutionTimers[roomId]) {
        clearTimeout(this.dissolutionTimers[roomId]);
        delete this.dissolutionTimers[roomId];
      }
    }

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
        if (safeAvatar) {
          room.members[sess.userId].avatar = safeAvatar;
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
      if (safeAvatar) {
        existingPlayer.avatar = safeAvatar;
      }
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
      avatar: safeAvatar,
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

  public updatePlayerAvatar(
    roomId: string,
    userId: string,
    avatar: string
  ): { room: Room; player: Player } | { error: string } {
    const room = this.getRoom(roomId);
    if (!room) return { error: '房间不存在' };
    const player = room.members[userId];
    if (!player) return { error: '玩家不存在' };

    const safeAvatar = sanitizeAvatarInput(avatar);
    player.avatar = safeAvatar;
    room.updatedAt = Date.now();
    this.persist();

    return { room, player };
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
      room.updatedAt = Date.now();
      this.persist();
    }
  }

  // Check if all users are offline in this room, trigger 30s countdown if policy is offline_30s
  public handleUserDisconnected(roomId: string, onDissolveCountdownStart?: (room: Room, countdownSec: number) => void, onRoomDissolved?: (room: Room) => void) {
    const room = this.data.rooms[roomId];
    if (!room || room.status === 'closed') return;

    const onlineMembers = Object.values(room.members).filter((m) => m.isOnline);
    if (onlineMembers.length === 0) {
      // If room is not permanent and set to offline_30s (or general auto-cleanup)
      if (room.retention === 'offline_30s') {
        const countdownSec = 30;
        const now = Date.now();
        room.dissolveCountdownExpiresAt = now + countdownSec * 1000;
        this.persist();

        if (onDissolveCountdownStart) {
          onDissolveCountdownStart(room, countdownSec);
        }

        // Cancel previous timer if any
        if (this.dissolutionTimers[roomId]) {
          clearTimeout(this.dissolutionTimers[roomId]);
        }

        this.dissolutionTimers[roomId] = setTimeout(() => {
          // Double check if still empty
          const curRoom = this.data.rooms[roomId];
          if (curRoom && curRoom.status === 'active') {
            const currentOnline = Object.values(curRoom.members).filter((m) => m.isOnline);
            if (currentOnline.length === 0) {
              console.log(`[DB] Room ${curRoom.code} auto-dissolved after 30s empty timeout.`);
              curRoom.status = 'closed';
              curRoom.dissolveCountdownExpiresAt = null;
              curRoom.updatedAt = Date.now();
              this.persist();
              if (onRoomDissolved) {
                onRoomDissolved(curRoom);
              }
            }
          }
          delete this.dissolutionTimers[roomId];
        }, countdownSec * 1000);
      }
    }
  }

  public cancelDissolveCountdown(roomId: string): boolean {
    const room = this.data.rooms[roomId];
    if (room && room.dissolveCountdownExpiresAt) {
      room.dissolveCountdownExpiresAt = null;
      if (this.dissolutionTimers[roomId]) {
        clearTimeout(this.dissolutionTimers[roomId]);
        delete this.dissolutionTimers[roomId];
      }
      this.persist();
      return true;
    }
    return false;
  }

  // Create Deduction Proposal (When someone tries to deduct points from another player)
  public createDeductionProposal(params: {
    roomId: string;
    fromUserId: string;
    targetUserId: string;
    amount: number; // positive number of deduction, e.g. 10
    note?: string;
  }): { proposal: DeductionProposal; room: Room } | { error: string } {
    const room = this.data.rooms[params.roomId];
    if (!room) return { error: '房间不存在' };
    if (room.status === 'closed') return { error: '房间已解散' };

    const fromUser = room.members[params.fromUserId];
    const targetUser = room.members[params.targetUserId];
    if (!fromUser || !targetUser) return { error: '玩家不存在于房间中' };

    const proposalId = 'prop_' + crypto.randomBytes(8).toString('hex');
    const now = Date.now();

    const proposal: DeductionProposal = {
      id: proposalId,
      roomId: room.id,
      fromUserId: fromUser.id,
      fromNickname: fromUser.nickname,
      targetUserId: targetUser.id,
      targetNickname: targetUser.nickname,
      amount: Math.abs(params.amount),
      note: params.note?.trim() || undefined,
      status: 'pending',
      createdAt: now,
    };

    if (!room.pendingDeductions) room.pendingDeductions = {};
    room.pendingDeductions[proposalId] = proposal;
    room.updatedAt = now;
    this.persist();

    return { proposal, room };
  }

  // Respond to Deduction Proposal (Target accepts or rejects)
  public respondToDeductionProposal(params: {
    roomId: string;
    proposalId: string;
    responderUserId: string;
    accepted: boolean;
  }): { room: Room; proposal: DeductionProposal; newLog?: ScoreLog } | { error: string } {
    const room = this.data.rooms[params.roomId];
    if (!room) return { error: '房间不存在' };
    if (!room.pendingDeductions || !room.pendingDeductions[params.proposalId]) {
      return { error: '扣分申请不存在或已过期' };
    }

    const proposal = room.pendingDeductions[params.proposalId];
    if (proposal.targetUserId !== params.responderUserId) {
      return { error: '只能由被扣分玩家本人进行确认' };
    }

    if (proposal.status !== 'pending') {
      return { error: '该扣分申请已被处理' };
    }

    const now = Date.now();
    const fromUser = room.members[proposal.fromUserId];
    const targetUser = room.members[proposal.targetUserId];

    if (params.accepted) {
      proposal.status = 'accepted';

      if (targetUser) {
        // Execute deduction
        targetUser.score -= proposal.amount;

        // If zero-sum mode, fromUser receives the deducted amount
        if (room.mode === 'zero_sum' && fromUser) {
          fromUser.score += proposal.amount;
        }

        const log: ScoreLog = {
          id: 'log_' + crypto.randomBytes(8).toString('hex'),
          roomId: room.id,
          fromUserId: proposal.fromUserId,
          fromNickname: proposal.fromNickname,
          toUserId: targetUser.id,
          toNickname: targetUser.nickname,
          amount: -proposal.amount,
          mode: room.mode,
          note: proposal.note ? `[本人已同意] ${proposal.note}` : `[本人已同意扣分]`,
          timestamp: now,
        };

        room.logs.unshift(log);
        if (room.logs.length > 500) room.logs = room.logs.slice(0, 500);

        room.updatedAt = now;
        delete room.pendingDeductions[params.proposalId];
        this.persist();

        return { room, proposal, newLog: log };
      }
    } else {
      proposal.status = 'rejected';
      room.updatedAt = now;
      delete room.pendingDeductions[params.proposalId];
      this.persist();

      return { room, proposal };
    }

    return { error: '处理失败' };
  }

  // Direct score submit (Positive score additions or Host authorized adjustments)
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
    action: 'reset_scores' | 'kick_player' | 'change_mode' | 'set_initial_score' | 'set_retention' | 'close_room';
    targetUserId?: string;
    mode?: GameMode;
    initialScore?: number;
    retention?: RoomRetention;
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

      case 'set_retention': {
        if (!params.retention) {
          return { error: '请选择有效的房间保留策略' };
        }
        room.retention = params.retention;
        room.expiresAt = this.calculateExpiresAt(params.retention);
        room.dissolveCountdownExpiresAt = null;
        room.updatedAt = now;
        this.persist();

        const labelMap: Record<RoomRetention, string> = {
          'offline_30s': '全员离线30秒解散',
          '1h': '保留1小时',
          '24h': '保留24小时',
          'permanent': '永久保留'
        };
        return { room, message: `房间生命周期已设为：${labelMap[params.retention]}` };
      }

      case 'close_room': {
        room.status = 'closed';
        room.dissolveCountdownExpiresAt = null;
        room.updatedAt = now;
        this.persist();
        return { room, message: '房间已成功解散' };
      }

      default:
        return { error: '未知管理指令' };
    }
  }

  // Admin: Get all rooms list on server
  public getAllRoomsForAdmin(): any[] {
    const list: any[] = [];
    for (const roomId in this.data.rooms) {
      const r = this.data.rooms[roomId];
      const members = Object.values(r.members);
      const onlineCount = members.filter((m) => m.isOnline).length;
      const host = r.members[r.hostId];

      list.push({
        id: r.id,
        code: r.code,
        title: r.title,
        mode: r.mode,
        hostNickname: host?.nickname || '未知',
        memberCount: members.length,
        onlineCount: onlineCount,
        status: r.status,
        retention: r.retention || 'offline_30s',
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        expiresAt: r.expiresAt,
        dissolveCountdownExpiresAt: r.dissolveCountdownExpiresAt,
      });
    }

    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // Admin: Delete or dissolve room completely
  public adminDeleteRoom(roomId: string, hardDelete: boolean = true): { success: boolean; roomTitle?: string; roomCode?: string } {
    const room = this.data.rooms[roomId];
    if (!room) {
      return { success: false };
    }

    const roomTitle = room.title;
    const roomCode = room.code;

    // 1. Cancel any active dissolution countdown timer
    this.cancelDissolveCountdown(roomId);

    // 2. Clean up all sessions tied to this room
    for (const token in this.data.sessions) {
      if (this.data.sessions[token].roomId === roomId) {
        delete this.data.sessions[token];
      }
    }

    // 3. Mark closed & remove from database
    if (hardDelete) {
      delete this.data.rooms[roomId];
    } else {
      room.status = 'closed';
      room.dissolveCountdownExpiresAt = null;
      room.updatedAt = Date.now();
    }

    this.persist();
    return { success: true, roomTitle, roomCode };
  }

  public adminUpdateRetention(roomId: string, retention: RoomRetention): Room | null {
    const room = this.data.rooms[roomId];
    if (room) {
      room.retention = retention;
      room.expiresAt = this.calculateExpiresAt(retention);
      room.dissolveCountdownExpiresAt = null;
      room.updatedAt = Date.now();
      this.persist();
      return room;
    }
    return null;
  }
}

export const db = new Database();

