import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Video } from '@/types/video';
import { getAllVideos, deleteVideo } from '@/db/videos';
import { db } from '@/db/database';
import { VideoThumbnail } from '@/components/video/VideoThumbnail';
import { EmptyState } from '@/components/video/EmptyState';
import { useDirectory } from '@/hooks/useDirectory';
import { Icon } from '@iconify/react';
import { Dropdown, Input, Modal, useOverlayState } from '@heroui/react';
import { FilterSelect } from '@/components/general/FilterSelect';
import {
  updateVideoNameInDataJson,
  hideVideoInDataJson,
  isTauri,
  revealInFileManager,
} from '@/services/fileSystem/index';
import { ConfirmModal } from '@/components/general/ConfirmModal';
import { VideoDetailsModal } from '@/components/video/VideoDetailsModal';
import { cn } from '@/utils/cn';

export const VideosPage: React.FC = () => {
  const { t } = useTranslation();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  const { directoryRef, directoryHandle, isScanning, isHandleRestoring, hasDirectoryPermission } =
    useDirectory();
  const activeDirectory = useMemo(
    () =>
      directoryRef ||
      (directoryHandle ? { name: directoryHandle.name, handle: directoryHandle } : null),
    [directoryRef, directoryHandle]
  );

  // 重命名状态
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // 封面查看弹窗状态
  const [previewCoverVideo, setPreviewCoverVideo] = useState<Video | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  // 隐藏视频确认弹窗状态
  const [isShowHideConfirm, setIsShowHideConfirm] = useState<boolean>(false);
  const [hideConfirmVideo, setHideConfirmVideo] = useState<Video | null>(null);

  // 详细信息弹窗状态
  const [detailsModalVideo, setDetailsModalVideo] = useState<Video | null>(null);

  // 页面独立筛选状态（不与 Clips 页面同步）
  const [selectedCategory, setSelectedCategoryState] = useState<string | null>(null);
  const [selectedActor, setSelectedActorState] = useState<string | null>(null);

  // 统一归一化为 null（当选择 'all' 或空时）
  const setSelectedCategory = useCallback((cat: string | null) => {
    setSelectedCategoryState(!cat || cat === 'all' ? null : cat);
  }, []);

  const setSelectedActor = useCallback((act: string | null) => {
    setSelectedActorState(!act || act === 'all' ? null : act);
  }, []);

  // 重置筛选条件
  const resetFilters = useCallback(() => {
    setSelectedCategoryState(null);
    setSelectedActorState(null);
  }, []);

  // 检查视频库中是否有任何类别或演员（用于保持选择器结构稳定）
  const hasAnyCategory = useMemo(() => {
    return videos.some((v) => Boolean(v.category && v.category.trim()));
  }, [videos]);

  const hasAnyActor = useMemo(() => {
    return videos.some((v) => Boolean(v.actor && v.actor.trim()));
  }, [videos]);

  // 根据当前已选演员动态级联计算可用类别列表
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const v of videos) {
      const matchActor =
        !selectedActor || selectedActor === 'all'
          ? true
          : Boolean(v.actor && v.actor.includes(selectedActor));
      if (matchActor && v.category && v.category.trim()) {
        const parts = v.category.split(/[,，/、;\s]+/);
        for (const p of parts) {
          const trimmed = p.trim();
          if (trimmed) {
            set.add(trimmed);
          }
        }
      }
    }
    return Array.from(set).sort();
  }, [videos, selectedActor]);

  // 根据当前已选类别动态级联计算可用演员列表
  const availableActors = useMemo(() => {
    const set = new Set<string>();
    for (const v of videos) {
      const matchCategory =
        !selectedCategory || selectedCategory === 'all'
          ? true
          : Boolean(v.category && v.category.includes(selectedCategory));
      if (matchCategory && v.actor && v.actor.trim()) {
        const parts = v.actor.split(/[,，/、;\s]+/);
        for (const p of parts) {
          const trimmed = p.trim();
          if (trimmed) {
            set.add(trimmed);
          }
        }
      }
    }
    return Array.from(set).sort();
  }, [videos, selectedCategory]);

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

  // 依据筛选器计算当前显示的视频列表
  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      const matchCategory =
        !selectedCategory || selectedCategory === 'all'
          ? true
          : Boolean(v.category && v.category.includes(selectedCategory));

      const matchActor =
        !selectedActor || selectedActor === 'all'
          ? true
          : Boolean(v.actor && v.actor.includes(selectedActor));

      return matchCategory && matchActor;
    });
  }, [videos, selectedCategory, selectedActor]);

  // 卡片操作列表
  const videoActionList = [
    {
      text: t('videos.details'),
      key: 'details',
      iconName: 'lucide:info',
      isShow: true,
    },
    {
      text: t('videos.revealInExplorer'),
      key: 'reveal',
      iconName: 'lucide:folder-symlink',
      isShow: isTauri() && activeDirectory?.path,
    },
    {
      text: t('videos.hideVideo'),
      key: 'delete',
      iconName: 'lucide:image-off',
      isShow: true,
      textColorClass: 'text-danger',
    },
  ];

  // 加载视频列表
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

  // 封面预览 URL 生命周期管理
  useEffect(() => {
    if (!previewCoverVideo?.thumbnail) {
      setCoverUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewCoverVideo.thumbnail);
    setCoverUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [previewCoverVideo]);

  const coverModalState = useOverlayState({
    isOpen: Boolean(previewCoverVideo),
    onOpenChange: (open) => {
      if (!open) {
        setPreviewCoverVideo(null);
      }
    },
  });

  const handleStartRename = (video: Video, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingVideoId(video.id);
    setEditingName(video.name);
  };

  // 保存更改视频名称
  const handleSaveRename = async (video: Video) => {
    const trimmed = editingName.trim();
    setEditingVideoId(null);
    if (!trimmed || trimmed === video.name) {
      return;
    }

    const now = Date.now();
    setVideos((prev) =>
      prev.map((v) => (v.id === video.id ? { ...v, name: trimmed, updatedAt: now } : v))
    );

    try {
      await db.videos.update(video.id, {
        name: trimmed,
        updatedAt: now,
      });
    } catch (err) {
      console.error('Failed to update video name in DB:', err);
    }

    if (activeDirectory) {
      try {
        await updateVideoNameInDataJson(activeDirectory, video.folderName, trimmed);
      } catch (err) {
        console.warn('Failed to update data.json on video rename:', err);
      }
    }
  };

  // 隐藏视频
  const handleDeleteVideo = async (video: Video) => {
    // 从列表中隐藏/删除
    setVideos((prev) => prev.filter((v) => v.id !== video.id));

    // 写入 data.json hidden: true
    if (activeDirectory) {
      try {
        await hideVideoInDataJson(activeDirectory, video.folderName);
      } catch (err) {
        console.warn('Failed to write hidden: true to data.json:', err);
      }
    }

    // 从 Dexie 数据库中删除
    try {
      await deleteVideo(video.id);
    } catch (err) {
      console.error('Failed to delete video from DB:', err);
    }
  };

  if (isHandleRestoring) {
    return <EmptyState type="loading" />;
  }

  if (!activeDirectory) {
    return <EmptyState type="no-directory" />;
  }

  if (!hasDirectoryPermission) {
    return <EmptyState type="permission-needed" />;
  }

  if (isScanning) {
    return <EmptyState type="scanning" />;
  }

  if (isLoading) {
    return <EmptyState type="loading" />;
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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 顶部筛选工具栏 */}
      {(hasAnyCategory || hasAnyActor) && (
        <div className="flex items-center gap-3 px-4 md:px-6 lg:px-8 pt-4 pb-1 shrink-0 flex-wrap">
          {/* 种类筛选 */}
          {hasAnyCategory && (
            <FilterSelect
              value={selectedCategory}
              onChange={setSelectedCategory}
              icon="lucide:folder"
              defaultLabel={t('videos.allCategories')}
              options={availableCategories}
              placeholder={t('videos.filterByCategory')}
              ariaLabel={t('videos.filterByCategory')}
            />
          )}

          {/* 演员筛选 */}
          {hasAnyActor && (
            <FilterSelect
              value={selectedActor}
              onChange={setSelectedActor}
              icon="lucide:user"
              defaultLabel={t('videos.allActors')}
              options={availableActors}
              placeholder={t('videos.filterByActor')}
              ariaLabel={t('videos.filterByActor')}
            />
          )}
        </div>
      )}

      {/* 可滚动网格容器 */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 md:pt-4 lg:p-8 lg:pt-4">
        {filteredVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-foreground-muted py-16 gap-2">
            <Icon icon="lucide:folder-search" className="size-10" />
            <p className="text-xs">{t('videos.noFilteredVideos')}</p>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-accent hover:underline cursor-pointer mt-1"
            >
              {t('clipsFeed.default')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 pb-8">
            {filteredVideos.map((video) => (
              <div key={video.id} className="flex flex-col transition-transform duration-200 group">
                {/* 缩略图容器 */}
                <div onClick={() => navigate(`/videos/${video.id}`)}>
                  <VideoThumbnail
                    thumbnailBlob={video.thumbnail}
                    alt={video.name}
                    // 查看封面
                    onOpenCoverPreview={() => setPreviewCoverVideo(video)}
                  />
                </div>
                {/* 缩略图下方的视频信息 */}
                <div className="mt-2.5 px-0.5 text-center">
                  <div className="flex items-center justify-center relative h-7">
                    {/* 输入框 */}
                    {editingVideoId === video.id ? (
                      <Input
                        autoFocus
                        value={editingName}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleSaveRename(video)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveRename(video);
                          } else if (e.key === 'Escape') {
                            setEditingVideoId(null);
                          }
                        }}
                        className="w-full text-xs font-semibold px-2 py-0.5 rounded-md text-center bg-surface 
                      border border-accent focus:outline-none focus:ring-1"
                        aria-label={t('videos.rename')}
                      />
                    ) : (
                      <>
                        {/* 标题与操作按钮 */}
                        <div
                          className="w-full text-xs font-semibold text-foreground truncate px-12 py-0.5 border border-transparent"
                          title={video.name}
                        >
                          {video.name}
                        </div>
                        <div className="flex items-center gap-1.5 absolute right-0">
                          <button
                            type="button"
                            onClick={(e) => handleStartRename(video, e)}
                            className="p-1 rounded-md hover:bg-surface-hover transition-colors text-foreground-muted hover:text-foreground 
                          cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 ease-in transition-opacity duration-200"
                            aria-label={t('videos.rename')}
                          >
                            <Icon icon="lucide:pencil-line" className="size-3.5" />
                          </button>

                          {/* 操作列表 */}
                          <Dropdown>
                            <Dropdown.Trigger
                              className="p-1 rounded-md hover:bg-surface-hover text-foreground-muted hover:text-foreground cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                              aria-label={t('common.more')}
                            >
                              <Icon icon="lucide:ellipsis" className="size-3.5" />
                            </Dropdown.Trigger>

                            {/* 操作列表 */}
                            <Dropdown.Popover className="min-w-30 rounded-xl">
                              <Dropdown.Menu
                                onAction={(key) => {
                                  if (key === 'details') {
                                    // 打开详细信息弹窗
                                    setDetailsModalVideo(video);
                                  } else if (key === 'delete') {
                                    // 隐藏视频
                                    setHideConfirmVideo(video);
                                    setIsShowHideConfirm(true);
                                  } else if (key === 'reveal' && activeDirectory?.path) {
                                    const sep = activeDirectory.path.includes('\\') ? '\\' : '/';
                                    const fullPath = `${activeDirectory.path}${sep}${video.folderName}`;
                                    revealInFileManager(fullPath);
                                  }
                                }}
                              >
                                {/* 操作列表 */}
                                {videoActionList
                                  .filter((item) => item.isShow)
                                  .map((item) => (
                                    <Dropdown.Item
                                      id={item.key}
                                      className="rounded-md px-1.5 py-1 min-h-0"
                                    >
                                      <div
                                        className={cn(
                                          'flex items-center gap-2 w-full text-xs font-medium rounded-xl',
                                          item.textColorClass
                                            ? item.textColorClass
                                            : 'text-foreground'
                                        )}
                                      >
                                        <Icon icon={item.iconName} className="size-3.5" />
                                        <div>{item.text}</div>
                                      </div>
                                    </Dropdown.Item>
                                  ))}
                              </Dropdown.Menu>
                            </Dropdown.Popover>
                          </Dropdown>
                        </div>
                      </>
                    )}
                  </div>

                  <p className="text-[11px] text-foreground-muted font-medium mt-0.5">
                    {t('videos.clipCount', { count: video.clipsCount })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 查看封面弹窗 */}
      <Modal state={coverModalState}>
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="center">
            <Modal.Dialog
              className="bg-transparent shadow-none p-0 rounded-xl sm:w-auto sm:h-auto sm:max-w-5xl 
              sm:max-h-[90vh] sm:rounded-2xl "
            >
              <Modal.CloseTrigger />

              {/* 封面图片展示区：按原比例 */}
              <Modal.Body className="flex-1 flex items-center justify-center p-0">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={previewCoverVideo?.name || 'Cover'}
                    className="w-auto h-auto object-contain select-none"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-foreground-muted gap-2 py-16">
                    <Icon icon="lucide:image-off" className="size-10" />
                    <span className="text-xs">{t('videos.noCover')}</span>
                  </div>
                )}
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* 隐藏视频确认弹窗 */}
      <ConfirmModal
        isOpen={isShowHideConfirm}
        onClose={() => {
          setHideConfirmVideo(null);
          setIsShowHideConfirm(false);
        }}
        onConfirm={async () => {
          if (hideConfirmVideo) {
            await handleDeleteVideo(hideConfirmVideo);
            setHideConfirmVideo(null);
            setIsShowHideConfirm(false);
          }
        }}
        title={t('videos.hideConfirmTitle')}
        content={t('videos.hideConfirmContent')}
        confirmText={t('videos.confirmHide')}
        confirmVariant="danger"
        iconName="lucide:eye-off"
      />

      {/* 视频详细信息弹窗 */}
      <VideoDetailsModal
        isOpen={Boolean(detailsModalVideo)}
        video={detailsModalVideo}
        activeDirectory={activeDirectory}
        onClose={() => setDetailsModalVideo(null)}
        onSaved={(updatedVideo) => {
          setVideos((prev) => prev.map((v) => (v.id === updatedVideo.id ? updatedVideo : v)));
        }}
      />
    </div>
  );
};
