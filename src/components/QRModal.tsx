import React, { useState } from 'react';
import { Room } from '../types';
import { sounds } from '../utils/audio';
import { X, Copy, Check, Share2, Smartphone, QrCode } from 'lucide-react';

interface QRModalProps {
  room: Room;
  isOpen: boolean;
  onClose: () => void;
}

export const QRModal: React.FC<QRModalProps> = ({ room, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
  // Using an image-based reliable QR code API fallback, plus direct URL display and copy
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    inviteUrl
  )}&margin=10`;

  const handleCopy = async () => {
    sounds.playTap();
    const text = `🎮 邀请你加入实时游戏记分房间【${room.title}】\n🔑 房间码：${room.code}\n🔗 链接：${inviteUrl}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in select-none">
      <div className="bg-white border-4 border-black rounded-[28px] max-w-sm w-full p-5 shadow-brutal space-y-4 relative text-black">
        {/* Close Button */}
        <button
          id="qr-modal-close-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-black text-white hover:bg-black/80 transition-transform active:scale-90 border-2 border-black"
        >
          <X className="w-4 h-4 stroke-[3]" />
        </button>

        {/* Title */}
        <div className="text-center">
          <div className="inline-flex p-2.5 rounded-2xl bg-[#FFD93D] border-2 border-black text-black mb-2 shadow-brutal-sm">
            <QrCode className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h3 className="text-lg font-black uppercase text-black">扫码加入房间</h3>
          <p className="text-xs text-black/70 font-bold mt-0.5 truncate">{room.title}</p>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-4 bg-[#FFFDF9] border-2 border-black rounded-2xl shadow-inner mx-auto w-fit">
          <img
            src={qrApiUrl}
            alt="Room QR Code"
            className="w-48 h-48 rounded-lg border border-black/10"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="text-black font-mono font-black text-xl tracking-widest mt-2 px-3 py-0.5 bg-[#FFD93D] border-2 border-black rounded-lg shadow-brutal-sm">
            {room.code}
          </div>
        </div>

        {/* 6-digit Code & Copy */}
        <div className="bg-black/5 p-3 rounded-2xl border-2 border-black flex items-center justify-between gap-2">
          <div className="min-w-0 pr-2">
            <div className="text-[10px] text-black/70 font-black uppercase">房间链接</div>
            <div className="text-xs font-mono font-bold text-black truncate">{inviteUrl}</div>
          </div>
          <button
            id="qr-modal-copy-btn"
            onClick={handleCopy}
            className="px-3.5 py-2 rounded-xl bg-black hover:bg-black/90 text-white text-xs font-black shrink-0 flex items-center gap-1.5 transition-all shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none border-2 border-black"
          >
            {copied ? <Check className="w-4 h-4 text-[#10B981] stroke-[3]" /> : <Copy className="w-4 h-4 stroke-[2.5]" />}
            <span>{copied ? '已复制' : '复制'}</span>
          </button>
        </div>

        <p className="text-xs text-center text-black/70 font-bold">
          好友使用手机微信或浏览器扫码，即可直接免注册加入
        </p>
      </div>
    </div>
  );
};
