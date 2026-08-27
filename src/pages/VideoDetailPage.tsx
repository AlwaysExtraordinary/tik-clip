import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { Video } from '@/types/video';
import { Clip } from '@/types/clip';
import { getVideoById } from '@/db/videos';
import { getClipsByVideoId, saveClip, deleteClip } from '@/db/clips';
import {
  getVideoMediaSource,
  syncVideoClipsToDataJson,
  isTauri,
  revealInFileManager,
} from '@/services/fileSystem/index';
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
  const location = useLocation();
  const initialTime = (location.state as { initialTime?: number } | undefined)?.initialTime;

  const { directoryRef, directoryHandle, isHandleRestoring } = useDirectory();
  const activeDirectory = useMemo(
    () =>
      directoryRef ||
      (directoryHandle ? { name: directoryHandle.name, handle: directoryHandle } : null),
    [directoryRef, directoryHandle]
  );
  const { isClipPanelOpen, setIsClipPanelOpen, setEditingClip } = usePlayerStore();

  const [video, setVideo] = useState<Video | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [currentVideoTime, setCurrentVideoTime] = useState(initialTime ?? 0);
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

      if (activeDirectory) {
        try {
          const mediaSource = await getVideoMediaSource(activeDirectory, v.folderName, v.fileName);
          setVideoFile(mediaSource.file || null);
          setVideoSrc(mediaSource.src || null);
        } catch (fileErr) {
          console.error('Failed to load video media source from disk:', fileErr);
          setError(t('videoDetail.videoReadError'));
        }
      }
    } catch (err) {
      console.error(err);
      setError(t('videoDetail.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [videoId, activeDirectory, t]);

  useEffect(() => {
    loadVideoData();
  }, [loadVideoData]);

  // 处理片段保存（新建或更新）
  const handleSaveClip = async (
    startTime: number,
    endTime: number,
    clipId?: string,
    tags?: string[]
  ): Promise<boolean> => {
    if (!videoId || !video) return false;

    const existingClip = clips.find((c) => c.id === clipId);
    const now = Date.now();
    const clipToSave: Clip = {
      id: clipId || generateClipId(),
      videoId,
      startTime,
      endTime,
      tags: tags || [],
      createdAt: existingClip?.createdAt || now,
      updatedAt: now,
    };

    try {
      await saveClip(clipToSave);
      const updatedList = await getClipsByVideoId(videoId);
      setClips(updatedList);

      // 同步持久化至当前视频子目录的 data.json
      if (activeDirectory) {
        try {
          await syncVideoClipsToDataJson(activeDirectory, video, updatedList);
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
      if (activeDirectory) {
        try {
          await syncVideoClipsToDataJson(activeDirectory, video, updatedList);
        } catch (syncErr) {
          console.warn('Failed to sync clips to data.json on delete:', syncErr);
        }
      }
    } catch (err) {
      console.error('Failed to delete clip:', err);
    }
  };

  //返回上一级界面，若无历史记录则回退到视频列表
  const handleBack = useCallback(() => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/videos');
    }
  }, [navigate]);

  if (isHandleRestoring || isLoading) {
    return (
      <div className="text-foreground-muted flex flex-1 items-center justify-center">
        <Icon icon="lucide:loader-2" className="size-8 animate-spin opacity-50" />
      </div>
    );
  }

  if (!activeDirectory) {
    return <EmptyState type="permission-needed" />;
  }

  // 处理视频不存在或读取错误的情况
  if (error || !video) {
    return (
      <div className="bg-surface/40 border-border/40 flex flex-1 flex-col items-center justify-center rounded-3xl border p-8 text-center">
        <div className="bg-danger/10 text-danger mb-3 flex size-12 items-center justify-center rounded-full">
          <Icon icon="lucide:alert-circle" className="size-6" />
        </div>
        <h3 className="mb-1 text-sm font-semibold">{error || t('videoDetail.videoUnavailable')}</h3>
        <p className="text-foreground-muted mb-4 max-w-sm text-xs">
          {t('videoDetail.videoUnavailableDesc')}
        </p>
        <Button variant="secondary" size="sm" onClick={handleBack}>
          {t('videoDetail.back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col p-4 md:p-6 lg:p-8">
      {/* 移动端片段面板背景遮罩 */}
      <div
        onClick={() => {
          setIsClipPanelOpen(false);
          setEditingClip(null);
        }}
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity duration-300 md:hidden',
          isClipPanelOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none hidden opacity-0'
        )}
      />

      {/* 顶部返回导航栏 */}
      <div className="flex items-center justify-between pb-3 select-none">
        <div className="flex items-center gap-2.5 truncate">
          <Button
            isIconOnly
            variant="tertiary"
            size="sm"
            onClick={handleBack}
            aria-label={t('videoDetail.back')}
            className="size-7"
          >
            <Icon icon="lucide:arrow-left" className="size-4" />
          </Button>
          <span className="text-md text-foreground truncate font-semibold" title={video.name}>
            {video.name}
          </span>
          <span className="text-foreground-muted hidden text-xs sm:inline">
            ({t('videoDetail.clipCount', { count: clips.length })})
          </span>
        </div>
      </div>

      {/* 主内容区域：视频播放器 + 片段面板 */}
      <div
        className={cn(
          'relative flex min-h-0 min-w-0 flex-1 transition-all duration-300 ease-in-out',
          isClipPanelOpen ? 'md:gap-4' : 'gap-0'
        )}
      >
        {/* 视频播放器容器 */}
        <div className="flex h-full min-w-0 flex-1">
          <VideoPlayer
            file={videoFile}
            src={videoSrc}
            initialTime={initialTime}
            showScissorsButton={true}
            onCurrentTimeChange={setCurrentVideoTime}
            hasPrevious={false}
            hasNext={false}
            onRevealInExplorer={
              isTauri() && activeDirectory?.path
                ? () => {
                    const sep = activeDirectory.path?.includes('\\') ? '\\' : '/';
                    const fullPath = `${activeDirectory.path}${sep}${video.folderName}`;
                    revealInFileManager(fullPath);
                  }
                : undefined
            }
          />
        </div>

        {/* 右侧片段面板 */}
        <div
          className={cn(
            'h-full shrink-0 transition-all duration-300 ease-in-out',
            // 移动端样式：从右侧悬浮滑出
            'fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] p-3 sm:w-88 sm:p-4',
            // 桌面端样式：常规 flex 侧边栏与折叠过渡
            'md:static md:inset-auto md:z-auto md:max-w-none md:p-0',
            isClipPanelOpen
              ? 'translate-x-0 opacity-100 md:w-88'
              : 'pointer-events-none translate-x-full opacity-0 md:w-0 md:translate-x-[calc(100%+3rem)]'
          )}
        >
          <div className="h-full w-full md:w-88">
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
