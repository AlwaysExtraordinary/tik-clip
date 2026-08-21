import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Sidebar } from '@/components/layout/Sidebar';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { useSidebarStore } from '@/stores/sidebarStore';
import { cn } from '@/utils/cn';

export const MainLayout: React.FC = () => {
  const { t } = useTranslation();
  const { isOpen, isMobile, openSidebar, closeSidebar, setIsMobile } = useSidebarStore();

  // 监听屏幕尺寸变化
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setIsMobile]);

  return (
    <div className="flex h-screen w-screen bg-background overflow-hidden font-sans relative">
      {/* 移动端侧边栏遮罩 */}
      {isMobile && (
        <div
          onClick={closeSidebar}
          aria-hidden="true"
          className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity duration-300 ${
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        />
      )}

      {/* 侧边栏 */}
      <Sidebar />

      {/* 左上角展开侧边栏按钮 (收起时显示) */}
      <button
        onClick={openSidebar}
        aria-label={t('nav.expandSidebar')}
        title={t('nav.expandSidebar')}
        className={cn(
          `fixed bottom-2.5 left-3 z-30 w-7 h-7 rounded-lg hover:bg-surface-hover active:bg-surface-active
           text-foreground-muted hover:text-foreground backdrop-blur-md flex items-center 
           justify-center active:scale-95 transition-all duration-300 cursor-pointer `,
          !isOpen
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-75 pointer-events-none'
        )}
      >
        <Icon icon="lucide:panel-left-open" className="w-4.5 h-4.5" />
      </button>

      {/* 主内容区域 */}
      <main
        className={clsx(
          'flex-1 h-full overflow-hidden relative flex flex-col transition-all duration-300 ease-in-out'
          // 'p-4 md:p-6 lg:p-8'
        )}
      >
        <Outlet />
      </main>

      <SettingsModal />
    </div>
  );
};
