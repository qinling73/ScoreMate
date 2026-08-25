import React, { useState, useEffect } from 'react';
import { GameMode } from '../types';
import { getStoredNickname, setStoredNickname } from '../services/api';
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
  Layers
} from 'lucide-react';

interface JoinCreateModalProps {
  onJoin: (nickname: string, roomCode: string) => Promise<void>;
  onCreate: (nickname: string, roomTitle: string, mode: GameMode, initialScore: number) => Promise<void>;
  initialRoomCode?: string;
}

export const JoinCreateModal: React.FC<JoinCreateModalProps> = ({
  onJoin,
  onCreate,
  initialRoomCode = '',
}) => {
  const [activeTab, setActiveTab] = useState<'join' | 'create'>(initialRoomCode ? 'join' : 'create');
  const [nickname, setNickname] = useState<string>(getStoredNickname() || '');
  
  // Join Tab State
  const [roomCode, setRoomCode] = useState<string>(initialRoomCode);

  // Create Tab State
  const [roomTitle, setRoomTitle] = useState<string>('');
  const [mode, setMode] = useState<GameMode>('free');
  const [initialScore, setInitialScore] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (initialRoomCode) {
      setRoomCode(initialRoomCode);
      setActiveTab('join');
    }
  }, [initialRoomCode]);

  const handleTabChange = (tab: 'join' | 'create') => {
    sounds.playTap();
    setActiveTab(tab);
    setErrorMessage('');
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      await onJoin(nickname.trim(), roomCode.trim().toUpperCase());
      sounds.playScoreSent();
    } catch (err: any) {
      setErrorMessage(err.message || '加入房间失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setErrorMessage('请输入房主昵称 (2-16字符)');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      setStoredNickname(nickname.trim());
      await onCreate(
        nickname.trim(),
        roomTitle.trim() || `${nickname.trim()}的记分房间`,
        mode,
        initialScore
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
      {/* Neo-brutalist floating accents */}
      <div className="absolute top-8 left-8 w-16 h-16 bg-[#FFD93D] border-3 border-black rounded-2xl shadow-brutal -rotate-6 pointer-events-none hidden sm:block" />
      <div className="absolute bottom-12 right-12 w-20 h-20 bg-[#4ECDC4] border-3 border-black rounded-3xl shadow-brutal rotate-12 pointer-events-none hidden sm:block" />
      <div className="absolute top-1/3 right-8 w-12 h-12 bg-[#FF6B6B] border-3 border-black rounded-full shadow-brutal-sm pointer-events-none hidden sm:block" />

      <div className="max-w-md w-full z-10 space-y-5">
        {/* App Title & Intro Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-[#FFD93D] border-3 border-black text-black shadow-brutal-sm rotate-1">
            <Gamepad2 className="w-9 h-9 stroke-[2.5]" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-black uppercase italic">
            多人实时游戏记分
          </h1>
          <p className="text-xs text-black/80 font-black max-w-xs mx-auto">
            免繁琐注册 • 多人实时同步 • 自由/筹码模式 • 排行与流水播报
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white border-4 border-black rounded-[28px] p-6 shadow-brutal space-y-5 text-black">
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

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-[#FF6B6B] border-2 border-black text-white text-xs font-black shadow-brutal-sm">
              {errorMessage}
            </div>
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

        {/* Feature Highlights Footer */}
        <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-black font-black">
          <div className="p-2.5 rounded-xl bg-white border-2 border-black shadow-brutal-sm">
            🔒 会话安全恢复
          </div>
          <div className="p-2.5 rounded-xl bg-white border-2 border-black shadow-brutal-sm">
            ⚡️ 毫秒级广播同步
          </div>
          <div className="p-2.5 rounded-xl bg-white border-2 border-black shadow-brutal-sm">
            📱 小程序无缝接入
          </div>
        </div>
      </div>
    </div>
  );
};
