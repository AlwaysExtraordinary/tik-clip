import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { Clip } from '@/types/clip';
import { formatTime } from '@/utils/time';
import { DeleteClipModal } from '@/components/clip/DeleteClipModal';
import { usePlayerStore } from '@/stores/playerStore';

interface ClipItemProps {
  clip: Clip;
  isEditing: boolean;
  onStartEdit: (clip: Clip) => void;
  onDelete: (clipId: string) => void;
}

export const ClipItem: React.FC<ClipItemProps> = ({ clip, isEditing, onStartEdit, onDelete }) => {
  const { t } = useTranslation();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const { requestSeek } = usePlayerStore();

  const timeRangeText = `${formatTime(clip.startTime)} - ${formatTime(clip.endTime)}`;

  return (
    <>
      <div
        className={`group flex items-center justify-between px-3.5 py-2.5 rounded-2xl border transition-all duration-150 ${
          isEditing
            ? 'bg-accent text-background shadow-sm'
            : 'bg-background border-border text-foreground hover:border-foreground/40 hover:bg-surface-hover/60'
        }`}
      >
        {/* 时间范围文本（点击跳转预览） */}
        <button
          onClick={() => requestSeek(clip.startTime)}
          title={t('clipItem.jumpToStart')}
          className={`text-xs font-medium tracking-tight flex items-center gap-1.5 transition-opacity cursor-pointer ${
            isEditing ? 'text-background hover:underline' : 'text-foreground hover:underline'
          }`}
        >
          <Icon icon="lucide:play-circle" className="w-3.5 h-3.5 opacity-60" />
          <span>{timeRangeText}</span>
        </button>

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
            onClick={() => setIsDeleteModalOpen(true)}
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

      <DeleteClipModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => {
          setIsDeleteModalOpen(false);
          onDelete(clip.id);
        }}
        timeRangeText={timeRangeText}
      />
    </>
  );
};
