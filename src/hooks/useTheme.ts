import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { isTauri } from '@/services/fileSystem/index';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * 主题管理 Hook，负责切换浅色/深色主题并同步原生窗口背景色
 */
export function useTheme() {
  const { theme, initTheme } = useSettingsStore();

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  useEffect(() => {
    const root = document.documentElement;

    /**
     * 应用主题到 DOM 并同步桌面窗口底色
     */
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      // 同步桌面端原生窗口底色
      if (isTauri()) {
        try {
          getCurrentWindow().setBackgroundColor(isDark ? '#121214' : '#f3f4f6');
        } catch (err) {
          console.warn('Failed to set native window background color:', err);
        }
      }
    };

    if (theme === 'dark') {
      applyTheme(true);
    } else if (theme === 'light') {
      applyTheme(false);
    } else {
      // 跟随系统模式
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);
}
