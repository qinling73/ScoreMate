import React, { useState } from 'react';
import { Room, Player } from '../types';
import { sounds } from '../utils/audio';
import { copyToClipboard } from '../utils/clipboard';
import { AvatarDisplay } from './AvatarDisplay';
import { 
  Users, 
  Volume2, 
  VolumeX, 
  Copy, 
  Check, 
  Share2, 
  LogOut, 
  Crown,
  Sparkles,
  ShieldAlert,
  Server,
  Image as ImageIcon
} from 'lucide-react';

interface NavbarProps {
  room: Room;
  currentPlayer: Player | null;
  onLeaveRoom: () => void;
  onShowQR: () => void;
  onOpenServerAdmin?: () => void;
  onOpenAvatarPicker?: () => void;
  onOpenShareModal?: (defaultType?: 'leaderboard' | 'logs') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  room,
  currentPlayer,
  onLeaveRoom,
  onShowQR,
  onOpenServerAdmin,
  onOpenAvatarPicker,
  onOpenShareModal,
}) => {
  const [copied, setCopied] = useState(false);
  const [isMuted, setIsMuted] = useState(sounds.getIsMuted());

  const onlineMembersCount = (Object.values(room.members) as Player[]).filter((m) => m.isOnline).length;
  const totalMembersCount = Object.keys(room.members).length;

  const handleCopyCode = async () => {
    sounds.playTap();
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
    const text = `🎮 邀请你加入实时游戏记分房间【${room.title}】\n🔑 房间码：${room.code}\n🔗 链接：${inviteUrl}`;
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      window.prompt('请长按或Ctrl+C复制房间信息：', text);
    }
  };

  const toggleSound = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
    if (!muted) sounds.playTap();
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FF6B35] px-3 pt-3 pb-2 text-black select-none">
      <div className="max-w-md mx-auto bg-white border-4 border-black rounded-2xl p-3 shadow-brutal">
        {/* Top Row: Room title, online badge, actions */}
        <div className="flex items-center justify-between gap-2">
          {/* Room Name & Code */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Clickable Avatar to edit */}
            <div 
              onClick={() => { sounds.playTap(); onOpenAvatarPicker?.(); }}
              className="cursor-pointer shrink-0 transition-transform active:scale-95"
              title="点击更换我的头像"
            >
              <AvatarDisplay
                avatar={currentPlayer?.avatar}
                avatarColor={currentPlayer?.avatarColor}
                nickname={currentPlayer?.nickname || '我'}
                isOnline={true}
                size="md"
                className="ring-2 ring-black"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-black truncate max-w-[120px] sm:max-w-[160px] text-black tracking-tight">
                  {room.title}
                </h1>
                {currentPlayer?.isHost && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-black bg-[#FFD93D] text-black border-2 border-black rounded-md shadow-brutal-sm">
                    <Crown className="w-2.5 h-2.5 mr-0.5" /> 房主
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-black/80 font-bold">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] border border-black animate-pulse" />
                  <span>{onlineMembersCount}/{totalMembersCount}在线</span>
                </span>
                <span>•</span>
                <span className={`text-[11px] font-black px-1.5 py-0.2 rounded border border-black ${
                  room.mode === 'zero_sum' 
                    ? 'bg-[#FFD93D] text-black' 
                    : 'bg-[#4ECDC4] text-black'
                }`}>
                  {room.mode === 'zero_sum' ? '零和筹码' : '自由记分'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Share Picture Modal */}
            {onOpenShareModal && (
              <button
                id="nav-share-pic-btn"
                onClick={() => { sounds.playTap(); onOpenShareModal('leaderboard'); }}
                className="w-8 h-8 rounded-xl bg-[#FFD93D] hover:bg-[#ffce1f] text-black border-2 border-black shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center justify-center transition-transform"
                title="生成战报/流水长图"
              >
                <ImageIcon className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}

            {/* Quick Share / QR Button */}
            <button
              id="nav-qr-btn"
              onClick={onShowQR}
              className="w-8 h-8 rounded-xl bg-[#4ECDC4] hover:bg-[#3dbdb4] text-black border-2 border-black shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center justify-center transition-transform"
              title="邀请与二维码"
            >
              <Share2 className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* Server Admin Modal Button */}
            {onOpenServerAdmin && (
              <button
                id="nav-admin-btn"
                onClick={onOpenServerAdmin}
                className="w-8 h-8 rounded-xl bg-[#FFE66D] hover:bg-[#ffd93d] text-black border-2 border-black shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center justify-center transition-transform"
                title="服务器房间后台管理"
              >
                <Server className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}

            {/* Sound Mute Toggle */}
            <button
              id="nav-sound-btn"
              onClick={toggleSound}
              className="w-8 h-8 rounded-xl bg-white hover:bg-black/5 text-black border-2 border-black shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center justify-center transition-transform"
              title={isMuted ? '开启音效' : '静音'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-black/40 stroke-[2.5]" /> : <Volume2 className="w-4 h-4 text-black stroke-[2.5]" />}
            </button>

            {/* Leave Room Button */}
            <button
              id="nav-leave-btn"
              onClick={onLeaveRoom}
              className="w-8 h-8 rounded-xl bg-[#FF6B6B] hover:bg-[#fa5252] text-white border-2 border-black shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center justify-center transition-transform"
              title="离开房间"
            >
              <LogOut className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Bottom Banner: 6-digit Room Code with Copy Button */}
        <div className="mt-2.5 pt-2 border-t-2 border-black flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-black/70 font-black uppercase tracking-wider">房间码</span>
            <button
              id="copy-code-chip"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFD93D] border-2 border-black hover:bg-[#ffcf10] text-black text-xs font-black tracking-widest shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-transform"
            >
              <span>{room.code}</span>
              {copied ? <Check className="w-3.5 h-3.5 text-black stroke-[3]" /> : <Copy className="w-3.5 h-3.5 text-black stroke-[2.5]" />}
            </button>
            {copied && <span className="text-[10px] text-black font-black bg-[#4ECDC4] px-1.5 py-0.5 rounded border border-black animate-fade-in">已复制!</span>}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-black font-bold">
            <span className="text-black/70">我的得分:</span>
            <span className={`px-2 py-0.5 rounded-lg border-2 border-black font-black text-sm shadow-brutal-sm ${
              (currentPlayer?.score || 0) > 0 
                ? 'bg-[#4ECDC4] text-black' 
                : (currentPlayer?.score || 0) < 0 
                  ? 'bg-[#FF6B6B] text-white' 
                  : 'bg-black/5 text-black'
            }`}>
              {(currentPlayer?.score || 0) > 0 ? `+${currentPlayer?.score}` : currentPlayer?.score || 0}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

