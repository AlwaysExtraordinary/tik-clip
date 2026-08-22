import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { cn } from '@/utils/cn';

interface VideoThumbnailProps {
  thumbnailBlob?: Blob;
  alt: string;
  className?: string;
  onOpenCoverPreview?: () => void;
}

export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  thumbnailBlob,
  alt,
  className = '',
  onOpenCoverPreview,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
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

  return (
    <div
      ref={containerRef}
      className={cn(
        `bg-surface border-border shadow-subtle group/cover hover:shadow-card relative flex aspect-800/540 w-full 
        cursor-pointer items-center justify-center overflow-hidden rounded-lg border transition-all
        duration-300 ease-out hover:-translate-y-1 ${className}`
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          className="h-full w-full object-cover transition-transform"
          loading="lazy"
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
