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
      <div className="text-foreground-muted py-8 text-center">
        <p className="text-xs">{t('clipList.noClips')}</p>
        <p className="mt-1 text-[11px] opacity-70">{t('clipList.noClipsHint')}</p>
      </div>
    );
  }

  return (
    <div className="max-h-[calc(100vh-320px)] space-y-2 overflow-y-auto">
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
