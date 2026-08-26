import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db.js';
import { CreateRoomRequest, JoinRoomRequest, SubmitScorePayload, RoomActionPayload } from '../types.js';
import { broadcastRoomDissolved } from '../socket.js';

export const roomRouter = Router();

// Helper to extract client IP from headers or socket
export function getClientIp(req: Request): string {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    const firstIp = ips.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp) {
    return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
  }
  return req.socket.remoteAddress || req.ip || '';
}

// Checks if an IP is internal/private or localhost (RFC 1918 / Loopback / Link-local)
export function isInternalIp(rawIp?: string): boolean {
  if (!rawIp) return false;
  let ip = rawIp.trim();

  // Strip IPv6 prefix for IPv4-mapped addresses
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  // Loopback (127.0.0.1, ::1, localhost, 0.0.0.0)
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip === '0.0.0.0') {
    return true;
  }

  // 10.0.0.0/8 (10.0.0.0 - 10.255.255.255)
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return true;
  }

  // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  const match172 = ip.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (match172) {
    const second = parseInt(match172[1], 10);
    if (second >= 16 && second <= 31) {
      return true;
    }
  }

  // 192.168.0.0/16 (192.168.0.0 - 192.168.255.255)
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return true;
  }

  // 169.254.0.0/16 (Link-local)
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return true;
  }

  // IPv6 Link-Local / Unique-Local
  if (/^fe80:/i.test(ip) || /^fc00:/i.test(ip) || /^fd00:/i.test(ip)) {
    return true;
  }

  return false;
}

// Check admin access authorization
export function evaluateAdminAccess(req: Request): { hasAccess: boolean; clientIp: string; isInternal: boolean; reason: string } {
  const clientIp = getClientIp(req);
  const isInternal = isInternalIp(clientIp);
  const adminKey = (req.headers?.['x-admin-key'] as string) || (req.query?.adminKey as string);
  const configuredSecret = process.env.ADMIN_SECRET || 'admin888';

  if (isInternal) {
    return {
      hasAccess: true,
      clientIp,
      isInternal: true,
      reason: '已识别为内网/本地IP访问，自动授权',
    };
  }

  if (adminKey && adminKey === configuredSecret) {
    return {
      hasAccess: true,
      clientIp,
      isInternal: false,
      reason: '已通过管理员专用密钥认证',
    };
  }

  return {
    hasAccess: false,
    clientIp,
    isInternal: false,
    reason: '当前为公网IP访问，请在 /ra 路径输入管理员密码完成认证',
  };
}

// Middleware: restrict admin routes to internal IP only
function requireInternalAdmin(req: Request, res: Response, next: NextFunction): void {
  const access = evaluateAdminAccess(req);
  if (!access.hasAccess) {
    res.status(403).json({
      error: '无权访问：服务器房间后台仅限内网/局域网IP访问',
      clientIp: access.clientIp,
      isInternal: access.isInternal,
    });
    return;
  }
  next();
}

// Helper to extract session token from Authorization header or body
function getSessionToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return req.body?.token || (req.query?.token as string) || undefined;
}

// POST /api/room/create - Create room
roomRouter.post('/create', (req: Request, res: Response): void => {
  try {
    const { nickname, avatar, roomTitle, mode, initialScore, retention } = req.body as CreateRoomRequest & { avatar?: string };

    if (!nickname || typeof nickname !== 'string' || nickname.trim().length < 1 || nickname.trim().length > 20) {
      res.status(400).json({ error: '昵称长度需在 1 到 20 个字符之间' });
      return;
    }

    const { room, token, player } = db.createRoom({
      nickname: nickname.trim(),
      avatar,
      roomTitle,
      mode: mode === 'zero_sum' ? 'zero_sum' : 'free',
      initialScore: typeof initialScore === 'number' ? initialScore : 0,
      retention: retention || 'offline_30s',
    });

    res.status(200).json({
      success: true,
      roomId: room.id,
      roomCode: room.code,
      token,
      player,
      room,
    });
  } catch (err: any) {
    console.error('[API] /create error:', err);
    res.status(500).json({ error: '创建房间失败：' + (err?.message || '服务器内部错误') });
  }
});


// POST /api/room/join - Join room with nickname & code (or session token)
roomRouter.post('/join', (req: Request, res: Response): void => {
  try {
    const { nickname, avatar, roomCode, token: bodyToken } = req.body as JoinRoomRequest & { avatar?: string };
    const token = bodyToken || getSessionToken(req);

    if (!roomCode || typeof roomCode !== 'string') {
      res.status(400).json({ error: '请输入有效的房间码' });
      return;
    }

    if (!nickname || typeof nickname !== 'string' || nickname.trim().length < 1) {
      res.status(400).json({ error: '请输入玩家昵称' });
      return;
    }

    const result = db.joinRoom({
      roomCode: roomCode.trim(),
      nickname: nickname.trim(),
      avatar,
      token,
    });

    if ('error' in result) {
      const isNotFound = result.error.includes('不存在') || result.error.includes('已解散') || result.error.includes('已过期');
      res.status(isNotFound ? 404 : 400).json({ error: result.error });
      return;
    }

    res.status(200).json({
      success: true,
      roomId: result.room.id,
      roomCode: result.room.code,
      token: result.token,
      player: result.player,
      room: result.room,
    });
  } catch (err: any) {
    console.error('[API] /join error:', err);
    res.status(500).json({ error: '加入房间失败：' + (err?.message || '服务器内部错误') });
  }
});

// POST /api/room/:roomId/avatar - Update current player avatar
roomRouter.post('/:roomId/avatar', (req: Request, res: Response): void => {
  try {
    const { roomId } = req.params;
    const token = getSessionToken(req);
    const { avatar } = req.body;

    if (!token) {
      res.status(401).json({ error: '未授权或登录状态已失效' });
      return;
    }

    const session = db.getSession(token);
    if (!session || session.roomId !== roomId) {
      res.status(401).json({ error: '无效的用户会话' });
      return;
    }

    const result = db.updatePlayerAvatar(roomId, session.userId, avatar);
    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(200).json({
      success: true,
      player: result.player,
      room: result.room,
    });
  } catch (err: any) {
    console.error('[API] /avatar update error:', err);
    res.status(500).json({ error: '更新头像失败：' + (err?.message || '服务器内部错误') });
  }
});

// GET /api/room/:roomId - Get room details & sorted leaderboard
roomRouter.get('/:roomId', (req: Request, res: Response): void => {
  try {
    const { roomId } = req.params;
    const room = db.getRoom(roomId);

    if (!room) {
      res.status(404).json({ error: '房间不存在或已过期' });
      return;
    }

    // Leaderboard sorted by score desc
    const leaderboard = Object.values(room.members).sort((a, b) => b.score - a.score);

    res.status(200).json({
      success: true,
      room,
      leaderboard,
    });
  } catch (err: any) {
    console.error('[API] /:roomId error:', err);
    res.status(500).json({ error: '获取房间信息失败' });
  }
});

// GET /api/room/:roomId/logs - Get room score logs
roomRouter.get('/:roomId/logs', (req: Request, res: Response): void => {
  try {
    const { roomId } = req.params;
    const room = db.getRoom(roomId);

    if (!room) {
      res.status(404).json({ error: '房间不存在' });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const logs = room.logs.slice(0, limit);

    res.status(200).json({
      success: true,
      logs,
      total: room.logs.length,
    });
  } catch (err: any) {
    console.error('[API] /:roomId/logs error:', err);
    res.status(500).json({ error: '获取明细失败' });
  }
});

// POST /api/room/:roomId/score - RESTful fallback for score submit & deduction approval
roomRouter.post('/:roomId/score', (req: Request, res: Response): void => {
  try {
    const { roomId } = req.params;
    const { fromUserId, targetUserIds, amount, note, requireApprovalForDeduction = true } = req.body as SubmitScorePayload;

    if (!roomId || !fromUserId || !targetUserIds || !targetUserIds.length) {
      res.status(400).json({ error: '参数不完整' });
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount === 0) {
      res.status(400).json({ error: '请输入有效的非零数值' });
      return;
    }

    const room = db.getRoom(roomId);
    if (!room) {
      res.status(404).json({ error: '房间不存在' });
      return;
    }

    // If deducting points (amount < 0) from other players, create proposals requiring consent
    if (numAmount < 0 && requireApprovalForDeduction) {
      const proposals = [];
      const directTargets = [];

      for (const targetId of targetUserIds) {
        if (targetId === fromUserId) {
          directTargets.push(targetId);
        } else {
          const propRes = db.createDeductionProposal({
            roomId,
            fromUserId,
            targetUserId: targetId,
            amount: Math.abs(numAmount),
            note,
          });
          if ('proposal' in propRes) {
            proposals.push(propRes.proposal);
          }
        }
      }

      if (directTargets.length > 0) {
        db.submitScore({
          roomId,
          fromUserId,
          targetUserIds: directTargets,
          amount: numAmount,
          note,
        });
      }

      const freshRoom = db.getRoom(roomId) || room;
      res.status(200).json({
        success: true,
        requiresConsent: proposals.length > 0,
        proposals,
        room: freshRoom,
      });
      return;
    }

    const result = db.submitScore({
      roomId,
      fromUserId,
      targetUserIds,
      amount: numAmount,
      note,
    });

    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(200).json({
      success: true,
      room: result.room,
      newLogs: result.newLogs,
    });
  } catch (err: any) {
    console.error('[API] /:roomId/score error:', err);
    res.status(500).json({ error: '提交分数失败' });
  }
});

// POST /api/room/:roomId/action - Host actions
roomRouter.post('/:roomId/action', (req: Request, res: Response): void => {
  try {
    const { roomId } = req.params;
    const token = getSessionToken(req);
    const session = token ? db.getSession(token) : null;
    const hostUserId = req.body.hostUserId || session?.userId;

    if (!hostUserId) {
      res.status(401).json({ error: '请提供有效的房主身份凭据' });
      return;
    }

    const room = db.getRoom(roomId);
    if (!room) {
      res.status(404).json({ error: '房间不存在' });
      return;
    }

    if (room.hostId !== hostUserId) {
      res.status(403).json({ error: '只有房主有权执行此操作' });
      return;
    }

    const { action, targetUserId, mode, initialScore, retention } = req.body as RoomActionPayload;

    const result = db.handleHostAction({
      roomId,
      hostUserId,
      action,
      targetUserId,
      mode,
      initialScore,
      retention,
    });

    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(200).json({
      success: true,
      message: result.message,
      room: result.room,
    });
  } catch (err: any) {
    console.error('[API] /:roomId/action error:', err);
    res.status(500).json({ error: '执行操作失败' });
  }
});

const handleDeductionResponse = (req: Request, res: Response): void => {
  try {
    const { roomId } = req.params;
    const { proposalId, accepted, responderUserId } = req.body;

    if (!proposalId || !responderUserId) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }

    const room = db.getRoom(roomId);
    if (!room) {
      res.status(404).json({ error: '房间不存在' });
      return;
    }

    const proposal = room.pendingDeductions?.[proposalId];
    if (!proposal) {
      res.status(400).json({ error: '扣分申请不存在或已被处理' });
      return;
    }

    if (proposal.targetUserId !== responderUserId) {
      res.status(403).json({ error: '只有被扣分玩家本人有权确认或拒绝扣分' });
      return;
    }

    const result = db.respondToDeductionProposal({
      roomId,
      proposalId,
      responderUserId,
      accepted: Boolean(accepted),
    });

    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(200).json({
      success: true,
      accepted: Boolean(accepted),
      room: result.room,
      proposal: result.proposal,
      newLog: result.newLog,
    });
  } catch (err: any) {
    console.error('[API] /deduction/respond error:', err);
    res.status(500).json({ error: '处理扣分申请失败' });
  }
};

// POST /api/room/:roomId/deduction/respond and alias /respond-deduction
roomRouter.post('/:roomId/deduction/respond', handleDeductionResponse);
roomRouter.post('/:roomId/respond-deduction', handleDeductionResponse);

// POST /api/room/admin/auth - Authenticate admin credentials for /ra route
roomRouter.post('/admin/auth', (req: Request, res: Response): void => {
  try {
    const password = req.body?.password || req.body?.adminKey;
    const configuredSecret = process.env.ADMIN_SECRET || 'admin888';
    const clientIp = getClientIp(req);
    const isInternal = isInternalIp(clientIp);

    if (isInternal) {
      res.status(200).json({
        success: true,
        adminKey: configuredSecret,
        clientIp,
        isInternal: true,
        message: '内网环境已自动授权',
      });
      return;
    }

    if (!password) {
      res.status(400).json({ error: '请输入管理员密码' });
      return;
    }

    if (password === configuredSecret) {
      res.status(200).json({
        success: true,
        adminKey: configuredSecret,
        clientIp,
        isInternal: false,
        message: '管理员身份认证成功',
      });
    } else {
      res.status(401).json({ error: '管理员密码错误，请重新输入' });
    }
  } catch (err: any) {
    res.status(500).json({ error: '认证服务异常: ' + (err?.message || '') });
  }
});

// GET /api/room/admin/access-check - Check whether client IP has admin privileges (internal network or valid key)
roomRouter.get('/admin/access-check', (req: Request, res: Response): void => {
  try {
    const access = evaluateAdminAccess(req);
    res.status(200).json({
      success: true,
      hasAdminAccess: access.hasAccess,
      clientIp: access.clientIp,
      isInternal: access.isInternal,
      reason: access.reason,
    });
  } catch (err: any) {
    res.status(500).json({
      hasAdminAccess: false,
      error: '权限检测异常: ' + (err?.message || ''),
    });
  }
});

// GET /api/room/admin/all - Server room management list (Protected: Internal IP only)
roomRouter.get('/admin/all', requireInternalAdmin, (req: Request, res: Response): void => {
  try {
    const rooms = db.getAllRoomsForAdmin();
    res.status(200).json({
      success: true,
      rooms,
      total: rooms.length,
    });
  } catch (err: any) {
    console.error('[API] /admin/all error:', err);
    res.status(500).json({ error: '获取服务器房间列表失败' });
  }
});

// POST /api/room/admin/room/:roomId/delete - Admin dissolve & purge room (Protected: Internal IP only)
roomRouter.post('/admin/room/:roomId/delete', requireInternalAdmin, (req: Request, res: Response): void => {
  try {
    const { roomId } = req.params;
    const { hardDelete = true, reason } = req.body || {};

    // 1. Broadcast immediate dissolution notification to all sockets in that room
    broadcastRoomDissolved(
      roomId,
      reason || '管理员已在后台管理中强制解散并清除了该房间'
    );

    // 2. Perform database purge and timer cancellation
    const result = db.adminDeleteRoom(roomId, Boolean(hardDelete));
    if (!result.success) {
      res.status(404).json({ error: '房间不存在或已被删除' });
      return;
    }

    res.status(200).json({
      success: true,
      message: `房间【${result.roomCode || roomId}】已强制解散并完全清理`,
      roomCode: result.roomCode,
    });
  } catch (err: any) {
    console.error('[API] /admin/room/:roomId/delete error:', err);
    res.status(500).json({ error: '解散房间失败：' + (err?.message || '') });
  }
});

// POST /api/room/admin/room/:roomId/retention - Admin update retention (Protected: Internal IP only)
roomRouter.post('/admin/room/:roomId/retention', requireInternalAdmin, (req: Request, res: Response): void => {
  try {
    const { roomId } = req.params;
    const { retention } = req.body;
    if (!retention) {
      res.status(400).json({ error: '请选择保留策略' });
      return;
    }
    const updatedRoom = db.adminUpdateRetention(roomId, retention);
    if (!updatedRoom) {
      res.status(404).json({ error: '房间不存在' });
      return;
    }
    res.status(200).json({ success: true, room: updatedRoom, message: '保留策略已更新' });
  } catch (err: any) {
    console.error('[API] /admin/room/:roomId/retention error:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

