import React from 'react';
import { Room, Player } from '../types';
import { sounds } from '../utils/audio';
import { AvatarDisplay } from './AvatarDisplay';
import confetti from 'canvas-confetti';
import { 
  Trophy, 
  Crown, 
  Medal, 
  TrendingUp, 
  TrendingDown, 
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Flame,
  Share2
} from 'lucide-react';

interface LeaderboardTabProps {
  room: Room;
  currentPlayer: Player | null;
  onSelectPlayerToScore: (playerId: string) => void;
  onOpenShareModal?: (defaultType?: 'leaderboard' | 'logs') => void;
  onOpenAvatarPicker?: () => void;
}

export const LeaderboardTab: React.FC<LeaderboardTabProps> = ({
  room,
  currentPlayer,
  onSelectPlayerToScore,
  onOpenShareModal,
  onOpenAvatarPicker,
}) => {
  const members = Object.values(room.members) as Player[];
  const sorted: Player[] = [...members].sort((a, b) => b.score - a.score);
  const leader = sorted[0];
  const lowest = sorted.length > 1 ? sorted[sorted.length - 1] : null;

  const triggerCelebration = () => {
    sounds.playCelebration();
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#10b981', '#6366f1', '#ec4899'],
      });
    } catch {}
  };

  return (
    <div className="space-y-4 pb-20 select-none">
      {/* 1. Header Trophy Banner */}
      <div className="bg-white border-4 border-black rounded-[24px] p-4 shadow-brutal relative overflow-hidden text-black">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FFD93D] border-2 border-black flex items-center justify-center text-black shadow-brutal-sm">
              <Trophy className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black uppercase italic tracking-tight text-black">实时排行榜</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-black text-white font-black tracking-wider">
                  LIVE
                </span>
              </div>
              <p className="text-xs text-black/70 font-bold mt-0.5">
                {leader ? `当前榜首【${leader.nickname}】领跑中` : '暂无玩家'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenShareModal && (
              <button
                id="share-report-btn"
                onClick={() => { sounds.playTap(); onOpenShareModal('leaderboard'); }}
                className="px-3 py-2 rounded-xl bg-white hover:bg-[#FFD93D] text-black border-2 border-black font-black text-xs flex items-center gap-1.5 shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-transform"
                title="生成并分享战报图片"
              >
                <Share2 className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">生成战报长图</span>
                <span className="sm:hidden">分享长图</span>
              </button>
            )}

            {leader && (
              <button
                id="celebrate-btn"
                onClick={triggerCelebration}
                className="px-3 py-2 rounded-xl bg-[#4ECDC4] hover:bg-[#3dbdb4] text-black border-2 border-black font-black text-xs flex items-center gap-1.5 shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-transform"
                title="放礼花庆祝"
              >
                <Sparkles className="w-4 h-4 stroke-[2.5]" />
                <span>庆祝</span>
              </button>
            )}
          </div>
        </div>

        {/* Highlight Score Gap */}
        {leader && lowest && leader.id !== lowest.id && (
          <div className="mt-3 pt-3 border-t-2 border-black flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-1.5 text-black">
              <Crown className="w-4 h-4 text-black stroke-[2.5]" />
              <span>最高分：</span>
              <span className="font-black text-black">{leader.score} 分</span>
            </div>
            <div className="flex items-center gap-1.5 text-black/80 font-black">
              <span>分差：</span>
              <span className="px-2 py-0.5 rounded bg-[#FF6B6B] text-white border border-black shadow-brutal-sm">
                {leader.score - lowest.score} 分
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Leaderboard List */}
      <div className="space-y-3">
        {sorted.map((player, index) => {
          const isCurrent = player.id === currentPlayer?.id;
          const isTop1 = index === 0;
          const isTop2 = index === 1;
          const isTop3 = index === 2;
          const isLowest = lowest && player.id === lowest.id && sorted.length > 2;

          let rankBadge = (
            <span className="w-8 h-8 rounded-xl bg-white border-2 border-black text-black text-sm font-black flex items-center justify-center shadow-brutal-sm">
              {index + 1}
            </span>
          );

          if (isTop1) {
            rankBadge = (
              <div className="w-9 h-9 rounded-xl bg-[#FFD93D] border-2 border-black text-black flex items-center justify-center font-black shadow-brutal-sm">
                <Crown className="w-5 h-5 stroke-[2.5]" />
              </div>
            );
          } else if (isTop2) {
            rankBadge = (
              <div className="w-8 h-8 rounded-xl bg-[#4ECDC4] border-2 border-black text-black flex items-center justify-center font-black text-sm shadow-brutal-sm">
                2
              </div>
            );
          } else if (isTop3) {
            rankBadge = (
              <div className="w-8 h-8 rounded-xl bg-[#FF8C61] border-2 border-black text-black flex items-center justify-center font-black text-sm shadow-brutal-sm">
                3
              </div>
            );
          }

          return (
            <div
              key={player.id}
              id={`rank-card-${player.id}`}
              className={`p-3.5 rounded-2xl border-4 border-black transition-all shadow-brutal ${
                isTop1
                  ? 'bg-[#FFD93D] text-black font-bold'
                  : isLowest
                    ? 'bg-black text-white'
                    : isCurrent
                      ? 'bg-[#4ECDC4] text-black'
                      : 'bg-white text-black'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                {/* Left: Rank & User */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0">{rankBadge}</div>

                  {/* Avatar with Click to edit if current user */}
                  <AvatarDisplay
                    avatar={player.avatar}
                    avatarColor={player.avatarColor}
                    nickname={player.nickname}
                    isOnline={player.isOnline}
                    size="md"
                    onClick={isCurrent ? onOpenAvatarPicker : undefined}
                    className={isCurrent ? 'ring-2 ring-black' : ''}
                  />

                  {/* Nickname & Badges */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-base font-black truncate ${isLowest ? 'text-white' : 'text-black'}`}>
                        {player.nickname}
                      </span>
                      {isCurrent && (
                        <span 
                          onClick={onOpenAvatarPicker}
                          title="点击更换我的头像"
                          className={`text-[10px] px-1.5 py-0.2 rounded border font-black cursor-pointer ${
                            isLowest 
                              ? 'bg-white text-black border-white' 
                              : 'bg-black text-white border-black'
                          }`}
                        >
                          我
                        </span>
                      )}
                      {player.isHost && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-black text-white font-black">
                          房主
                        </span>
                      )}
                    </div>

                    <div className={`flex items-center gap-2 text-xs mt-0.5 font-bold ${
                      isLowest ? 'text-white/70' : 'text-black/70'
                    }`}>
                      {isTop1 ? (
                        <span className="flex items-center gap-1 text-black font-black">
                          <Flame className="w-3.5 h-3.5 stroke-[2.5]" /> 榜首领跑
                        </span>
                      ) : isLowest ? (
                        <span className="text-[#FF6B6B] font-black flex items-center gap-0.5">
                          <TrendingDown className="w-3.5 h-3.5 stroke-[2.5]" /> 暂时落后 (-{leader.score - player.score}分)
                        </span>
                      ) : (
                        <span>距榜首 -{leader.score - player.score} 分</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Score & Quick Score Action */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <div className={`text-xl font-black ${
                      isLowest
                        ? player.score < 0 ? 'text-[#FF6B6B]' : 'text-white'
                        : player.score > 0 
                          ? 'text-black' 
                          : player.score < 0 
                            ? 'text-[#FF6B6B]' 
                            : 'text-black/80'
                    }`}>
                      {player.score > 0 ? `+${player.score}` : player.score}
                    </div>
                    <div className={`text-[10px] font-bold ${isLowest ? 'text-white/60' : 'text-black/60'}`}>
                      得分
                    </div>
                  </div>

                  {!isCurrent && (
                    <button
                      id={`quick-score-btn-${player.id}`}
                      onClick={() => onSelectPlayerToScore(player.id)}
                      className={`p-2 rounded-xl border-2 border-black font-black shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-transform ${
                        isLowest 
                          ? 'bg-white text-black hover:bg-[#FFD93D]' 
                          : 'bg-black text-white hover:bg-black/80'
                      }`}
                      title="向 TA 给分"
                    >
                      <ArrowRight className="w-4 h-4 stroke-[3]" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
