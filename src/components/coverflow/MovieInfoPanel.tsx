import React, { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { Chip, Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { CoverflowMovie } from './types';
import { cn } from '@/utils/cn';
import { parseTagList } from '@/utils/common';
import { useAppStore } from '@/stores/appStore';
import { isTauri, openPathInOs, openExternalUrl } from '@/services/fileSystem/index';
import { Video } from '@/types/video';
import { VideoDetailsModal } from '@/components/video/VideoDetailsModal';

interface MovieInfoPanelProps {
  movie: CoverflowMovie | null;
  onPlay: (videoId: string) => void;
  onOpenFolder?: (movie: CoverflowMovie) => void;
  onMovieUpdated?: (updatedVideo: Video) => void;
  isHidden?: boolean;
}

/**
 * Coverflow 视频信息展示面板组件
 * 严格展示 data.json 已有的数据（名称、类别、演员、描述），并提供播放与翻页交互
 */
export const MovieInfoPanel: React.FC<MovieInfoPanelProps> = ({
  movie,
  onPlay,
  onOpenFolder,
  onMovieUpdated,
  isHidden = false,
}) => {
  const { t } = useTranslation();
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const directoryRef = useAppStore((s) => s.directoryRef);
  const directoryHandle = useAppStore((s) => s.directoryHandle);
  const activeDirectory = useMemo(
    () =>
      directoryRef ||
      (directoryHandle ? { name: directoryHandle.name, handle: directoryHandle } : null),
    [directoryRef, directoryHandle]
  );
  const canOpenFolder = isTauri() && Boolean(directoryRef?.path);

  // 打开当前电影所在的本地文件夹
  const handleOpenFolder = () => {
    if (onOpenFolder && movie) {
      onOpenFolder(movie);
      return;
    }
    if (!directoryRef?.path || !movie?.video?.folderName) return;
    const dirPath = directoryRef.path;
    const sep = dirPath.includes('\\') ? '\\' : '/';
    const fullPath = `${dirPath.replace(/[\\/]+$/, '')}${sep}${movie.video.folderName}`;
    openPathInOs(fullPath);
  };

  // 格式化演员与类别数据为标签数组
  const movieActor = movie?.actor ?? movie?.video?.actor;
  const actorsList = useMemo(() => parseTagList(movieActor), [movieActor]);

  const movieCategory = movie?.category ?? movie?.video?.category;
  const categoriesList = useMemo(() => parseTagList(movieCategory), [movieCategory]);

  // 格式化相关链接列表
  const linksList = useMemo(() => {
    const rawLinks = movie?.links ?? movie?.video?.links;
    if (!Array.isArray(rawLinks)) return [];
    return rawLinks.filter((l) => Boolean(l && l.url && l.url.trim()));
  }, [movie]);

  if (!movie) return null;

  return (
    <div
      onKeyDown={(e) => {
        // 阻止视频信息面板内部键盘事件向外冒泡
        e.stopPropagation();
      }}
      className={cn(
        'absolute z-20 transition-all duration-350 ease-in-out select-text',
        'bg-surface/90 backdrop-blur-xl border border-border rounded-2xl shadow-floating',
        // 移动端 / 窄容器 (< 768px: 3xl)：居中位于封面正下方抽屉式面板
        'left-1/2 -translate-x-1/2 bottom-4 w-[min(calc(100%-32px),28rem)] max-w-md max-h-[38vh] p-4 flex flex-col justify-between gap-2.5',
        // 宽屏容器 (>= 768px: 3xl)：左侧垂直居中悬浮卡片
        '@3xl:left-8 @3xl:top-1/2 @3xl:-translate-y-1/2 @3xl:bottom-auto @3xl:translate-x-0 @3xl:w-80 @3xl:max-h-6/10 @3xl:p-6 @3xl:gap-4',
        // 更宽容器
        '@6xl:w-100',
        // 隐藏状态平滑过渡
        isHidden && 'pointer-events-none opacity-0 translate-y-full @3xl:translate-y-0'
      )}
    >
      <div className="flex-1 min-h-0 flex flex-col gap-2">
        {/* 视频名称与在文件夹中显示按钮 */}
        <div className="shrink-0">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base @3xl:text-lg font-bold text-foreground leading-snug wrap-break-word flex-1">
              {movie.title}
            </h2>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* 编辑详细信息按钮 */}
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                aria-label={t('videos.details', '详细信息')}
                className="size-7 @3xl:size-8 bg-surface-hover hover:bg-surface-active text-foreground-muted hover:text-foreground cursor-pointer"
                onPress={() => setIsDetailsOpen(true)}
              >
                <Icon icon="lucide:pencil-line" className="size-4" />
              </Button>

              {/* 在文件夹中显示按钮 */}
              {canOpenFolder && (
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label={t('videos.revealInExplorer', '在文件夹中显示')}
                  className="size-7 @3xl:size-8 bg-surface-hover hover:bg-surface-active text-foreground-muted hover:text-foreground cursor-pointer"
                  onPress={handleOpenFolder}
                >
                  <Icon icon="lucide:folder-symlink" className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 信息区域 */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pr-1">
          {/* 元数据标签网格（自适应最长标签宽度，保证右侧 Chips 完美对齐） */}
          {(categoriesList.length > 0 || actorsList.length > 0 || linksList.length > 0) && (
            <div className="grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-2 mt-1 shrink-0">
              {/* 类别标签 */}
              {categoriesList.length > 0 && (
                <>
                  <span className="text-xs font-medium text-foreground-muted flex items-center gap-1 shrink-0 h-5 whitespace-nowrap justify-end">
                    <Icon icon="lucide:chart-column-stacked" className="size-3.5" />
                    {t('coverflow.category')}
                  </span>
                  <div className="flex flex-wrap gap-1.5 min-w-0">
                    {categoriesList.map((category, idx) => (
                      <Chip key={idx} color="accent" variant="soft" size="sm">
                        {category}
                      </Chip>
                    ))}
                  </div>
                </>
              )}

              {/* 演员阵容 */}
              {actorsList.length > 0 && (
                <>
                  <span className="text-xs font-medium text-foreground-muted flex items-center gap-1 shrink-0 h-5 whitespace-nowrap justify-end">
                    <Icon icon="lucide:user" className="size-3.5" />
                    {t('coverflow.actors')}
                  </span>
                  <div className="flex flex-wrap gap-1.5 min-w-0">
                    {actorsList.map((actor, idx) => (
                      <Chip key={idx} size="sm" variant="secondary" className="text-xs">
                        {actor}
                      </Chip>
                    ))}
                  </div>
                </>
              )}

              {/* 相关链接 */}
              {linksList.length > 0 && (
                <>
                  <span className="text-xs font-medium text-foreground-muted flex items-center gap-1 shrink-0 h-5 whitespace-nowrap justify-end">
                    <Icon icon="lucide:link" className="size-3.5" />
                    {t('videos.links')}
                  </span>
                  <div className="flex flex-wrap gap-1.5 min-w-0">
                    {linksList.map((link, idx) => (
                      <Chip
                        key={idx}
                        size="sm"
                        color="accent"
                        variant="secondary"
                        className="gap-1 px-1.5 cursor-pointer"
                        onClick={() => openExternalUrl(link.url)}
                        title={link.url}
                      >
                        <span>{link.title || link.url}</span>
                        <Icon icon="lucide:external-link" className="size-3 shrink-0" />
                      </Chip>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 描述信息 */}
          {movie.description && (
            <div className=" flex flex-col gap-1 mt-2 ">
              <p className="text-xs text-foreground-muted leading-relaxed whitespace-pre-wrap wrap-break-word">
                {movie.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 底部控制区：播放跳转 */}
      <div className="pt-3 border-t border-border/70 shrink-0">
        {/* 播放视频按钮 */}
        <Button
          size="sm"
          variant="primary"
          className="w-full flex items-center justify-center gap-1.5 font-medium cursor-pointer @6xl:h-10"
          onPress={() => onPlay(movie.video.id)}
        >
          <Icon icon="lucide:play" className="size-4" />
          <span>{t('coverflow.playVideo', '播放视频')}</span>
        </Button>
      </div>

      {/* 视频详细信息编辑弹窗 */}
      <VideoDetailsModal
        isOpen={isDetailsOpen}
        video={movie.video}
        activeDirectory={activeDirectory}
        onClose={() => setIsDetailsOpen(false)}
        onSaved={(updatedVideo) => {
          onMovieUpdated?.(updatedVideo);
        }}
      />
    </div>
  );
};
