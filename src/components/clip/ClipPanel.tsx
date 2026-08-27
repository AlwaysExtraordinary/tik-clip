import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { Clip } from '@/types/clip';
import { ClipForm } from '@/components/clip/ClipForm';
import { ClipList } from '@/components/clip/ClipList';
import { ConfirmModal } from '@/components/general/ConfirmModal';
import { usePlayerStore } from '@/stores/playerStore';
import { formatTime } from '@/utils/time';
import { Button } from '@heroui/react';

interface ClipPanelProps {
  videoDuration: number;
  currentVideoTime: number;
  clips: Clip[];
  onSaveClip: (
    startTime: number,
    endTime: number,
    clipId?: string,
    tags?: string[]
  ) => Promise<boolean>;
  onDeleteClip: (clipId: string) => void;
}

export const ClipPanel: React.FC<ClipPanelProps> = ({
  videoDuration,
  currentVideoTime,
  clips,
  onSaveClip,
  onDeleteClip,
}) => {
  const { t } = useTranslation();
  const { setIsClipPanelOpen, editingClip, setEditingClip } = usePlayerStore();
  const [clipToDelete, setClipToDelete] = useState<Clip | null>(null);

  return (
    <>
      <aside className="w-full h-full bg-surface border border-border/40 rounded-3xl p-5 shadow-card flex flex-col justify-between shrink-0">
        <div className="flex flex-col h-full overflow-hidden">
          {/* 头部 */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-border/40">
            <h2 className="text-md font-semibold tracking-tight text-foreground">
              {editingClip ? t('clipPanel.editClip') : t('clipPanel.addClips')}
            </h2>
            <Button
              onClick={() => {
                setIsClipPanelOpen(false);
                setEditingClip(null);
              }}
              aria-label={t('clipPanel.closePanel')}
              isIconOnly
              variant="tertiary"
              className="size-7"
            >
              <Icon icon="lucide:x" className="w-4 h-4" />
            </Button>
          </div>

          {/* 片段创建 / 编辑表单 */}
          <div className="pt-2 pb-4">
            <ClipForm
              videoDuration={videoDuration}
              currentVideoTime={currentVideoTime}
              editingClip={editingClip}
              onSaveClip={async (start, end, id, tags) => {
                const res = await onSaveClip(start, end, id, tags);
                if (res) {
                  setEditingClip(null);
                }
                return res;
              }}
              onCancelEdit={() => setEditingClip(null)}
            />
          </div>

          {/* 分割线 */}
          <div className="w-full border-t border-border/60 my-2" />

          {/* 片段列表 */}
          <div className="flex-1 overflow-y-auto pt-2">
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-sm font-semibold text-foreground-muted uppercase tracking-wider">
                {t('clipPanel.existingClips', { count: clips.length })}
              </span>
            </div>
            <ClipList
              clips={clips}
              editingClipId={editingClip?.id}
              onStartEdit={(clip) => setEditingClip(clip)}
              onDeleteClip={(clip) => setClipToDelete(clip)}
            />
          </div>
        </div>
      </aside>

      {/* 删除确认通用弹窗 */}
      <ConfirmModal
        isOpen={Boolean(clipToDelete)}
        onClose={() => setClipToDelete(null)}
        onConfirm={() => {
          if (clipToDelete) {
            onDeleteClip(clipToDelete.id);
            setClipToDelete(null);
          }
        }}
        title={t('deleteModal.title')}
        content={
          clipToDelete
            ? `${formatTime(clipToDelete.startTime)} - ${formatTime(clipToDelete.endTime)}`
            : undefined
        }
      />
    </>
  );
};
