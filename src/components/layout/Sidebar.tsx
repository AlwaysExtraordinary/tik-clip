import React from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSidebarStore } from '@/stores/sidebarStore';
import { cn } from '@/utils/cn';
import brandIconLight from '@/assets/svg/tik-clip-text-dark.svg';
import brandIconDark from '@/assets/svg/tik-clip-text-white.svg';

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const { setIsSettingsOpen } = useSettingsStore();
  const { isOpen, isMobile, closeSidebar } = useSidebarStore();

  const handleNavClick = () => {
    if (isMobile) {
      closeSidebar();
    }
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
    if (isMobile) {
      closeSidebar();
    }
  };

  return (
    <aside
      className={cn(
        'flex flex-col justify-between items-center select-none bg-background transition-all duration-300 ease-in-out',
        // 移动端样式：悬浮抽屉
        isMobile && [
          'fixed inset-y-0 left-0 z-50 w-44 py-6 px-3.5 border-r border-border/40 backdrop-blur-md',
          isOpen ? 'translate-x-0 shadow-floating' : '-translate-x-full pointer-events-none',
        ],
        // 桌面端样式：常规 flex 侧边栏与折叠过渡
        !isMobile && [
          'relative h-full z-20 shrink-0',
          isOpen
            ? 'w-40 opacity-100 translate-x-0 py-4 px-3 border-r border-border/40'
            : 'w-0 opacity-0 -translate-x-full py-4 px-0 border-r-0 overflow-hidden pointer-events-none',
        ]
      )}
    >
      {/* 顶部区域：收起按钮 + 导航标签 */}
      <div className="flex flex-col items-center gap-3 w-full">
        {/* 收起侧边栏按钮 */}
        <div className="w-full flex items-center justify-start pb-0.5">
          {/* 品牌图标 */}
          <div className="pl-1">
            <img src={brandIconLight} className="w-25 dark:hidden" alt="Tik Clip" />
            <img src={brandIconDark} className="w-25 hidden dark:block" alt="Tik Clip" />
          </div>

          {/* 收起按钮图标 */}
          {/* <button
            onClick={closeSidebar}
            aria-label={t('nav.collapseSidebar')}
            title={t('nav.collapseSidebar')}
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center text-foreground-muted hover:text-foreground ',
              ' hover:bg-surface-hover active:bg-surface-active transition-all duration-150 cursor-pointer'
            )}
          >
            <Icon icon="lucide:panel-left-close" className="w-4.5 h-4.5" />
          </button> */}
        </div>

        <NavTab to="/clips" icon="lucide:zap" text={t('nav.clips')} onClick={handleNavClick} />
        <NavTab
          to="/videos"
          icon="lucide:square-play"
          text={t('nav.videos')}
          onClick={handleNavClick}
        />
      </div>

      {/* 底部设置按钮 */}
      <div className="flex justify-center gap-2 items-center w-full">
        <button
          onClick={closeSidebar}
          aria-label={t('nav.collapseSidebar')}
          title={t('nav.collapseSidebar')}
          className="w-10 h-10 rounded-full flex items-center justify-center text-foreground-muted 
          hover:text-foreground bg-surface/60 hover:bg-surface-hover active:bg-surface-active transition-all 
          duration-150 shadow-subtle cursor-pointer"
        >
          <Icon icon="lucide:panel-left-close" className="w-5 h-5" />
        </button>

        <button
          onClick={handleSettingsClick}
          aria-label={t('nav.settings')}
          title={t('nav.settings')}
          className="w-10 h-10 rounded-full flex items-center justify-center text-foreground-muted 
          hover:text-foreground bg-surface/60 hover:bg-surface-hover active:bg-surface-active transition-all 
          duration-150 shadow-subtle cursor-pointer"
        >
          <Icon icon="lucide:settings" className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
};

interface NavTabProps extends React.HTMLAttributes<HTMLAnchorElement> {
  to: string;
  icon?: string;
  iconClassName?: string;
  className?: string;
  text?: string;
  onClick?: () => void;
}

// 导航标签组件
const NavTab: React.FC<NavTabProps> = ({
  to,
  icon,
  iconClassName = 'size-4',
  className,
  text,
  children,
  onClick,
  ...props
}) => {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `w-full py-2 px-3 rounded-lg flex items-center justify-start gap-1.5 text-sm font-medium text-center transition-all duration-200 shadow-sm ${
          isActive
            ? 'bg-surface-active text-foreground font-bold shadow-md'
            : 'bg-surface/80 text-foreground-muted hover:bg-surface hover:text-foreground'
        } ${className}`
      }
      {...props}
    >
      {icon && <Icon icon={icon} className={iconClassName} />}
      {text ? <span className="shrink-0">{text}</span> : children}
    </NavLink>
  );
};
