import { create } from 'zustand';
import { ThemeMode, SupportedLanguage, StartupPage } from '@/types/settings';
import {
  getStoredTheme,
  setStoredTheme,
  getStoredLanguage,
  setStoredLanguage,
  getStoredStartupPage,
  setStoredStartupPage,
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

const getInitialCoverflowPreview = (): boolean => {
  try {
    const saved = localStorage.getItem('tik_clip_coverflow_preview');
    return saved !== null ? saved === 'true' : true;
  } catch {
    return true;
  }
};

const getInitialStartupPage = (): StartupPage => {
  try {
    const saved = localStorage.getItem('tik_clip_startup_page');
    if (saved === '/clips' || saved === '/videos' || saved === '/coverflow') {
      return saved;
    }
  } catch {
    // 忽略存储错误
  }
  return '/clips';
};

interface SettingsState {
  theme: ThemeMode;
  language: SupportedLanguage;
  startupPage: StartupPage;
  isSettingsOpen: boolean; //设置侧边栏是否打开
  showThumbnailPreview: boolean; //是否显示进度条缩略图
  showCoverflowPreview: boolean; //是否开启封面流展示预览

  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: SupportedLanguage) => void;
  setStartupPage: (startupPage: StartupPage) => void;
  setIsSettingsOpen: (isOpen: boolean) => void;
  setShowThumbnailPreview: (show: boolean) => void;
  toggleShowThumbnailPreview: () => void;
  setShowCoverflowPreview: (show: boolean) => void;
  toggleShowCoverflowPreview: () => void;
  initTheme: () => Promise<void>;
  initLanguage: () => Promise<void>;
  initStartupPage: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'system',
  language: 'zh',
  startupPage: getInitialStartupPage(),
  isSettingsOpen: false,
  showThumbnailPreview: getInitialThumbnailPreview(),
  showCoverflowPreview: getInitialCoverflowPreview(),

  setTheme: (theme) => {
    set({ theme });
    setStoredTheme(theme).catch(console.error);
  },
  setLanguage: (language) => {
    set({ language });
    i18n.changeLanguage(language).catch(console.error);
    setStoredLanguage(language).catch(console.error);
  },
  setStartupPage: (startupPage) => {
    try {
      localStorage.setItem('tik_clip_startup_page', startupPage);
    } catch {
      // 忽略存储错误
    }
    set({ startupPage });
    setStoredStartupPage(startupPage).catch(console.error);
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
  setShowCoverflowPreview: (show) => {
    try {
      localStorage.setItem('tik_clip_coverflow_preview', String(show));
    } catch {
      // 忽略存储错误
    }
    set({ showCoverflowPreview: show });
  },
  toggleShowCoverflowPreview: () =>
    set((state) => {
      const next = !state.showCoverflowPreview;
      try {
        localStorage.setItem('tik_clip_coverflow_preview', String(next));
      } catch {
        // 忽略存储错误
      }
      return { showCoverflowPreview: next };
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
  initStartupPage: async () => {
    try {
      const stored = await getStoredStartupPage();
      set({ startupPage: stored });
    } catch {
      // 忽略错误，使用回退值
    }
  },
}));
