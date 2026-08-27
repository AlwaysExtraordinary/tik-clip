import React from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { Clip } from '@/types/clip';
import { formatTime } from '@/utils/time';
import { usePlayerStore } from '@/stores/playerStore';

interface ClipItemProps {
  clip: Clip;
  isEditing: boolean;
  onStartEdit: (clip: Clip) => void;
  onDelete: (clip: Clip) => void;
}

export const ClipItem: React.FC<ClipItemProps> = ({ clip, isEditing, onStartEdit, onDelete }) => {
  const { t } = useTranslation();
  const { requestSeek } = usePlayerStore();

  return (
    <div
      className={`group flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-border/60 transition-all duration-150 ${
        isEditing
          ? 'bg-accent text-background'
          : 'bg-background text-foreground hover:border-foreground/20 hover:bg-surface-hover'
      }`}
    >
      {/* 时间范围与标签 */}
      <div className="flex flex-col gap-1 min-w-0 flex-1 mr-2">
        <button
          title={t('clipItem.jumpToStart')}
          className={`text-xs font-medium tracking-tight flex items-center gap-1.5 transition-opacity cursor-pointer ${
            isEditing ? 'text-background' : 'text-foreground'
          }`}
        >
          <Icon icon="lucide:play-circle" className="size-3.5 opacity-60 shrink-0" />
          <span className="truncate">
            <span className="hover:underline" onClick={() => requestSeek(clip.startTime)}>
              {formatTime(clip.startTime)}
            </span>
            <span> - </span>
            <span className="hover:underline" onClick={() => requestSeek(clip.endTime)}>
              {formatTime(clip.endTime)}
            </span>
          </span>
        </button>
        {clip.tags && clip.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pl-5">
            {clip.tags.map((tag) => (
              <span
                key={tag}
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium leading-none ${
                  isEditing
                    ? 'bg-background/20 text-background'
                    : 'bg-surface text-foreground-muted'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 操作按钮组 */}
      <div className="flex items-center gap-1">
        {/* 编辑按钮 */}
        <button
          onClick={() => onStartEdit(clip)}
          aria-label={t('clipItem.editClip')}
          title={t('clipItem.editClip')}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isEditing
              ? 'text-background/80 hover:text-background hover:bg-background/20'
              : 'text-foreground-muted hover:text-foreground hover:bg-surface-active'
          }`}
        >
          <Icon icon="lucide:pencil" className="w-3.5 h-3.5" />
        </button>

        {/* 删除按钮 */}
        <button
          onClick={() => onDelete(clip)}
          aria-label={t('clipItem.deleteClip')}
          title={t('clipItem.deleteClip')}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isEditing
              ? 'text-background/80 hover:text-danger hover:bg-background/20'
              : 'text-foreground-muted hover:text-danger hover:bg-danger/10'
          }`}
        >
          <Icon icon="lucide:trash-2" className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
