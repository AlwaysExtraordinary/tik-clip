import React from 'react';
import { Icon } from '@iconify/react';
import { Tabs } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { ViewMode } from './types';
import { cn } from '@/utils/cn';

interface CoverflowNavbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedActor?: string | null;
  onSelectActor?: (actor: string | null) => void;
  actors?: string[];
  isHidden?: boolean;
}

interface ViewModeItem {
  key: ViewMode;
  icon: string;
  labelKey: string;
  defaultLabel: string;
  customClass?: string;
}

// 视图模式选项配置
const VIEW_MODES: ViewModeItem[] = [
  {
    key: 'front',
    icon: 'lucide:gallery-horizontal',
    labelKey: 'coverflow.frontView',
    defaultLabel: '正面',
  },
  {
    key: 'angled',
    icon: 'lucide:gallery-horizontal-end',
    labelKey: 'coverflow.angledView',
    defaultLabel: '斜角',
  },
  {
    key: 'vertical',
    icon: 'lucide:columns-3',
    labelKey: 'coverflow.verticalView',
    defaultLabel: '侧面',
  },
];

/**
 * Coverflow 顶部导航栏组件
 * 提供按演员筛选与视图模式切换（正面、斜角、侧面），深浅色自动跟随系统
 */
export const CoverflowNavbar: React.FC<CoverflowNavbarProps> = ({
  viewMode,
  onViewModeChange,
  selectedActor = null,
  onSelectActor,
  actors = [],
  isHidden = false,
}) => {
  const { t } = useTranslation();

  return (
    <nav
      className={cn(
        'absolute top-5 left-1/2 -translate-x-1/2 z-20 transition-all duration-300 ease-in-out',
        'flex items-center gap-3 max-w-[calc(100%-1.5rem)] @xl:max-w-[calc(100%-2.5rem)] px-3 py-2 rounded-full',
        'bg-surface/80 backdrop-blur-md border border-border shadow-floating',
        isHidden && 'opacity-0 -translate-y-4 pointer-events-none'
      )}
    >
      {/* 演员筛选 Tabs */}
      {actors.length > 0 && onSelectActor && (
        <>
          <Tabs
            selectedKey={selectedActor || 'all'}
            onSelectionChange={(key) => onSelectActor(key === 'all' ? null : String(key))}
            aria-label={t('videos.filterByActor')}
            className="min-w-0 shrink"
          >
            <Tabs.ListContainer className="min-w-0 max-w-[45vw] @3xl:max-w-[50vw]">
              <Tabs.List>
                <Tabs.Tab
                  key="all"
                  id="all"
                  className="flex items-center gap-1.5 px-2 @3xl:px-3 py-1 cursor-pointer"
                >
                  <Icon icon="lucide:user" className="size-4" />
                  <span className="text-xs font-medium whitespace-nowrap">
                    {t('videos.allActors')}
                  </span>
                  <Tabs.Indicator />
                </Tabs.Tab>
                {actors.map((actor) => (
                  <Tabs.Tab
                    key={actor}
                    id={actor}
                    className="flex items-center gap-1.5 px-2 @3xl:px-3 py-1 cursor-pointer"
                  >
                    <span className="text-xs font-medium whitespace-nowrap">{actor}</span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </>
      )}

      {/* 视图模式切换 */}
      <Tabs
        selectedKey={viewMode}
        onSelectionChange={(key) => onViewModeChange(key as ViewMode)}
        aria-label={t('coverflow.viewMode', '视图模式')}
        className="shrink-0"
      >
        <Tabs.ListContainer className="min-w-0">
          <Tabs.List>
            {VIEW_MODES.map((item) => (
              <Tabs.Tab
                key={item.key}
                id={item.key}
                className="flex items-center gap-1.5 px-2 @3xl:px-3 py-1 cursor-pointer"
              >
                <Icon
                  icon={item.icon}
                  className={cn('size-4', item.customClass ? item.customClass : '')}
                />
                <span className="text-xs font-medium whitespace-nowrap @max-3xl:hidden">
                  {t(item.labelKey, item.defaultLabel)}
                </span>
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
    </nav>
  );
};
