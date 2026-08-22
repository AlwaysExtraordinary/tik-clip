import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { Select, ListBox } from '@heroui/react';
import { Video } from '@/types/video';
import { ShuffleItem } from '@/types/clip';
import { getAllVideos } from '@/db/videos';
import { getAllClips } from '@/db/clips';
import { getVideoFileFromHandle } from '@/services/fileSystem';
import { useDirectory } from '@/hooks/useDirectory';
import { ClipFeedContainer, FeedSlotData } from '@/components/clip/ClipFeedContainer';
import { ClipTagList } from '@/components/clip/ClipTagList';
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
    selectedTag,
    setCurrentShuffleItem,
    setCurrentVideoFile,
    setLastPlaybackTime,
    setFileError,
    setSelectedTag,
  } = useClipsFeedStore();

  const [isLoading, setIsLoading] = useState(true);
  const [hasNoClips, setHasNoClips] = useState(false);
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

  // 初始化片段列表和随机播放队列
  const initializeClips = useCallback(async () => {
    if (!directoryHandle) return;
    setIsLoading(true);
    try {
      const [allClips, allVideos] = await Promise.all([getAllClips(), getAllVideos()]);
      const store = useClipsFeedStore.getState();

      if (allClips.length === 0) {
        setAllItems([]);
        setHasNoClips(true);
        store.resetFeed();
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
        setHasNoClips(true);
        store.resetFeed();
        return;
      }

      // 根据当前已选 tag 筛选播放列表
      const curTag = store.selectedTag;
      const targetItems =
        !curTag || curTag === 'all'
          ? items
          : items.filter((item) => item.clip.tags?.includes(curTag));

      if (targetItems.length === 0) {
        setHasNoClips(true);
        store.setCurrentShuffleItem(null);
        store.setCurrentVideoFile(null);
        return;
      }

      setHasNoClips(false);

      // 检查当前全局 Store 中是否已有正在播放的片段
      const existingItem = store.currentShuffleItem;
      if (existingItem) {
        const matchedItem = targetItems.find((it) => it.clip.id === existingItem.clip.id);
        if (matchedItem) {
          // 当前片段依然存在且符合当前 tag：同步队列数据，加载对应文件
          store.shuffleQueue.syncItems(targetItems, matchedItem.clip.id);
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
          // 当前片段不在筛选列表中或已被删除：以 targetItems 重新初始化
          store.shuffleQueue.setItems(targetItems);
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
      } else {
        // 首次进入：全量初始化洗牌队列并从第一个开始
        store.shuffleQueue.setItems(targetItems);
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

  // 切换标签筛选
  const handleTagChange = useCallback(
    async (newTag: string | null) => {
      const activeTag = !newTag || newTag === 'all' ? null : newTag;
      setSelectedTag(activeTag);
      const targetItems = !activeTag
        ? allItems
        : allItems.filter((item) => item.clip.tags?.includes(activeTag));

      if (targetItems.length === 0) {
        setHasNoClips(true);
        setCurrentShuffleItem(null);
        setCurrentVideoFile(null);
        return;
      }

      setHasNoClips(false);
      setFileError(null);

      const current = useClipsFeedStore.getState().currentShuffleItem;
      const matched = current ? targetItems.find((it) => it.clip.id === current.clip.id) : null;

      if (matched) {
        shuffleQueue.syncItems(targetItems, matched.clip.id);
      } else {
        shuffleQueue.setItems(targetItems);
        const first = shuffleQueue.next();
        if (first) {
          setCurrentShuffleItem(first);
          setLastPlaybackTime(first.clip.startTime);
          if (directoryHandle) {
            try {
              const file = await getVideoFileFromHandle(
                directoryHandle,
                first.video.folderName,
                first.video.fileName
              );
              setCurrentVideoFile(file);
            } catch (err) {
              console.error('Failed to load video file for clip:', err);
              setFileError(t('clipsFeed.readError'));
              setCurrentVideoFile(null);
            }
          }
        }
      }
    },
    [
      allItems,
      directoryHandle,
      setCurrentShuffleItem,
      setCurrentVideoFile,
      setFileError,
      setLastPlaybackTime,
      setSelectedTag,
      shuffleQueue,
      t,
    ]
  );

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
        <Icon icon="lucide:loader-2" className="size-8 animate-spin opacity-50" />
      </div>
    );
  }

  if (!directoryHandle) {
    return <EmptyState type="no-directory" />;
  }

  if (hasNoClips || (!currentShuffleItem && !fileError)) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden p-4 md:p-6 lg:p-8">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between pb-3 select-none">
          <div className="flex items-center gap-2 truncate">
            <span className="text-md font-semibold text-foreground truncate">
              {t('clipsFeed.title')}
            </span>
          </div>

          {/* 选择标签 */}
          {allTags.length > 0 && (
            <div className="shrink-0">
              <Select
                value={selectedTag || null}
                onChange={(key) => {
                  handleTagChange(key as string | null);
                }}
                placeholder={t('clipsFeed.selectTag')}
                aria-label={t('clipsFeed.filterByTag')}
                className="w-30"
              >
                <Select.Trigger className="text-xs rounded-full">
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <Icon icon="lucide:tag" className="size-3.5 text-foreground-muted shrink-0" />
                    <Select.Value />
                  </div>
                  <Select.Indicator className="text-foreground-muted" />
                </Select.Trigger>
                <Select.Popover className="min-w-30">
                  <ListBox>
                    <ListBox.Item id="all" textValue={t('clipsFeed.default')}>
                      <span>{t('clipsFeed.none')}</span>
                      <ListBox.ItemIndicator className="text-accent" />
                    </ListBox.Item>
                    {allTags.map((tag) => (
                      <ListBox.Item key={tag} id={tag} textValue={tag}>
                        <span>{tag}</span>
                        <ListBox.ItemIndicator className="text-accent" />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
          )}
        </div>

        {/* 空状态提示 */}
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            type="no-clips"
            title={
              !selectedTag || selectedTag === 'all'
                ? t('clipsFeed.noClipsTitle')
                : t('clipsFeed.noClipsForTag')
            }
            description={t('clipsFeed.noClipsDesc')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4 md:p-6 lg:p-8">
      {/* 视频 / 片段标题头部与右上角 Tag 选择 */}
      <div className="flex items-center justify-between pb-3 select-none gap-3">
        {/* 视频标题与标签 */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className="text-md font-semibold text-foreground truncate shrink-0"
            title={currentShuffleItem?.video.name || t('clipsFeed.title')}
          >
            {currentShuffleItem?.video.name || t('clipsFeed.title')}
          </span>
          <ClipTagList tags={currentShuffleItem?.clip.tags} />
        </div>

        {/* 右上角 Tag 选择器 */}
        {allTags.length > 0 && (
          <div className="shrink-0">
            <Select
              value={selectedTag || null}
              onChange={(key) => {
                handleTagChange(key as string | null);
              }}
              placeholder={t('clipsFeed.selectTag')}
              aria-label={t('clipsFeed.filterByTag')}
              className="w-30"
            >
              <Select.Trigger className="text-xs">
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <Icon icon="lucide:tag" className="size-3.5 text-foreground-muted shrink-0" />
                  <Select.Value className="max-sm:text-sm" />
                </div>
                <Select.Indicator className="text-foreground-muted" />
              </Select.Trigger>
              <Select.Popover className="min-w-30">
                <ListBox>
                  <ListBox.Item
                    id="all"
                    textValue={t('clipsFeed.default')}
                    className="text-foreground-muted"
                  >
                    <span>{t('clipsFeed.default')}</span>
                    <ListBox.ItemIndicator className="text-accent" />
                  </ListBox.Item>
                  {allTags.map((tag) => (
                    <ListBox.Item key={tag} id={tag} textValue={tag}>
                      <span>{tag}</span>
                      <ListBox.ItemIndicator className="text-accent" />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        )}
      </div>

      {/* 主视频播放器容器（仿 TikTok 上下滑动切换） */}
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
