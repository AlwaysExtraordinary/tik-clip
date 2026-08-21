import React, { useEffect, useState, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { Video } from '@/types/video';
import { ShuffleItem } from '@/types/clip';
import { getAllVideos } from '@/db/videos';
import { getAllClips } from '@/db/clips';
import { getVideoFileFromHandle } from '@/services/fileSystem';
import { useDirectory } from '@/hooks/useDirectory';
import { ClipFeedContainer, FeedSlotData } from '@/components/clip/ClipFeedContainer';
import { EmptyState } from '@/components/video/EmptyState';
import { useClipsFeedStore } from '@/stores/clipsFeedStore';

export const ClipsPage: React.FC = () => {
  const { t } = useTranslation();
  const { directoryHandle, isHandleRestoring } = useDirectory();

  const {
    shuffleQueue,
    currentShuffleItem,
    currentVideoFile,
    lastPlaybackTime,
    fileError,
    setCurrentShuffleItem,
    setCurrentVideoFile,
    setLastPlaybackTime,
    setFileError,
  } = useClipsFeedStore();

  const [isLoading, setIsLoading] = useState(true);
  const [hasNoClips, setHasNoClips] = useState(false);

  // 初始化片段列表和随机播放队列（仅依赖 directoryHandle，内部通过 getState 获取最新 store 状态）
  const initializeClips = useCallback(async () => {
    if (!directoryHandle) return;
    setIsLoading(true);
    try {
      const [allClips, allVideos] = await Promise.all([getAllClips(), getAllVideos()]);
      const store = useClipsFeedStore.getState();

      if (allClips.length === 0) {
        setHasNoClips(true);
        store.resetFeed();
        return;
      }

      setHasNoClips(false);
      const videoMap = new Map<string, Video>();
      allVideos.forEach((v) => videoMap.set(v.id, v));

      const items: ShuffleItem[] = [];
      for (const clip of allClips) {
        const video = videoMap.get(clip.videoId);
        if (video) {
          items.push({ clip, video });
        }
      }

      if (items.length === 0) {
        setHasNoClips(true);
        store.resetFeed();
        return;
      }

      // 检查当前全局 Store 中是否已有正在播放的片段
      const existingItem = store.currentShuffleItem;
      if (existingItem) {
        const matchedItem = items.find((it) => it.clip.id === existingItem.clip.id);
        if (matchedItem) {
          // 当前片段依然存在：同步队列数据，加载对应文件
          store.shuffleQueue.syncItems(items, matchedItem.clip.id);
          store.setCurrentShuffleItem(matchedItem);
          store.setFileError(null);
          try {
            const file = await getVideoFileFromHandle(
              directoryHandle,
              matchedItem.video.folderName,
              matchedItem.video.fileName
            );
            store.setCurrentVideoFile(file);
          } catch (err) {
            console.error('Failed to load video file for clip:', err);
            store.setFileError(t('clipsFeed.readError'));
            store.setCurrentVideoFile(null);
          }
        } else {
          // 当前片段已被删除：同步队列，设置错误提示
          store.shuffleQueue.syncItems(items);
          store.setFileError(t('clipsFeed.clipDeletedOrUnavailable'));
          store.setCurrentVideoFile(null);
        }
      } else {
        // 首次进入：全量初始化洗牌队列并从第一个开始
        store.shuffleQueue.setItems(items);
        const first = store.shuffleQueue.next();
        if (first) {
          store.setCurrentShuffleItem(first);
          store.setLastPlaybackTime(first.clip.startTime);
          store.setFileError(null);
          try {
            const file = await getVideoFileFromHandle(
              directoryHandle,
              first.video.folderName,
              first.video.fileName
            );
            store.setCurrentVideoFile(file);
          } catch (err) {
            console.error('Failed to load video file for clip:', err);
            store.setFileError(t('clipsFeed.readError'));
            store.setCurrentVideoFile(null);
          }
        }
      }
    } catch (err) {
      console.error('Error initializing clips feed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [directoryHandle, t]);

  useEffect(() => {
    if (directoryHandle) {
      initializeClips();
    }
  }, [directoryHandle, initializeClips]);

  // 请求下一个片段数据供动画容器预先装载
  const handleRequestNext = useCallback(async (): Promise<FeedSlotData | null> => {
    if (!directoryHandle) return null;
    const nextItem = shuffleQueue.next();
    if (!nextItem) return null;

    try {
      const file = await getVideoFileFromHandle(
        directoryHandle,
        nextItem.video.folderName,
        nextItem.video.fileName
      );
      return { item: nextItem, file };
    } catch (err) {
      console.error('Failed to load next video file:', err);
      return null;
    }
  }, [directoryHandle, shuffleQueue]);

  // 请求上一个片段数据供动画容器预先装载
  const handleRequestPrevious = useCallback(async (): Promise<FeedSlotData | null> => {
    if (!directoryHandle) return null;
    const prevItem = shuffleQueue.previous();
    if (!prevItem) return null;

    try {
      const file = await getVideoFileFromHandle(
        directoryHandle,
        prevItem.video.folderName,
        prevItem.video.fileName
      );
      return { item: prevItem, file };
    } catch (err) {
      console.error('Failed to load previous video file:', err);
      return null;
    }
  }, [directoryHandle, shuffleQueue]);

  // 当动画滑动完成时同步当前状态
  const handleCommitItemChange = useCallback(
    (item: ShuffleItem, file: File | null) => {
      setCurrentShuffleItem(item);
      setCurrentVideoFile(file);
      setLastPlaybackTime(item.clip.startTime);
    },
    [setCurrentShuffleItem, setCurrentVideoFile, setLastPlaybackTime]
  );

  // 播放器时间更新时实时记录到 Store
  const handleCurrentTimeChange = useCallback(
    (time: number) => {
      setLastPlaybackTime(time);
    },
    [setLastPlaybackTime]
  );

  // 跳过已被删除的片段
  const handleSkipDeletedClip = useCallback(async () => {
    if (!directoryHandle) return;
    const nextItem = shuffleQueue.next();
    if (nextItem) {
      setFileError(null);
      try {
        const file = await getVideoFileFromHandle(
          directoryHandle,
          nextItem.video.folderName,
          nextItem.video.fileName
        );
        handleCommitItemChange(nextItem, file);
      } catch (err) {
        console.error('Failed to load next video file:', err);
        setFileError(t('clipsFeed.readError'));
      }
    } else {
      setHasNoClips(true);
    }
  }, [directoryHandle, shuffleQueue, handleCommitItemChange, setFileError, t]);

  if (isHandleRestoring || (isLoading && !currentShuffleItem && !fileError && !hasNoClips)) {
    return (
      <div className="flex-1 flex items-center justify-center text-foreground-muted">
        <Icon icon="lucide:loader-2" className="w-8 h-8 animate-spin opacity-50" />
      </div>
    );
  }

  if (!directoryHandle) {
    return <EmptyState type="no-directory" />;
  }

  if (hasNoClips || (!currentShuffleItem && !fileError)) {
    return (
      <EmptyState
        type="no-clips"
        title={t('clipsFeed.noClipsTitle')}
        description={t('clipsFeed.noClipsDesc')}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4 md:p-6 lg:p-8">
      {/* 视频 / 片段标题头部 */}
      <div className="flex items-center justify-between pb-3 select-none">
        <div className="flex items-center gap-2 truncate">
          <span className="text-sm font-semibold text-foreground truncate">
            {currentShuffleItem?.video.name || t('clipsFeed.title')}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-active text-foreground-muted font-medium">
            {t('clipsFeed.randomFeed')}
          </span>
        </div>
      </div>

      {/* 主视频播放器容器（仿 TikTok 上下滑动切换） */}
      <div className="flex-1 h-full min-w-0 flex overflow-hidden">
        {fileError ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-surface rounded-3xl border border-border/40 shadow-card">
            <Icon icon="lucide:alert-triangle" className="w-10 h-10 text-danger mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">
              {t('clipsFeed.clipUnavailable')}
            </h3>
            <p className="text-xs text-foreground-muted mb-5 max-w-sm">{fileError}</p>
            <button
              onClick={handleSkipDeletedClip}
              className="px-5 py-2 rounded-2xl bg-foreground text-background text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-subtle cursor-pointer"
            >
              {t('clipsFeed.skipToNext')}
            </button>
          </div>
        ) : (
          currentShuffleItem && (
            <ClipFeedContainer
              key="clip-feed-container"
              currentSlot={{ item: currentShuffleItem, file: currentVideoFile }}
              initialTime={lastPlaybackTime ?? currentShuffleItem.clip.startTime}
              onCurrentTimeChange={handleCurrentTimeChange}
              onRequestNext={handleRequestNext}
              onRequestPrevious={handleRequestPrevious}
              onCommitItemChange={handleCommitItemChange}
              hasPrevious={true}
              hasNext={true}
            />
          )
        )}
      </div>
    </div>
  );
};
