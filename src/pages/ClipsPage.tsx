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
import { ClipFeedContainer } from '@/components/clip/ClipFeedContainer';
import { ClipTagList } from '@/components/clip/ClipTagList';
import { EmptyState } from '@/components/video/EmptyState';
import { useClipsFeedStore } from '@/stores/clipsFeedStore';
import { usePlayerStore } from '@/stores/playerStore';

export const ClipsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { directoryRef, directoryHandle, isScanning, isHandleRestoring, hasDirectoryPermission } =
    useDirectory();
  const activeDirectory = useMemo(
    () =>
      directoryRef ||
      (directoryHandle ? { name: directoryHandle.name, handle: directoryHandle } : null),
    [directoryRef, directoryHandle]
  );

  const {
    shuffleQueue,
    currentShuffleItem,
    lastPlaybackTime,
    fileError,
    selectedTag,
    setCurrentShuffleItem,
    setLastPlaybackTime,
    setFileError,
    setSelectedTag,
    resetFeed,
  } = useClipsFeedStore();

  const [totalVideoCount, setTotalVideoCount] = useState<number>(0);
  const [allItems, setAllItems] = useState<ShuffleItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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

  // 当目录变更或扫描完成时加载数据
  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!activeDirectory || !hasDirectoryPermission || isScanning) {
        return;
      }

      setIsLoading(true);
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
        } else {
          // 重新初始化洗牌队列并从首个片段开始播放
          store.shuffleQueue.setItems(targetItems);
          const first = store.shuffleQueue.current();
          if (first) {
            store.setCurrentShuffleItem(first);
            store.setLastPlaybackTime(first.clip.startTime);
            store.setFileError(null);
          }
        }
      } catch (err) {
        console.error('Error loading clips feed:', err);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    if (!isScanning && activeDirectory && hasDirectoryPermission) {
      loadData();
    } else if (!activeDirectory || !hasDirectoryPermission) {
      setAllItems([]);
      setTotalVideoCount(0);
      setIsLoading(false);
      resetFeed();
    }

    return () => {
      active = false;
    };
  }, [
    activeDirectory,
    hasDirectoryPermission,
    isScanning,
    resetFeed,
    setCurrentShuffleItem,
    setFileError,
    setLastPlaybackTime,
  ]);

  /**
   * 切换标签筛选
   * @param newTag 选中的标签名称，为 'all' 或 null 时重置为全部片段
   */
  const handleTagChange = useCallback(
    (newTag: string | null) => {
      const activeTag = !newTag || newTag === 'all' ? null : newTag;
      setSelectedTag(activeTag);
      const targetItems = !activeTag
        ? allItems
        : allItems.filter((item) => item.clip.tags?.includes(activeTag));

      if (targetItems.length === 0) {
        shuffleQueue.setItems([]);
        setCurrentShuffleItem(null);
        setLastPlaybackTime(null);
        return;
      }

      setFileError(null);
      shuffleQueue.setItems(targetItems);
      const first = shuffleQueue.current();
      if (first) {
        setCurrentShuffleItem(first);
        setLastPlaybackTime(first.clip.startTime);
      }
    },
    [
      allItems,
      setCurrentShuffleItem,
      setFileError,
      setLastPlaybackTime,
      setSelectedTag,
      shuffleQueue,
    ]
  );

  // 播放器时间更新时实时记录到 Store
  const handleCurrentTimeChange = useCallback(
    (time: number) => {
      setLastPlaybackTime(time);
    },
    [setLastPlaybackTime]
  );

  // 当前播放项变更时同步
  const handleCurrentClipChange = useCallback(
    (item: ShuffleItem) => {
      setCurrentShuffleItem(item);
      setLastPlaybackTime(item.clip.startTime);
      setFileError(null);
    },
    [setCurrentShuffleItem, setFileError, setLastPlaybackTime]
  );

  // 跳过已被删除或损坏的片段
  const handleSkipDeletedClip = useCallback(async () => {
    const nextItem = shuffleQueue.next();
    if (nextItem) {
      setCurrentShuffleItem(nextItem);
      setLastPlaybackTime(nextItem.clip.startTime);
      setFileError(null);
    } else {
      setCurrentShuffleItem(null);
    }
  }, [shuffleQueue, setCurrentShuffleItem, setFileError, setLastPlaybackTime]);

  // 状态检查
  if (isHandleRestoring) {
    return <EmptyState type="loading" />;
  }

  // 无目录状态
  if (!activeDirectory) {
    return <EmptyState type="no-directory" />;
  }

  // 需要重新授权访问权限状态
  if (!hasDirectoryPermission) {
    return <EmptyState type="permission-needed" />;
  }

  // 扫描状态
  if (isScanning) {
    return <EmptyState type="scanning" />;
  }

  // 数据加载中状态
  if (isLoading) {
    return <EmptyState type="loading" />;
  }

  // 无视频状态
  if (totalVideoCount === 0 && allItems.length === 0) {
    return (
      <EmptyState
        type="no-videos"
        title={t('videos.noVideosTitle')}
        description={t('videos.noVideosDesc')}
      />
    );
  }

  // 无片段状态
  if (allItems.length === 0) {
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
              value={selectedTag || 'all'}
              onChange={(key) => handleTagChange(key as string | null)}
              placeholder={t('clipsFeed.selectTag')}
              aria-label={t('clipsFeed.filterByTag')}
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
                      <ListBox.ItemIndicator className="text-accent" />
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
          <EmptyState
            type="clip-unavailable"
            description={fileError}
            onAction={handleSkipDeletedClip}
          />
        ) : currentShuffleItem ? (
          <ClipFeedContainer
            key={`${activeDirectory.name}-${selectedTag || 'all'}`}
            shuffleQueue={shuffleQueue}
            loadMediaSource={loadVideoSource}
            initialIndex={shuffleQueue.currentIndexValue}
            initialTime={lastPlaybackTime ?? currentShuffleItem.clip.startTime}
            onCurrentTimeChange={handleCurrentTimeChange}
            onCurrentClipChange={handleCurrentClipChange}
            onGoToVideoDetail={(item, time) => {
              usePlayerStore.getState().setEditingClip(item.clip);
              const targetTime =
                typeof time === 'number' ? time : (lastPlaybackTime ?? item.clip.startTime);
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
