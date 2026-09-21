import React from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@heroui/react';
import { useTranslation, Trans } from 'react-i18next';
import { useDirectory } from '@/hooks/useDirectory';
import { isFileSystemAccessSupported } from '@/services/fileSystem';
import { cn } from '@/utils/cn';

/** 空状态场景类型 */
export type EmptyStateType =
  | 'no-directory'
  | 'no-videos'
  | 'no-clips'
  | 'no-filter-results'
  | 'permission-needed'
  | 'scanning'
  | 'loading'
  | 'clip-unavailable';

/** 空状态组件属性 */
export interface EmptyStateProps {
  /** 空状态类型：未选目录 | 无视频 | 无片段 | 筛选无结果 | 需重新授权 | 目录扫描中 | 加载中 | 片段不可用 */
  type?: EmptyStateType;
  /** 自定义图标名称（可选） */
  icon?: string;
  /** 自定义标题（可选） */
  title?: string;
  /** 自定义描述文本（可选） */
  description?: React.ReactNode;
  /** 操作按钮文本（可选） */
  actionText?: string;
  /** 操作按钮前置图标（可选） */
  actionIcon?: string;
  /** 操作按钮点击回调（可选） */
  onAction?: () => void;
  /** 操作按钮样式变体（可选） */
  actionVariant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'outline';
  /** 自定义容器类名（可选） */
  className?: string;
  /** 自定义底部操作内容插槽（可选） */
  children?: React.ReactNode;
}

/**
 * 空状态展示组件
 * 采用配置驱动与统一管线设计，统一维护不同业务场景（未选目录、无视频、无片段、筛选无结果、扫描中等）的视觉与交互反馈
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'no-directory',
  icon,
  title,
  description,
  actionText,
  actionIcon,
  onAction,
  actionVariant,
  className,
  children,
}) => {
  const { t } = useTranslation();
  const { selectDirectory, reauthorizeDirectory, directoryName } = useDirectory();
  const supported = isFileSystemAccessSupported();

  // 浏览器不支持原生文件系统 API 特殊提示
  if (!supported) {
    return (
      <div
        className={cn(
          'flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/50 h-full',
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

  // 基础场景配置字典
  const stateConfigs: Record<
    EmptyStateType,
    {
      icon: string;
      iconWrapperClass?: string;
      iconClass?: string;
      defaultTitle?: string;
      defaultDescription?: React.ReactNode;
      defaultActionText?: string;
      defaultActionIcon?: string;
      defaultActionVariant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'outline';
      defaultOnAction?: () => void;
      customActionRenderer?: () => React.ReactNode;
    }
  > = {
    loading: {
      icon: 'lucide:loader-2',
      iconClass: 'animate-spin opacity-80',
    },
    scanning: {
      icon: 'lucide:folder-search',
      iconWrapperClass: 'bg-surface-hover animate-pulse text-foreground',
      iconClass: 'animate-(--slight-bounce)',
      defaultTitle: t('emptyState.scanningTitle'),
      defaultDescription: directoryName,
    },
    'no-directory': {
      icon: 'lucide:folder',
      iconWrapperClass: 'bg-surface-hover text-foreground-muted',
      iconClass: 'opacity-60',
      defaultTitle: t('emptyState.selectFolderTitle'),
      defaultDescription: t('emptyState.selectFolderDesc'),
      defaultActionText: t('emptyState.selectFolderBtn'),
      defaultActionIcon: 'lucide:folder-plus',
      defaultActionVariant: 'primary',
      defaultOnAction: selectDirectory,
    },
    'permission-needed': {
      icon: 'lucide:shield-alert',
      iconWrapperClass: 'bg-surface-hover text-foreground',
      defaultTitle: t('emptyState.permissionRequiredTitle'),
      customActionRenderer: () => (
        <div className="flex flex-col items-center">
          <div className="flex flex-col sm:flex-row items-center gap-3 mb-3">
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
      ),
    },
    'no-videos': {
      icon: 'lucide:video-off',
      iconWrapperClass: 'bg-surface-hover text-foreground-muted',
      iconClass: 'opacity-60',
      defaultTitle: t('videos.noVideosTitle'),
      defaultDescription: t('videos.noVideosDesc'),
    },
    'no-clips': {
      icon: 'lucide:scissors',
      iconWrapperClass: 'bg-surface-hover text-foreground-muted',
      iconClass: 'opacity-60',
      defaultTitle: t('emptyState.noClipsTitle'),
      defaultDescription: t('emptyState.noClipsDesc'),
      defaultActionVariant: 'secondary',
    },
    'no-filter-results': {
      icon: 'lucide:folder-search',
      iconWrapperClass: 'bg-surface-hover text-foreground-muted',
      iconClass: 'opacity-70',
      defaultTitle: t('videos.noFilteredVideos'),
      defaultActionText: t('clipsFeed.default'),
      defaultActionVariant: 'secondary',
    },
    'clip-unavailable': {
      icon: 'lucide:alert-triangle',
      iconWrapperClass: 'bg-danger/10 text-danger',
      defaultTitle: t('clipsFeed.clipUnavailable'),
      defaultActionText: t('clipsFeed.skipToNext'),
      defaultActionIcon: 'lucide:skip-forward',
      defaultActionVariant: 'primary',
    },
  };

  const config = stateConfigs[type] || stateConfigs['no-directory'];
  const resolvedIcon = icon || config.icon;
  const resolvedTitle = title ?? config.defaultTitle;
  const resolvedDesc = description ?? config.defaultDescription;
  const resolvedActionText = actionText || config.defaultActionText;
  const resolvedActionIcon = actionIcon || config.defaultActionIcon;
  const resolvedActionVariant = actionVariant || config.defaultActionVariant || 'primary';
  const resolvedOnAction = onAction || config.defaultOnAction;

  // loading 场景轻量直接居中
  if (type === 'loading') {
    return (
      <div
        className={cn(
          'flex-1 flex flex-col items-center justify-center p-8 text-center text-foreground-muted h-full',
          className
        )}
      >
        <Icon icon={resolvedIcon} className={cn('size-8', config.iconClass)} />
        {resolvedTitle && <p className="text-xs text-foreground-muted mt-2">{resolvedTitle}</p>}
        {resolvedDesc && (
          <p className="text-xs text-foreground-muted mt-1 max-w-sm">{resolvedDesc}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/50 h-full',
        className
      )}
    >
      {/* 图标展示容器 */}
      <div
        className={cn(
          'size-16 rounded-full flex items-center justify-center mb-4',
          config.iconWrapperClass
        )}
      >
        <Icon icon={resolvedIcon} className={cn('size-8', config.iconClass)} />
      </div>

      {/* 标题 */}
      {resolvedTitle && (
        <h3 className="text-base font-semibold text-foreground mb-2">{resolvedTitle}</h3>
      )}

      {/* 描述文本 */}
      {resolvedDesc && (
        <p className="text-sm text-foreground-muted max-w-md mb-4 leading-relaxed">
          {resolvedDesc}
        </p>
      )}

      {/* 底部操作区：优先 children 插槽，其次专用渲染器，最后为标准单一操作按钮 */}
      {children ? (
        children
      ) : config.customActionRenderer ? (
        config.customActionRenderer()
      ) : resolvedActionText && resolvedOnAction ? (
        <Button
          variant={resolvedActionVariant}
          onPress={resolvedOnAction}
          className="gap-1.5"
        >
          {resolvedActionIcon && <Icon icon={resolvedActionIcon} className="size-4" />}
          <span>{resolvedActionText}</span>
        </Button>
      ) : null}
    </div>
  );
};
