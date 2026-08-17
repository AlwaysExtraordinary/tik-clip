import { create } from 'zustand';
import { ThemeMode, SupportedLanguage } from '@/types/settings';
import {
  getStoredTheme,
  setStoredTheme,
  getStoredLanguage,
  setStoredLanguage,
} from '@/db/settings';
import i18n from '@/i18n';

const getInitialThumbnailPreview = (): boolean => {
  try {
    const saved = localStorage.getItem('tik_clip_thumbnail_preview');
    return saved !== null ? saved === 'true' : true;
  } catch {
    return true;
  }
};

interface SettingsState {
  theme: ThemeMode;
  language: SupportedLanguage;
  isSettingsOpen: boolean; //设置侧边栏是否打开
  showThumbnailPreview: boolean; //是否显示进度条缩略图

  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: SupportedLanguage) => void;
  setIsSettingsOpen: (isOpen: boolean) => void;
  setShowThumbnailPreview: (show: boolean) => void;
  toggleShowThumbnailPreview: () => void;
  initTheme: () => Promise<void>;
  initLanguage: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'system',
  language: 'zh',
  isSettingsOpen: false,
  showThumbnailPreview: getInitialThumbnailPreview(),

  setTheme: (theme) => {
    set({ theme });
    setStoredTheme(theme).catch(console.error);
  },
  setLanguage: (language) => {
    set({ language });
    i18n.changeLanguage(language).catch(console.error);
    setStoredLanguage(language).catch(console.error);
  },
  setIsSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
  setShowThumbnailPreview: (show) => {
    try {
      localStorage.setItem('tik_clip_thumbnail_preview', String(show));
    } catch {
      // 忽略存储错误
    }
    set({ showThumbnailPreview: show });
  },
  toggleShowThumbnailPreview: () =>
    set((state) => {
      const next = !state.showThumbnailPreview;
      try {
        localStorage.setItem('tik_clip_thumbnail_preview', String(next));
      } catch {
        // 忽略存储错误
      }
      return { showThumbnailPreview: next };
    }),
  initTheme: async () => {
    try {
      const stored = await getStoredTheme();
      set({ theme: stored });
    } catch {
      // 忽略错误，使用回退值
    }
  },
  initLanguage: async () => {
    try {
      const stored = await getStoredLanguage();
      set({ language: stored });
      await i18n.changeLanguage(stored);
    } catch {
      // 忽略错误，使用回退值
    }
  },
}));
