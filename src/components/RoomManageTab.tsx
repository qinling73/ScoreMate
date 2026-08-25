import React, { useState } from 'react';
import { Room, Player, GameMode } from '../types';
import { sounds } from '../utils/audio';
import { 
  Settings, 
  Crown, 
  RotateCcw, 
  UserMinus, 
  Trash2, 
  Sliders, 
  QrCode, 
  Copy, 
  Check, 
  Share2, 
  Smartphone, 
  Code2, 
  ShieldCheck, 
  FileText,
  AlertTriangle
} from 'lucide-react';

interface RoomManageTabProps {
  room: Room;
  currentPlayer: Player | null;
  onExecuteHostAction: (payload: {
    action: 'reset_scores' | 'kick_player' | 'change_mode' | 'set_initial_score' | 'close_room';
    targetUserId?: string;
    mode?: GameMode;
    initialScore?: number;
  }) => Promise<void>;
  onShowQR: () => void;
}

export const RoomManageTab: React.FC<RoomManageTabProps> = ({
  room,
  currentPlayer,
  onExecuteHostAction,
  onShowQR,
}) => {
  const isHost = currentPlayer?.isHost;
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMiniCode, setCopiedMiniCode] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [resetBaseScore, setResetBaseScore] = useState<number>(room.initialScore || 0);
  const [selectedKickUserId, setSelectedKickUserId] = useState<string>('');

  const members = Object.values(room.members) as Player[];
  const kickableMembers = members.filter((m) => m.id !== currentPlayer?.id);

  const handleCopyInviteLink = async () => {
    sounds.playTap();
    const url = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
    const text = `🎮 邀请你加入实时游戏记分房间【${room.title}】\n🔑 房间码：${room.code}\n🔗 链接：${url}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleResetScores = async () => {
    if (!window.confirm(`确定要将房间内全员的分数重置为 ${resetBaseScore} 分吗？`)) return;
    try {
      setActionLoading(true);
      await onExecuteHostAction({
        action: 'reset_scores',
        initialScore: resetBaseScore,
      });
      sounds.playScoreSent();
      alert('全员分数已重置成功！');
    } catch (err: any) {
      alert(err.message || '重置失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeMode = async (newMode: GameMode) => {
    if (newMode === room.mode) return;
    try {
      setActionLoading(true);
      await onExecuteHostAction({
        action: 'change_mode',
        mode: newMode,
      });
      sounds.playTap();
    } catch (err: any) {
      alert(err.message || '切换模式失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleKickPlayer = async () => {
    if (!selectedKickUserId) {
      alert('请先选择要踢出的玩家');
      return;
    }
    const target = room.members[selectedKickUserId];
    if (!window.confirm(`确定要将玩家【${target?.nickname}】移出房间吗？`)) return;

    try {
      setActionLoading(true);
      await onExecuteHostAction({
        action: 'kick_player',
        targetUserId: selectedKickUserId,
      });
      setSelectedKickUserId('');
      sounds.playTap();
      alert(`玩家 ${target?.nickname} 已被移出房间`);
    } catch (err: any) {
      alert(err.message || '踢出失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseRoom = async () => {
    if (!window.confirm('⚠️ 警告：解散房间后所有玩家将被断开且无法再记分，确定解散吗？')) return;
    try {
      setActionLoading(true);
      await onExecuteHostAction({ action: 'close_room' });
      alert('房间已解散');
    } catch (err: any) {
      alert(err.message || '解散失败');
    } finally {
      setActionLoading(false);
    }
  };

  const miniProgramCodeExample = `// 微信小程序接入示例 (Uni-App / Taro / 原生微信小程序)
// 1. 房间创建 / 加入 (wx.request)
wx.request({
  url: 'https://YOUR_SERVER_DOMAIN/api/room/join',
  method: 'POST',
  data: {
    nickname: '微信用户',
    roomCode: '${room.code}'
  },
  success: (res) => {
    const { token, player, room } = res.data;
    wx.setStorageSync('token', token);
    
    // 2. 连接 WebSocket (wx.connectSocket)
    const socketTask = wx.connectSocket({
      url: 'wss://YOUR_SERVER_DOMAIN/socket.io/?EIO=4&transport=websocket'
    });
    
    socketTask.onOpen(() => {
      // 发送加入房间握手
      socketTask.send({
        data: JSON.stringify(['join_room', { roomId: room.id, token, userId: player.id }])
      });
    });
  }
});`;

  const copyMiniProgramSnippet = async () => {
    sounds.playTap();
    try {
      await navigator.clipboard.writeText(miniProgramCodeExample);
      setCopiedMiniCode(true);
      setTimeout(() => setCopiedMiniCode(false), 2000);
    } catch {
      setCopiedMiniCode(true);
      setTimeout(() => setCopiedMiniCode(false), 2000);
    }
  };

  return (
    <div className="space-y-4 pb-20 select-none">
      {/* 1. Room Info Card */}
      <div className="bg-white border-4 border-black rounded-[24px] p-4 shadow-brutal space-y-3.5 text-black">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-black stroke-[2.5]" />
            <h2 className="text-base font-black uppercase text-black">房间信息</h2>
          </div>
          <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-black text-white">
            ID: {room.id.slice(0, 8)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-2xl bg-black/5 border-2 border-black">
            <span className="text-black/70 text-[11px] font-black uppercase">房间名称</span>
            <div className="font-black text-black text-sm mt-0.5 truncate">{room.title}</div>
          </div>
          <div className="p-3 rounded-2xl bg-black/5 border-2 border-black">
            <span className="text-black/70 text-[11px] font-black uppercase">当前房主</span>
            <div className="font-black text-black text-sm mt-0.5 truncate flex items-center gap-1">
              <Crown className="w-4 h-4 text-black stroke-[2.5]" />
              {room.members[room.hostId]?.nickname || '房主'}
            </div>
          </div>
        </div>

        {/* 6-digit Code & Invite */}
        <div className="p-3.5 bg-[#FFD93D] border-2 border-black rounded-2xl flex items-center justify-between gap-2 shadow-brutal-sm">
          <div>
            <div className="text-[11px] text-black font-black uppercase tracking-wider">6位专属房间码</div>
            <div className="text-2xl font-black text-black tracking-widest mt-0.5">
              {room.code}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="room-qr-btn"
              onClick={onShowQR}
              className="px-3 py-2 rounded-xl bg-white hover:bg-black hover:text-white text-black text-xs font-black flex items-center gap-1.5 border-2 border-black transition-all shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <QrCode className="w-4 h-4 stroke-[2.5]" />
              <span>二维码</span>
            </button>
            <button
              id="room-invite-btn"
              onClick={handleCopyInviteLink}
              className="px-3 py-2 rounded-xl bg-black hover:bg-black/90 text-white text-xs font-black flex items-center gap-1.5 border-2 border-black transition-all shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              {copiedLink ? <Check className="w-4 h-4 text-[#10B981] stroke-[3]" /> : <Copy className="w-4 h-4 stroke-[2.5]" />}
              <span>{copiedLink ? '已复制' : '复制邀请'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Host Controls Panel (If user is host) */}
      {isHost ? (
        <div className="bg-[#4ECDC4] border-4 border-black rounded-[24px] p-4 shadow-brutal space-y-4 text-black">
          <div className="flex items-center gap-2 text-black font-black text-base uppercase">
            <Crown className="w-5 h-5 stroke-[2.5]" />
            <span>房主管理中心 (Host Controls)</span>
          </div>

          {/* Mode Switcher */}
          <div>
            <div className="text-xs text-black font-black mb-1.5 flex items-center gap-1">
              <Sliders className="w-4 h-4 stroke-[2.5]" />
              <span>切换记分模式</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="host-mode-free"
                onClick={() => handleChangeMode('free')}
                disabled={actionLoading}
                className={`p-3 rounded-2xl border-2 border-black text-left text-xs transition-all shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
                  room.mode === 'free'
                    ? 'bg-black text-white font-black ring-2 ring-black'
                    : 'bg-white text-black hover:bg-black/5 font-bold'
                }`}
              >
                <div className="font-black text-sm">自由模式</div>
                <div className="text-[10px] opacity-80 mt-0.5 font-bold">送分不扣除己方分数</div>
              </button>

              <button
                id="host-mode-zero"
                onClick={() => handleChangeMode('zero_sum')}
                disabled={actionLoading}
                className={`p-3 rounded-2xl border-2 border-black text-left text-xs transition-all shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
                  room.mode === 'zero_sum'
                    ? 'bg-black text-white font-black ring-2 ring-black'
                    : 'bg-white text-black hover:bg-black/5 font-bold'
                }`}
              >
                <div className="font-black text-sm">零和 / 筹码模式</div>
                <div className="text-[10px] opacity-80 mt-0.5 font-bold">给多少扣自己多少分</div>
              </button>
            </div>
          </div>

          {/* Reset All Scores */}
          <div className="pt-3 border-t-2 border-black">
            <div className="text-xs text-black font-black mb-1.5 flex items-center gap-1">
              <RotateCcw className="w-4 h-4 stroke-[2.5]" />
              <span>一键重置全员分数</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white px-3 py-2 rounded-xl border-2 border-black shadow-brutal-sm">
                <span className="text-xs text-black font-bold">重置为:</span>
                <input
                  id="host-reset-score-input"
                  type="number"
                  value={resetBaseScore}
                  onChange={(e) => setResetBaseScore(Number(e.target.value) || 0)}
                  className="w-14 text-center font-black text-sm bg-transparent text-black focus:outline-none"
                />
                <span className="text-xs text-black font-bold">分</span>
              </div>
              <button
                id="host-reset-btn"
                disabled={actionLoading}
                onClick={handleResetScores}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#FFD93D] hover:bg-[#ffcf10] text-black font-black text-xs border-2 border-black transition-all shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                重置全员分数
              </button>
            </div>
          </div>

          {/* Kick Player */}
          {kickableMembers.length > 0 && (
            <div className="pt-3 border-t-2 border-black">
              <div className="text-xs text-black font-black mb-1.5 flex items-center gap-1">
                <UserMinus className="w-4 h-4 stroke-[2.5]" />
                <span>移出违规成员</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  id="host-kick-select"
                  value={selectedKickUserId}
                  onChange={(e) => setSelectedKickUserId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-white border-2 border-black text-xs font-bold text-black focus:outline-none shadow-brutal-sm"
                >
                  <option value="">选择要移出的玩家...</option>
                  {kickableMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nickname} (当前 {m.score} 分)
                    </option>
                  ))}
                </select>
                <button
                  id="host-kick-btn"
                  disabled={actionLoading || !selectedKickUserId}
                  onClick={handleKickPlayer}
                  className="py-2 px-3 rounded-xl bg-[#FF6B6B] hover:bg-[#ff5252] text-white border-2 border-black font-black text-xs transition-all shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50"
                >
                  移出
                </button>
              </div>
            </div>
          )}

          {/* Dissolve Room */}
          <div className="pt-3 border-t-2 border-black">
            <button
              id="host-close-room-btn"
              disabled={actionLoading}
              onClick={handleCloseRoom}
              className="w-full py-3 px-4 rounded-xl bg-black hover:bg-black/90 text-white border-2 border-black font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <Trash2 className="w-4 h-4 stroke-[2.5]" />
              <span>解散当前房间</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border-4 border-black rounded-[24px] p-4 shadow-brutal text-xs text-black font-bold flex items-center gap-2.5">
          <ShieldCheck className="w-6 h-6 text-black shrink-0 stroke-[2.5]" />
          <span>您是普通成员。重置分数、切换模式或踢人等操作需由房主执行。</span>
        </div>
      )}

      {/* 3. WeChat Mini-Program Architecture Spec */}
      <div className="bg-white border-4 border-black rounded-[24px] p-4 shadow-brutal space-y-3 text-black">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-black">
            <Smartphone className="w-4 h-4 stroke-[2.5]" />
            <span>微信小程序接入架构 (Mini-Program Ready)</span>
          </div>
          <button
            id="copy-miniprogram-snippet-btn"
            onClick={copyMiniProgramSnippet}
            className="text-[11px] font-black text-black flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFD93D] border-2 border-black shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            {copiedMiniCode ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Code2 className="w-3.5 h-3.5 stroke-[2.5]" />}
            <span>{copiedMiniCode ? '已复制示例' : '复制代码'}</span>
          </button>
        </div>

        <p className="text-xs text-black/80 font-bold leading-relaxed">
          本系统服务端完全基于标准 RESTful API 与 Socket.io/WebSocket 实现，前后端深度解耦。可在 Uni-App、Taro 或微信原生小程序中直接复用本后端所有接口。
        </p>

        <div className="bg-black p-3.5 rounded-2xl border-2 border-black font-mono text-[10px] text-white overflow-x-auto max-h-48 leading-relaxed shadow-inner">
          <pre>{miniProgramCodeExample}</pre>
        </div>
      </div>
    </div>
  );
};
