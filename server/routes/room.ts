import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { CreateRoomRequest, JoinRoomRequest, SubmitScorePayload, RoomActionPayload } from '../types.js';

export const roomRouter = Router();

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
    const { nickname, roomTitle, mode, initialScore } = req.body as CreateRoomRequest;

    if (!nickname || typeof nickname !== 'string' || nickname.trim().length < 1 || nickname.trim().length > 20) {
      res.status(400).json({ error: '昵称长度需在 1 到 20 个字符之间' });
      return;
    }

    const { room, token, player } = db.createRoom({
      nickname: nickname.trim(),
      roomTitle,
      mode: mode === 'zero_sum' ? 'zero_sum' : 'free',
      initialScore: typeof initialScore === 'number' ? initialScore : 0,
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
    const { nickname, roomCode, token: bodyToken } = req.body as JoinRoomRequest;
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
      token,
    });

    if ('error' in result) {
      res.status(400).json({ error: result.error });
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

// POST /api/room/:roomId/score - RESTful fallback for score submit
roomRouter.post('/:roomId/score', (req: Request, res: Response): void => {
  try {
    const { roomId } = req.params;
    const { fromUserId, targetUserIds, amount, note } = req.body as SubmitScorePayload;

    const result = db.submitScore({
      roomId,
      fromUserId,
      targetUserIds,
      amount: Number(amount),
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

    const { action, targetUserId, mode, initialScore } = req.body as RoomActionPayload;

    const result = db.handleHostAction({
      roomId,
      hostUserId,
      action,
      targetUserId,
      mode,
      initialScore,
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
