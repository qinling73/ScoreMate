import React, { useState, useEffect } from 'react';
import { ServerRoomSummary, RoomRetention } from '../types';
import { api, removeStoredAdminKey, getApiBaseUrl, setApiBaseUrl } from '../services/api';
import { 
  Server, 
  Trash2, 
  Clock, 
  RefreshCw, 
  Search, 
  ShieldCheck, 
  X, 
  Users, 
  Radio, 
  AlertTriangle, 
  Sparkles,
  Layers,
  KeyRound,
  Lock,
  LogOut,
  Link as LinkIcon,
  Check
} from 'lucide-react';

interface ServerAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRoom?: (roomCode: string) => void;
}

export const ServerAdminModal: React.FC<ServerAdminModalProps> = ({
  isOpen,
  onClose,
  onSelectRoom,
}) => {
  const [rooms, setRooms] = useState<ServerRoomSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [retentionUpdatingId, setRetentionUpdatingId] = useState<string | null>(null);
  const [clientIpInfo, setClientIpInfo] = useState<{ clientIp?: string; isInternal?: boolean; reason?: string; hasAdminAccess?: boolean } | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check access permission first
      const accessRes = await api.checkAdminAccess();
      setClientIpInfo({
        clientIp: accessRes.clientIp,
        isInternal: accessRes.isInternal,
        reason: accessRes.reason,
        hasAdminAccess: accessRes.hasAdminAccess,
      });

      if (!accessRes.hasAdminAccess) {
        setNeedsAuth(true);
        setRooms([]);
        return;
      }

      setNeedsAuth(false);
      const roomRes = await api.getAllRooms();
      setRooms(roomRes.rooms || []);
    } catch (err: any) {
      if (err.message && (err.message.includes('403') || err.message.includes('认证') || err.message.includes('权限'))) {
        setNeedsAuth(true);
      } else {
        setError(err.message || '获取房间列表失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authPassword.trim()) {
      setError('请输入管理员访问密码');
      return;
    }

    try {
      setAuthSubmitting(true);
      setError(null);
      await api.adminAuth(authPassword.trim());
      setSuccessMsg('管理员身份认证成功！');
      setAuthPassword('');
      setNeedsAuth(false);
      setTimeout(() => setSuccessMsg(null), 2500);
      await fetchRooms();
    } catch (err: any) {
      setError(err.message || '认证失败，密码错误');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogoutAdmin = () => {
    removeStoredAdminKey();
    setNeedsAuth(true);
    setRooms([]);
    setSuccessMsg('已退出管理员认证');
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  useEffect(() => {
    if (isOpen) {
      fetchRooms();
      const interval = setInterval(() => {
        if (!needsAuth) {
          fetchRooms();
        }
      }, 10000); // refresh every 10s
      return () => clearInterval(interval);
    }
  }, [isOpen, needsAuth]);

  const handleDeleteRoom = async (roomId: string, roomCode: string, isClosed: boolean) => {
    const confirmText = isClosed
      ? `确定要彻底清理房间【${roomCode}】的记录吗？`
      : `⚠️ 确定要强制解散并清理房间【${roomCode}】吗？\n\n该房间内所有在线玩家将被立即强制退出！`;
    
    if (!window.confirm(confirmText)) return;

    try {
      setError(null);
      // Immediate optimistic removal from view
      setRooms((prev) => prev.filter((r) => r.id !== roomId));

      const res = await api.adminDeleteRoom(roomId, true);
      setSuccessMsg(res.message || `房间【${roomCode}】已成功解散并清理`);
      setTimeout(() => setSuccessMsg(null), 3500);

      await fetchRooms();
    } catch (err: any) {
      setError('解散操作失败: ' + err.message);
      await fetchRooms();
    }
  };

  const handleUpdateRetention = async (roomId: string, retention: RoomRetention) => {
    try {
      setRetentionUpdatingId(roomId);
      await api.adminUpdateRetention(roomId, retention);
      await fetchRooms();
    } catch (err: any) {
      alert('更新保留时长失败: ' + err.message);
    } finally {
      setRetentionUpdatingId(null);
    }
  };

  if (!isOpen) return null;

  const filteredRooms = rooms.filter((r) => {
    const q = filterText.toLowerCase();
    return (
      r.code.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.hostNickname.toLowerCase().includes(q)
    );
  });

  return (
    <div
      id="server-admin-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in"
    >
      <div
        id="server-admin-modal-card"
        className="w-full max-w-4xl max-h-[90vh] bg-[#FFFDF7] border-3 border-black rounded-3xl shadow-brutal flex flex-col text-black relative animate-scale-up overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b-2 border-black flex items-center justify-between bg-[#FFE66D]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center border-2 border-black shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black tracking-tight">服务器房间后台管理</h2>
                {clientIpInfo && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-800 text-white font-mono text-[10px] font-black border border-black inline-flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>内网授权 ({clientIpInfo.clientIp || '127.0.0.1'})</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-black/70 font-bold">仅内网/局域网环境可见 • 全服房间监管、在线状态监控与强制解散清理</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchRooms}
              className="p-2 rounded-xl bg-white border-2 border-black hover:bg-neutral-100 active:scale-95 transition-all text-xs font-black flex items-center gap-1 shadow-brutal-sm"
              title="刷新列表"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">刷新</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white border-2 border-black hover:bg-neutral-100 active:scale-95 transition-all"
              aria-label="关闭"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-3 sm:p-4 border-b border-black/10 bg-white flex flex-col sm:flex-row gap-2 justify-between items-center">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="搜索房间码 / 房名 / 房主..."
              className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-neutral-50 border-2 border-black rounded-xl focus:outline-hidden focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="text-xs font-bold text-neutral-600 self-start sm:self-auto flex items-center gap-2">
            <span>总房间数: <strong className="text-black">{rooms.length}</strong></span>
            <span>•</span>
            <span>运行中: <strong className="text-emerald-600">{rooms.filter(r => r.status === 'active').length}</strong></span>
          </div>
        </div>

        {/* Room List Content or Auth Required */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-100 border-2 border-emerald-500 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-700" />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-2xl bg-red-100 border-2 border-red-500 text-red-800 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {needsAuth ? (
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center max-w-sm mx-auto animate-fade-in">
              <div className="w-16 h-16 rounded-3xl bg-[#FF6B6B]/10 border-2 border-black text-[#FF6B6B] flex items-center justify-center mb-4 shadow-brutal-sm">
                <Lock className="w-8 h-8 stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-black text-black tracking-tight mb-1">管理员身份认证</h3>
              <p className="text-xs text-neutral-600 font-bold mb-6">
                {clientIpInfo?.isInternal
                  ? '系统检测到内网环境，您可输入管理员密钥或直接连接。'
                  : '当前处于公网访问环境（IP: ' + (clientIpInfo?.clientIp || '未知') + '），请输入管理员访问密码以解锁后台管理权限。'}
              </p>

              <form onSubmit={handleAuthSubmit} className="w-full space-y-3">
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="请输入管理员密码 (默认 admin888)"
                    autoFocus
                    className="w-full pl-10 pr-3 py-3 text-sm font-bold bg-white border-2 border-black rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-black shadow-brutal-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authSubmitting || !authPassword.trim()}
                  className="w-full py-3 rounded-2xl bg-[#FFE66D] border-2 border-black text-black font-black text-sm hover:bg-[#ffd93d] active:scale-98 transition-all shadow-brutal disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {authSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{authSubmitting ? '正在验证...' : '验证并解锁管理后台'}</span>
                </button>
              </form>

              {/* Target Backend Info for cross-origin hosting */}
              <div className="w-full mt-4 pt-3 border-t border-black/10 text-center">
                <p className="text-[11px] text-neutral-500 font-bold">
                  目标后端: <code className="text-black bg-neutral-100 px-1.5 py-0.5 rounded-md border border-black/20 font-mono text-[10px]">{getApiBaseUrl() || window.location.origin}</code>
                </p>
              </div>
            </div>
          ) : (
            <>
              {filteredRooms.length === 0 && !loading && (
                <div className="text-center py-12 text-neutral-400 font-bold text-sm">
                  暂无匹配的房间记录
                </div>
              )}

              {filteredRooms.map((room) => {
                const isDissolving = Boolean(room.dissolveCountdownExpiresAt && room.status === 'active');
                const isClosed = room.status === 'closed';

                return (
                  <div
                    key={room.id}
                    id={`admin-room-card-${room.code}`}
                    className={`p-3.5 sm:p-4 rounded-2xl border-2 border-black transition-all ${
                      isClosed
                        ? 'bg-neutral-100 opacity-75'
                        : isDissolving
                        ? 'bg-red-50 border-red-500'
                        : 'bg-white shadow-brutal-sm'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Info */}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-lg bg-black text-[#FFE66D] font-mono text-sm font-black tracking-wider">
                            {room.code}
                          </span>
                          <span className="font-black text-sm text-neutral-900 truncate">
                            {room.title}
                          </span>
                          <span className={`text-[11px] font-black px-2 py-0.5 rounded-md border border-black ${
                            room.mode === 'zero_sum' ? 'bg-[#FF6B6B] text-white' : 'bg-[#4ECDC4] text-black'
                          }`}>
                            {room.mode === 'zero_sum' ? '零和模式' : '自由模式'}
                          </span>
                          <span className={`text-[11px] font-black px-2 py-0.5 rounded-md ${
                            isClosed ? 'bg-neutral-300 text-neutral-700' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isClosed ? '已解散' : '运行中'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-neutral-600 font-bold flex-wrap pt-0.5">
                          <span>房主: <strong className="text-neutral-800">{room.hostNickname}</strong></span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            <span>成员: {room.memberCount} 人</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Radio className={`w-3.5 h-3.5 ${room.onlineCount > 0 ? 'text-emerald-500' : 'text-neutral-400'}`} />
                            <span>在线: {room.onlineCount} 人</span>
                          </span>
                          <span>创建: {new Date(room.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        {/* Dissolution Alert */}
                        {isDissolving && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-500 text-white text-xs font-black animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>全员离线中：30秒后将自动解散房间</span>
                          </div>
                        )}
                      </div>

                      {/* Right: Actions & Retention Settings */}
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-black/10">
                        {/* Retention selector */}
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-neutral-500" />
                          <select
                            disabled={isClosed || retentionUpdatingId === room.id}
                            value={room.retention || 'offline_30s'}
                            onChange={(e) => handleUpdateRetention(room.id, e.target.value as RoomRetention)}
                            className="text-xs font-black bg-neutral-100 border-2 border-black rounded-xl px-2 py-1.5 focus:outline-hidden disabled:opacity-50"
                          >
                            <option value="offline_30s">离线30s解散</option>
                            <option value="1h">保留 1 小时</option>
                            <option value="24h">保留 24 小时</option>
                            <option value="permanent">永久保留</option>
                          </select>
                        </div>

                        {onSelectRoom && !isClosed && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectRoom(room.code);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-xl border-2 border-black bg-[#4ECDC4] hover:bg-[#3dbdb4] active:scale-95 text-xs font-black text-black transition-all shadow-brutal-sm"
                          >
                            进入
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteRoom(room.id, room.code, isClosed)}
                          className="px-2.5 py-1.5 rounded-xl border-2 border-black bg-red-100 hover:bg-red-200 active:scale-95 text-xs font-black text-red-700 transition-all flex items-center gap-1 shadow-brutal-sm"
                          title={isClosed ? '清除记录' : '强制解散房间并踢出玩家'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isClosed ? '清理' : '强制解散'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 sm:p-4 bg-neutral-100 border-t-2 border-black text-xs font-bold text-neutral-600 flex items-center justify-between flex-wrap gap-2">
          <span>💡 提示：管理员点击「强制解散」将实时将房间内所有玩家请出，并彻底清理房间记录。</span>
          <div className="flex items-center gap-2">
            {!needsAuth && (
              <button
                type="button"
                onClick={handleLogoutAdmin}
                className="px-3 py-1.5 rounded-xl bg-neutral-200 border-2 border-black text-black font-black text-xs hover:bg-neutral-300 shadow-brutal-sm active:scale-95 flex items-center gap-1"
                title="退出当前管理员授权"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>退出登录</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-black text-white font-black text-xs hover:bg-neutral-800 shadow-brutal-sm active:scale-95"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
