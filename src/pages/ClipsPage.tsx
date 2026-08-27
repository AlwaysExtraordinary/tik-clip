import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { Select, ListBox } from '@heroui/react';
import { Video } from '@/types/video';
import { ShuffleItem } from '@/types/clip';
import { getAllVideos } from '@/db/videos';
import { getAllClips } from '@/db/clips';
import { getVideoMediaSource, VideoMediaSource } from '@/services/fileSystem/index';
import { useDirectory } from '@/hooks/useDirectory';
import { ClipFeedContainer, FeedSlotData } from '@/components/clip/ClipFeedContainer';
import { ClipTagList } from '@/components/clip/ClipTagList';
import { EmptyState } from '@/components/video/EmptyState';
import { useClipsFeedStore } from '@/stores/clipsFeedStore';
import { usePlayerStore } from '@/stores/playerStore';

export const ClipsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { directoryRef, directoryHandle, isScanning, isHandleRestoring } = useDirectory();
  const activeDirectory = useMemo(
    () =>
      directoryRef ||
      (directoryHandle ? { name: directoryHandle.name, handle: directoryHandle } : null),
    [directoryRef, directoryHandle]
  );

  const {
    shuffleQueue,
    currentShuffleItem,
    currentVideoFile,
    currentVideoSrc,
    lastPlaybackTime,
    fileError,
    selectedTag,
    setCurrentShuffleItem,
    setCurrentVideoFile,
    setCurrentVideoSrc,
    setLastPlaybackTime,
    setFileError,
    setSelectedTag,
    resetFeed,
  } = useClipsFeedStore();

  const [totalVideoCount, setTotalVideoCount] = useState<number>(0);
  const [allItems, setAllItems] = useState<ShuffleItem[]>([]);

  // 提取所有已有片段中的全部不重复标签
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const item of allItems) {
      if (item.clip.tags) {
        for (const tag of item.clip.tags) {
          if (tag && tag.trim()) {
            tagSet.add(tag.trim());
          }
        }
      }
    }
    return Array.from(tagSet).sort();
  }, [allItems]);

  // 从文件系统加载视频媒体源
  const loadVideoSource = useCallback(
    async (item: ShuffleItem): Promise<VideoMediaSource | null> => {
      if (!activeDirectory) return null;
      try {
        return await getVideoMediaSource(
          activeDirectory,
          item.video.folderName,
          item.video.fileName
        );
      } catch (err) {
        console.error('Failed to load video media source for clip:', err);
        return null;
      }
    },
    [activeDirectory]
  );

  // 激活并播放指定片段项
  const playItem = useCallback(
    async (item: ShuffleItem) => {
      setCurrentShuffleItem(item);
      setLastPlaybackTime(item.clip.startTime);
      setFileError(null);
      const mediaSource = await loadVideoSource(item);
      if (!mediaSource) {
        setFileError(t('clipsFeed.readError'));
        setCurrentVideoFile(null);
        setCurrentVideoSrc(null);
      } else {
        setCurrentVideoFile(mediaSource.file || null);
        setCurrentVideoSrc(mediaSource.src || null);
      }
    },
    [
      loadVideoSource,
      setCurrentShuffleItem,
      setLastPlaybackTime,
      setFileError,
      setCurrentVideoFile,
      setCurrentVideoSrc,
      t,
    ]
  );

  // 当目录变更或扫描完成时加载数据
  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!activeDirectory || isScanning) {
        return;
      }

      try {
        const [allClips, allVideos] = await Promise.all([getAllClips(), getAllVideos()]);
        if (!active) return;

        setTotalVideoCount(allVideos.length);

        if (allVideos.length === 0 || allClips.length === 0) {
          setAllItems([]);
          resetFeed();
          return;
        }

        const videoMap = new Map<string, Video>();
        allVideos.forEach((v) => videoMap.set(v.id, v));

        const items: ShuffleItem[] = [];
        for (const clip of allClips) {
          const video = videoMap.get(clip.videoId);
          if (video) {
            items.push({ clip, video });
          }
        }

        setAllItems(items);

        if (items.length === 0) {
          resetFeed();
          return;
        }

        // 根据当前已选 tag 筛选播放列表
        const store = useClipsFeedStore.getState();
        const curTag = store.selectedTag;
        const targetItems =
          !curTag || curTag === 'all'
            ? items
            : items.filter((item) => item.clip.tags?.includes(curTag));

        if (targetItems.length === 0) {
          setCurrentShuffleItem(null);
          setCurrentVideoFile(null);
          setCurrentVideoSrc(null);
          return;
        }

        // 检查当前已播放片段是否仍然有效且匹配当前筛选
        const existingItem = store.currentShuffleItem;
        const matchedItem = existingItem
          ? targetItems.find((it) => it.clip.id === existingItem.clip.id)
          : null;

        if (matchedItem) {
          store.shuffleQueue.syncItems(targetItems, matchedItem.clip.id);
          store.setCurrentShuffleItem(matchedItem);
          store.setFileError(null);
          if (!store.currentVideoFile && !store.currentVideoSrc) {
            const mediaSource = await loadVideoSource(matchedItem);
            if (!mediaSource) {
              store.setFileError(t('clipsFeed.readError'));
            }
            store.setCurrentVideoFile(mediaSource?.file || null);
            store.setCurrentVideoSrc(mediaSource?.src || null);
          }
        } else {
          // 重新初始化洗牌队列并从首个片段开始播放
          store.shuffleQueue.setItems(targetItems);
          const first = store.shuffleQueue.next();
          if (first) {
            await playItem(first);
          }
        }
      } catch (err) {
        console.error('Error loading clips feed:', err);
      }
    }

    if (!isScanning && activeDirectory) {
      loadData();
    } else if (!activeDirectory) {
      setAllItems([]);
      setTotalVideoCount(0);
      resetFeed();
    }

    return () => {
      active = false;
    };
  }, [
    activeDirectory,
    isScanning,
    loadVideoSource,
    playItem,
    resetFeed,
    setCurrentShuffleItem,
    setCurrentVideoFile,
    setCurrentVideoSrc,
    t,
  ]);

  // 切换标签筛选
  const handleTagChange = useCallback(
    async (newTag: string | null) => {
      const activeTag = !newTag || newTag === 'all' ? null : newTag;
      setSelectedTag(activeTag);
      const targetItems = !activeTag
        ? allItems
        : allItems.filter((item) => item.clip.tags?.includes(activeTag));

      if (targetItems.length === 0) {
        setCurrentShuffleItem(null);
        setCurrentVideoFile(null);
        setCurrentVideoSrc(null);
        return;
      }

      setFileError(null);

      const current = useClipsFeedStore.getState().currentShuffleItem;
      const matched = current ? targetItems.find((it) => it.clip.id === current.clip.id) : null;

      if (matched) {
        shuffleQueue.syncItems(targetItems, matched.clip.id);
      } else {
        shuffleQueue.setItems(targetItems);
        const first = shuffleQueue.next();
        if (first) {
          await playItem(first);
        }
      }
    },
    [
      allItems,
      playItem,
      setCurrentShuffleItem,
      setCurrentVideoFile,
      setCurrentVideoSrc,
      setFileError,
      setSelectedTag,
      shuffleQueue,
    ]
  );

  // 预获取下一个片段数据供动画容器后台预加载（不消耗洗牌队列游标）
  const handlePeekNext = useCallback(async (): Promise<FeedSlotData | null> => {
    const nextItem = shuffleQueue.peekNext();
    if (!nextItem) return null;
    const mediaSource = await loadVideoSource(nextItem);
    return {
      item: nextItem,
      file: mediaSource?.file || null,
      src: mediaSource?.src || null,
    };
  }, [loadVideoSource, shuffleQueue]);

  // 请求下一个片段数据供动画容器预先装载
  const handleRequestNext = useCallback(async (): Promise<FeedSlotData | null> => {
    const nextItem = shuffleQueue.next();
    if (!nextItem) return null;
    const mediaSource = await loadVideoSource(nextItem);
    return {
      item: nextItem,
      file: mediaSource?.file || null,
      src: mediaSource?.src || null,
    };
  }, [loadVideoSource, shuffleQueue]);

  // 请求上一个片段数据供动画容器预先装载
  const handleRequestPrevious = useCallback(async (): Promise<FeedSlotData | null> => {
    const prevItem = shuffleQueue.previous();
    if (!prevItem) return null;
    const mediaSource = await loadVideoSource(prevItem);
    return {
      item: prevItem,
      file: mediaSource?.file || null,
      src: mediaSource?.src || null,
    };
  }, [loadVideoSource, shuffleQueue]);

  // 当动画滑动完成时同步当前状态
  const handleCommitItemChange = useCallback(
    (item: ShuffleItem, file: File | null, src?: string | null) => {
      setCurrentShuffleItem(item);
      setCurrentVideoFile(file);
      setCurrentVideoSrc(src || null);
      setLastPlaybackTime(item.clip.startTime);
    },
    [setCurrentShuffleItem, setCurrentVideoFile, setCurrentVideoSrc, setLastPlaybackTime]
  );

  // 播放器时间更新时实时记录到 Store
  const handleCurrentTimeChange = useCallback(
    (time: number) => {
      setLastPlaybackTime(time);
    },
    [setLastPlaybackTime]
  );

  // 跳过已被删除或损坏的片段
  const handleSkipDeletedClip = useCallback(async () => {
    const nextItem = shuffleQueue.next();
    if (nextItem) {
      await playItem(nextItem);
    } else {
      setCurrentShuffleItem(null);
    }
  }, [shuffleQueue, playItem, setCurrentShuffleItem]);

  // 无目录状态
  if (isHandleRestoring || !activeDirectory) {
    return <EmptyState type="no-directory" />;
  }

  // 扫描状态
  if (isScanning) {
    return <EmptyState type="scanning" />;
  }

  // 无片段状态：无片段
  if (totalVideoCount === 0 && allItems.length === 0) {
    return (
      <EmptyState
        type="no-videos"
        title={t('videos.noVideosTitle')}
        description={t('videos.noVideosDesc')}
      />
    );
  }

  // 无片段状态：片段列表为空
  if (allItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-between pb-3 select-none">
          <span className="text-md font-semibold text-foreground truncate">
            {t('clipsFeed.title')}
          </span>
        </div>
        <div className="flex-1 h-full min-w-0 flex overflow-hidden">
          <EmptyState
            type="no-clips"
            title={t('clipsFeed.noClipsTitle')}
            description={t('clipsFeed.noClipsDesc')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4 md:p-6 lg:p-8">
      {/* 顶部栏：片段标题与标签列表 / 右上角 Tag 筛选器 */}
      <div className="flex items-center justify-between pb-3 select-none gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className="text-md font-semibold text-foreground truncate shrink-0"
            title={currentShuffleItem?.video.name || t('clipsFeed.title')}
          >
            {currentShuffleItem?.video.name || t('clipsFeed.title')}
          </span>
          {currentShuffleItem && <ClipTagList tags={currentShuffleItem.clip.tags} />}
        </div>

        {allTags.length > 0 && (
          <div className="shrink-0">
            <Select
              value={selectedTag || null}
              onChange={(key) => handleTagChange(key as string | null)}
              placeholder={t('clipsFeed.selectTag')}
              aria-label={t('clipsFeed.filterByTag')}
              // className="w-30"
            >
              <Select.Trigger className="text-xs rounded-full min-h-0 py-1.5">
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <Icon icon="lucide:tag" className="size-3.5 text-foreground-muted shrink-0" />
                  <Select.Value className="text-[11px] sm:text-[12px]" />
                </div>
                <Select.Indicator className="text-foreground-muted" />
              </Select.Trigger>
              <Select.Popover className="min-w-30 rounded-xl">
                <ListBox>
                  <ListBox.Item
                    id="all"
                    textValue={t('clipsFeed.default')}
                    className="text-foreground-muted text-[11px] sm:text-[12px] min-h-0 py-1 rounded-md"
                  >
                    <span>{t('clipsFeed.default')}</span>
                    <ListBox.ItemIndicator className="text-accent" />
                  </ListBox.Item>
                  {allTags.map((tag) => (
                    <ListBox.Item
                      key={tag}
                      id={tag}
                      textValue={tag}
                      className="text-[11px] sm:text-[12px] min-h-0 py-1 rounded-md"
                    >
                      <span>{tag}</span>
                      <ListBox.ItemIndicator className="text-accent " />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        )}
      </div>

      {/* 主播放区域 / 空状态 / 错误状态 */}
      <div className="flex-1 h-full min-w-0 flex overflow-hidden">
        {fileError ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-surface rounded-3xl border border-border/40 shadow-card">
            <Icon icon="lucide:alert-triangle" className="size-10 text-danger mb-3" />
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
        ) : currentShuffleItem ? (
          <ClipFeedContainer
            key={activeDirectory.name}
            currentSlot={{
              item: currentShuffleItem,
              file: currentVideoFile,
              src: currentVideoSrc,
            }}
            initialTime={lastPlaybackTime ?? currentShuffleItem.clip.startTime}
            onCurrentTimeChange={handleCurrentTimeChange}
            onPeekNext={handlePeekNext}
            onRequestNext={handleRequestNext}
            onRequestPrevious={handleRequestPrevious}
            onCommitItemChange={handleCommitItemChange}
            hasPrevious={true}
            hasNext={true}
            onGoToVideoDetail={(item, time) => {
              // 设置当前片段为编辑状态（不强制打开 ClipPanel，由已保存状态决定）
              usePlayerStore.getState().setEditingClip(item.clip);
              const targetTime = typeof time === 'number' ? time : (lastPlaybackTime ?? item.clip.startTime);
              navigate(`/videos/${item.video.id}`, { state: { initialTime: targetTime } });
            }}
          />
        ) : (
          <EmptyState
            type="no-clips"
            title={t('clipsFeed.noClipsForTag')}
            description={t('clipsFeed.noClipsDesc')}
          />
        )}
      </div>
    </div>
  );
};
