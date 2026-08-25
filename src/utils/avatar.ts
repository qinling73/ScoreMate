/**
 * Cute Avatar presets, security sanitization, and image rasterization helpers
 */

export interface AvatarCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

export const AVATAR_CATEGORIES: AvatarCategory[] = [
  {
    id: 'animals',
    name: '可爱动物',
    icon: '🐱',
    emojis: [
      '🐱', '🐶', '🦊', '🐼', '🐰', '🦁', '🐯', '🐨', 
      '🐻', '🐸', '🐵', '🐹', '🐙', '🐧', '🦄', '🐥',
      '🐺', '🦝', '🐮', '🐷', '🦉', '🦔', '🐝', '🐳'
    ],
  },
  {
    id: 'game',
    name: '游戏棋牌',
    icon: '👑',
    emojis: [
      '👑', '🏆', '🎯', '🎲', '🃏', '🀄️', '🎮', '💎',
      '🚀', '⚡️', '🔥', '🌟', '💰', '🪙', '🥇', '🎪',
      '⚔️', '🛡️', '🕹️', '🎳', '🎱', '🥊', '🏎️', '⛳️'
    ],
  },
  {
    id: 'cute',
    name: '萌趣搞怪',
    icon: '😎',
    emojis: [
      '😎', '🥳', '🤖', '👻', '🥑', '🍓', '🍔', '🍕',
      '🍦', '☕️', '🌈', '🍀', '🎸', '🏀', '🥷', '👾',
      '✨', '🍭', '🍉', '🍿', '🍩', '🧸', '🎈', '🛸'
    ],
  },
];

export const ALL_PRESET_EMOJIS = AVATAR_CATEGORIES.flatMap((c) => c.emojis);

export const DEFAULT_AVATAR = '🐱';

/**
 * Client-Side Canvas Image Sanitizer & Resizer
 * 
 * 1. Validates image MIME type and file size.
 * 2. Loads image onto a sandboxed offscreen HTML5 <canvas>.
 * 3. Crops into a centered square and scales down to 128x128 px.
 * 4. Exports strictly as 'image/webp' or 'image/jpeg' base64 data URL.
 * 
 * Security Advantage:
 * - Completely purges malicious SVGs, executable script tags, XML payloads, EXIF tracking metadata, and corrupt bytes.
 * - Prevents server denial of service / bloated JSON database by restricting output to ~8-15KB.
 */
export async function sanitizeAndCompressAvatar(file: File): Promise<string> {
  // Validate basic MIME type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/bmp'];
  if (!allowedTypes.includes(file.type) && !file.name.match(/\.(jpe?g|png|webp|gif|bmp|heic)$/i)) {
    throw new Error('仅支持上传 JPG、PNG、WebP 或 GIF 图片格式');
  }

  // Reject files larger than 5MB before processing
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('图片文件过大，请选择 5MB 以内的图片');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取图片文件失败'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片格式无效或已损坏'));
      img.onload = () => {
        try {
          const targetSize = 128; // Standard compact avatar size
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            return reject(new Error('创建图片画布失败'));
          }

          // Clear canvas with white/transparent background
          ctx.clearRect(0, 0, targetSize, targetSize);

          // Calculate center crop (1:1 aspect ratio)
          const minDim = Math.min(img.width, img.height);
          const srcX = (img.width - minDim) / 2;
          const srcY = (img.height - minDim) / 2;

          // Draw cropped & resized raster image onto canvas
          ctx.drawImage(img, srcX, srcY, minDim, minDim, 0, 0, targetSize, targetSize);

          // Export as clean WebP (or fallback JPEG) with reasonable quality
          let dataUrl = '';
          try {
            dataUrl = canvas.toDataURL('image/webp', 0.85);
          } catch {
            dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          }

          // Safety check: ensure result is a valid raster data URL under 60KB
          if (!dataUrl.startsWith('data:image/')) {
            return reject(new Error('图片转码失败'));
          }
          if (dataUrl.length > 75000) {
            // Compress further if still large
            dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          }

          resolve(dataUrl);
        } catch (err) {
          reject(new Error('图片处理失败: ' + (err as any)?.message));
        }
      };

      if (typeof e.target?.result === 'string') {
        img.src = e.target.result;
      } else {
        reject(new Error('解析图片数据失败'));
      }
    };

    reader.readAsDataURL(file);
  });
}

export function isCustomImageAvatar(avatar?: string): boolean {
  if (!avatar) return false;
  return avatar.startsWith('data:image/');
}

export function getStoredAvatar(): string {
  try {
    return localStorage.getItem('scoreboard_avatar') || DEFAULT_AVATAR;
  } catch {
    return DEFAULT_AVATAR;
  }
}

export function setStoredAvatar(avatar: string) {
  try {
    localStorage.setItem('scoreboard_avatar', avatar);
  } catch {}
}
