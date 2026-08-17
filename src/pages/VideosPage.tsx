import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Video } from '@/types/video';
import { getAllVideos } from '@/db/videos';
import { VideoThumbnail } from '@/components/video/VideoThumbnail';
import { EmptyState } from '@/components/video/EmptyState';
import { useDirectory } from '@/hooks/useDirectory';

export const VideosPage: React.FC = () => {
  const { t } = useTranslation();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const { directoryHandle, isScanning, isHandleRestoring } = useDirectory();

  useEffect(() => {
    let active = true;

    async function loadVideos() {
      setIsLoading(true);
      try {
        const list = await getAllVideos();
        if (active) {
          setVideos(list);
        }
      } catch (err) {
        console.error('Failed to load videos:', err);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    if (!isScanning) {
      loadVideos();
    }

    return () => {
      active = false;
    };
  }, [isScanning]);

  if (isHandleRestoring || (isLoading && isScanning)) {
    return <EmptyState type="no-directory" />;
  }

  if (!directoryHandle && videos.length === 0) {
    return <EmptyState type="no-directory" />;
  }

  if (!directoryHandle && videos.length > 0) {
    return <EmptyState type="permission-needed" />;
  }

  if (videos.length === 0) {
    return (
      <EmptyState
        type="no-videos"
        title={t('videos.noVideosTitle')}
        description={t('videos.noVideosDesc')}
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* 可滚动网格容器 */}
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 pb-8">
          {videos.map((video) => (
            <div
              key={video.id}
              onClick={() => navigate(`/videos/${video.id}`)}
              className="group flex flex-col cursor-pointer transition-transform duration-200 hover:-translate-y-1 select-none"
            >
              {/* 缩略图容器 */}
              <VideoThumbnail
                thumbnailBlob={video.thumbnail}
                alt={video.name}
                className="shadow-subtle group-hover:shadow-card transition-shadow duration-200"
              />

              {/* 缩略图下方的视频信息 */}
              <div className="mt-2.5 px-0.5 text-center">
                <h3
                  className="text-xs font-semibold text-foreground truncate group-hover:text-accent transition-colors"
                  title={video.name}
                >
                  {video.name}
                </h3>
                <p className="text-[11px] text-foreground-muted font-medium mt-0.5">
                  {t('videos.clipCount', { count: video.clipsCount })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
