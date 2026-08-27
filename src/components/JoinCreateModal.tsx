import React, { useState, useEffect } from 'react';
import { GameMode, RoomRetention } from '../types';
import { getStoredNickname, setStoredNickname, getApiBaseUrl, setApiBaseUrl } from '../services/api';
import { getStoredAvatar, setStoredAvatar, DEFAULT_AVATAR } from '../utils/avatar';
import { AvatarDisplay } from './AvatarDisplay';
import { AvatarPickerModal } from './AvatarPickerModal';
import { NetworkDiagnosticModal } from './NetworkDiagnosticModal';
import { sounds } from '../utils/audio';
import { 
  Gamepad2, 
  PlusCircle, 
  LogIn, 
  User, 
  Coins, 
  Sliders, 
  ArrowRight,
  Sparkles,
  Layers,
  Server,
  Clock,
  Smile,
  Edit3,
  Link,
  Check,
  Activity
} from 'lucide-react';

interface JoinCreateModalProps {
  onJoin: (nickname: string, roomCode: string, avatar?: string) => Promise<void>;
  onCreate: (nickname: string, roomTitle: string, mode: GameMode, initialScore: number, retention?: RoomRetention, avatar?: string) => Promise<void>;
  initialRoomCode?: string;
  onOpenServerAdmin?: () => void;
}

const QUICK_AVATARS = ['🐱', '🐶', '🦊', '🐼', '🐰', '🦁', '👑', '🎲', '😎', '🤖'];

export const JoinCreateModal: React.FC<JoinCreateModalProps> = ({
  onJoin,
  onCreate,
  initialRoomCode = '',
  onOpenServerAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<'join' | 'create'>(initialRoomCode ? 'join' : 'create');
  const [nickname, setNickname] = useState<string>(getStoredNickname() || '');
  const [avatar, setAvatar] = useState<string>(getStoredAvatar() || DEFAULT_AVATAR);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState<boolean>(false);
  const [showBackendConfig, setShowBackendConfig] = useState<boolean>(false);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState<boolean>(false);
  const [backendUrlInput, setBackendUrlInput] = useState<string>(getApiBaseUrl() || '');
  const [backendSavedSuccess, setBackendSavedSuccess] = useState<boolean>(false);
  
  // Join Tab State
  const [roomCode, setRoomCode] = useState<string>(initialRoomCode);

  // Create Tab State
  const [roomTitle, setRoomTitle] = useState<string>('');
  const [mode, setMode] = useState<GameMode>('free');
  const [initialScore, setInitialScore] = useState<number>(0);
  const [retention, setRetention] = useState<RoomRetention>('offline_30s');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (initialRoomCode) {
      setRoomCode(initialRoomCode);
      setActiveTab('join');
    }
  }, [initialRoomCode]);

  const handleSaveBackendUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setApiBaseUrl(backendUrlInput.trim());
    setBackendSavedSuccess(true);
    setErrorMessage('');
    setTimeout(() => {
      setBackendSavedSuccess(false);
      setShowBackendConfig(false);
    }, 1200);
  };

  const handleTabChange = (tab: 'join' | 'create') => {
    sounds.playTap();
    setActiveTab(tab);
    setErrorMessage('');
  };

  const handleSelectAvatar = (newAvatar: string) => {
    setAvatar(newAvatar);
    setStoredAvatar(newAvatar);
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!nickname.trim()) {
      setErrorMessage('请输入玩家昵称 (2-16字符)');
      return;
    }
    if (!roomCode.trim()) {
      setErrorMessage('请输入6位房间码');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      setStoredNickname(nickname.trim());
      setStoredAvatar(avatar);
      await onJoin(nickname.trim(), roomCode.trim().toUpperCase(), avatar);
      sounds.playScoreSent();
    } catch (err: any) {
      setErrorMessage(err.message || '加入房间失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!nickname.trim()) {
      setErrorMessage('请输入房主昵称 (2-16字符)');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      setStoredNickname(nickname.trim());
      setStoredAvatar(avatar);
      await onCreate(
        nickname.trim(),
        roomTitle.trim() || `${nickname.trim()}的记分房间`,
        mode,
        initialScore,
        retention,
        avatar
      );
      sounds.playScoreSent();
    } catch (err: any) {
      setErrorMessage(err.message || '创建房间失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] flex flex-col items-center justify-center p-4 text-black relative overflow-hidden select-none">
      {/* Avatar Picker Modal */}
      <AvatarPickerModal
        isOpen={isAvatarPickerOpen}
        currentAvatar={avatar}
        onClose={() => setIsAvatarPickerOpen(false)}
        onSelectAvatar={handleSelectAvatar}
      />

      {/* Neo-brutalist floating accents */}
      <div className="absolute top-8 left-8 w-16 h-16 bg-[#FFD93D] border-3 border-black rounded-2xl shadow-brutal -rotate-6 pointer-events-none hidden sm:block" />
      <div className="absolute bottom-12 right-12 w-20 h-20 bg-[#4ECDC4] border-3 border-black rounded-3xl shadow-brutal rotate-12 pointer-events-none hidden sm:block" />
      <div className="absolute top-1/3 right-8 w-12 h-12 bg-[#FF6B6B] border-3 border-black rounded-full shadow-brutal-sm pointer-events-none hidden sm:block" />

      <div className="max-w-md w-full z-10 space-y-4">
        {/* App Title & Intro Banner */}
        <div className="text-center space-y-2 relative">
          <div className="inline-flex p-3 rounded-2xl bg-[#FFD93D] border-3 border-black text-black shadow-brutal-sm rotate-1">
            <Gamepad2 className="w-9 h-9 stroke-[2.5]" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-black uppercase italic">
            多人实时游戏记分
          </h1>
          <p className="text-xs text-black/80 font-black max-w-xs mx-auto">
            免繁琐注册 • 多人实时同步 • 自由/筹码模式 • 扣分同意与房间生命周期管理
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white border-4 border-black rounded-[28px] p-5 sm:p-6 shadow-brutal space-y-4 text-black">
          {/* Tab Switcher */}
          <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-black/5 border-2 border-black">
            <button
              id="tab-join-btn"
              type="button"
              onClick={() => handleTabChange('join')}
              className={`py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border-2 ${
                activeTab === 'join'
                  ? 'bg-[#4ECDC4] text-black border-black shadow-brutal-sm'
                  : 'border-transparent text-black/60 hover:text-black'
              }`}
            >
              <LogIn className="w-4 h-4 stroke-[2.5]" />
              <span>加入房间</span>
            </button>

            <button
              id="tab-create-btn"
              type="button"
              onClick={() => handleTabChange('create')}
              className={`py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border-2 ${
                activeTab === 'create'
                  ? 'bg-[#FFD93D] text-black border-black shadow-brutal-sm'
                  : 'border-transparent text-black/60 hover:text-black'
              }`}
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              <span>创建房间</span>
            </button>
          </div>

          {/* Avatar Selection Box */}
          <div className="p-3 bg-[#FFFDF9] border-2 border-black rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black flex items-center gap-1.5">
                <Smile className="w-4 h-4 stroke-[2.5]" />
                <span>选择我的头像</span>
              </span>
              <button
                type="button"
                id="open-avatar-picker-btn"
                onClick={() => { sounds.playTap(); setIsAvatarPickerOpen(true); }}
                className="text-[11px] font-black text-black bg-[#FFD93D] hover:bg-[#ffcd1a] px-2.5 py-1 rounded-lg border-2 border-black shadow-brutal-sm flex items-center gap-1 active:translate-x-0.5 active:translate-y-0.5"
              >
                <Edit3 className="w-3 h-3 stroke-[2.5]" />
                <span>更多/自定义</span>
              </button>
            </div>

            {/* Quick avatar selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
              <div 
                onClick={() => { sounds.playTap(); setIsAvatarPickerOpen(true); }}
                className="shrink-0 cursor-pointer"
                title="点击更换头像"
              >
                <AvatarDisplay avatar={avatar} nickname={nickname || '我'} size="lg" className="ring-2 ring-black" />
              </div>

              <div className="h-8 w-0.5 bg-black/20 shrink-0" />

              {QUICK_AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => { sounds.playTap(); handleSelectAvatar(emoji); }}
                  className={`w-9 h-9 shrink-0 rounded-xl border-2 border-black flex items-center justify-center text-lg transition-transform active:scale-90 ${
                    avatar === emoji
                      ? 'bg-[#FFD93D] ring-2 ring-black scale-110 shadow-brutal-sm'
                      : 'bg-white hover:bg-black/5'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-[#FF6B6B] border-2 border-black text-white text-xs font-black shadow-brutal-sm space-y-2.5">
              <div className="leading-snug">{errorMessage}</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsDiagnosticOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-black text-[#FFE66D] border border-black text-xs font-black inline-flex items-center gap-1.5 hover:bg-neutral-800 active:scale-95 cursor-pointer shadow-brutal-xs"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>🔍 打开网络与后端诊断排查</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBackendConfig(!showBackendConfig)}
                  className="px-2.5 py-1.5 rounded-xl bg-white text-black border border-black text-xs font-black inline-flex items-center gap-1 hover:bg-neutral-100 active:scale-95 cursor-pointer"
                >
                  <Link className="w-3.5 h-3.5" />
                  <span>快速输入地址</span>
                </button>
              </div>
            </div>
          )}

          {/* Backend URL Custom Config Box */}
          {showBackendConfig && (
            <form onSubmit={handleSaveBackendUrl} className="p-3.5 bg-[#FFF9D2] border-2 border-black rounded-2xl space-y-2 animate-fade-in text-black">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black flex items-center gap-1.5 text-black">
                  <Link className="w-4 h-4 text-black stroke-[2.5]" />
                  <span>后端服务地址 (API Server)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowBackendConfig(false)}
                  className="text-[11px] text-neutral-600 font-bold hover:text-black underline"
                >
                  关闭
                </button>
              </div>
              <p className="text-[11px] text-neutral-700 font-bold leading-tight">
                如果您将前端部署在 Cloudflare Pages，请在此输入 Render 提供的后端完整公网网址（例如 <code>https://xxx.onrender.com</code>）：
              </p>
              <div className="flex gap-1.5">
                <input
                  type="url"
                  placeholder="https://your-app.onrender.com"
                  value={backendUrlInput}
                  onChange={(e) => setBackendUrlInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-bold bg-white border-2 border-black rounded-xl focus:outline-hidden"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-black text-white rounded-xl text-xs font-black border-2 border-black shadow-brutal-sm hover:bg-neutral-800 active:scale-95 flex items-center gap-1 shrink-0"
                >
                  {backendSavedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                  <span>{backendSavedSuccess ? '已保存!' : '保存'}</span>
                </button>
              </div>
            </form>
          )}

          {/* JOIN FORM */}
          {activeTab === 'join' ? (
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              {/* Nickname Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-black flex items-center gap-1.5">
                  <User className="w-4 h-4 text-black stroke-[2.5]" />
                  <span>我的昵称</span>
                </label>
                <input
                  id="join-nickname-input"
                  type="text"
                  placeholder="输入你的游戏昵称 (2-16字)"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={16}
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-black text-sm font-bold text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-black shadow-inner"
                />
              </div>

              {/* Room Code Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-black flex items-center gap-1.5">
                  <Gamepad2 className="w-4 h-4 text-black stroke-[2.5]" />
                  <span>6 位房间码</span>
                </label>
                <input
                  id="join-room-code-input"
                  type="text"
                  placeholder="如：ABC892"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-black text-lg font-mono font-black text-center tracking-widest text-black placeholder-black/30 focus:outline-none focus:ring-2 focus:ring-black shadow-inner uppercase"
                />
              </div>

              <button
                id="join-room-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 rounded-2xl bg-black hover:bg-black/90 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none font-black text-sm uppercase tracking-wider text-white border-2 border-black shadow-brutal flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span className="animate-pulse">正在加入房间...</span>
                ) : (
                  <>
                    <span>进入游戏房间</span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* CREATE FORM */
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Nickname Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-black flex items-center gap-1.5">
                  <User className="w-4 h-4 text-black stroke-[2.5]" />
                  <span>房主昵称</span>
                </label>
                <input
                  id="create-nickname-input"
                  type="text"
                  placeholder="输入房主昵称 (2-16字)"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={16}
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-black text-sm font-bold text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-black shadow-inner"
                />
              </div>

              {/* Room Title (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-black">
                  房间名称 (选填)
                </label>
                <input
                  id="create-room-title-input"
                  type="text"
                  placeholder="如：麻将局 / 德扑聚会 / 狼人杀记分"
                  value={roomTitle}
                  onChange={(e) => setRoomTitle(e.target.value)}
                  maxLength={24}
                  className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-black text-sm font-bold text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-black shadow-inner"
                />
              </div>

              {/* Game Mode Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-black flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-black stroke-[2.5]" />
                  <span>记分模式</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    id="create-mode-free-btn"
                    onClick={() => { sounds.playTap(); setMode('free'); }}
                    className={`p-3 rounded-2xl border-2 border-black text-left text-xs transition-all shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 ${
                      mode === 'free'
                        ? 'bg-[#4ECDC4] text-black font-black ring-2 ring-black'
                        : 'bg-white text-black hover:bg-black/5 font-bold'
                    }`}
                  >
                    <div className="font-black text-sm">自由模式</div>
                    <div className="text-[10px] opacity-80 mt-0.5 font-bold">送分不扣除己方分数</div>
                  </button>

                  <button
                    type="button"
                    id="create-mode-zero-btn"
                    onClick={() => { sounds.playTap(); setMode('zero_sum'); }}
                    className={`p-3 rounded-2xl border-2 border-black text-left text-xs transition-all shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 ${
                      mode === 'zero_sum'
                        ? 'bg-[#FFD93D] text-black font-black ring-2 ring-black'
                        : 'bg-white text-black hover:bg-black/5 font-bold'
                    }`}
                  >
                    <div className="font-black text-sm">筹码 / 零和模式</div>
                    <div className="text-[10px] opacity-80 mt-0.5 font-bold">给多少分对应扣己方</div>
                  </button>
                </div>
              </div>

              {/* Initial Base Score */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-black flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-black stroke-[2.5]" />
                    <span>初始基础分</span>
                  </span>
                  <span className="text-[11px] text-black/70 font-bold">新人进房默认携带</span>
                </label>
                <div className="flex gap-2">
                  {[0, 100, 500, 1000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => { sounds.playTap(); setInitialScore(val); }}
                      className={`flex-1 py-2 rounded-xl font-mono font-black text-xs border-2 border-black transition-all shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 ${
                        initialScore === val
                          ? 'bg-[#FFD93D] text-black ring-1 ring-black'
                          : 'bg-white text-black hover:bg-black/5'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Retention Policy Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-black flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-black stroke-[2.5]" />
                  <span>房间保留时长与离线策略</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { key: 'offline_30s', label: '离线30s解散', desc: '全员离线30秒后解散' },
                    { key: '1h', label: '保持 1 小时', desc: '1小时后自动过期' },
                    { key: '24h', label: '保持 24 小时', desc: '整天有效' },
                    { key: 'permanent', label: '永久保留', desc: '不自动解散' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => { sounds.playTap(); setRetention(item.key as RoomRetention); }}
                      className={`p-2 rounded-xl border-2 border-black text-left text-xs transition-all shadow-brutal-sm ${
                        retention === item.key
                          ? 'bg-[#FFD93D] text-black font-black ring-1 ring-black'
                          : 'bg-white text-black hover:bg-black/5'
                      }`}
                    >
                      <div className="font-black text-xs">{item.label}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                id="create-room-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 rounded-2xl bg-black hover:bg-black/90 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none font-black text-sm uppercase tracking-wider text-white border-2 border-black shadow-brutal flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span className="animate-pulse">正在创建房间...</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 stroke-[2.5]" />
                    <span>创建专属房间</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Server Admin Entry Button */}
        {onOpenServerAdmin && (
          <div className="text-center">
            <button
              id="open-server-admin-btn"
              type="button"
              onClick={onOpenServerAdmin}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border-2 border-black text-xs font-black shadow-brutal-sm hover:bg-neutral-50 active:scale-95 transition-all text-neutral-800"
            >
              <Server className="w-4 h-4 text-neutral-600" />
              <span>🖥️ 查看服务器所有房间与后台管理</span>
            </button>
          </div>
        )}

        {/* Feature Highlights Footer */}
        <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-black font-black">
          <div className="p-2.5 rounded-xl bg-white border-2 border-black shadow-brutal-sm">
            🔒 扣分确认机制
          </div>
          <div className="p-2.5 rounded-xl bg-white border-2 border-black shadow-brutal-sm">
            ⚡️ 离线智能解散
          </div>
          <div className="p-2.5 rounded-xl bg-white border-2 border-black shadow-brutal-sm">
            📱 手机全屏适配
          </div>
        </div>

        {/* Backend configuration switcher toggle & Network Diagnostic */}
        <div className="text-center pt-1 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setIsDiagnosticOpen(true)}
            className="text-[11px] text-[#4D96FF] hover:text-blue-700 font-black inline-flex items-center gap-1 transition-colors cursor-pointer bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>🔧 网络与 API 连通性排查</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBackendConfig(!showBackendConfig)}
            className="text-[11px] text-neutral-500 font-bold hover:text-black inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Link className="w-3 h-3" />
            <span>{getApiBaseUrl() ? `后端: ${getApiBaseUrl()}` : '手动填入后端地址'}</span>
          </button>
        </div>

        {/* Network Diagnostic Modal */}
        <NetworkDiagnosticModal
          isOpen={isDiagnosticOpen}
          onClose={() => setIsDiagnosticOpen(false)}
        />
      </div>
    </div>
  );
};

