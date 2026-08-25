import React, { useState } from 'react';
import { Room, Player, ScoreLog } from '../types';
import { sounds } from '../utils/audio';
import { 
  ScrollText, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  Copy, 
  Check, 
  Filter, 
  Coins, 
  Sparkles,
  Calendar
} from 'lucide-react';

interface LogTabProps {
  room: Room;
  currentPlayer: Player | null;
}

export const LogTab: React.FC<LogTabProps> = ({ room, currentPlayer }) => {
  const [subTab, setSubTab] = useState<'global' | 'my'>('global');
  const [copiedReport, setCopiedReport] = useState(false);

  const logs = room.logs || [];

  // Personal logs
  const myGivenLogs = logs.filter((l) => l.fromUserId === currentPlayer?.id && l.toUserId !== currentPlayer?.id);
  const myReceivedLogs = logs.filter((l) => l.toUserId === currentPlayer?.id && l.fromUserId !== currentPlayer?.id);
  const myRelatedLogs = logs.filter(
    (l) => l.fromUserId === currentPlayer?.id || l.toUserId === currentPlayer?.id || l.toUserId === 'all'
  );

  // Calculations for personal ledger
  const totalGivenAmount = myGivenLogs.reduce((acc, l) => acc + Math.abs(l.amount), 0);
  const totalReceivedAmount = myReceivedLogs.reduce((acc, l) => acc + l.amount, 0);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // Generate copyable battle report
  const handleCopyReport = async () => {
    sounds.playTap();
    const sorted = (Object.values(room.members) as Player[]).sort((a, b) => b.score - a.score);
    const lines = [
      `📊【${room.title}】实时战报播报`,
      `⏰ 统计时间：${new Date().toLocaleTimeString('zh-CN')}`,
      `🔑 房间码：${room.code}`,
      `-----------------------`,
      ...sorted.map((p, idx) => {
        const medal = idx === 0 ? '👑 榜首' : idx === 1 ? '🥈 榜眼' : idx === 2 ? '🥉 探花' : `第${idx + 1}名`;
        const scoreStr = p.score > 0 ? `+${p.score}` : `${p.score}`;
        return `${medal}: ${p.nickname} -> ${scoreStr} 分`;
      }),
      `-----------------------`,
      `🎲 累计记录 ${logs.length} 笔流水`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2000);
    } catch {
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2000);
    }
  };

  return (
    <div className="space-y-4 pb-20 select-none">
      {/* Sub-tab switcher and battle report copy */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex bg-white border-2 border-black p-1 rounded-2xl shadow-brutal-sm">
          <button
            id="subtab-global"
            onClick={() => { sounds.playTap(); setSubTab('global'); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              subTab === 'global'
                ? 'bg-black text-white shadow-sm'
                : 'text-black/70 hover:text-black'
            }`}
          >
            🔥 全局流水 ({logs.length})
          </button>
          <button
            id="subtab-my"
            onClick={() => { sounds.playTap(); setSubTab('my'); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              subTab === 'my'
                ? 'bg-[#FFD93D] text-black shadow-sm'
                : 'text-black/70 hover:text-black'
            }`}
          >
            📊 我的账单 ({myRelatedLogs.length})
          </button>
        </div>

        <button
          id="copy-report-btn"
          onClick={handleCopyReport}
          className="px-3 py-2 rounded-xl bg-white hover:bg-[#FFD93D] text-black border-2 border-black text-xs font-black flex items-center gap-1.5 shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-transform"
        >
          {copiedReport ? <Check className="w-4 h-4 text-black stroke-[3]" /> : <Copy className="w-4 h-4 stroke-[2.5]" />}
          <span>{copiedReport ? '已复制战报' : '复制战报'}</span>
        </button>
      </div>

      {/* Personal Ledger Summary Cards */}
      {subTab === 'my' && (
        <div className="grid grid-cols-3 gap-2.5 animate-fade-in text-black">
          <div className="p-3 rounded-2xl bg-[#FF8C61] border-2 border-black text-center shadow-brutal-sm">
            <div className="text-[10px] font-black uppercase text-black/70">我给出的分</div>
            <div className="text-base font-black text-black mt-0.5">
              {totalGivenAmount} 分
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#4ECDC4] border-2 border-black text-center shadow-brutal-sm">
            <div className="text-[10px] font-black uppercase text-black/70">我收到的分</div>
            <div className="text-base font-black text-black mt-0.5">
              +{totalReceivedAmount} 分
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#FFD93D] border-2 border-black text-center shadow-brutal-sm">
            <div className="text-[10px] font-black uppercase text-black/70">我的总分</div>
            <div className="text-base font-black text-black mt-0.5">
              {(currentPlayer?.score || 0) > 0 ? `+${currentPlayer?.score}` : currentPlayer?.score || 0}
            </div>
          </div>
        </div>
      )}

      {/* Logs List */}
      <div className="space-y-2.5">
        {logs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-[24px] border-4 border-black shadow-brutal text-black">
            <ScrollText className="w-10 h-10 text-black mx-auto mb-2 stroke-[2.5]" />
            <p className="text-sm font-black text-black">暂无记分记录</p>
            <p className="text-xs text-black/70 mt-1 font-bold">
              在【记分】界面提交操作后，每笔流水将实时同步展示在此处
            </p>
          </div>
        ) : (
          (subTab === 'global' ? logs : myRelatedLogs).map((item) => {
            const isFromMe = item.fromUserId === currentPlayer?.id;
            const isToMe = item.toUserId === currentPlayer?.id;
            const isSystemAction = item.toUserId === 'all' || item.toUserId === 'room';

            return (
              <div
                key={item.id}
                id={`log-item-${item.id}`}
                className={`p-3.5 rounded-2xl border-3 border-black text-xs transition-all shadow-brutal-sm ${
                  isSystemAction
                    ? 'bg-black/5 text-black'
                    : isToMe
                      ? 'bg-[#4ECDC4] text-black font-bold'
                      : isFromMe
                        ? 'bg-[#FFD93D] text-black font-bold'
                        : 'bg-white text-black font-bold'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Left: Action description */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="shrink-0">
                      {isSystemAction ? (
                        <div className="w-7 h-7 rounded-xl bg-black text-white border-2 border-black flex items-center justify-center font-black">
                          ⚙️
                        </div>
                      ) : isToMe ? (
                        <div className="w-7 h-7 rounded-xl bg-black text-white border-2 border-black flex items-center justify-center font-black">
                          <ArrowDownLeft className="w-4 h-4 text-white stroke-[3]" />
                        </div>
                      ) : isFromMe ? (
                        <div className="w-7 h-7 rounded-xl bg-black text-white border-2 border-black flex items-center justify-center font-black">
                          <ArrowUpRight className="w-4 h-4 text-white stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-xl bg-white text-black border-2 border-black flex items-center justify-center font-black">
                          •
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-black">
                        {isSystemAction ? (
                          <span className="text-black">{item.note}</span>
                        ) : (
                          <>
                            <span className="text-black">
                              {isFromMe ? '你' : item.fromNickname}
                            </span>
                            <span className="text-black/60 mx-1 font-bold">给了</span>
                            <span className="text-black">
                              {isToMe ? '你' : item.toNickname}
                            </span>
                          </>
                        )}
                      </div>

                      {item.note && !isSystemAction && (
                        <div className="text-xs text-black/80 mt-0.5 flex items-center gap-1">
                          <span className="px-1.5 py-0.2 rounded-md bg-white text-black font-black border border-black shadow-sm">
                            {item.note}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Amount & Timestamp */}
                  <div className="text-right shrink-0">
                    {!isSystemAction && (
                      <div className={`text-base font-black ${
                        item.amount > 0 ? 'text-black' : 'text-[#FF6B6B]'
                      }`}>
                        {item.amount > 0 ? `+${item.amount}` : item.amount} 分
                      </div>
                    )}
                    <div className="text-[10px] text-black/60 font-black">
                      {formatTime(item.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
