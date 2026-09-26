import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { FilterSelect } from '@/components/general/FilterSelect';

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
    selectedCategory,
    selectedActor,
    selectedTag,
    allItems,
    setCurrentShuffleItem,
    setLastPlaybackTime,
    setFileError,
    setSelectedCategory,
    setSelectedActor,
    setSelectedTag,
    setAllItems,
    resetFilters,
    resetFeed,
  } = useClipsFeedStore();

  const [totalVideoCount, setTotalVideoCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(() => allItems.length === 0);

  // 检查片段库中是否有任何类别、演员或标签（用于保持选择器结构稳定，防止组件闪烁消失）
  const hasAnyCategory = useMemo(() => {
    return allItems.some((item) => Boolean(item.video.category && item.video.category.trim()));
  }, [allItems]);

  const hasAnyActor = useMemo(() => {
    return allItems.some((item) => Boolean(item.video.actor && item.video.actor.trim()));
  }, [allItems]);

  const hasAnyTag = useMemo(() => {
    return allItems.some((item) => Boolean(item.clip.tags && item.clip.tags.length > 0));
  }, [allItems]);

  // 根据当前已选演员与标签，动态级联计算可用的类别列表
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const item of allItems) {
      const matchActor =
        !selectedActor || selectedActor === 'all'
          ? true
          : Boolean(item.video.actor && item.video.actor.includes(selectedActor));
      const matchTag =
        !selectedTag || selectedTag === 'all'
          ? true
          : Boolean(item.clip.tags && item.clip.tags.includes(selectedTag));

      if (matchActor && matchTag && item.video.category && item.video.category.trim()) {
        const parts = item.video.category.split(/[,，/、;\s]+/);
        for (const p of parts) {
          const trimmed = p.trim();
          if (trimmed) {
            set.add(trimmed);
          }
        }
      }
    }
    return Array.from(set).sort();
  }, [allItems, selectedActor, selectedTag]);

  // 根据当前已选类别与标签，动态级联计算可用的演员列表
  const availableActors = useMemo(() => {
    const set = new Set<string>();
    for (const item of allItems) {
      const matchCategory =
        !selectedCategory || selectedCategory === 'all'
          ? true
          : Boolean(item.video.category && item.video.category.includes(selectedCategory));
      const matchTag =
        !selectedTag || selectedTag === 'all'
          ? true
          : Boolean(item.clip.tags && item.clip.tags.includes(selectedTag));

      if (matchCategory && matchTag && item.video.actor && item.video.actor.trim()) {
        const parts = item.video.actor.split(/[,，/、;\s]+/);
        for (const p of parts) {
          const trimmed = p.trim();
          if (trimmed) {
            set.add(trimmed);
          }
        }
      }
    }
    return Array.from(set).sort();
  }, [allItems, selectedCategory, selectedTag]);

  // 根据当前已选类别与演员，动态级联计算可用的标签列表
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const item of allItems) {
      const matchCategory =
        !selectedCategory || selectedCategory === 'all'
          ? true
          : Boolean(item.video.category && item.video.category.includes(selectedCategory));
      const matchActor =
        !selectedActor || selectedActor === 'all'
          ? true
          : Boolean(item.video.actor && item.video.actor.includes(selectedActor));

      if (matchCategory && matchActor && item.clip.tags) {
        for (const tag of item.clip.tags) {
          const trimmed = tag.trim();
          if (trimmed) {
            set.add(trimmed);
          }
        }
      }
    }
    return Array.from(set).sort();
  }, [allItems, selectedCategory, selectedActor]);

  // 当筛选条件改变后，若已选类别无符合条件则自动回退显示默认项
  useEffect(() => {
    if (
      selectedCategory &&
      selectedCategory !== 'all' &&
      !availableCategories.includes(selectedCategory)
    ) {
      setSelectedCategory(null);
    }
  }, [availableCategories, selectedCategory, setSelectedCategory]);

  // 当筛选条件改变后，若已选演员无符合条件则自动回退显示默认项
  useEffect(() => {
    if (selectedActor && selectedActor !== 'all' && !availableActors.includes(selectedActor)) {
      setSelectedActor(null);
    }
  }, [availableActors, selectedActor, setSelectedActor]);

  // 当筛选条件改变后，若已选标签无符合条件则自动回退显示默认项
  useEffect(() => {
    if (selectedTag && selectedTag !== 'all' && !availableTags.includes(selectedTag)) {
      setSelectedTag(null);
    }
  }, [availableTags, selectedTag, setSelectedTag]);

  /**
   * 根据标签、类别、演员联合筛选片段列表
   * @param items 待筛选的所有片段列表
   * @param tag 选中的标签
   * @param category 选中的类别
   * @param actor 选中的演员
   */
  const filterItems = useCallback(
    (
      items: ShuffleItem[],
      tag: string | null,
      category: string | null,
      actor: string | null
    ): ShuffleItem[] => {
      return items.filter((item) => {
        const matchTag = !tag || tag === 'all' ? true : item.clip.tags?.includes(tag);
        const matchCategory =
          !category || category === 'all'
            ? true
            : Boolean(item.video.category && item.video.category.includes(category));
        const matchActor =
          !actor || actor === 'all'
            ? true
            : Boolean(item.video.actor && item.video.actor.includes(actor));
        return matchTag && matchCategory && matchActor;
      });
    },
    []
  );

  // 依据当前生效的筛选条件计算当前目标播放列表
  const targetItems = useMemo(() => {
    return filterItems(allItems, selectedTag, selectedCategory, selectedActor);
  }, [allItems, filterItems, selectedTag, selectedCategory, selectedActor]);

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

      if (useClipsFeedStore.getState().allItems.length === 0) {
        setIsLoading(true);
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

        if (items.length === 0) {
          setAllItems([]);
          resetFeed();
          return;
        }

        // 若当前未初始化洗牌队列或当前播放项为空，立即初始化队列，确保首次渲染时队列与播放项已就绪
        const state = useClipsFeedStore.getState();
        const currentItem = state.currentShuffleItem;
        if (!currentItem || shuffleQueue.totalCount === 0) {
          const initialTargetItems = filterItems(
            items,
            state.selectedTag,
            state.selectedCategory,
            state.selectedActor
          );
          if (initialTargetItems.length > 0) {
            shuffleQueue.setItems(initialTargetItems);
            const first = shuffleQueue.current();
            setCurrentShuffleItem(first);
            if (first) {
              setLastPlaybackTime(first.clip.startTime);
            }
          }
        }

        setAllItems(items);
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
    } else if (!isHandleRestoring && (!activeDirectory || !hasDirectoryPermission)) {
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
    filterItems,
    hasDirectoryPermission,
    isHandleRestoring,
    isScanning,
    resetFeed,
    setAllItems,
    setCurrentShuffleItem,
    setLastPlaybackTime,
    shuffleQueue,
  ]);

  // 同步当前播放片段到 Ref，避免普通播放滑动时重新触发队列同步 Effect
  const currentShuffleItemRef = useRef(currentShuffleItem);
  useEffect(() => {
    currentShuffleItemRef.current = currentShuffleItem;
  }, [currentShuffleItem]);

  // 当前筛选条件唯一组合键
  const currentFilterKey = `${selectedTag || 'all'}-${selectedCategory || 'all'}-${selectedActor || 'all'}`;

  // 记录上一次渲染时生效的筛选条件组合键，用于判断当前渲染帧是否处于筛选切换状态
  const [prevFilterKey, setPrevFilterKey] = useState(currentFilterKey);
  const filtersChanged = currentFilterKey !== prevFilterKey;

  if (filtersChanged) {
    setPrevFilterKey(currentFilterKey);
  }

  // 记录上一次完成数据与播放项同步的筛选条件组合键（仅在 Effect 中读写）
  const syncedFilterKeyRef = useRef(currentFilterKey);

  // 当筛选目标片段列表发生变动时，自适应同步洗牌队列与当前播放项
  useEffect(() => {
    if (allItems.length === 0) {
      return;
    }

    if (targetItems.length === 0) {
      shuffleQueue.setItems([]);
      setCurrentShuffleItem(null);
      setLastPlaybackTime(null);
      return;
    }

    setFileError(null);
    const existingItem = currentShuffleItemRef.current;
    const matchedItem = existingItem
      ? targetItems.find((it) => it.clip.id === existingItem.clip.id)
      : null;

    const isFilterChange = syncedFilterKeyRef.current !== currentFilterKey;
    syncedFilterKeyRef.current = currentFilterKey;

    if (isFilterChange) {
      // 切换筛选条件（包括从筛选恢复到默认）：清空所有已观看状态，全量重新洗牌并从第 0 项开始播放
      shuffleQueue.setItems(targetItems);
      const first = shuffleQueue.current();
      setCurrentShuffleItem(first);
      if (first) {
        setLastPlaybackTime(first.clip.startTime);
      }
    } else {
      // 非筛选变更（如从详情页返回或数据增量刷新）：原地同步，保持原队列顺序与当前播放项及进度稳定
      if (matchedItem) {
        shuffleQueue.syncItems(targetItems, matchedItem.clip.id);
        setCurrentShuffleItem(matchedItem);
      } else {
        shuffleQueue.setItems(targetItems);
        const first = shuffleQueue.current();
        if (first) {
          setCurrentShuffleItem(first);
          setLastPlaybackTime(first.clip.startTime);
        }
      }
    }
  }, [
    allItems.length,
    currentFilterKey,
    setCurrentShuffleItem,
    setFileError,
    setLastPlaybackTime,
    shuffleQueue,
    targetItems,
  ]);

  // 切换标签筛选
  const handleTagChange = useCallback(
    (newTag: string | null) => {
      setSelectedTag(newTag);
    },
    [setSelectedTag]
  );

  // 切换类别筛选
  const handleCategoryChange = useCallback(
    (newCategory: string | null) => {
      setSelectedCategory(newCategory);
    },
    [setSelectedCategory]
  );

  // 切换演员筛选
  const handleActorChange = useCallback(
    (newActor: string | null) => {
      setSelectedActor(newActor);
    },
    [setSelectedActor]
  );

  /**
   * 播放器时间更新时实时记录到 Store（确保不低于当前片段起始时间）
   * @param time 当前播放时间戳（秒）
   */
  const handleCurrentTimeChange = useCallback(
    (time: number) => {
      const curStartTime = currentShuffleItem?.clip.startTime ?? 0;
      setLastPlaybackTime(Math.max(curStartTime, time));
    },
    [currentShuffleItem, setLastPlaybackTime]
  );

  // 刷新重看当前筛选条件下的片段列表（保持已有筛选条件不变，全量重新洗牌）
  const handleRefreshAndRewatch = useCallback(() => {
    if (targetItems.length === 0) return;
    shuffleQueue.setItems(targetItems);
    const first = shuffleQueue.current();
    setCurrentShuffleItem(first);
    if (first) {
      setLastPlaybackTime(first.clip.startTime);
    }
    setFileError(null);
  }, [shuffleQueue, targetItems, setCurrentShuffleItem, setLastPlaybackTime, setFileError]);

  /**
   * 当前播放项变更时同步
   * @param item 当前激活的片段项（到达末尾提示卡片时为 null）
   */
  const handleCurrentClipChange = useCallback(
    (item: ShuffleItem | null) => {
      setCurrentShuffleItem(item);
      if (item) {
        setLastPlaybackTime(item.clip.startTime);
      }
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
            className="text-md font-semibold text-foreground truncate min-w-0"
            title={currentShuffleItem?.video.name || t('clipsFeed.title')}
          >
            {currentShuffleItem?.video.name || t('clipsFeed.title')}
          </span>
          {currentShuffleItem && <ClipTagList tags={currentShuffleItem.clip.tags} />}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* 类别筛选器 */}
          {hasAnyCategory && (
            <FilterSelect
              value={selectedCategory}
              onChange={handleCategoryChange}
              icon="lucide:chart-column-stacked"
              defaultLabel={t('videos.allCategories')}
              options={availableCategories}
              placeholder={t('clipsFeed.selectCategory')}
              ariaLabel={t('clipsFeed.filterByCategory')}
              isShowDefautText={false}
            />
          )}

          {/* 演员筛选器 */}
          {hasAnyActor && (
            <FilterSelect
              value={selectedActor}
              onChange={handleActorChange}
              icon="lucide:user"
              defaultLabel={t('videos.allActors')}
              options={availableActors}
              placeholder={t('clipsFeed.selectActor')}
              ariaLabel={t('clipsFeed.filterByActor')}
              isShowDefautText={false}
            />
          )}

          {/* 标签筛选器 */}
          {hasAnyTag && (
            <FilterSelect
              value={selectedTag}
              onChange={handleTagChange}
              icon="lucide:tag"
              defaultLabel={t('clipsFeed.allTags')}
              options={availableTags}
              placeholder={t('clipsFeed.selectTag')}
              ariaLabel={t('clipsFeed.filterByTag')}
              isShowDefautText={false}
            />
          )}
        </div>
      </div>

      {/* 主播放区域 / 空状态 / 错误状态 */}
      <div className="flex-1 h-full min-w-0 flex overflow-hidden">
        {fileError ? (
          <EmptyState
            type="clip-unavailable"
            description={fileError}
            onAction={handleSkipDeletedClip}
          />
        ) : targetItems.length > 0 && currentShuffleItem && shuffleQueue.totalCount > 0 ? (
          <ClipFeedContainer
            key={`${activeDirectory.name}-${selectedTag || 'all'}-${selectedCategory || 'all'}-${selectedActor || 'all'}`}
            shuffleQueue={shuffleQueue}
            loadMediaSource={loadVideoSource}
            initialIndex={filtersChanged ? 0 : shuffleQueue.currentIndexValue}
            initialTime={
              filtersChanged
                ? (shuffleQueue.current()?.clip.startTime ?? 0)
                : lastPlaybackTime !== null && currentShuffleItem
                  ? Math.max(currentShuffleItem.clip.startTime, lastPlaybackTime)
                  : currentShuffleItem
                    ? currentShuffleItem.clip.startTime
                    : 0
            }
            onCurrentTimeChange={handleCurrentTimeChange}
            onCurrentClipChange={handleCurrentClipChange}
            onRefresh={handleRefreshAndRewatch}
            onGoToVideoDetail={(item, time) => {
              usePlayerStore.getState().setEditingClip(item.clip);
              const targetTime =
                typeof time === 'number'
                  ? Math.max(item.clip.startTime, time)
                  : Math.max(item.clip.startTime, lastPlaybackTime ?? item.clip.startTime);
              navigate(`/videos/${item.video.id}`, { state: { initialTime: targetTime } });
            }}
          />
        ) : targetItems.length > 0 ? (
          <EmptyState type="loading" />
        ) : (
          <EmptyState
            type="no-clips"
            title={t('clipsFeed.noClipsForFilter')}
            description={t('clipsFeed.noClipsDesc')}
            actionText={t('clipsFeed.default')}
            onAction={resetFilters}
          />
        )}
      </div>
    </div>
  );
};
