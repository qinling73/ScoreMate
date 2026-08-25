import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { db } from './db.js';
import { SubmitScorePayload, RoomActionPayload, DeductionResponsePayload } from './types.js';

interface SocketData {
  userId?: string;
  roomId?: string;
  nickname?: string;
}

let globalIO: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return globalIO;
}

export function broadcastRoomDissolved(roomId: string, message: string = '管理员已强制解散该房间') {
  if (globalIO) {
    globalIO.to(roomId).emit('room_auto_dissolved', {
      roomId,
      message,
    });
    // Kick out all sockets from room
    const roomSockets = globalIO.sockets.adapter.rooms.get(roomId);
    if (roomSockets) {
      for (const socketId of Array.from(roomSockets)) {
        const s = globalIO.sockets.sockets.get(socketId);
        if (s) {
          s.leave(roomId);
        }
      }
    }
  }
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

  globalIO = io;

  // Track active socket connections per user to manage isOnline status
  const userSocketCount: Record<string, number> = {};

  io.on('connection', (socket: Socket) => {
    // Join room
    socket.on('join_room', (data: { roomId: string; token?: string; userId?: string; nickname?: string }) => {
      const { roomId, token, userId } = data;
      if (!roomId) return;

      const room = db.getRoom(roomId);
      if (!room) {
        socket.emit('error_message', { message: '房间未找到或已解散' });
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

        // Cancel any pending dissolution countdown because a member is active
        const cancelled = db.cancelDissolveCountdown(room.id);
        if (cancelled) {
          io.to(room.id).emit('dissolve_countdown_cancelled', {
            roomId: room.id,
            reason: `玩家【${room.members[actualUserId].nickname}】重新上线，房间自动解散已取消`,
            room,
          });
        }

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

    // Score submission or Deduction Proposal
    socket.on('submit_score', (payload: SubmitScorePayload & { roomId: string }) => {
      const { roomId, fromUserId, targetUserIds, amount, note, requireApprovalForDeduction = true } = payload;
      if (!roomId || !fromUserId || !targetUserIds || !targetUserIds.length) {
        socket.emit('error_message', { message: '参数不完整' });
        return;
      }

      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount === 0) {
        socket.emit('error_message', { message: '请输入有效的非零数值' });
        return;
      }

      const room = db.getRoom(roomId);
      if (!room) {
        socket.emit('error_message', { message: '房间不存在' });
        return;
      }

      // If deducting points (amount < 0), require confirmation from the deducted players!
      if (numAmount < 0 && requireApprovalForDeduction) {
        const proposals = [];
        for (const targetId of targetUserIds) {
          // If a player is deducting points from themselves, no need for approval
          if (targetId === fromUserId) {
            db.submitScore({
              roomId,
              fromUserId,
              targetUserIds: [targetId],
              amount: numAmount,
              note,
            });
            continue;
          }

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

        const freshRoom = db.getRoom(roomId) || room;
        const leaderboard = Object.values(freshRoom.members).sort((a, b) => b.score - a.score);

        // Notify room & targets about deduction proposals
        io.to(roomId).emit('deductions_proposed', {
          room: freshRoom,
          proposals,
          fromUserId,
          fromNickname: room.members[fromUserId]?.nickname || '玩家',
          timestamp: Date.now(),
        });

        socket.emit('proposal_sent', {
          count: proposals.length,
          message: `扣分申请已发送给相关玩家，等待对方确认`,
        });
        return;
      }

      // Regular positive score addition or self-deduction
      const result = db.submitScore({
        roomId,
        fromUserId,
        targetUserIds,
        amount: numAmount,
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

    // Respond to deduction proposal (Agree or Refuse)
    socket.on('respond_deduction', (payload: DeductionResponsePayload & { roomId: string }) => {
      const { roomId, proposalId, accepted, responderUserId } = payload;
      if (!roomId || !proposalId || !responderUserId) {
        socket.emit('error_message', { message: '参数不完整' });
        return;
      }

      const result = db.respondToDeductionProposal({
        roomId,
        proposalId,
        responderUserId,
        accepted: Boolean(accepted),
      });

      if ('error' in result) {
        socket.emit('error_message', { message: result.error });
        return;
      }

      const freshRoom = result.room;
      const leaderboard = Object.values(freshRoom.members).sort((a, b) => b.score - a.score);

      io.to(roomId).emit('deduction_resolved', {
        proposal: result.proposal,
        accepted,
        room: freshRoom,
        leaderboard,
        newLog: result.newLog,
        timestamp: Date.now(),
      });
    });

    // Host actions (reset scores, change mode, kick player, close room, set retention)
    socket.on('room_action', (payload: RoomActionPayload & { roomId: string; hostUserId: string }) => {
      const { roomId, hostUserId, action, targetUserId, mode, initialScore, retention } = payload;
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
        retention,
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

    // Update player avatar real-time
    socket.on('update_avatar', (data: { roomId: string; userId: string; avatar: string }) => {
      const { roomId, userId, avatar } = data;
      if (!roomId || !userId) return;

      const result = db.updatePlayerAvatar(roomId, userId, avatar);
      if ('error' in result) {
        socket.emit('error_message', { message: result.error });
        return;
      }

      io.to(roomId).emit('avatar_updated', {
        roomId,
        userId,
        player: result.player,
        room: result.room,
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

          // Check if all users are offline -> trigger 30s countdown if policy is offline_30s
          db.handleUserDisconnected(
            sData.roomId,
            (room, countdownSec) => {
              io.to(room.id).emit('dissolve_countdown_started', {
                roomId: room.id,
                countdownSec,
                expiresAt: room.dissolveCountdownExpiresAt,
                message: `房间内所有玩家均已离线，系统将在 ${countdownSec} 秒后自动解散房间（有人重新进入可取消）`,
                room,
              });
            },
            (dissolvedRoom) => {
              io.to(dissolvedRoom.id).emit('room_auto_dissolved', {
                roomId: dissolvedRoom.id,
                message: '由于全员离线超时，房间已自动解散',
                room: dissolvedRoom,
              });
            }
          );
        }
      }
    });
  });

  return io;
}

