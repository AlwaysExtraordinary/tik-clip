import React, { useMemo } from 'react';
import { Icon } from '@iconify/react';
import { Chip, Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { CoverflowMovie } from './types';
import { cn } from '@/utils/cn';

interface MovieInfoPanelProps {
  movie: CoverflowMovie | null;
  currentIndex: number;
  totalMovies: number;
  onPrev: () => void;
  onNext: () => void;
  onPlay: (videoId: string) => void;
  isHidden?: boolean;
}

/**
 * Coverflow 视频信息展示面板组件
 * 严格展示 data.json 已有的数据（名称、类别、演员、描述），并提供播放与翻页交互
 */
export const MovieInfoPanel: React.FC<MovieInfoPanelProps> = ({
  movie,
  currentIndex,
  totalMovies,
  onPrev,
  onNext,
  onPlay,
  isHidden = false,
}) => {
  const { t } = useTranslation();

  // 格式化演员数据为标签数组（对齐 dev 分支分割规则）
  const movieActor = movie?.actor ?? movie?.video?.actor;
  const actorsList = useMemo<string[]>(() => {
    if (!movieActor) return [];
    if (Array.isArray(movieActor)) {
      return (movieActor as unknown[]).filter((a): a is string => typeof a === 'string' && a.trim() !== '');
    }
    return movieActor
      .split(/[,，/、;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [movieActor]);

  if (!movie) return null;

  return (
    <aside
      className={cn(
        'absolute z-20 transition-all duration-300 ease-in-out',
        'bg-surface/90 backdrop-blur-xl border border-border rounded-2xl shadow-floating',
        // 移动端 / 窄容器 (< 768px)：居中位于封面正下方抽屉式面板
        'left-1/2 -translate-x-1/2 bottom-4 w-[calc(100%-32px)] max-w-md max-h-[42vh] p-4 flex flex-col justify-between gap-2.5',
        // 宽屏容器 (>= 768px)：左侧垂直居中悬浮卡片
        '@[768px]:left-6 @[768px]:top-1/2 @[768px]:-translate-y-1/2 @[768px]:bottom-auto @[768px]:translate-x-0 @[768px]:w-80 @[768px]:max-w-none @[768px]:max-h-[calc(100%-48px)] @[768px]:p-6 @[768px]:gap-4',
        // 隐藏状态平滑过渡
        isHidden && 'pointer-events-none opacity-0 translate-y-8 @[768px]:translate-y-0 @[768px]:-translate-x-8'
      )}
    >
      <div className="flex flex-col gap-3 overflow-y-auto pr-1">
        {/* 视频名称 */}
        <div>
          <h2 className="text-base @[768px]:text-lg font-bold text-foreground leading-snug break-words">
            {movie.title}
          </h2>

          {/* 类别标签 */}
          {movie.category && (
            <div className="mt-2 flex items-center gap-2">
              <Chip color="accent" variant="primary" size="sm">
                {movie.category}
              </Chip>
            </div>
          )}
        </div>

        {/* 演员阵容 */}
        {actorsList.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-1">
            <span className="text-xs font-medium text-foreground-muted flex items-center gap-1">
              <Icon icon="lucide:user" className="size-3.5" />
              {t('coverflow.actors', '演员')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {actorsList.map((actor, idx) => (
                <Chip key={idx} size="sm" variant="secondary" className="text-xs">
                  {actor}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* 描述信息 */}
        {movie.description && (
          <div className="flex flex-col gap-1 mt-1">
            <p className="text-xs text-foreground-muted leading-relaxed select-text line-clamp-3 @[768px]:line-clamp-5">
              {movie.description}
            </p>
          </div>
        )}
      </div>

      {/* 底部控制区：播放跳转 + 上/下一项切换 */}
      <div className="flex flex-col gap-2.5 pt-3 border-t border-border/70">
        {/* 播放视频按钮 */}
        <Button
          size="sm"
          variant="primary"
          className="w-full flex items-center justify-center gap-1.5 font-medium cursor-pointer"
          onPress={() => onPlay(movie.video.id)}
        >
          <Icon icon="lucide:play" className="size-4" />
          <span>{t('coverflow.playVideo', '播放视频')}</span>
        </Button>

        {/* 翻页指示器 */}
        <div className="flex items-center justify-between px-1">
          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            onPress={onPrev}
            aria-label={t('coverflow.prev', '上一个')}
            className="size-8 rounded-full cursor-pointer hover:bg-surface-hover"
          >
            <Icon icon="lucide:chevron-left" className="size-4" />
          </Button>

          <span className="text-xs font-medium text-foreground-muted">
            {currentIndex + 1} / {totalMovies}
          </span>

          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            onPress={onNext}
            aria-label={t('coverflow.next', '下一个')}
            className="size-8 rounded-full cursor-pointer hover:bg-surface-hover"
          >
            <Icon icon="lucide:chevron-right" className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
};
