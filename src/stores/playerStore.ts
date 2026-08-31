import { create } from 'zustand';
import { Clip } from '@/types/clip';

export type VideoFitMode = 'contain' | 'cover';

const getInitialClipsFitMode = (): VideoFitMode => {
  try {
    const saved = localStorage.getItem('tik_clip_clips_fit_mode');
    if (saved === 'cover' || saved === 'contain') return saved;
    const legacy = localStorage.getItem('tik_clip_fit_mode');
    return legacy === 'cover' ? 'cover' : 'contain';
  } catch {
    return 'contain';
  }
};

const getInitialDetailFitMode = (): VideoFitMode => {
  try {
    const saved = localStorage.getItem('tik_clip_detail_fit_mode');
    if (saved === 'cover' || saved === 'contain') return saved;
    const legacy = localStorage.getItem('tik_clip_fit_mode');
    return legacy === 'cover' ? 'cover' : 'contain';
  } catch {
    return 'contain';
  }
};

const getInitialShowCountdown = (): boolean => {
  try {
    const saved = localStorage.getItem('tik_clip_show_countdown');
    return saved !== null ? saved === 'true' : true;
  } catch {
    return true;
  }
};

const getInitialVolume = (): number => {
  try {
    const saved = localStorage.getItem('tik_clip_volume');
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        return parsed;
      }
    }
    return 1;
  } catch {
    return 1;
  }
};

const getInitialMuted = (): boolean => {
  try {
    const saved = localStorage.getItem('tik_clip_muted');
    return saved === 'true';
  } catch {
    return false;
  }
};

interface PlayerState {
  isClipPanelOpen: boolean;
  editingPoint: 'start' | 'end';
  editingClip: Clip | null;
  seekTargetTime: number | null; // 用于请求视频播放器跳转进度
  clipsFitMode: VideoFitMode; // 片段流播放画面比例模式
  detailFitMode: VideoFitMode; // 视频详情页播放画面比例模式
  showCountdown: boolean;
  volume: number;
  isMuted: boolean;

  /** 设置片段编辑面板打开状态 */
  setIsClipPanelOpen: (isOpen: boolean) => void;
  /** 切换片段编辑面板打开状态 */
  toggleClipPanel: () => void;
  /** 设置当前正在编辑的时间打点类型 */
  setEditingPoint: (point: 'start' | 'end') => void;
  /** 设置当前正在编辑的片段数据 */
  setEditingClip: (clip: Clip | null) => void;
  /** 请求播放器跳转到指定时间 */
  requestSeek: (time: number | null) => void;
  /** 设置片段流画面的比例模式 */
  setClipsFitMode: (mode: VideoFitMode) => void;
  /** 切换片段流画面的比例模式 (contain / cover) */
  toggleClipsFitMode: () => void;
  /** 设置视频详情页画面的比例模式 */
  setDetailFitMode: (mode: VideoFitMode) => void;
  /** 切换视频详情页画面的比例模式 (contain / cover) */
  toggleDetailFitMode: () => void;
  /** 设置片段倒计时显示状态 */
  setShowCountdown: (show: boolean) => void;
  /** 切换片段倒计时显示状态 */
  toggleShowCountdown: () => void;
  /** 设置全局播放音量 */
  setVolume: (volume: number) => void;
  /** 设置全局静音状态 */
  setIsMuted: (isMuted: boolean) => void;
  /** 切换全局静音状态 */
  toggleMute: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  isClipPanelOpen: false,
  editingPoint: 'start',
  editingClip: null,
  seekTargetTime: null,
  clipsFitMode: getInitialClipsFitMode(),
  detailFitMode: getInitialDetailFitMode(),
  showCountdown: getInitialShowCountdown(),
  volume: getInitialVolume(),
  isMuted: getInitialMuted(),

  setIsClipPanelOpen: (isClipPanelOpen) => set({ isClipPanelOpen }),
  toggleClipPanel: () => set((state) => ({ isClipPanelOpen: !state.isClipPanelOpen })),
  setEditingPoint: (editingPoint) => set({ editingPoint }),
  setEditingClip: (editingClip) => set({ editingClip }),
  requestSeek: (seekTargetTime) => set({ seekTargetTime }),
  setClipsFitMode: (clipsFitMode) => {
    try {
      localStorage.setItem('tik_clip_clips_fit_mode', clipsFitMode);
    } catch {
      // 忽略存储错误
    }
    set({ clipsFitMode });
  },
  toggleClipsFitMode: () =>
    set((state) => {
      const nextMode: VideoFitMode = state.clipsFitMode === 'contain' ? 'cover' : 'contain';
      try {
        localStorage.setItem('tik_clip_clips_fit_mode', nextMode);
      } catch {
        // 忽略存储错误
      }
      return { clipsFitMode: nextMode };
    }),
  setDetailFitMode: (detailFitMode) => {
    try {
      localStorage.setItem('tik_clip_detail_fit_mode', detailFitMode);
    } catch {
      // 忽略存储错误
    }
    set({ detailFitMode });
  },
  toggleDetailFitMode: () =>
    set((state) => {
      const nextMode: VideoFitMode = state.detailFitMode === 'contain' ? 'cover' : 'contain';
      try {
        localStorage.setItem('tik_clip_detail_fit_mode', nextMode);
      } catch {
        // 忽略存储错误
      }
      return { detailFitMode: nextMode };
    }),
  setShowCountdown: (showCountdown) => {
    try {
      localStorage.setItem('tik_clip_show_countdown', String(showCountdown));
    } catch {
      // 忽略存储错误
    }
    set({ showCountdown });
  },
  toggleShowCountdown: () =>
    set((state) => {
      const nextShow = !state.showCountdown;
      try {
        localStorage.setItem('tik_clip_show_countdown', String(nextShow));
      } catch {
        // 忽略存储错误
      }
      return { showCountdown: nextShow };
    }),
  setVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume));
    try {
      localStorage.setItem('tik_clip_volume', String(clamped));
    } catch {
      // 忽略存储错误
    }
    set((state) => {
      const shouldUnmute = state.isMuted && clamped > 0;
      const shouldMute = clamped === 0;
      const nextMuted = shouldMute ? true : shouldUnmute ? false : state.isMuted;
      try {
        localStorage.setItem('tik_clip_muted', String(nextMuted));
      } catch {
        // 忽略存储错误
      }
      return {
        volume: clamped,
        isMuted: nextMuted,
      };
    });
  },
  setIsMuted: (isMuted) => {
    try {
      localStorage.setItem('tik_clip_muted', String(isMuted));
    } catch {
      // 忽略存储错误
    }
    set({ isMuted });
  },
  toggleMute: () =>
    set((state) => {
      const nextMuted = !state.isMuted;
      let nextVolume = state.volume;
      if (!nextMuted && state.volume === 0) {
        nextVolume = 1;
        try {
          localStorage.setItem('tik_clip_volume', '1');
        } catch {
          // 忽略存储错误
        }
      }
      try {
        localStorage.setItem('tik_clip_muted', String(nextMuted));
      } catch {
        // 忽略存储错误
      }
      return { isMuted: nextMuted, volume: nextVolume };
    }),
}));
