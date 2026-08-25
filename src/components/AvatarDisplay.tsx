import React from 'react';
import { isCustomImageAvatar } from '../utils/avatar';

interface AvatarDisplayProps {
  avatar?: string;
  avatarColor?: string;
  nickname?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  className?: string;
  onClick?: () => void;
  showBorder?: boolean;
}

export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
  avatar,
  avatarColor = '#FFD93D',
  nickname = '玩家',
  size = 'md',
  isOnline,
  className = '',
  onClick,
  showBorder = true,
}) => {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs rounded-lg',
    md: 'w-9 h-9 text-base rounded-xl',
    lg: 'w-11 h-11 text-xl rounded-2xl',
    xl: 'w-16 h-16 text-3xl rounded-[20px]',
  };

  const isCustom = isCustomImageAvatar(avatar);
  const borderClass = showBorder ? 'border-2 border-black shadow-brutal-sm' : '';

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center shrink-0 font-black select-none transition-transform ${
        sizeClasses[size]
      } ${borderClass} ${onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : ''} ${className}`}
      style={{ backgroundColor: isCustom ? '#FFFFFF' : avatarColor }}
      title={nickname}
    >
      {isCustom ? (
        <img
          src={avatar}
          alt={nickname}
          className="w-full h-full object-cover rounded-[inherit]"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : avatar ? (
        <span className="leading-none flex items-center justify-center pointer-events-none">
          {avatar}
        </span>
      ) : (
        <span className="leading-none text-black font-black uppercase pointer-events-none">
          {nickname.slice(0, 1)}
        </span>
      )}

      {/* Online Pulse Indicator */}
      {isOnline !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border border-black ${
            size === 'sm' ? 'w-2 h-2' : size === 'xl' ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'
          } ${isOnline ? 'bg-[#10B981]' : 'bg-gray-400'}`}
        />
      )}
    </div>
  );
};
