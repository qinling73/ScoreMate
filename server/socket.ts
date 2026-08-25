import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { db } from './db.js';
import { SubmitScorePayload, RoomActionPayload } from './types.js';

interface SocketData {
  userId?: string;
  roomId?: string;
  nickname?: string;
}

export function setupSocketIO(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingInterval: 15000,
    pingTimeout: 30000,
  });

  // Track active socket connections per user to manage isOnline status
  const userSocketCount: Record<string, number> = {};

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // Join room
    socket.on('join_room', (data: { roomId: string; token?: string; userId?: string; nickname?: string }) => {
      const { roomId, token, userId } = data;
      if (!roomId) return;

      const room = db.getRoom(roomId);
      if (!room) {
        socket.emit('error_message', { message: '房间未找到' });
        return;
      }

      let actualUserId = userId;
      if (token) {
        const sess = db.getSession(token);
        if (sess) actualUserId = sess.userId;
      }

      (socket.data as SocketData).roomId = room.id;
      (socket.data as SocketData).userId = actualUserId;
      if (actualUserId && room.members[actualUserId]) {
        (socket.data as SocketData).nickname = room.members[actualUserId].nickname;
      }

      socket.join(room.id);

      if (actualUserId && room.members[actualUserId]) {
        userSocketCount[actualUserId] = (userSocketCount[actualUserId] || 0) + 1;
        db.setUserOnline(room.id, actualUserId, true);

        // Broadcast member presence
        io.to(room.id).emit('user_joined', {
          userId: actualUserId,
          player: room.members[actualUserId],
          timestamp: Date.now(),
        });
      }

      // Send initial room snapshot to joining client
      const leaderboard = Object.values(room.members).sort((a, b) => b.score - a.score);
      socket.emit('room_state', {
        room,
        leaderboard,
      });
    });

    // Score submission
    socket.on('submit_score', (payload: SubmitScorePayload & { roomId: string }) => {
      const { roomId, fromUserId, targetUserIds, amount, note } = payload;
      if (!roomId || !fromUserId || !targetUserIds || !targetUserIds.length) {
        socket.emit('error_message', { message: '参数不完整' });
        return;
      }

      const result = db.submitScore({
        roomId,
        fromUserId,
        targetUserIds,
        amount: Number(amount),
        note,
      });

      if ('error' in result) {
        socket.emit('error_message', { message: result.error });
        return;
      }

      const leaderboard = Object.values(result.room.members).sort((a, b) => b.score - a.score);

      // Broadcast score update to everyone in the room in real-time
      io.to(result.room.id).emit('score_updated', {
        room: result.room,
        leaderboard,
        newLogs: result.newLogs,
        actorUserId: fromUserId,
        timestamp: Date.now(),
      });
    });

    // Host actions (reset scores, change mode, kick player, close room)
    socket.on('room_action', (payload: RoomActionPayload & { roomId: string; hostUserId: string }) => {
      const { roomId, hostUserId, action, targetUserId, mode, initialScore } = payload;
      if (!roomId || !hostUserId || !action) {
        socket.emit('error_message', { message: '参数不完整' });
        return;
      }

      const result = db.handleHostAction({
        roomId,
        hostUserId,
        action,
        targetUserId,
        mode,
        initialScore,
      });

      if ('error' in result) {
        socket.emit('error_message', { message: result.error });
        return;
      }

      const leaderboard = Object.values(result.room.members).sort((a, b) => b.score - a.score);

      io.to(result.room.id).emit('room_action_executed', {
        action,
        message: result.message,
        room: result.room,
        leaderboard,
        targetUserId,
        timestamp: Date.now(),
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      const sData = socket.data as SocketData;
      if (sData.userId && sData.roomId) {
        const count = (userSocketCount[sData.userId] || 1) - 1;
        userSocketCount[sData.userId] = Math.max(0, count);

        if (count <= 0) {
          db.setUserOnline(sData.roomId, sData.userId, false);
          io.to(sData.roomId).emit('user_left', {
            userId: sData.userId,
            nickname: sData.nickname,
            timestamp: Date.now(),
          });
        }
      }
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  return io;
}
