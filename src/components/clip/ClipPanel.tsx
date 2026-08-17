import React from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { Clip } from '@/types/clip';
import { ClipForm } from '@/components/clip/ClipForm';
import { ClipList } from '@/components/clip/ClipList';
import { usePlayerStore } from '@/stores/playerStore';

interface ClipPanelProps {
  videoDuration: number;
  currentVideoTime: number;
  clips: Clip[];
  onSaveClip: (startTime: number, endTime: number, clipId?: string) => Promise<boolean>;
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
  const { isClipPanelOpen, setIsClipPanelOpen, editingClip, setEditingClip } = usePlayerStore();

  if (!isClipPanelOpen) return null;

  return (
    <aside className="w-80 sm:w-88 h-full bg-surface border border-border rounded-3xl p-5 shadow-card flex flex-col justify-between shrink-0 animate-in slide-in-from-right-6 duration-300">
      <div className="flex flex-col h-full overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-border/40">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {editingClip ? t('clipPanel.editClip') : t('clipPanel.addClips')}
          </h2>
          <button
            onClick={() => {
              setIsClipPanelOpen(false);
              setEditingClip(null);
            }}
            aria-label={t('clipPanel.closePanel')}
            className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <Icon icon="lucide:x" className="w-4 h-4" />
          </button>
        </div>

        {/* 片段创建 / 编辑表单 */}
        <div className="pt-2 pb-4">
          <ClipForm
            videoDuration={videoDuration}
            currentVideoTime={currentVideoTime}
            editingClip={editingClip}
            onSaveClip={async (start, end, id) => {
              const res = await onSaveClip(start, end, id);
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
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] font-semibold text-foreground-muted uppercase tracking-wider">
              {t('clipPanel.existingClips', { count: clips.length })}
            </span>
          </div>
          <ClipList
            clips={clips}
            editingClipId={editingClip?.id}
            onStartEdit={(clip) => setEditingClip(clip)}
            onDeleteClip={onDeleteClip}
          />
        </div>
      </div>
    </aside>
  );
};
