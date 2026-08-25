import React, { useState, useRef } from 'react';
import { 
  AVATAR_CATEGORIES, 
  sanitizeAndCompressAvatar, 
  DEFAULT_AVATAR,
  isCustomImageAvatar 
} from '../utils/avatar';
import { AvatarDisplay } from './AvatarDisplay';
import { sounds } from '../utils/audio';
import { 
  X, 
  Upload, 
  Smile, 
  Check, 
  Sparkles, 
  AlertCircle,
  Camera,
  RotateCcw
} from 'lucide-react';

interface AvatarPickerModalProps {
  isOpen: boolean;
  currentAvatar?: string;
  avatarColor?: string;
  nickname?: string;
  onClose: () => void;
  onSelectAvatar: (avatar: string) => void;
}

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  isOpen,
  currentAvatar = DEFAULT_AVATAR,
  avatarColor = '#FFD93D',
  nickname = '玩家',
  onClose,
  onSelectAvatar,
}) => {
  const [selectedAvatar, setSelectedAvatar] = useState<string>(currentAvatar);
  const [activeCategory, setActiveCategory] = useState<string>('animals');
  const [uploadError, setUploadError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSelectEmoji = (emoji: string) => {
    sounds.playTap();
    setSelectedAvatar(emoji);
    setUploadError('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setUploadError('');
      const cleanDataUrl = await sanitizeAndCompressAvatar(file);
      setSelectedAvatar(cleanDataUrl);
      sounds.playTap();
    } catch (err: any) {
      setUploadError(err?.message || '图片上传处理失败');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirm = () => {
    sounds.playScoreSent();
    onSelectAvatar(selectedAvatar);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in select-none">
      <div className="bg-white border-4 border-black rounded-[28px] max-w-sm w-full p-5 shadow-brutal space-y-4 relative text-black">
        {/* Close Button */}
        <button
          id="avatar-modal-close-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-black text-white hover:bg-black/80 transition-transform active:scale-90 border-2 border-black"
        >
          <X className="w-4 h-4 stroke-[3]" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex p-2.5 rounded-2xl bg-[#FFD93D] border-2 border-black text-black shadow-brutal-sm">
            <Smile className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h3 className="text-lg font-black uppercase text-black">选择个性化头像</h3>
          <p className="text-xs text-black/70 font-bold">
            选择可爱萌宠表情，或上传自定义照片头像
          </p>
        </div>

        {/* Current Preview Banner */}
        <div className="flex items-center justify-center gap-3 p-3 bg-[#FFFDF9] border-2 border-black rounded-2xl shadow-inner">
          <AvatarDisplay
            avatar={selectedAvatar}
            avatarColor={avatarColor}
            nickname={nickname}
            size="xl"
          />
          <div className="text-left">
            <div className="text-xs text-black/60 font-black">当前预览</div>
            <div className="text-sm font-black text-black truncate max-w-[140px]">{nickname}</div>
            <div className="text-[11px] text-[#FF6B35] font-black mt-0.5">
              {isCustomImageAvatar(selectedAvatar) ? '🖼️ 自定义图片头像' : '✨ 趣味 Emoji 头像'}
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="grid grid-cols-4 p-1 rounded-xl bg-black/5 border-2 border-black text-xs font-black">
          {AVATAR_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { sounds.playTap(); setActiveCategory(cat.id); }}
              className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
                activeCategory === cat.id
                  ? 'bg-[#FFD93D] text-black border border-black shadow-brutal-sm'
                  : 'text-black/60 hover:text-black'
              }`}
            >
              <span>{cat.icon}</span>
              <span className="text-[11px]">{cat.name}</span>
            </button>
          ))}
          <button
            onClick={() => { sounds.playTap(); setActiveCategory('upload'); }}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
              activeCategory === 'upload'
                ? 'bg-[#4ECDC4] text-black border border-black shadow-brutal-sm'
                : 'text-black/60 hover:text-black'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="text-[11px]">上传</span>
          </button>
        </div>

        {/* Category Content */}
        {activeCategory === 'upload' ? (
          <div className="p-4 border-2 border-dashed border-black rounded-2xl text-center space-y-3 bg-[#FFFDF9]">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleFileUpload}
            />
            
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-[#4ECDC4] border-2 border-black flex items-center justify-center text-black mb-2 shadow-brutal-sm">
                <Upload className="w-6 h-6 stroke-[2.5]" />
              </div>
              <p className="text-xs font-black text-black">点击选择或拍照上传头像</p>
              <p className="text-[10px] text-black/60 font-bold mt-0.5">
                支持 JPG / PNG / WebP，自动裁剪与安全转码（&lt;5MB）
              </p>
            </div>

            <button
              type="button"
              id="upload-avatar-btn"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 rounded-xl bg-black text-white text-xs font-black border-2 border-black shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none hover:bg-black/80"
            >
              {isProcessing ? '处理与转码中...' : '选择本地图片'}
            </button>

            {uploadError && (
              <div className="flex items-center justify-center gap-1 text-xs text-[#FF6B6B] font-black">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-2 max-h-44 overflow-y-auto p-1 scrollbar-thin">
            {AVATAR_CATEGORIES.find((c) => c.id === activeCategory)?.emojis.map((emoji, idx) => {
              const isChosen = selectedAvatar === emoji;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectEmoji(emoji)}
                  className={`w-11 h-11 rounded-xl text-2xl flex items-center justify-center border-2 transition-transform active:scale-90 ${
                    isChosen
                      ? 'bg-[#FFD93D] border-black scale-110 shadow-brutal-sm'
                      : 'bg-white border-black/20 hover:border-black hover:bg-black/5'
                  }`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t-2 border-black/10">
          <button
            type="button"
            onClick={() => {
              sounds.playTap();
              setSelectedAvatar(DEFAULT_AVATAR);
            }}
            className="py-2.5 rounded-xl border-2 border-black bg-white hover:bg-black/5 text-xs font-black text-black flex items-center justify-center gap-1 shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>恢复默认</span>
          </button>
          
          <button
            type="button"
            id="avatar-confirm-btn"
            onClick={handleConfirm}
            className="py-2.5 rounded-xl border-2 border-black bg-[#4ECDC4] hover:bg-[#3dbdb4] text-xs font-black text-black flex items-center justify-center gap-1 shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>确认使用</span>
          </button>
        </div>
      </div>
    </div>
  );
};
