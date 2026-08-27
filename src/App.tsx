import React, { useState, useEffect, useRef } from 'react';
import { Room, Player, ScoreLog, GameMode, DeductionProposal, RoomRetention } from './types';
import { api, getStoredToken, removeStoredToken, getStoredNickname, getStoredRoomCode } from './services/api';
import { socketService } from './services/socket';
import { sounds } from './utils/audio';
import confetti from 'canvas-confetti';
import { Navbar } from './components/Navbar';
import { ScoreTab } from './components/ScoreTab';
import { LeaderboardTab } from './components/LeaderboardTab';
import { LogTab } from './components/LogTab';
import { RoomManageTab } from './components/RoomManageTab';
import { JoinCreateModal } from './components/JoinCreateModal';
import { QRModal } from './components/QRModal';
import { LiveNotification, CustomNotification } from './components/LiveNotification';
import { DeductionConfirmModal } from './components/DeductionConfirmModal';
import { ServerAdminModal } from './components/ServerAdminModal';
import { AvatarPickerModal } from './components/AvatarPickerModal';
import { ShareImageModal } from './components/ShareImageModal';
import { NetworkDiagnosticModal } from './components/NetworkDiagnosticModal';
import { setStoredAvatar } from './utils/avatar';
import { 
  Gamepad2, 
  Trophy, 
  ScrollText, 
  Settings, 
  WifiOff, 
  Loader2,
  AlertTriangle
} from 'lucide-react';

type TabType = 'score' | 'leaderboard' | 'logs' | 'manage';

export default function App() {
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('score');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showQR, setShowQR] = useState<boolean>(false);
  const [showServerAdmin, setShowServerAdmin] = useState<boolean>(false);
  const [hasAdminAccess, setHasAdminAccess] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [latestLog, setLatestLog] = useState<ScoreLog | null>(null);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [customNotification, setCustomNotification] = useState<CustomNotification | null>(null);
  const [urlRoomCode, setUrlRoomCode] = useState<string>('');
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState<boolean>(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState<boolean>(false);
  const [shareModalConfig, setShareModalConfig] = useState<{ isOpen: boolean; defaultType: 'leaderboard' | 'logs' }>({
    isOpen: false,
    defaultType: 'leaderboard',
  });

  // Check admin privileges on initial load
  useEffect(() => {
    api.checkAdminAccess()
      .then((res) => {
        setHasAdminAccess(Boolean(res.hasAdminAccess));
      })
      .catch(() => {
        setHasAdminAccess(false);
      });
  }, []);

  // Check URL pathname for /ra (Route to Admin), ?admin=1, or ?diag=1
  useEffect(() => {
    const pathname = window.location.pathname.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    if (pathname === '/ra' || pathname === '/ra/' || params.get('admin') === '1' || params.get('ra') === '1') {
      setShowServerAdmin(true);
    }
    if (params.get('diag') === '1' || params.get('debug') === '1') {
      setShowDiagnosticModal(true);
    }
  }, []);

  // Pending deduction proposal for current user
  const [activeProposal, setActiveProposal] = useState<DeductionProposal | null>(null);

  // Target player selection forwarded to ScoreTab
  const [preselectedTargetId, setPreselectedTargetId] = useState<string | null>(null);

  // Parse URL query parameter for ?room=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    if (code) {
      setUrlRoomCode(code.toUpperCase());
    }
  }, []);

  // Try auto-reconnect using saved token or initial query
  useEffect(() => {
    async function restoreSession() {
      const token = getStoredToken();
      const nickname = getStoredNickname();

      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('room') || getStoredRoomCode();

        if (code && nickname) {
          const res = await api.joinRoom({
            roomCode: code,
            nickname: nickname,
            token,
          });
          setCurrentRoom(res.room);
          setCurrentPlayer(res.player);
          setUrlRoomCode(res.room.code);
          window.history.replaceState({}, document.title, `?room=${res.room.code}`);
          socketService.connect(res.room.id, res.player.id, res.player.nickname);
        } else {
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Session restore failed:', err);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  // Socket event subscriptions
  useEffect(() => {
    if (!currentRoom || !currentPlayer) return;

    const unsubState = socketService.on('room_state', (data: { room: Room }) => {
      setCurrentRoom(data.room);
      if (currentPlayer && data.room.members[currentPlayer.id]) {
        setCurrentPlayer(data.room.members[currentPlayer.id]);
      }
    });

    const unsubScore = socketService.on('score_updated', (data: { room: Room; newLogs: ScoreLog[]; actorUserId: string }) => {
      setCurrentRoom(data.room);
      if (currentPlayer && data.room.members[currentPlayer.id]) {
        setCurrentPlayer(data.room.members[currentPlayer.id]);
      }
      if (data.newLogs && data.newLogs.length > 0) {
        const newest = data.newLogs[0];
        setLatestLog(newest);

        // If I was the receiver, play notification sound
        if (currentPlayer && newest.toUserId === currentPlayer.id) {
          sounds.playNotification();
        }
      }
    });

    const unsubAction = socketService.on('room_action_executed', (data: { action: string; message: string; room: Room; targetUserId?: string }) => {
      if (data.action === 'close_room') {
        alert('房主已解散本房间');
        handleLeaveRoom();
        return;
      }
      if (data.action === 'kick_player' && data.targetUserId === currentPlayer.id) {
        alert('您已被房主移出房间');
        handleLeaveRoom();
        return;
      }

      setCurrentRoom(data.room);
      if (currentPlayer && data.room.members[currentPlayer.id]) {
        setCurrentPlayer(data.room.members[currentPlayer.id]);
      }
      setSystemMessage(data.message);
    });

    const unsubJoin = socketService.on('user_joined', (data: { player: Player }) => {
      if (data.player.id !== currentPlayer.id) {
        setCustomNotification({
          id: 'join_' + Date.now() + Math.random(),
          type: 'join',
          title: `👋 【${data.player.nickname}】进入了房间`,
          subtitle: `当前房间共 ${Object.keys(currentRoom.members).length + 1} 位玩家`,
          timestamp: Date.now(),
        });
      }
    });

    const unsubLeft = socketService.on('user_left', (data: { nickname?: string }) => {
      if (data.nickname) {
        setCustomNotification({
          id: 'leave_' + Date.now() + Math.random(),
          type: 'leave',
          title: `💨 【${data.nickname}】已退出/离线`,
          timestamp: Date.now(),
        });
      }
    });

    // 1. Deduction Proposals Event
    const unsubDeductions = socketService.on('deductions_proposed', (data: {
      room: Room;
      proposals: DeductionProposal[];
      fromUserId: string;
      fromNickname: string;
    }) => {
      setCurrentRoom(data.room);
      // Check if current user is the target of any proposal
      const myProposal = data.proposals.find((p) => p.targetUserId === currentPlayer.id);
      if (myProposal) {
        setActiveProposal(myProposal);
        sounds.playNotification();
      } else if (data.fromUserId !== currentPlayer.id) {
        // Broad notification for others
        const targets = data.proposals.map((p) => p.targetNickname).join('、');
        setCustomNotification({
          id: 'prop_' + Date.now() + Math.random(),
          type: 'deduct_request',
          title: `⚡️ ${data.fromNickname} 向 ${targets} 申请扣分`,
          subtitle: '正在等待对方确认同意...',
          timestamp: Date.now(),
        });
      }
    });

    const unsubProposalSent = socketService.on('proposal_sent', (data: { message: string }) => {
      setSystemMessage(data.message);
    });

    // 2. Deduction Resolved Event
    const unsubDeductionResolved = socketService.on('deduction_resolved', (data: {
      proposal: DeductionProposal;
      accepted: boolean;
      room: Room;
      newLog?: ScoreLog;
    }) => {
      setCurrentRoom(data.room);
      if (currentPlayer && data.room.members[currentPlayer.id]) {
        setCurrentPlayer(data.room.members[currentPlayer.id]);
      }

      // Close modal if it was this proposal
      if (activeProposal && activeProposal.id === data.proposal.id) {
        setActiveProposal(null);
      }

      if (data.accepted) {
        sounds.playScoreSent();
        setCustomNotification({
          id: 'deduct_res_' + Date.now(),
          type: 'deduct_accepted',
          title: `✅ ${data.proposal.targetNickname} 同意了扣分申请 (-${data.proposal.amount}分)`,
          subtitle: data.proposal.note ? `备注：${data.proposal.note}` : undefined,
          timestamp: Date.now(),
        });
        if (data.newLog) {
          setLatestLog(data.newLog);
        }
      } else {
        sounds.playTap();
        setCustomNotification({
          id: 'deduct_res_' + Date.now(),
          type: 'deduct_rejected',
          title: `❌ ${data.proposal.targetNickname} 拒绝了扣分申请 (-${data.proposal.amount}分)`,
          timestamp: Date.now(),
        });
      }
    });

    // 3. Dissolve Countdown Started Event (30s grace period)
    const unsubDissolveStarted = socketService.on('dissolve_countdown_started', (data: {
      message: string;
      room: Room;
    }) => {
      setCurrentRoom(data.room);
      setCustomNotification({
        id: 'dissolve_' + Date.now(),
        type: 'dissolve_warn',
        title: '⚠️ 全员离线警告：30秒后将自动解散房间',
        subtitle: '重新进入房间可自动取消解散倒计时',
        timestamp: Date.now(),
      });
    });

    // 4. Dissolve Countdown Cancelled Event
    const unsubDissolveCancelled = socketService.on('dissolve_countdown_cancelled', (data: {
      room: Room;
      reason: string;
    }) => {
      setCurrentRoom(data.room);
      setCustomNotification({
        id: 'dissolve_cancel_' + Date.now(),
        type: 'system',
        title: '✅ 玩家已重新连接，自动解散已取消',
        timestamp: Date.now(),
      });
    });

    // 5. Room Auto Dissolved Event
    const unsubAutoDissolved = socketService.on('room_auto_dissolved', (data: {
      message: string;
    }) => {
      alert(data.message || '房间由于全员离线已自动解散');
      handleLeaveRoom();
    });

    // 6. Avatar Updated Event
    const unsubAvatar = socketService.on('avatar_updated', (data: { userId: string; avatar: string; room: Room }) => {
      setCurrentRoom(data.room);
      if (currentPlayer && currentPlayer.id === data.userId) {
        setCurrentPlayer((prev) => (prev ? { ...prev, avatar: data.avatar } : null));
      }
    });

    const unsubConn = socketService.on('connection_status', (data: { status: string }) => {
      setIsConnected(data.status === 'connected');
    });

    return () => {
      unsubState();
      unsubScore();
      unsubAction();
      unsubJoin();
      unsubLeft();
      unsubDeductions();
      unsubProposalSent();
      unsubDeductionResolved();
      unsubDissolveStarted();
      unsubDissolveCancelled();
      unsubAutoDissolved();
      unsubAvatar();
      unsubConn();
    };
  }, [currentRoom?.id, currentPlayer?.id, activeProposal?.id]);

  // Join Room Handler
  const handleJoinRoom = async (nickname: string, roomCode: string, avatar?: string) => {
    const res = await api.joinRoom({ nickname, roomCode, avatar });
    setCurrentRoom(res.room);
    setCurrentPlayer(res.player);
    setUrlRoomCode(res.room.code);
    window.history.replaceState({}, document.title, `?room=${res.room.code}`);
    socketService.connect(res.room.id, res.player.id, res.player.nickname);
  };

  // Create Room Handler
  const handleCreateRoom = async (
    nickname: string,
    roomTitle: string,
    mode: GameMode,
    initialScore: number,
    retention?: RoomRetention,
    avatar?: string
  ) => {
    const res = await api.createRoom({ nickname, roomTitle, mode, initialScore, retention, avatar });
    setCurrentRoom(res.room);
    setCurrentPlayer(res.player);
    setUrlRoomCode(res.room.code);
    window.history.replaceState({}, document.title, `?room=${res.room.code}`);
    socketService.connect(res.room.id, res.player.id, res.player.nickname);
  };

  // Dynamic Avatar Update Handler (Real-time sync)
  const handleUpdateAvatar = async (newAvatar: string) => {
    if (!currentRoom || !currentPlayer) return;
    setStoredAvatar(newAvatar);
    
    // Optimistic local update
    setCurrentPlayer((prev) => (prev ? { ...prev, avatar: newAvatar } : null));
    setCurrentRoom((prev) => {
      if (!prev) return null;
      const mem = prev.members[currentPlayer.id];
      if (!mem) return prev;
      return {
        ...prev,
        members: {
          ...prev.members,
          [currentPlayer.id]: { ...mem, avatar: newAvatar },
        },
      };
    });

    try {
      socketService.updateAvatar({
        roomId: currentRoom.id,
        userId: currentPlayer.id,
        avatar: newAvatar,
      });
    } catch {
      await api.updateAvatar(currentRoom.id, {
        userId: currentPlayer.id,
        avatar: newAvatar,
      });
    }
  };

  // Open Share Modal
  const handleOpenShareModal = (defaultType: 'leaderboard' | 'logs' = 'leaderboard') => {
    sounds.playTap();
    setShareModalConfig({
      isOpen: true,
      defaultType,
    });
  };

  // Submit Score Handler
  const handleSubmitScore = async (payload: {
    targetUserIds: string[];
    amount: number;
    note?: string;
  }) => {
    if (!currentRoom || !currentPlayer) return;

    try {
      socketService.submitScore({
        roomId: currentRoom.id,
        fromUserId: currentPlayer.id,
        targetUserIds: payload.targetUserIds,
        amount: payload.amount,
        note: payload.note,
      });
    } catch {
      // Fallback via HTTP REST
      const res = await api.submitScore(currentRoom.id, {
        fromUserId: currentPlayer.id,
        targetUserIds: payload.targetUserIds,
        amount: payload.amount,
        note: payload.note,
      });
      setCurrentRoom(res.room);
    }
  };

  // Respond Deduction Proposal Handler
  const handleRespondDeduction = async (proposalId: string, accepted: boolean) => {
    if (!currentRoom || !currentPlayer) return;
    try {
      socketService.respondDeduction({
        roomId: currentRoom.id,
        proposalId,
        accepted,
        responderUserId: currentPlayer.id,
      });
    } catch {
      await api.respondDeduction(currentRoom.id, {
        proposalId,
        accepted,
        responderUserId: currentPlayer.id,
      });
    }
    setActiveProposal(null);
  };

  // Execute Host Action Handler
  const handleExecuteHostAction = async (payload: {
    action: 'reset_scores' | 'kick_player' | 'change_mode' | 'set_initial_score' | 'set_retention' | 'close_room';
    targetUserId?: string;
    mode?: GameMode;
    initialScore?: number;
    retention?: RoomRetention;
  }) => {
    if (!currentRoom || !currentPlayer) return;

    try {
      socketService.executeHostAction({
        roomId: currentRoom.id,
        hostUserId: currentPlayer.id,
        action: payload.action,
        targetUserId: payload.targetUserId,
        mode: payload.mode,
        initialScore: payload.initialScore,
        retention: payload.retention,
      });
    } catch {
      const res = await api.executeHostAction(currentRoom.id, {
        ...payload,
        hostUserId: currentPlayer.id,
      });
      setCurrentRoom(res.room);
    }
  };

  // Leave Room
  const handleLeaveRoom = () => {
    sounds.playTap();
    socketService.disconnect();
    removeStoredToken();
    setCurrentRoom(null);
    setCurrentPlayer(null);
    setActiveProposal(null);
    // Clear URL parameter
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  // Quick select player from leaderboard to score tab
  const handleSelectPlayerToScore = (playerId: string) => {
    sounds.playTap();
    setPreselectedTargetId(playerId);
    setActiveTab('score');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFFDF9] flex items-center justify-center text-black">
        <div className="flex flex-col items-center gap-3 p-6 bg-white border-4 border-black rounded-[24px] shadow-brutal">
          <Loader2 className="w-8 h-8 animate-spin text-black stroke-[3]" />
          <span className="text-xs font-black uppercase tracking-wider">加载房间数据中...</span>
        </div>
      </div>
    );
  }

  if (!currentRoom || !currentPlayer) {
    return (
      <>
        <JoinCreateModal
          onJoin={handleJoinRoom}
          onCreate={handleCreateRoom}
          initialRoomCode={urlRoomCode}
          onOpenServerAdmin={hasAdminAccess ? () => setShowServerAdmin(true) : undefined}
        />
        {hasAdminAccess && (
          <ServerAdminModal
            isOpen={showServerAdmin}
            onClose={() => setShowServerAdmin(false)}
            onSelectRoom={(code) => {
              setUrlRoomCode(code);
              setShowServerAdmin(false);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-black flex flex-col selection:bg-[#FFD93D] selection:text-black">
      {/* 1. Header Navigation Bar */}
      <Navbar
        room={currentRoom}
        currentPlayer={currentPlayer}
        onLeaveRoom={handleLeaveRoom}
        onShowQR={() => setShowQR(true)}
        onOpenServerAdmin={hasAdminAccess ? () => setShowServerAdmin(true) : undefined}
        onOpenAvatarPicker={() => setIsAvatarPickerOpen(true)}
        onOpenShareModal={handleOpenShareModal}
      />

      {/* Connection Offline Banner */}
      {!isConnected && (
        <div className="bg-[#FF6B6B] text-white px-4 py-2 text-xs text-center font-black border-b-2 border-black flex items-center justify-center gap-1.5 shadow-sm">
          <WifiOff className="w-4 h-4 stroke-[2.5]" />
          <span>网络正在重连中，实时更新可能延迟...</span>
        </div>
      )}

      {/* Live Floating Notifications */}
      <LiveNotification
        latestLog={latestLog}
        systemMessage={systemMessage}
        customNotification={customNotification}
      />

      {/* Deduction Consent Modal */}
      <DeductionConfirmModal
        proposal={activeProposal}
        onRespond={handleRespondDeduction}
      />

      {/* 2. Main Content Area (Max width phone layout) */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-3.5">
        {activeTab === 'score' && (
          <ScoreTab
            room={currentRoom}
            currentPlayer={currentPlayer}
            onSubmitScore={handleSubmitScore}
            onNavigateToTab={setActiveTab}
          />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardTab
            room={currentRoom}
            currentPlayer={currentPlayer}
            onSelectPlayerToScore={handleSelectPlayerToScore}
            onOpenAvatarPicker={() => setIsAvatarPickerOpen(true)}
            onOpenShareModal={handleOpenShareModal}
          />
        )}

        {activeTab === 'logs' && (
          <LogTab
            room={currentRoom}
            currentPlayer={currentPlayer}
            onOpenShareModal={handleOpenShareModal}
          />
        )}

        {activeTab === 'manage' && (
          <RoomManageTab
            room={currentRoom}
            currentPlayer={currentPlayer}
            onExecuteHostAction={handleExecuteHostAction}
            onShowQR={() => setShowQR(true)}
            onOpenAvatarPicker={() => setIsAvatarPickerOpen(true)}
            onOpenShareModal={handleOpenShareModal}
          />
        )}
      </main>

      {/* 3. Bottom Mobile Tab Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-4 border-black shadow-[0px_-4px_0px_0px_#000000] select-none">
        <div className="max-w-md mx-auto grid grid-cols-4 px-3 py-2 gap-1">
          <button
            id="tab-btn-score"
            onClick={() => { sounds.playTap(); setActiveTab('score'); }}
            className={`flex flex-col items-center justify-center py-2 rounded-2xl border-2 transition-all active:translate-x-0.5 active:translate-y-0.5 ${
              activeTab === 'score'
                ? 'bg-[#FFD93D] text-black border-black font-black shadow-brutal-sm'
                : 'border-transparent text-black/60 hover:text-black font-bold'
            }`}
          >
            <Gamepad2 className="w-5 h-5 stroke-[2.5]" />
            <span className="text-[11px] mt-0.5 uppercase tracking-wide">记分</span>
          </button>

          <button
            id="tab-btn-leaderboard"
            onClick={() => { sounds.playTap(); setActiveTab('leaderboard'); }}
            className={`flex flex-col items-center justify-center py-2 rounded-2xl border-2 transition-all active:translate-x-0.5 active:translate-y-0.5 ${
              activeTab === 'leaderboard'
                ? 'bg-[#4ECDC4] text-black border-black font-black shadow-brutal-sm'
                : 'border-transparent text-black/60 hover:text-black font-bold'
            }`}
          >
            <Trophy className="w-5 h-5 stroke-[2.5]" />
            <span className="text-[11px] mt-0.5 uppercase tracking-wide">排行</span>
          </button>

          <button
            id="tab-btn-logs"
            onClick={() => { sounds.playTap(); setActiveTab('logs'); }}
            className={`flex flex-col items-center justify-center py-2 rounded-2xl border-2 transition-all relative active:translate-x-0.5 active:translate-y-0.5 ${
              activeTab === 'logs'
                ? 'bg-[#FF6B6B] text-white border-black font-black shadow-brutal-sm'
                : 'border-transparent text-black/60 hover:text-black font-bold'
            }`}
          >
            <ScrollText className="w-5 h-5 stroke-[2.5]" />
            <span className="text-[11px] mt-0.5 uppercase tracking-wide">流水</span>
            {(currentRoom.logs?.length || 0) > 0 && (
              <span className="absolute top-1.5 right-4 w-2.5 h-2.5 rounded-full bg-black border border-white" />
            )}
          </button>

          <button
            id="tab-btn-manage"
            onClick={() => { sounds.playTap(); setActiveTab('manage'); }}
            className={`flex flex-col items-center justify-center py-2 rounded-2xl border-2 transition-all active:translate-x-0.5 active:translate-y-0.5 ${
              activeTab === 'manage'
                ? 'bg-black text-white border-black font-black shadow-brutal-sm'
                : 'border-transparent text-black/60 hover:text-black font-bold'
            }`}
          >
            <Settings className="w-5 h-5 stroke-[2.5]" />
            <span className="text-[11px] mt-0.5 uppercase tracking-wide">房间</span>
          </button>
        </div>
      </nav>

      {/* QR Code Modal */}
      <QRModal
        room={currentRoom}
        isOpen={showQR}
        onClose={() => setShowQR(false)}
      />

      {/* Avatar Picker Modal (In-game) */}
      <AvatarPickerModal
        isOpen={isAvatarPickerOpen}
        currentAvatar={currentPlayer?.avatar}
        onClose={() => setIsAvatarPickerOpen(false)}
        onSelectAvatar={handleUpdateAvatar}
      />

      {/* Share Image Modal (Battle Report & Logs) */}
      <ShareImageModal
        isOpen={shareModalConfig.isOpen}
        onClose={() => setShareModalConfig((prev) => ({ ...prev, isOpen: false }))}
        room={currentRoom}
        currentPlayer={currentPlayer}
        defaultType={shareModalConfig.defaultType}
      />

      {/* Server Admin Modal (Accessible via internal IP or /ra password auth) */}
      {(hasAdminAccess || showServerAdmin) && (
        <ServerAdminModal
          isOpen={showServerAdmin}
          onClose={() => {
            setShowServerAdmin(false);
            if (window.location.pathname.toLowerCase().startsWith('/ra')) {
              window.history.replaceState({}, document.title, '/');
            }
          }}
          onSelectRoom={(code) => {
            setUrlRoomCode(code);
            setShowServerAdmin(false);
            if (window.location.pathname.toLowerCase().startsWith('/ra')) {
              window.history.replaceState({}, document.title, '/');
            }
          }}
        />
      )}

      {/* Network Diagnostic Modal (Can be opened via footer, error banner, or ?diag=1) */}
      <NetworkDiagnosticModal
        isOpen={showDiagnosticModal}
        onClose={() => {
          setShowDiagnosticModal(false);
          const params = new URLSearchParams(window.location.search);
          if (params.get('diag') === '1' || params.get('debug') === '1') {
            params.delete('diag');
            params.delete('debug');
            const newQuery = params.toString() ? `?${params.toString()}` : '';
            window.history.replaceState({}, document.title, window.location.pathname + newQuery);
          }
        }}
      />
    </div>
  );
}
