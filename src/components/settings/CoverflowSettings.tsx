/**
 * @file CoverflowSettings.tsx
 * @description 封面流设置模块：3D 封面流动态悬停预览等相关偏好
 */

import React from 'react';
import { Switch } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settingsStore';

export const CoverflowSettings: React.FC = () => {
  const { t } = useTranslation();
  const { showCoverflowPreview, setShowCoverflowPreview } = useSettingsStore();

  return (
    <div className="space-y-5">
      {/* 封面流展示预览 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <label className="text-sm font-medium text-foreground">
            {t('settings.coverflowPreview')}
          </label>
          <span className="text-xs text-foreground-muted">
            {t('settings.coverflowPreviewDesc')}
          </span>
        </div>
        <Switch
          isSelected={showCoverflowPreview}
          onChange={setShowCoverflowPreview}
          aria-label={t('settings.coverflowPreview')}
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
