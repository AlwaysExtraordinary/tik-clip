import React from 'react';
import { Icon } from '@iconify/react';
import { Tabs } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { ViewMode } from './types';
import { cn } from '@/utils/cn';

interface CoverflowNavbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isHidden?: boolean;
}

/**
 * Coverflow 顶部导航栏组件
 * 提供视图模式切换（正面、斜角、侧面），深浅色自动跟随系统
 */
export const CoverflowNavbar: React.FC<CoverflowNavbarProps> = ({
  viewMode,
  onViewModeChange,
  isHidden = false,
}) => {
  const { t } = useTranslation();

  return (
    <nav
      className={cn(
        'absolute top-3 @[480px]:top-5 left-1/2 -translate-x-1/2 z-20 transition-all duration-300 ease-in-out',
        'flex items-center gap-2 px-2 py-1 rounded-full',
        'bg-surface/80 backdrop-blur-md border border-border shadow-floating',
        isHidden && 'opacity-0 -translate-y-4 pointer-events-none'
      )}
    >
      <Tabs
        selectedKey={viewMode}
        onSelectionChange={(key) => onViewModeChange(key as ViewMode)}
        aria-label={t('coverflow.viewMode', '视图模式')}
      >
        <Tabs.ListContainer className="min-w-0">
          <Tabs.List>
            <Tabs.Tab
              key="front"
              id="front"
              className="flex items-center gap-1.5 px-2 @[400px]:px-3 py-1 cursor-pointer"
            >
              <Icon icon="lucide:rectangle-vertical" className="size-4" />
              <span className="text-xs font-medium">{t('coverflow.frontView', '正面')}</span>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab
              key="angled"
              id="angled"
              className="flex items-center gap-1.5 px-2 @[400px]:px-3 py-1 cursor-pointer"
            >
              <Icon icon="lucide:layers" className="size-4" />
              <span className="text-xs font-medium">{t('coverflow.angledView', '斜角')}</span>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab
              key="vertical"
              id="vertical"
              className="flex items-center gap-1.5 px-2 @[400px]:px-3 py-1 cursor-pointer"
            >
              <Icon icon="lucide:columns-3" className="size-4" />
              <span className="text-xs font-medium">{t('coverflow.verticalView', '侧面')}</span>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
    </nav>
  );
};
