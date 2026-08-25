import React, { useState } from 'react';
import { Room, Player } from '../types';
import { sounds } from '../utils/audio';
import { 
  Users, 
  Send, 
  CheckSquare, 
  Square, 
  Minus, 
  Plus, 
  Sparkles, 
  Tag, 
  Coins, 
  Info,
  CheckCircle2
} from 'lucide-react';

interface ScoreTabProps {
  room: Room;
  currentPlayer: Player | null;
  onSubmitScore: (payload: { targetUserIds: string[]; amount: number; note?: string }) => Promise<void>;
  onNavigateToTab: (tab: 'score' | 'leaderboard' | 'logs' | 'manage') => void;
}

const PRESET_AMOUNTS = [1, 2, 5, 10, 20, 50, 100];
const QUICK_NOTES = ['🏆 胜局获胜', '🀄️ 胡牌/自摸', '💥 炸弹翻倍', '☕️ 犯规/请客', '✨ 奖励分', '🎯 任务完成'];

export const ScoreTab: React.FC<ScoreTabProps> = ({
  room,
  currentPlayer,
  onSubmitScore,
  onNavigateToTab,
}) => {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [amount, setAmount] = useState<number>(10);
  const [customInput, setCustomInput] = useState<string>('10');
  const [isPositive, setIsPositive] = useState<boolean>(true);
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [justSubmitted, setJustSubmitted] = useState<boolean>(false);

  const membersList = (Object.values(room.members) as Player[]).sort((a, b) => {
    // Current user first, then host, then by name
    if (a.id === currentPlayer?.id) return -1;
    if (b.id === currentPlayer?.id) return 1;
    return b.score - a.score;
  });

  const otherMembers = membersList.filter((m) => m.id !== currentPlayer?.id);

  // Target toggle
  const toggleSelectUser = (id: string) => {
    sounds.playTap();
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Select all others
  const handleSelectAllOthers = () => {
    sounds.playTap();
    if (selectedUserIds.length === otherMembers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(otherMembers.map((m) => m.id));
    }
  };

  // Preset amount click
  const handlePresetClick = (val: number) => {
    sounds.playTap();
    setAmount(val);
    setCustomInput(String(val));
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setCustomInput(valStr);
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setAmount(parsed);
    }
  };

  const finalAmount = isPositive ? amount : -amount;

  const handleSubmit = async () => {
    if (selectedUserIds.length === 0) {
      sounds.playTap();
      alert('请先选择至少一位受分玩家');
      return;
    }
    if (amount === 0 || isNaN(amount)) {
      alert('请输入有效的记分数值');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmitScore({
        targetUserIds: selectedUserIds,
        amount: finalAmount,
        note: note.trim() || undefined,
      });

      sounds.playScoreSent();
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 2000);
      // Keep selection or reset note
      setNote('');
    } catch (err: any) {
      alert(err.message || '记分提交失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const targetCount = selectedUserIds.length;
  const totalCost = room.mode === 'zero_sum' ? finalAmount * targetCount : 0;
  const giverNextScore = (currentPlayer?.score || 0) - totalCost;

  return (
    <div className="space-y-4 pb-20 select-none">
      {/* 1. Mode Status Banner */}
      <div className={`p-3 rounded-2xl border-2 border-black flex items-start gap-2.5 text-xs shadow-brutal-sm font-bold ${
        room.mode === 'zero_sum' 
          ? 'bg-[#FFD93D] text-black' 
          : 'bg-[#4ECDC4] text-black'
      }`}>
        <Coins className="w-4 h-4 shrink-0 mt-0.5 text-black stroke-[2.5]" />
        <div className="flex-1">
          <div className="font-black flex items-center justify-between">
            <span>当前模式：{room.mode === 'zero_sum' ? '零和 / 筹码模式 (转分互扣)' : '自由模式 (加分不扣己)'}</span>
          </div>
          <p className="text-[11px] opacity-90 mt-0.5 font-medium">
            {room.mode === 'zero_sum' 
              ? '给选定玩家每人多少分，将从您自己的分数中扣除等额筹码。' 
              : '给选定玩家加减分仅作为外部计分，不影响您自己的得分。'}
          </p>
        </div>
      </div>

      {/* 2. Target Players Selector */}
      <div className="bg-white border-4 border-black rounded-[24px] p-4 shadow-brutal text-black">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-black">
            <Users className="w-4 h-4 text-black stroke-[2.5]" />
            <span>选择受分玩家 ({selectedUserIds.length}/{otherMembers.length || 1})</span>
          </div>
          {otherMembers.length > 0 && (
            <button
              id="select-all-others-btn"
              onClick={handleSelectAllOthers}
              className="text-xs font-black text-black transition-transform active:translate-x-0.5 active:translate-y-0.5 px-2.5 py-1 rounded-lg bg-[#FFD93D] border-2 border-black shadow-brutal-sm hover:bg-[#ffcf10]"
            >
              {selectedUserIds.length === otherMembers.length ? '取消全选' : '除我全选'}
            </button>
          )}
        </div>

        {otherMembers.length === 0 ? (
          <div className="text-center py-6 px-4 bg-black/5 rounded-2xl border-2 border-dashed border-black">
            <p className="text-xs font-black text-black">目前房间只有你一人</p>
            <p className="text-[11px] text-black/70 mt-1 font-bold">
              点击上方【分享】按钮复制邀请码给好友加入
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {otherMembers.map((member) => {
              const isSelected = selectedUserIds.includes(member.id);
              return (
                <button
                  key={member.id}
                  id={`target-player-${member.id}`}
                  onClick={() => toggleSelectUser(member.id)}
                  className={`p-3 rounded-2xl border-2 border-black text-left flex items-center gap-2.5 transition-all shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
                    isSelected
                      ? 'bg-[#4ECDC4] text-black font-black'
                      : 'bg-white hover:bg-black/5 text-black'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-xl border-2 border-black flex items-center justify-center font-black text-xs text-black shrink-0 relative shadow-brutal-sm"
                    style={{ backgroundColor: member.avatarColor || '#FFD93D' }}
                  >
                    {member.nickname.slice(0, 1)}
                    {member.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#10B981] border border-black rounded-full" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black truncate">
                      {member.nickname}
                    </div>
                    <div className="text-[11px] font-bold text-black/70">
                      {member.score >= 0 ? `+${member.score}` : member.score} 分
                    </div>
                  </div>

                  {/* Checkbox Icon */}
                  <div className="shrink-0">
                    {isSelected ? (
                      <div className="w-5 h-5 rounded-md bg-black flex items-center justify-center text-white border border-black">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-md bg-white border-2 border-black" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Amount & Value Adjustment */}
      <div className="bg-white border-4 border-black rounded-[24px] p-4 shadow-brutal space-y-4 text-black">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-black">分值设置</span>
          {/* Sign Toggle: + / - */}
          <div className="flex items-center bg-black/5 rounded-xl p-1 border-2 border-black gap-1">
            <button
              id="score-sign-plus"
              onClick={() => { sounds.playTap(); setIsPositive(true); }}
              className={`px-3 py-1 text-xs font-black rounded-lg transition-all border-2 ${
                isPositive 
                  ? 'bg-[#4ECDC4] text-black border-black shadow-brutal-sm' 
                  : 'border-transparent text-black/60 hover:text-black'
              }`}
            >
              + 加分
            </button>
            <button
              id="score-sign-minus"
              onClick={() => { sounds.playTap(); setIsPositive(false); }}
              className={`px-3 py-1 text-xs font-black rounded-lg transition-all border-2 ${
                !isPositive 
                  ? 'bg-[#FF6B6B] text-white border-black shadow-brutal-sm' 
                  : 'border-transparent text-black/60 hover:text-black'
              }`}
            >
              - 扣分
            </button>
          </div>
        </div>

        {/* Big Amount Stepper with Neo-Brutalist Box */}
        <div className="flex items-center justify-center gap-4 bg-black/5 p-4 rounded-2xl border-2 border-black shadow-inner">
          <button
            id="amount-step-minus"
            onClick={() => {
              sounds.playTap();
              const next = Math.max(1, amount - (amount > 10 ? 5 : 1));
              setAmount(next);
              setCustomInput(String(next));
            }}
            className="w-12 h-12 rounded-xl bg-white border-2 border-black text-black font-black flex items-center justify-center shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none hover:bg-black hover:text-white transition-all"
          >
            <Minus className="w-6 h-6 stroke-[3]" />
          </button>

          <div className="flex items-baseline gap-1">
            <span className={`text-4xl font-black ${isPositive ? 'text-[#10B981]' : 'text-[#FF6B6B]'}`}>
              {isPositive ? '+' : '-'}
            </span>
            <input
              id="score-amount-input"
              type="number"
              min="1"
              max="99999"
              value={customInput}
              onChange={handleCustomInputChange}
              className="w-28 text-center text-5xl font-black bg-transparent text-black focus:outline-none focus:ring-0"
            />
            <span className="text-xs text-black/70 font-black uppercase">分 / 人</span>
          </div>

          <button
            id="amount-step-plus"
            onClick={() => {
              sounds.playTap();
              const next = amount + (amount >= 10 ? 5 : 1);
              setAmount(next);
              setCustomInput(String(next));
            }}
            className="w-12 h-12 rounded-xl bg-white border-2 border-black text-black font-black flex items-center justify-center shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none hover:bg-black hover:text-white transition-all"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
        </div>

        {/* Quick Amount Preset Chips */}
        <div>
          <div className="text-[11px] font-black uppercase text-black/70 mb-2">快捷分值：</div>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {PRESET_AMOUNTS.map((val) => (
              <button
                key={val}
                id={`preset-amt-${val}`}
                onClick={() => handlePresetClick(val)}
                className={`py-2 rounded-xl text-sm font-black transition-all border-2 border-black shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
                  amount === val
                    ? 'bg-[#FFD93D] text-black font-black scale-105'
                    : 'bg-white hover:bg-black hover:text-white text-black'
                }`}
              >
                {isPositive ? `+${val}` : `-${val}`}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Reason / Note */}
        <div className="pt-2 border-t-2 border-black">
          <div className="flex items-center gap-1 text-[11px] font-black uppercase text-black/70 mb-2">
            <Tag className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>备注 / 理由（可选）：</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {QUICK_NOTES.map((quickTag) => (
              <button
                key={quickTag}
                onClick={() => {
                  sounds.playTap();
                  setNote(quickTag);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all border-2 border-black shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 ${
                  note === quickTag
                    ? 'bg-[#FFD93D] text-black'
                    : 'bg-white hover:bg-black/5 text-black/80'
                }`}
              >
                {quickTag}
              </button>
            ))}
          </div>
          <input
            id="score-note-input"
            type="text"
            placeholder="输入自定义备注（如：炸弹翻倍、自摸等）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={30}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-black text-xs font-bold text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-black shadow-inner"
          />
        </div>
      </div>

      {/* 4. Real-time Calculation Summary Card */}
      {targetCount > 0 && (
        <div className="bg-[#FFD93D] border-3 border-black rounded-2xl p-3.5 text-xs text-black font-bold space-y-1.5 animate-fade-in shadow-brutal">
          <div className="flex items-center justify-between">
            <span className="text-black/80">受分目标：</span>
            <span className="font-black">{targetCount} 位玩家</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-black/80">每人获得：</span>
            <span className="font-black text-sm">
              {finalAmount > 0 ? `+${finalAmount}` : finalAmount} 分
            </span>
          </div>
          {room.mode === 'zero_sum' && (
            <div className="flex items-center justify-between pt-1.5 border-t-2 border-black font-black">
              <span>您将扣除筹码：</span>
              <span>
                -{totalCost} 分 (余额 {currentPlayer?.score || 0} → {giverNextScore})
              </span>
            </div>
          )}
        </div>
      )}

      {/* 5. Big Tactile Submit Action Button */}
      <button
        id="submit-score-btn"
        disabled={isSubmitting || targetCount === 0}
        onClick={handleSubmit}
        className={`w-full py-4 px-6 rounded-2xl font-black text-base uppercase tracking-wider flex items-center justify-center gap-2 border-3 border-black transition-all shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
          targetCount === 0
            ? 'bg-black/20 text-black/50 cursor-not-allowed border-black/30 shadow-none'
            : 'bg-black text-white hover:bg-black/90 active:scale-[0.98]'
        }`}
      >
        {isSubmitting ? (
          <span className="animate-pulse">正在同步记分...</span>
        ) : justSubmitted ? (
          <>
            <CheckCircle2 className="w-5 h-5 text-[#10B981] stroke-[3]" />
            <span>记分成功！</span>
          </>
        ) : (
          <>
            <Send className="w-5 h-5 stroke-[2.5]" />
            <span>
              {targetCount === 0 
                ? '请先勾选受分玩家' 
                : `确认给分 (${isPositive ? '+' : ''}${finalAmount * targetCount} 分)`}
            </span>
          </>
        )}
      </button>
    </div>
  );
};
