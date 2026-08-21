import React, { useEffect, useState } from 'react';
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
import { updateVideoNameInDataJson, hideVideoInDataJson } from '@/services/fileSystem';
import { ConfirmModal } from '@/components/general/ConfirmModal';

export const VideosPage: React.FC = () => {
  const { t } = useTranslation();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const { directoryHandle, isScanning, isHandleRestoring } = useDirectory();

  // 重命名状态
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // 封面查看弹窗状态
  const [previewCoverVideo, setPreviewCoverVideo] = useState<Video | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  // 隐藏视频确认弹窗状态
  const [isShowHideConfirm, setIsShowHideConfirm] = useState<boolean>(false);
  const [hideConfirmVideo, setHideConfirmVideo] = useState<Video | null>(null);

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

    if (directoryHandle) {
      try {
        await updateVideoNameInDataJson(directoryHandle, video.folderName, trimmed);
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
    if (directoryHandle) {
      try {
        await hideVideoInDataJson(directoryHandle, video.folderName);
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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 可滚动网格容器 */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 pb-8">
          {videos.map((video) => (
            <div key={video.id} className="flex flex-col transition-transform duration-200 group">
              {/* 缩略图容器 */}
              <div onClick={() => navigate(`/videos/${video.id}`)}>
                <VideoThumbnail thumbnailBlob={video.thumbnail} alt={video.name} />
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
                          <Dropdown.Trigger>
                            <button
                              type="button"
                              className="p-1 rounded-md hover:bg-surface-hover transition-colors text-foreground-muted hover:text-foreground
                               cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 ease-in transition-opacity duration-200"
                              aria-label={t('common.more')}
                            >
                              <Icon icon="lucide:ellipsis" className="size-3.5" />
                            </button>
                          </Dropdown.Trigger>

                          {/* 操作列表 */}
                          <Dropdown.Popover className="min-w-30">
                            <Dropdown.Menu
                              onAction={(key) => {
                                if (key === 'view-cover') {
                                  // 查看封面
                                  setPreviewCoverVideo(video);
                                } else if (key === 'delete') {
                                  // 隐藏视频
                                  setHideConfirmVideo(video);
                                  setIsShowHideConfirm(true);
                                }
                              }}
                            >
                              {/* 查看封面 */}
                              <Dropdown.Item id="view-cover">
                                <div className="flex items-center gap-2 w-full text-xs font-medium text-foreground">
                                  <Icon icon="lucide:image" className="size-3.5" />
                                  <div>{t('videos.viewCover')}</div>
                                </div>
                              </Dropdown.Item>
                              {/* 隐藏视频 */}
                              <Dropdown.Item id="delete">
                                <div className="flex items-center gap-2 w-full text-xs font-medium text-danger">
                                  <Icon icon="lucide:eye-off" className="size-3.5" />
                                  <div>{t('videos.hide')}</div>
                                </div>
                              </Dropdown.Item>
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
      </div>

      {/* 查看封面弹窗 */}
      <Modal state={coverModalState}>
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="center">
            <Modal.Dialog className="bg-transparent shadow-none p-0 rounded-xl sm:w-auto sm:h-auto sm:max-w-5xl sm:max-h-[90vh] sm:rounded-2xl ">
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
    </div>
  );
};
