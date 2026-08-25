import React, { useState, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { Room, Player, ScoreLog } from '../types';
import { AvatarDisplay } from './AvatarDisplay';
import { copyToClipboard } from '../utils/clipboard';
import { sounds } from '../utils/audio';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  Share2, 
  Trophy, 
  ScrollText, 
  Sparkles, 
  Crown, 
  QrCode,
  Flame,
  Layers,
  ArrowRight
} from 'lucide-react';

interface ShareImageModalProps {
  room: Room;
  currentPlayer: Player | null;
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'leaderboard' | 'logs';
}

export const ShareImageModal: React.FC<ShareImageModalProps> = ({
  room,
  currentPlayer,
  isOpen,
  onClose,
  defaultType = 'leaderboard',
}) => {
  const [cardType, setCardType] = useState<'leaderboard' | 'logs'>(defaultType);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedImgUrl, setGeneratedImgUrl] = useState<string>('');
  const [copiedSuccess, setCopiedSuccess] = useState<string>('');
  const cardRef = useRef<HTMLDivElement>(null);

  const members = (Object.values(room.members) as Player[]).sort((a, b) => b.score - a.score);
  const logs = room.logs || [];
  const top1 = members[0];
  const top2 = members[1];
  const top3 = members[2];

  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
    inviteUrl
  )}&margin=4`;

  // Auto-generate image when modal opens or card type changes
  useEffect(() => {
    if (!isOpen) {
      setGeneratedImgUrl('');
      return;
    }
    setGeneratedImgUrl('');
    const timer = setTimeout(() => {
      handleGenerateImage();
    }, 200);
    return () => clearTimeout(timer);
  }, [isOpen, cardType, room]);

  const handleGenerateImage = async () => {
    if (!cardRef.current) return;
    try {
      setIsGenerating(true);
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2, // High DPI for crisp text & borders
        backgroundColor: '#FFFDF9',
      });
      setGeneratedImgUrl(dataUrl);
    } catch (err) {
      console.error('[ShareImage] Generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadImage = () => {
    sounds.playScoreSent();
    if (!generatedImgUrl) return;
    const a = document.createElement('a');
    const typeLabel = cardType === 'leaderboard' ? '战报榜单' : '对局流水';
    a.download = `【${typeLabel}】${room.title}_${new Date().toISOString().slice(0, 10)}.png`;
    a.href = generatedImgUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('图片下载已开始！');
  };

  const handleCopyImageOrText = async () => {
    sounds.playTap();
    if (generatedImgUrl) {
      try {
        // Try clipboard image item
        const res = await fetch(generatedImgUrl);
        const blob = await res.blob();
        if (navigator.clipboard && (window as any).ClipboardItem) {
          await navigator.clipboard.write([
            new (window as any).ClipboardItem({ 'image/png': blob }),
          ]);
          showToast('战报长图已复制到剪贴板！');
          return;
        }
      } catch (e) {
        console.warn('Direct image clipboard copy not supported in this browser, fallback to text report', e);
      }
    }

    // Fallback: Copy clean text report
    const textReport = cardType === 'leaderboard'
      ? `📊【${room.title}】实时战报\n` +
        `🔑 房间码：${room.code}\n` +
        `🏆 榜首：${top1 ? `${top1.nickname} (${top1.score}分)` : '无'}\n` +
        `-------------------\n` +
        members.map((p, i) => `${i + 1}. ${p.nickname}: ${p.score > 0 ? `+${p.score}` : p.score} 分`).join('\n') +
        `\n🔗 加入链接：${inviteUrl}`
      : `📜【${room.title}】流水明细 (${logs.length}笔)\n` +
        `🔑 房间码：${room.code}\n` +
        `-------------------\n` +
        logs.slice(-10).map((l) => `• ${l.fromNickname} ➡️ ${l.toNickname}: ${l.amount > 0 ? `+${l.amount}` : l.amount}分 (${l.note || '记分'})`).join('\n') +
        `\n🔗 加入链接：${inviteUrl}`;

    await copyToClipboard(textReport);
    showToast('战报文本已复制到剪贴板！');
  };

  const showToast = (msg: string) => {
    setCopiedSuccess(msg);
    setTimeout(() => setCopiedSuccess(''), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in select-none">
      <div className="bg-white border-4 border-black rounded-[28px] max-w-md w-full max-h-[92vh] flex flex-col shadow-brutal text-black overflow-hidden relative">
        {/* Top Header */}
        <div className="p-4 border-b-3 border-black flex items-center justify-between bg-[#FFFDF9]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#FFD93D] border-2 border-black shadow-brutal-sm">
              <Share2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase text-black">分享战报与流水</h3>
              <p className="text-[11px] text-black/70 font-bold">
                一键生成高颜值战报长图，支持保存或长按发送
              </p>
            </div>
          </div>

          <button
            id="share-modal-close-btn"
            onClick={onClose}
            className="p-2 rounded-xl bg-black text-white hover:bg-black/80 transition-transform active:scale-90 border-2 border-black"
          >
            <X className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* Card Type Selector */}
        <div className="px-4 pt-3 pb-2 bg-white border-b-2 border-black/10">
          <div className="grid grid-cols-2 p-1 rounded-xl bg-black/5 border-2 border-black text-xs font-black">
            <button
              onClick={() => { sounds.playTap(); setCardType('leaderboard'); }}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                cardType === 'leaderboard'
                  ? 'bg-[#FFD93D] text-black border border-black shadow-brutal-sm'
                  : 'text-black/60 hover:text-black'
              }`}
            >
              <Trophy className="w-4 h-4 stroke-[2.5]" />
              <span>🏆 战报榜单长图</span>
            </button>
            <button
              onClick={() => { sounds.playTap(); setCardType('logs'); }}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                cardType === 'logs'
                  ? 'bg-[#4ECDC4] text-black border border-black shadow-brutal-sm'
                  : 'text-black/60 hover:text-black'
              }`}
            >
              <ScrollText className="w-4 h-4 stroke-[2.5]" />
              <span>📜 对局流水长图</span>
            </button>
          </div>
        </div>

        {/* Scrollable Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#F7F4EB] flex flex-col items-center">
          {/* Offscreen / Render Container */}
          <div className="w-full max-w-[360px]">
            {generatedImgUrl ? (
              <div className="space-y-2">
                <div className="rounded-2xl border-3 border-black overflow-hidden shadow-brutal bg-white">
                  <img
                    src={generatedImgUrl}
                    alt="Generated Battle Report"
                    className="w-full h-auto block"
                  />
                </div>
                <p className="text-[11px] text-center text-black/70 font-bold">
                  💡 手机用户可长按上方图片保存到相册或直接发送给好友
                </p>
              </div>
            ) : (
              <div className="py-20 text-center text-xs font-black text-black/60">
                {isGenerating ? '🎨 正在极速渲染高清战报长图...' : '准备就绪'}
              </div>
            )}

            {/* Hidden DOM Card template used strictly for rasterization */}
            <div className="absolute -left-[9999px] top-0 pointer-events-none">
              <div
                ref={cardRef}
                style={{ width: '380px', fontFamily: 'inherit' }}
                className="bg-[#FFFDF9] border-4 border-black p-5 rounded-[24px] text-black space-y-4 shadow-brutal"
              >
                {/* 1. Card Top Brand Header */}
                <div className="flex items-center justify-between border-b-3 border-black pb-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-[#FFD93D] border-2 border-black text-[10px] font-black uppercase">
                        {room.mode === 'zero_sum' ? '零和筹码模式' : '自由记分模式'}
                      </span>
                      <span className="text-[10px] text-black/60 font-bold">
                        {new Date().toLocaleDateString('zh-CN')} {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-black mt-1">
                      {room.title}
                    </h2>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-black/60 font-black">房间码</div>
                    <div className="text-base font-black font-mono tracking-wider bg-black text-white px-2 py-0.5 rounded-md">
                      {room.code}
                    </div>
                  </div>
                </div>

                {/* 2. Content depending on Card Type */}
                {cardType === 'leaderboard' ? (
                  <div className="space-y-3">
                    {/* Top 3 Podium Cards */}
                    {top1 && (
                      <div className="bg-[#FFD93D] border-3 border-black rounded-2xl p-3 shadow-brutal-sm flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center font-black">
                            <Crown className="w-5 h-5 text-[#FFD93D]" />
                          </div>
                          <AvatarDisplay
                            avatar={top1.avatar}
                            avatarColor={top1.avatarColor}
                            nickname={top1.nickname}
                            size="md"
                          />
                          <div>
                            <div className="flex items-center gap-1 font-black text-sm text-black">
                              <span>{top1.nickname}</span>
                              <span className="text-[9px] bg-black text-white px-1 rounded">冠军</span>
                            </div>
                            <div className="text-[10px] text-black/80 font-bold flex items-center gap-0.5">
                              <Flame className="w-3 h-3" /> 榜首领跑
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xl font-black text-black">
                            {top1.score > 0 ? `+${top1.score}` : top1.score}
                          </div>
                          <div className="text-[9px] font-black text-black/70">总积分</div>
                        </div>
                      </div>
                    )}

                    {/* Rankings Table */}
                    <div className="bg-white border-3 border-black rounded-2xl p-3 shadow-brutal-sm space-y-2">
                      <div className="text-xs font-black text-black border-b-2 border-black/10 pb-1.5 flex justify-between">
                        <span>全员总排名 ({members.length}人)</span>
                        <span>累计积分</span>
                      </div>

                      {members.map((p, idx) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between py-1 border-b border-black/5 last:border-none text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[11px] border border-black ${
                              idx === 0 ? 'bg-[#FFD93D]' : idx === 1 ? 'bg-[#4ECDC4]' : idx === 2 ? 'bg-[#FF8C61]' : 'bg-black/5'
                            }`}>
                              {idx + 1}
                            </span>
                            <AvatarDisplay
                              avatar={p.avatar}
                              avatarColor={p.avatarColor}
                              nickname={p.nickname}
                              size="sm"
                            />
                            <span className="font-black text-black truncate max-w-[120px]">
                              {p.nickname}
                            </span>
                            {p.isHost && (
                              <span className="text-[8px] bg-black/10 px-1 py-0.2 rounded font-bold">
                                房主
                              </span>
                            )}
                          </div>

                          <div className="font-black text-black text-right shrink-0">
                            {p.score > 0 ? `+${p.score}` : p.score} 分
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Logs Ledger Card */
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-center text-xs font-black">
                      <div className="p-2 bg-[#4ECDC4] border-2 border-black rounded-xl shadow-brutal-sm">
                        <div className="text-[9px] text-black/70 uppercase">累计流水笔数</div>
                        <div className="text-sm font-black text-black mt-0.5">{logs.length} 笔</div>
                      </div>
                      <div className="p-2 bg-[#FF8C61] border-2 border-black rounded-xl shadow-brutal-sm">
                        <div className="text-[9px] text-black/70 uppercase">参与玩家数</div>
                        <div className="text-sm font-black text-black mt-0.5">{members.length} 人</div>
                      </div>
                    </div>

                    <div className="bg-white border-3 border-black rounded-2xl p-3 shadow-brutal-sm space-y-2">
                      <div className="text-xs font-black text-black border-b-2 border-black/10 pb-1.5">
                        最新战局明细 (近8笔)
                      </div>

                      {logs.length === 0 ? (
                        <div className="text-center py-4 text-xs font-bold text-black/50">暂无记分记录</div>
                      ) : (
                        logs.slice(-8).reverse().map((l) => (
                          <div
                            key={l.id}
                            className="flex items-center justify-between py-1 border-b border-black/5 last:border-none text-[11px]"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-black text-black">{l.fromNickname}</span>
                              <ArrowRight className="w-3 h-3 text-black/40 shrink-0" />
                              <span className="font-black text-black">{l.toNickname}</span>
                              {l.note && (
                                <span className="text-[9px] bg-black/5 px-1 py-0.2 rounded text-black/70 truncate max-w-[80px]">
                                  {l.note}
                                </span>
                              )}
                            </div>
                            <div className={`font-black shrink-0 ${l.amount > 0 ? 'text-black' : 'text-[#FF6B6B]'}`}>
                              {l.amount > 0 ? `+${l.amount}` : l.amount}分
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Card Bottom Join Invite & QR Code */}
                <div className="pt-2 border-t-3 border-black flex items-center justify-between bg-black/5 p-3 rounded-2xl">
                  <div className="space-y-1">
                    <div className="text-xs font-black text-black flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>扫码即可免注册加入</span>
                    </div>
                    <div className="text-[10px] text-black/70 font-bold">
                      多人游戏记分 • 实时同步
                    </div>
                  </div>

                  <img
                    src={qrApiUrl}
                    alt="QR"
                    className="w-12 h-12 rounded-lg border-2 border-black bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t-3 border-black bg-white flex items-center gap-2">
          <button
            id="download-image-btn"
            disabled={!generatedImgUrl}
            onClick={handleDownloadImage}
            className="flex-1 py-3 rounded-2xl bg-[#FFD93D] hover:bg-[#ffcd1a] text-black border-3 border-black text-xs font-black flex items-center justify-center gap-1.5 shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4 stroke-[3]" />
            <span>保存高清图片</span>
          </button>

          <button
            id="copy-share-btn"
            disabled={!generatedImgUrl}
            onClick={handleCopyImageOrText}
            className="py-3 px-4 rounded-2xl bg-black hover:bg-black/90 text-white border-3 border-black text-xs font-black flex items-center justify-center gap-1.5 shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50"
          >
            <Copy className="w-4 h-4 stroke-[2.5]" />
            <span>复制分享</span>
          </button>
        </div>

        {/* Floating Toast */}
        {copiedSuccess && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-black text-white px-4 py-2 rounded-2xl border-2 border-[#FFD93D] text-xs font-black shadow-brutal flex items-center gap-1.5 animate-bounce">
            <Check className="w-4 h-4 text-[#10B981] stroke-[3]" />
            <span>{copiedSuccess}</span>
          </div>
        )}
      </div>
    </div>
  );
};
