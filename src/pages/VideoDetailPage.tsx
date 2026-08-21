import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { Video } from '@/types/video';
import { Clip } from '@/types/clip';
import { getVideoById } from '@/db/videos';
import { getClipsByVideoId, saveClip, deleteClip } from '@/db/clips';
import { getVideoFileFromHandle, syncVideoClipsToDataJson } from '@/services/fileSystem';
import { generateClipId } from '@/utils/id';
import { useDirectory } from '@/hooks/useDirectory';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { ClipPanel } from '@/components/clip/ClipPanel';
import { EmptyState } from '@/components/video/EmptyState';
import { usePlayerStore } from '@/stores/playerStore';
import { cn } from '@/utils/cn';
import { Button } from '@heroui/react';

export const VideoDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();

  const { directoryHandle, isHandleRestoring } = useDirectory();
  const { isClipPanelOpen } = usePlayerStore();

  const [video, setVideo] = useState<Video | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载视频元数据与文件
  const loadVideoData = useCallback(async () => {
    if (!videoId) return;
    setIsLoading(true);
    setError(null);

    try {
      const v = await getVideoById(videoId);
      if (!v) {
        setError(t('videoDetail.videoNotFound'));
        return;
      }
      setVideo(v);

      const clipList = await getClipsByVideoId(videoId);
      setClips(clipList);

      if (directoryHandle) {
        try {
          const file = await getVideoFileFromHandle(directoryHandle, v.folderName, v.fileName);
          setVideoFile(file);
        } catch (fileErr) {
          console.error('Failed to load video file from disk:', fileErr);
          setError(t('videoDetail.videoReadError'));
        }
      }
    } catch (err) {
      console.error(err);
      setError(t('videoDetail.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [videoId, directoryHandle, t]);

  useEffect(() => {
    loadVideoData();
  }, [loadVideoData]);

  // 处理片段保存（新建或更新）
  const handleSaveClip = async (
    startTime: number,
    endTime: number,
    clipId?: string
  ): Promise<boolean> => {
    if (!videoId || !video) return false;

    const existingClip = clips.find((c) => c.id === clipId);
    const now = Date.now();
    const clipToSave: Clip = {
      id: clipId || generateClipId(),
      videoId,
      startTime,
      endTime,
      createdAt: existingClip?.createdAt || now,
      updatedAt: now,
    };

    try {
      await saveClip(clipToSave);
      const updatedList = await getClipsByVideoId(videoId);
      setClips(updatedList);

      // 同步持久化至当前视频子目录的 data.json
      if (directoryHandle) {
        try {
          await syncVideoClipsToDataJson(directoryHandle, video, updatedList);
        } catch (syncErr) {
          console.warn('Failed to sync clips to data.json on save:', syncErr);
        }
      }

      return true;
    } catch (err) {
      console.error('Failed to save clip:', err);
      return false;
    }
  };

  // 处理片段删除
  const handleDeleteClip = async (clipId: string) => {
    if (!videoId || !video) return;
    try {
      await deleteClip(clipId, videoId);
      const updatedList = await getClipsByVideoId(videoId);
      setClips(updatedList);

      // 同步持久化至当前视频子目录的 data.json
      if (directoryHandle) {
        try {
          await syncVideoClipsToDataJson(directoryHandle, video, updatedList);
        } catch (syncErr) {
          console.warn('Failed to sync clips to data.json on delete:', syncErr);
        }
      }
    } catch (err) {
      console.error('Failed to delete clip:', err);
    }
  };

  if (isHandleRestoring || isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-foreground-muted">
        <Icon icon="lucide:loader-2" className="w-8 h-8 animate-spin opacity-50" />
      </div>
    );
  }

  if (!directoryHandle) {
    return <EmptyState type="permission-needed" />;
  }

  // 处理视频不存在或读取错误的情况
  if (error || !video) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-surface/40 rounded-3xl border border-border/40">
        <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mb-3">
          <Icon icon="lucide:alert-circle" className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold mb-1">{error || t('videoDetail.videoUnavailable')}</h3>
        <p className="text-xs text-foreground-muted mb-4 max-w-sm">
          {t('videoDetail.videoUnavailableDesc')}
        </p>
        <button
          onClick={() => navigate('/videos')}
          className="px-4 py-2 rounded-2xl bg-surface-hover text-xs font-semibold hover:bg-surface-active transition-colors cursor-pointer"
        >
          {t('videoDetail.backToVideos')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 p-4 md:p-6 lg:p-8">
      {/* 顶部返回导航栏 */}
      <div className="flex items-center justify-between pb-3 select-none">
        <div className="flex items-center gap-2.5 truncate">
          <Button
            isIconOnly
            variant="tertiary"
            size="sm"
            onClick={() => navigate('/videos')}
            aria-label={t('videoDetail.backToVideos')}
            className="size-7"
          >
            <Icon icon="lucide:arrow-left" className="w-4 h-4" />
          </Button>
          <span className="text-md font-semibold text-foreground truncate" title={video.name}>
            {video.name}
          </span>
          <span className="text-xs text-foreground-muted hidden sm:inline">
            ({t('videoDetail.clipCount', { count: clips.length })})
          </span>
        </div>
      </div>

      {/* 主内容区域：视频播放器 + 片段面板 */}
      <div
        className={cn(
          'flex-1 flex min-h-0 min-w-0 relative transition-all duration-300 ease-in-out',
          isClipPanelOpen ? 'gap-4' : 'gap-0'
        )}
      >
        {/* 视频播放器容器 */}
        <div className="flex-1 h-full min-w-0 flex">
          <VideoPlayer
            file={videoFile}
            showScissorsButton={true}
            onCurrentTimeChange={setCurrentVideoTime}
            hasPrevious={false}
            hasNext={false}
          />
        </div>

        {/* 右侧片段面板 */}
        <div
          className={cn(
            'h-full shrink-0 transition-all duration-300 ease-in-out',
            isClipPanelOpen
              ? 'w-80 sm:w-88 opacity-100 translate-x-0'
              : 'w-0 opacity-0 translate-x-[calc(100%+3rem)] pointer-events-none'
          )}
        >
          <div className="w-80 sm:w-88 h-full">
            <ClipPanel
              videoDuration={video.duration}
              currentVideoTime={currentVideoTime}
              clips={clips}
              onSaveClip={handleSaveClip}
              onDeleteClip={handleDeleteClip}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
