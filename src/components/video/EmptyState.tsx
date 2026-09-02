import React from 'react';
import { Icon } from '@iconify/react';
import { useTranslation, Trans } from 'react-i18next';
import { useDirectory } from '@/hooks/useDirectory';
import { isFileSystemAccessSupported } from '@/services/fileSystem';

interface EmptyStateProps {
  type?: 'no-directory' | 'no-videos' | 'no-clips' | 'permission-needed' | 'scanning' | 'loading';
  title?: string;
  description?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'no-directory',
  title,
  description,
}) => {
  const { t } = useTranslation();
  const { selectDirectory, reauthorizeDirectory, directoryName } = useDirectory();
  const supported = isFileSystemAccessSupported();

  if (type === 'loading') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-foreground-muted">
        <Icon icon="lucide:loader-2" className="size-8 animate-spin opacity-50" />
        {title && <p className="text-xs text-foreground-muted mt-2">{title}</p>}
        {description && <p className="text-xs text-foreground-muted mt-1 max-w-sm">{description}</p>}
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/50">
        <div className="size-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mb-4">
          <Icon icon="lucide:alert-triangle" className="size-8" />
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

  if (type === 'scanning') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/40 ">
        <div className="size-16 rounded-full bg-surface-hover flex items-center justify-center mb-4 text-foreground animate-pulse">
          <Icon icon="lucide:folder-search" className="size-8 animate-bounce" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-2">
          {title || t('emptyState.scanningTitle')}
        </h3>
        <p className="text-sm text-foreground-muted max-w-sm leading-relaxed">
          {description || directoryName}
        </p>
      </div>
    );
  }

  if (type === 'no-clips') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/40 ">
        <div className="size-16 rounded-full bg-surface-hover flex items-center justify-center mb-4 text-foreground-muted">
          <Icon icon="lucide:scissors" className="size-8 opacity-60" />
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

  if (type === 'no-videos') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/40 ">
        <div className="size-16 rounded-full bg-surface-hover flex items-center justify-center mb-4 text-foreground-muted">
          <Icon icon="lucide:video-off" className="size-8 opacity-60" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-2">
          {title || t('videos.noVideosTitle')}
        </h3>
        <p className="text-sm text-foreground-muted max-w-md mb-6 leading-relaxed">
          {description || t('videos.noVideosDesc')}
        </p>
      </div>
    );
  }

  if (type === 'permission-needed') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/40">
        <div className="size-16 rounded-full bg-surface-hover flex items-center justify-center mb-4 text-foreground">
          <Icon icon="lucide:shield-alert" className="size-8" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-2">
          {t('emptyState.permissionRequiredTitle')}
        </h3>
        <p className="text-sm text-foreground-muted max-w-sm mb-4 leading-relaxed">
          {t('emptyState.permissionRequiredDesc')}
          <br />
          <span className="text-xs font-semibold text-foreground mt-1 inline-block px-2 py-0.5 rounded bg-surface border border-border/60">
            {directoryName}
          </span>
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
          <button
            onClick={reauthorizeDirectory}
            className="px-6 py-2.5 rounded-2xl bg-foreground text-background font-semibold text-xs shadow-card hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Icon icon="lucide:unlock" className="size-4" />
            <span>{t('emptyState.authorizeFolder')}</span>
          </button>
          <button
            onClick={selectDirectory}
            className="px-4 py-2 rounded-2xl text-foreground-muted hover:text-foreground hover:bg-surface-hover text-xs transition-colors cursor-pointer"
          >
            <span>{t('emptyState.selectAnotherFolder')}</span>
          </button>
        </div>
        <p className="text-[11px] text-foreground-muted/70 max-w-xs leading-relaxed">
          {t('emptyState.permissionTip')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/40">
      <div className="size-16 rounded-full bg-surface-hover flex items-center justify-center mb-4 text-foreground-muted">
        <Icon icon="lucide:folder" className="size-8 opacity-60" />
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
        <Icon icon="lucide:folder-plus" className="size-4" />
        <span>{t('emptyState.selectFolderBtn')}</span>
      </button>
    </div>
  );
};
