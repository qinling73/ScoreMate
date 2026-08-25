import React, { useEffect, useState } from 'react';
import { ScoreLog } from '../types';
import { Sparkles, Bell, UserPlus, UserMinus, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react';

export interface CustomNotification {
  id: string;
  type: 'score' | 'join' | 'leave' | 'deduct_request' | 'deduct_accepted' | 'deduct_rejected' | 'dissolve_warn' | 'system';
  title: string;
  subtitle?: string;
  timestamp: number;
}

interface LiveNotificationProps {
  latestLog: ScoreLog | null;
  systemMessage: string | null;
  customNotification?: CustomNotification | null;
}

export const LiveNotification: React.FC<LiveNotificationProps> = ({
  latestLog,
  systemMessage,
  customNotification,
}) => {
  const [notifications, setNotifications] = useState<CustomNotification[]>([]);

  // Add notification to stack and auto dismiss
  const pushNotification = (item: CustomNotification) => {
    setNotifications((prev) => [item, ...prev.slice(0, 2)]); // Keep max 3 on mobile screen

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== item.id));
    }, 4000);
  };

  useEffect(() => {
    if (customNotification) {
      pushNotification(customNotification);
    }
  }, [customNotification]);

  useEffect(() => {
    if (systemMessage) {
      pushNotification({
        id: 'sys_' + Date.now() + Math.random(),
        type: 'system',
        title: '📢 房间通知',
        subtitle: systemMessage,
        timestamp: Date.now(),
      });
    }
  }, [systemMessage]);

  useEffect(() => {
    if (latestLog) {
      if (latestLog.toUserId === 'all' || latestLog.toUserId === 'room') {
        pushNotification({
          id: 'log_' + latestLog.id,
          type: 'system',
          title: '⚙️ 房间设置变更',
          subtitle: latestLog.note || '房主更新了规则',
          timestamp: Date.now(),
        });
      } else {
        const sign = latestLog.amount > 0 ? `+${latestLog.amount}` : `${latestLog.amount}`;
        const isDeduct = latestLog.amount < 0;
        pushNotification({
          id: 'log_' + latestLog.id,
          type: isDeduct ? 'deduct_accepted' : 'score',
          title: isDeduct
            ? `📉 ${latestLog.toNickname} 已确认扣除 ${Math.abs(latestLog.amount)} 分`
            : `⚡️ ${latestLog.fromNickname} 给了 ${latestLog.toNickname} ${sign} 分`,
          subtitle: latestLog.note ? `备注：${latestLog.note}` : undefined,
          timestamp: Date.now(),
        });
      }
    }
  }, [latestLog]);

  const dismissOne = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div
      id="live-notifications-container"
      className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-20px)] max-w-sm sm:max-w-md pointer-events-none flex flex-col gap-2 select-none"
    >
      {notifications.map((item) => {
        let bgClass = 'bg-[#4ECDC4]';
        let icon = <Bell className="w-4 h-4 text-black stroke-[2.5]" />;
        let iconBg = 'bg-white/80';

        if (item.type === 'score') {
          bgClass = 'bg-[#FFD93D]';
          icon = <Sparkles className="w-4 h-4 text-amber-950 stroke-[2.5]" />;
          iconBg = 'bg-white/80';
        } else if (item.type === 'join') {
          bgClass = 'bg-[#C7F464]';
          icon = <UserPlus className="w-4 h-4 text-emerald-950 stroke-[2.5]" />;
          iconBg = 'bg-white/80';
        } else if (item.type === 'leave') {
          bgClass = 'bg-[#E2E8F0]';
          icon = <UserMinus className="w-4 h-4 text-slate-700 stroke-[2.5]" />;
          iconBg = 'bg-white/80';
        } else if (item.type === 'deduct_request') {
          bgClass = 'bg-[#FF9F43]';
          icon = <ShieldAlert className="w-4 h-4 text-white stroke-[2.5]" />;
          iconBg = 'bg-black';
        } else if (item.type === 'deduct_accepted') {
          bgClass = 'bg-[#FFEAA7]';
          icon = <CheckCircle2 className="w-4 h-4 text-emerald-700 stroke-[2.5]" />;
          iconBg = 'bg-white/80';
        } else if (item.type === 'deduct_rejected') {
          bgClass = 'bg-[#FF7675] text-white';
          icon = <XCircle className="w-4 h-4 text-white stroke-[2.5]" />;
          iconBg = 'bg-black/40';
        } else if (item.type === 'dissolve_warn') {
          bgClass = 'bg-[#FF6B6B] text-white';
          icon = <AlertTriangle className="w-4 h-4 text-yellow-300 stroke-[2.5]" />;
          iconBg = 'bg-black/40';
        }

        return (
          <div
            key={item.id}
            id={`notif-${item.id}`}
            className={`pointer-events-auto p-2.5 sm:p-3 rounded-2xl border-2 sm:border-3 border-black shadow-brutal flex items-center justify-between gap-2 text-black transition-all animate-slide-down ${bgClass}`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border border-black/30 flex items-center justify-center shrink-0 ${iconBg}`}>
                {icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-black truncate leading-tight">
                  {item.title}
                </div>
                {item.subtitle && (
                  <div className="text-[11px] font-bold text-black/75 truncate mt-0.5 leading-tight">
                    {item.subtitle}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => dismissOne(item.id)}
              className="p-1 rounded-lg hover:bg-black/10 text-black/60 shrink-0"
              aria-label="关闭通知"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
