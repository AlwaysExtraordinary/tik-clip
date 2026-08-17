import { create } from 'zustand';
import { Clip } from '@/types/clip';

export type VideoFitMode = 'contain' | 'cover';

const getInitialFitMode = (): VideoFitMode => {
  try {
    const saved = localStorage.getItem('tik_clip_fit_mode');
    return saved === 'cover' ? 'cover' : 'contain';
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
  fitMode: VideoFitMode;
  showCountdown: boolean;
  volume: number;
  isMuted: boolean;

  setIsClipPanelOpen: (isOpen: boolean) => void;
  toggleClipPanel: () => void;
  setEditingPoint: (point: 'start' | 'end') => void;
  setEditingClip: (clip: Clip | null) => void;
  requestSeek: (time: number | null) => void;
  setFitMode: (mode: VideoFitMode) => void;
  toggleFitMode: () => void;
  setShowCountdown: (show: boolean) => void;
  toggleShowCountdown: () => void;
  setVolume: (volume: number) => void;
  setIsMuted: (isMuted: boolean) => void;
  toggleMute: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  isClipPanelOpen: false,
  editingPoint: 'start',
  editingClip: null,
  seekTargetTime: null,
  fitMode: getInitialFitMode(),
  showCountdown: getInitialShowCountdown(),
  volume: getInitialVolume(),
  isMuted: getInitialMuted(),

  setIsClipPanelOpen: (isClipPanelOpen) => set({ isClipPanelOpen }),
  toggleClipPanel: () => set((state) => ({ isClipPanelOpen: !state.isClipPanelOpen })),
  setEditingPoint: (editingPoint) => set({ editingPoint }),
  setEditingClip: (editingClip) => set({ editingClip }),
  requestSeek: (seekTargetTime) => set({ seekTargetTime }),
  setFitMode: (fitMode) => {
    try {
      localStorage.setItem('tik_clip_fit_mode', fitMode);
    } catch {
      // 忽略存储错误
    }
    set({ fitMode });
  },
  toggleFitMode: () =>
    set((state) => {
      const nextMode: VideoFitMode = state.fitMode === 'contain' ? 'cover' : 'contain';
      try {
        localStorage.setItem('tik_clip_fit_mode', nextMode);
      } catch {
        // 忽略存储错误
      }
      return { fitMode: nextMode };
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
