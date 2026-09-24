/**
 * @file PlaybackSettings.tsx
 * @description 播放设置模块：进度条缩略图悬停预览等播放相关偏好
 */

import React from 'react';
import { Switch } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settingsStore';

export const PlaybackSettings: React.FC = () => {
  const { t } = useTranslation();
  const { showThumbnailPreview, setShowThumbnailPreview } = useSettingsStore();

  return (
    <div className="space-y-5">
      {/* 进度条缩略图预览 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <label className="text-sm font-medium text-foreground">
            {t('settings.thumbnailPreview')}
          </label>
          <span className="text-xs text-foreground-muted">
            {t('settings.thumbnailPreviewDesc')}
          </span>
        </div>
        <Switch
          isSelected={showThumbnailPreview}
          onChange={setShowThumbnailPreview}
          aria-label={t('settings.thumbnailPreview')}
          size="md"
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </div>
    </div>
  );
};
