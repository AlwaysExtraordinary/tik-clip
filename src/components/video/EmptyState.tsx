import React from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@heroui/react';
import { useTranslation, Trans } from 'react-i18next';
import { useDirectory } from '@/hooks/useDirectory';
import { isFileSystemAccessSupported } from '@/services/fileSystem';
import { cn } from '@/utils/cn';

/** 空状态组件属性 */
interface EmptyStateProps {
  /** 空状态类型：未选目录 | 无视频 | 无片段 | 需重新授权 | 目录扫描中 | 加载中 | 片段不可用 */
  type?:
    | 'no-directory'
    | 'no-videos'
    | 'no-clips'
    | 'permission-needed'
    | 'scanning'
    | 'loading'
    | 'clip-unavailable';
  /** 自定义标题（可选） */
  title?: string;
  /** 自定义描述文本（可选） */
  description?: string;
  /** 操作按钮文本（可选） */
  actionText?: string;
  /** 操作按钮点击回调（可选） */
  onAction?: () => void;
  /** 自定义容器类名（可选） */
  className?: string;
}

/**
 * 空状态展示组件
 * 根据不同的业务场景（未选目录、无视频、无片段、权限失效、扫描中、加载中、片段不可用等）呈现对应的提示与操作按钮
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'no-directory',
  title,
  description,
  actionText,
  onAction,
  className,
}) => {
  const { t } = useTranslation();
  const { selectDirectory, reauthorizeDirectory, directoryName } = useDirectory();
  const supported = isFileSystemAccessSupported();

  // 1. 加载中状态：显示旋转加载动画及提示文本
  if (type === 'loading') {
    return (
      <div
        className={cn(
          'flex-1 flex flex-col items-center justify-center p-8 text-center text-foreground-muted',
          className
        )}
      >
        <Icon icon="lucide:loader-2" className="size-8 animate-spin opacity-80" />
        {title && <p className="text-xs text-foreground-muted mt-2">{title}</p>}
        {description && (
          <p className="text-xs text-foreground-muted mt-1 max-w-sm">{description}</p>
        )}
      </div>
    );
  }

  // 2. 浏览器不支持状态：当前浏览器环境不支持 File System Access API 时提示用户切换现代浏览器
  if (!supported) {
    return (
      <div
        className={cn(
          'flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/50',
          className
        )}
      >
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

  // 3. 扫描中状态：正在遍历和扫描选定目录中的视频资源
  if (type === 'scanning') {
    return (
      <div
        className={cn(
          'flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/50',
          className
        )}
      >
        <div className="size-16 rounded-full bg-surface-hover flex items-center justify-center mb-4 text-foreground animate-pulse">
          <Icon icon="lucide:folder-search" className="size-8 animate-(--slight-bounce)" />
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

  // 4. 无片段状态：所选视频或当前筛选条件下未包含任何标记的 Clip 片段
  if (type === 'no-clips') {
    return (
      <div
        className={cn(
          'flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/50',
          className
        )}
      >
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

  // 5. 无视频状态：已授权选定的目录中未发现可用的视频文件
  if (type === 'no-videos') {
    return (
      <div
        className={cn(
          'flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/50',
          className
        )}
      >
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

  // 6. 权限缺失状态：页面刷新或权限失效后需重新授权目录，或重新选择目录
  if (type === 'permission-needed') {
    return (
      <div
        className={cn(
          'flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/50',
          className
        )}
      >
        <div className="size-16 rounded-full bg-surface-hover flex items-center justify-center mb-4 text-foreground">
          <Icon icon="lucide:shield-alert" className="size-8" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-4">
          {t('emptyState.permissionRequiredTitle')}
        </h3>
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
          <Button onPress={reauthorizeDirectory}>
            <Icon icon="lucide:unlock" className="size-4" />
            <span>{t('emptyState.authorizeFolder')}</span>
          </Button>
          <Button variant="secondary" onPress={selectDirectory}>
            <span>{t('emptyState.selectAnotherFolder')}</span>
          </Button>
        </div>
        <p className="text-[11px] text-foreground-muted/70 max-w-xs leading-relaxed">
          {t('emptyState.permissionTip')}
        </p>
      </div>
    );
  }

  // 7. 片段不可用状态：视频片段文件不存在、读取异常或损坏
  if (type === 'clip-unavailable') {
    return (
      <div
        className={cn(
          'flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/50 rounded-3xl',
          className
        )}
      >
        <div className="size-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mb-4">
          <Icon icon="lucide:alert-triangle" className="size-8" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-2">
          {title || t('clipsFeed.clipUnavailable')}
        </h3>
        {description && (
          <p className="text-sm text-foreground-muted max-w-sm mb-4 leading-relaxed">
            {description}
          </p>
        )}
        {onAction && (
          <Button onPress={onAction}>
            <Icon icon="lucide:skip-forward" className="size-4" />
            <span>{actionText || t('clipsFeed.skipToNext')}</span>
          </Button>
        )}
      </div>
    );
  }

  // 8. 默认状态（未选目录）：引导用户选择本地视频文件夹
  return (
    <div
      className={cn(
        'flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/50',
        className
      )}
    >
      <div className="size-16 rounded-full bg-surface-hover flex items-center justify-center mb-4 text-foreground-muted">
        <Icon icon="lucide:folder" className="size-8 opacity-60" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">
        {title || t('emptyState.selectFolderTitle')}
      </h3>
      <p className="text-sm text-foreground-muted mb-4 leading-relaxed">
        {description || t('emptyState.selectFolderDesc')}
      </p>
      <Button onPress={selectDirectory}>
        <Icon icon="lucide:folder-plus" className="size-4" />
        <span>{t('emptyState.selectFolderBtn')}</span>
      </Button>
    </div>
  );
};
