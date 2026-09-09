import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Sidebar } from '@/components/layout/Sidebar';
import { TitleBar } from '@/components/layout/TitleBar';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { useSidebarStore } from '@/stores/sidebarStore';
import { CoverflowPage } from '@/pages/CoverflowPage';
import { cn } from '@/utils/cn';

export const MainLayout: React.FC = () => {
  const { t } = useTranslation();
  const { isOpen, isMobile, openSidebar, closeSidebar, setIsMobile } = useSidebarStore();
  const location = useLocation();

  const isCoverflow = location.pathname === '/coverflow';
  const [hasVisitedCoverflow, setHasVisitedCoverflow] = useState(isCoverflow);

  // 首次访问 Coverflow 时激活挂载，之后保持常驻缓存
  useEffect(() => {
    if (isCoverflow && !hasVisitedCoverflow) {
      setHasVisitedCoverflow(true);
    }
  }, [isCoverflow, hasVisitedCoverflow]);

  // 监听屏幕尺寸变化
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setIsMobile]);

  return (
    <div className="flex flex-col h-screen w-screen bg-background overflow-hidden font-sans relative">
      {/* 桌面端自定义沉浸式标题栏 */}
      <TitleBar />

      <div className="flex flex-1 overflow-hidden relative">
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

        {/* 展开侧边栏按钮 (收起时显示) */}
        <button
          onClick={openSidebar}
          aria-label={t('nav.expandSidebar')}
          title={t('nav.expandSidebar')}
          className={cn(
            `fixed bottom-2.5 left-3 z-30 size-7 rounded-lg hover:bg-surface-hover active:bg-surface-active
             text-foreground-muted hover:text-foreground backdrop-blur-md flex items-center 
             justify-center active:scale-95 transition-all duration-300 cursor-pointer `,
            !isOpen
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 scale-75 pointer-events-none'
          )}
        >
          <Icon icon="lucide:panel-left-open" className="size-4.5" />
        </button>

        {/* 主内容区域 */}
        <main className="flex-1 h-full overflow-hidden relative flex flex-col">
          {/* Coverflow 独立持久化缓存容器，切换页面时不销毁 WebGL 场景与纹理 */}
          {hasVisitedCoverflow && (
            <div
              className={clsx(
                'absolute inset-0 w-full h-full',
                isCoverflow
                  ? 'z-10 visible opacity-100'
                  : 'z-0 invisible opacity-0 pointer-events-none'
              )}
            >
              <CoverflowPage isVisible={isCoverflow} />
            </div>
          )}

          {/* 其它常规页面通过 Outlet 渲染 */}
          <div className={clsx('w-full h-full flex flex-col', isCoverflow ? 'hidden' : 'block')}>
            <Outlet />
          </div>
        </main>
      </div>

      <SettingsModal />
    </div>
  );
};
