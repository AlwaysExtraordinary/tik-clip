import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clip } from '@/types/clip';
import { ClipItem } from '@/components/clip/ClipItem';

interface ClipListProps {
  clips: Clip[];
  editingClipId?: string | null;
  onStartEdit: (clip: Clip) => void;
  onDeleteClip: (clip: Clip) => void;
}

export const ClipList: React.FC<ClipListProps> = ({
  clips,
  editingClipId,
  onStartEdit,
  onDeleteClip,
}) => {
  const { t } = useTranslation();

  if (clips.length === 0) {
    return (
      <div className="py-8 text-center text-foreground-muted">
        <p className="text-xs">{t('clipList.noClips')}</p>
        <p className="text-[11px] opacity-70 mt-1">{t('clipList.noClipsHint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-320px)] pr-1">
      {clips.map((clip) => (
        <ClipItem
          key={clip.id}
          clip={clip}
          isEditing={clip.id === editingClipId}
          onStartEdit={onStartEdit}
          onDelete={onDeleteClip}
        />
      ))}
    </div>
  );
};
