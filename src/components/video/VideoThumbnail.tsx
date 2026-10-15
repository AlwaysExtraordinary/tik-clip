import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { cn } from '@/utils/cn';
import { useSettingsStore } from '@/stores/settingsStore';

interface VideoThumbnailProps {
  thumbnailBlob?: Blob;
  alt: string;
  className?: string;
  hasCover?: boolean; // 是否拥有独立封面图片文件
  onOpenCoverPreview?: () => void;
}

export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  thumbnailBlob,
  alt,
  className = '',
  hasCover = false,
  onOpenCoverPreview,
}) => {
  const { showSinglePageCover } = useSettingsStore();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isSpread, setIsSpread] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 懒加载观察器
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '150px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 管理 Object URL 生命周期
  useEffect(() => {
    if (!isVisible || !thumbnailBlob) {
      setImageUrl(null);
      return;
    }

    const url = URL.createObjectURL(thumbnailBlob);
    setImageUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [thumbnailBlob, isVisible]);

  // 检测图片是否为宽幅封套展开图 (宽高比 > 1.25)
  useEffect(() => {
    if (!imageUrl) {
      setIsSpread(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setIsSpread(img.naturalWidth / img.naturalHeight > 1.25);
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // 判断是否应用 Coverflow 正面单页封面裁剪（开启单页封面、有真实封面且为展开图）
  const isFrontCoverCropped = showSinglePageCover && hasCover && isSpread;

  return (
    <div
      ref={containerRef}
      className={cn(
        `bg-surface border-border shadow-subtle group/cover hover:shadow-card relative flex w-full 
        cursor-pointer items-center justify-center overflow-hidden rounded-lg border transition-all
        duration-300 ease-out hover:-translate-y-1`,
        showSinglePageCover ? 'aspect-379.5/540' : 'aspect-800/540',
        className
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          className={cn(
            'h-full w-full object-cover transition-transform duration-300',
            isFrontCoverCropped ? 'object-right' : 'object-center'
          )}
          loading="lazy"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) {
              setIsSpread(img.naturalWidth / img.naturalHeight > 1.25);
            }
          }}
        />
      ) : (
        <div className="text-foreground-muted flex flex-col items-center justify-center gap-1">
          <Icon icon="lucide:film" className="h-8 w-8 opacity-40" />
        </div>
      )}

      <div
        className="bg-surface/40 backdrop-blur-md absolute top-1.5 right-1.5 rounded-full p-1 opacity-0 transition-opacity 
        transition-colors duration-300 ease-out group-hover/cover:opacity-100 hover:bg-surface/80"
        onClick={(e) => {
          // 阻止事件冒泡，避免触发父级点击事件
          e.stopPropagation();
          onOpenCoverPreview?.();
        }}
      >
        <Icon icon="lucide:maximize-2" className="text-foreground h-4 w-4" />
      </div>
    </div>
  );
};
