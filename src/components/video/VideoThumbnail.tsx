import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';

interface VideoThumbnailProps {
  thumbnailBlob?: Blob;
  alt: string;
  className?: string;
}

export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  thumbnailBlob,
  alt,
  className = '',
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
      className={`relative w-full aspect-video bg-surface overflow-hidden rounded-2xl flex items-center justify-center border border-border/40 ${className}`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-foreground-muted gap-1">
          <Icon icon="lucide:film" className="w-8 h-8 opacity-40" />
        </div>
      )}
    </div>
  );
};
