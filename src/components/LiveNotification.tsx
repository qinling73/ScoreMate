import React, { useEffect, useState } from 'react';
import { ScoreLog } from '../types';
import { Sparkles, ArrowRight, Bell } from 'lucide-react';

interface LiveNotificationProps {
  latestLog: ScoreLog | null;
  systemMessage: string | null;
}

export const LiveNotification: React.FC<LiveNotificationProps> = ({
  latestLog,
  systemMessage,
}) => {
  const [visible, setVisible] = useState(false);
  const [currentText, setCurrentText] = useState<{
    title: string;
    subtitle?: string;
    isScore: boolean;
  } | null>(null);

  useEffect(() => {
    if (systemMessage) {
      setCurrentText({
        title: '📢 房间通知',
        subtitle: systemMessage,
        isScore: false,
      });
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [systemMessage]);

  useEffect(() => {
    if (latestLog) {
      if (latestLog.toUserId === 'all' || latestLog.toUserId === 'room') {
        setCurrentText({
          title: '⚙️ 房间设置变更',
          subtitle: latestLog.note || '房主更新了规则',
          isScore: false,
        });
      } else {
        const sign = latestLog.amount > 0 ? `+${latestLog.amount}` : `${latestLog.amount}`;
        setCurrentText({
          title: `⚡️ ${latestLog.fromNickname} 给了 ${latestLog.toNickname} ${sign} 分`,
          subtitle: latestLog.note ? `备注：${latestLog.note}` : undefined,
          isScore: true,
        });
      }
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [latestLog]);

  if (!visible || !currentText) return null;

  return (
    <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4 pointer-events-none animate-slide-down select-none">
      <div className={`p-3 rounded-2xl border-3 border-black shadow-brutal flex items-center gap-3 text-black ${
        currentText.isScore
          ? 'bg-[#FFD93D]'
          : 'bg-[#4ECDC4]'
      }`}>
        <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shrink-0 border border-black">
          {currentText.isScore ? (
            <Sparkles className="w-4 h-4 text-[#FFD93D] stroke-[2.5]" />
          ) : (
            <Bell className="w-4 h-4 text-white stroke-[2.5]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black truncate uppercase">{currentText.title}</div>
          {currentText.subtitle && (
            <div className="text-[11px] font-bold text-black/80 truncate mt-0.5">{currentText.subtitle}</div>
          )}
        </div>
      </div>
    </div>
  );
};
