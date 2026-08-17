import React from 'react';
import { Icon } from '@iconify/react';
import { useTranslation, Trans } from 'react-i18next';
import { useDirectory } from '@/hooks/useDirectory';
import { isFileSystemAccessSupported } from '@/services/fileSystem';

interface EmptyStateProps {
  type?: 'no-directory' | 'no-videos' | 'no-clips' | 'permission-needed';
  title?: string;
  description?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'no-directory',
  title,
  description,
}) => {
  const { t } = useTranslation();
  const { selectDirectory, reauthorizeDirectory, isScanning, scanProgress, directoryName } =
    useDirectory();
  const supported = isFileSystemAccessSupported();

  if (!supported) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/50 rounded-3xl border border-border/60">
        <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mb-4">
          <Icon icon="lucide:alert-triangle" className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2">
          {t('emptyState.browserNotSupportedTitle')}
        </h3>
        <p className="text-sm text-foreground-muted max-w-md mb-6 leading-relaxed">
          <Trans
            i18nKey="emptyState.browserNotSupportedDesc"
            components={{ br: <br />, strong: <strong /> }}
          />
        </p>
      </div>
    );
  }

  if (isScanning) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/40 rounded-3xl border border-border/40">
        <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mb-4 text-foreground animate-pulse">
          <Icon icon="lucide:folder-search" className="w-8 h-8 animate-bounce" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-2">
          {t('emptyState.scanningTitle')}
        </h3>
        {scanProgress && (
          <div className="w-full max-w-xs mt-2 space-y-2">
            <div className="w-full h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground transition-all duration-300 rounded-full"
                style={{
                  width: `${Math.round(
                    (scanProgress.currentFolderIndex / scanProgress.totalFolders) * 100
                  )}%`,
                }}
              />
            </div>
            <p className="text-xs text-foreground-muted truncate">
              {scanProgress.currentFolderName} ({scanProgress.currentFolderIndex}/
              {scanProgress.totalFolders})
            </p>
          </div>
        )}
      </div>
    );
  }

  if (type === 'no-clips') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/40 rounded-3xl border border-border/40">
        <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mb-4 text-foreground-muted">
          <Icon icon="lucide:scissors" className="w-8 h-8 opacity-60" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-2">
          {title || t('emptyState.noClipsTitle')}
        </h3>
        <p className="text-sm text-foreground-muted max-w-sm mb-6 leading-relaxed">
          {description || t('emptyState.noClipsDesc')}
        </p>
      </div>
    );
  }

  if (type === 'permission-needed') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/40 rounded-3xl border border-border/40">
        <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mb-4 text-foreground">
          <Icon icon="lucide:shield-alert" className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-2">
          {t('emptyState.permissionRequiredTitle')}
        </h3>
        <p className="text-sm text-foreground-muted max-w-sm mb-6 leading-relaxed">
          {t('emptyState.permissionRequiredDesc')}
          <br />
          <code className="text-xs font-bold mt-1 inline-block">{directoryName}</code>
        </p>
        <button
          onClick={reauthorizeDirectory}
          className="px-6 py-2.5 rounded-2xl bg-foreground text-background font-semibold text-xs shadow-card hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer"
        >
          <Icon icon="lucide:unlock" className="w-4 h-4" />
          <span>{t('emptyState.authorizeFolder')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/40 rounded-3xl border border-border/40">
      <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mb-4 text-foreground-muted">
        <Icon icon="lucide:folder" className="w-8 h-8 opacity-60" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">
        {title || t('emptyState.selectFolderTitle')}
      </h3>
      <p className="text-sm text-foreground-muted max-w-md mb-6 leading-relaxed">
        {description || t('emptyState.selectFolderDesc')}
      </p>
      <button
        onClick={selectDirectory}
        className="px-6 py-2.5 rounded-2xl bg-foreground text-background font-semibold text-xs shadow-card hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer"
      >
        <Icon icon="lucide:folder-plus" className="w-4 h-4" />
        <span>{t('emptyState.selectFolderBtn')}</span>
      </button>
    </div>
  );
};
