import { io, Socket } from 'socket.io-client';
import { Room, Player, ScoreLog, ScoreUpdateBroadcast, RoomActionBroadcast } from '../types';
import { getStoredToken } from './api';

type EventCallback<T = any> = (data: T) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private isConnected = false;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;

  public connect(roomId: string, userId: string, nickname?: string) {
    this.currentRoomId = roomId;
    this.currentUserId = userId;

    if (this.socket) {
      if (this.socket.connected) {
        this.emitJoin(roomId, userId, nickname);
        return;
      }
      this.socket.disconnect();
    }

    const token = getStoredToken();

    this.socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.notifyListeners('connection_status', { status: 'connected' });
      this.emitJoin(roomId, userId, nickname);
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.notifyListeners('connection_status', { status: 'disconnected', reason });
    });

    this.socket.on('connect_error', (error) => {
      this.notifyListeners('connection_status', { status: 'error', error });
    });

    // Server-sent events
    this.socket.on('room_state', (data: { room: Room; leaderboard: Player[] }) => {
      this.notifyListeners('room_state', data);
    });

    this.socket.on('score_updated', (data: ScoreUpdateBroadcast) => {
      this.notifyListeners('score_updated', data);
    });

    this.socket.on('room_action_executed', (data: RoomActionBroadcast) => {
      this.notifyListeners('room_action_executed', data);
    });

    this.socket.on('user_joined', (data: { userId: string; player: Player; timestamp: number }) => {
      this.notifyListeners('user_joined', data);
    });

    this.socket.on('user_left', (data: { userId: string; nickname?: string; timestamp: number }) => {
      this.notifyListeners('user_left', data);
    });

    this.socket.on('error_message', (data: { message: string }) => {
      this.notifyListeners('error_message', data);
    });
  }

  private emitJoin(roomId: string, userId: string, nickname?: string) {
    if (!this.socket) return;
    const token = getStoredToken();
    this.socket.emit('join_room', {
      roomId,
      userId,
      token,
      nickname,
    });
  }

  public submitScore(payload: {
    roomId: string;
    fromUserId: string;
    targetUserIds: string[];
    amount: number;
    note?: string;
  }) {
    if (!this.socket || !this.socket.connected) {
      throw new Error('网络连接中，请稍后再试');
    }
    this.socket.emit('submit_score', payload);
  }

  public executeHostAction(payload: {
    roomId: string;
    hostUserId: string;
    action: 'reset_scores' | 'kick_player' | 'change_mode' | 'set_initial_score' | 'close_room';
    targetUserId?: string;
    mode?: 'free' | 'zero_sum';
    initialScore?: number;
  }) {
    if (!this.socket || !this.socket.connected) {
      throw new Error('网络连接中，请稍后再试');
    }
    this.socket.emit('room_action', payload);
  }

  public on<T = any>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private notifyListeners(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
  }

  public getStatus(): boolean {
    return this.isConnected;
  }
}

export const socketService = new SocketService();
