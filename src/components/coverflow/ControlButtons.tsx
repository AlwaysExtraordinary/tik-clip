import React from 'react';
import { Icon } from '@iconify/react';
import { Button, Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';

interface ControlButtonsProps {
  currentIndex: number;
  totalMovies: number;
  onPrev: () => void;
  onNext: () => void;
  onFlip: () => void;
  onExit: () => void;
  isHidden?: boolean;
}

/**
 * Coverflow 放大聚焦模式浮层控制条组件
 * 提供 3D 卡片翻页（上一个/下一个）、正反面翻转、退出聚焦视图按钮及页码指示
 */
export const ControlButtons: React.FC<ControlButtonsProps> = ({
  currentIndex,
  totalMovies,
  onPrev,
  onNext,
  onFlip,
  onExit,
  isHidden = false,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* 右上角控制条：翻转与返回列表 */}
      <div
        className={cn(
          'absolute top-3 right-3 gap-2 @3xl:top-5 @3xl:right-5 @3xl:gap-2.5 z-30 flex items-center transition-all duration-300 ease-in-out',
          isHidden && 'opacity-0 -translate-y-4 pointer-events-none'
        )}
      >
        {/* 翻转卡片 */}
        <Button
          variant="primary"
          size="sm"
          onPress={onFlip}
          className="flex items-center h-7 gap-1.5 rounded-full px-2.5 @3xl:px-3.5 @3xl:h-8 shadow-subtle cursor-pointer"
        >
          <Icon icon="lucide:rotate-cw" className="size-3.5" />
          <span className="text-xs font-medium">{t('coverflow.flip', '翻转')}</span>
        </Button>

        {/* 返回列表 */}
        <Button
          variant="outline"
          size="sm"
          onPress={onExit}
          className="flex items-center h-7 gap-1.5 rounded-full px-2.5 @3xl:px-3.5 @3xl:h-8 bg-surface/80 backdrop-blur-md border 
          border-border shadow-subtle cursor-pointer hover:bg-surface-hover"
        >
          <Icon icon="lucide:x" className="size-3.5" />
          <span className="text-xs font-medium">{t('coverflow.exit', '返回')}</span>
        </Button>
      </div>

      {/* 浮动翻页按钮：上一个 */}
      <div
        className={cn(
          'absolute z-30 size-9 @3xl:size-8 transition-all duration-500 ease-in-out',
          'left-5 top-[34%] -translate-y-1/2',
          '@3xl:left-auto @3xl:right-57 @3xl:top-5 @3xl:translate-y-0',
          isHidden && 'pointer-events-none opacity-0 -translate-x-4'
        )}
      >
        <Button
          isIconOnly
          size="sm"
          variant="secondary"
          onPress={onPrev}
          aria-label={t('coverflow.prev', '上一个')}
          className="size-full rounded-full bg-surface/80 dark:bg-zinc-900/80 backdrop-blur-md border border-border
           shadow-subtle text-foreground hover:bg-surface-hover active:scale-95 cursor-pointer"
        >
          <Icon icon="lucide:chevron-left" className="size-5 @3xl:size-4" />
        </Button>
      </div>

      {/* 浮动翻页按钮：下一个 */}
      <div
        className={cn(
          'absolute z-30 size-9 @3xl:size-8 transition-all duration-500 ease-in-out',
          'right-5 top-[34%] -translate-y-1/2',
          '@3xl:right-47 @3xl:top-5 @3xl:translate-y-0',
          isHidden && 'pointer-events-none opacity-0 translate-x-4'
        )}
      >
        <Button
          isIconOnly
          size="sm"
          variant="secondary"
          onPress={onNext}
          aria-label={t('coverflow.next', '下一个')}
          className="size-full rounded-full bg-surface/80 dark:bg-zinc-900/80 backdrop-blur-md border border-border 
           shadow-subtle text-foreground hover:bg-surface-hover active:scale-95 cursor-pointer"
        >
          <Icon icon="lucide:chevron-right" className="size-5 @3xl:size-4" />
        </Button>
      </div>

      {/* 封面页码 */}
      <div
        className={cn(
          'absolute z-30 pointer-events-none transition-all duration-500 ease-in-out ',
          // 'top-2 left-1/2 -translate-x-1/2',
          'top-3.5 left-5',
          // '@3xl:top-[calc(100%-3.25rem)] @3xl:left-8 @3xl:translate-x-0',
          '@3xl:top-5 @3xl:left-1/2 @3xl:-translate-x-1/2',
          isHidden && 'opacity-0 -translate-y-4'
        )}
      >
        {/* <Chip
          size="sm"
          variant="soft"
          className="backdrop-blur-md font-medium select-none bg-surface/85 dark:bg-zinc-900/85 border 
           border-border/80 text-foreground-muted text-xs px-2 shadow-subtle"
        >
          {currentIndex + 1} / {totalMovies}
        </Chip> */}
        <div className="font-medium select-none text-foreground-muted text-xs">
          {currentIndex + 1} / {totalMovies}
        </div>
      </div>
    </>
  );
};
