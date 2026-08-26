import { create } from 'zustand';
import { ShuffleItem } from '@/types/clip';
import { ShuffleQueue } from '@/services/shuffle';

interface ClipsFeedState {
  shuffleQueue: ShuffleQueue;
  currentShuffleItem: ShuffleItem | null;
  currentVideoFile: File | null;
  currentVideoSrc: string | null;
  lastPlaybackTime: number | null;
  fileError: string | null;
  selectedTag: string | null;

  setCurrentShuffleItem: (item: ShuffleItem | null) => void;
  setCurrentVideoFile: (file: File | null) => void;
  setCurrentVideoSrc: (src: string | null) => void;
  setLastPlaybackTime: (time: number | null) => void;
  setFileError: (error: string | null) => void;
  setSelectedTag: (tag: string | null) => void;
  resetFeed: () => void;
}

export const useClipsFeedStore = create<ClipsFeedState>((set) => ({
  shuffleQueue: new ShuffleQueue(),
  currentShuffleItem: null,
  currentVideoFile: null,
  currentVideoSrc: null,
  lastPlaybackTime: null,
  fileError: null,
  selectedTag: null,

  setCurrentShuffleItem: (currentShuffleItem) => set({ currentShuffleItem }),
  setCurrentVideoFile: (currentVideoFile) => set({ currentVideoFile }),
  setCurrentVideoSrc: (currentVideoSrc) => set({ currentVideoSrc }),
  setLastPlaybackTime: (lastPlaybackTime) => set({ lastPlaybackTime }),
  setFileError: (fileError) => set({ fileError }),
  setSelectedTag: (selectedTag) => set({ selectedTag }),
  resetFeed: () =>
    set({
      shuffleQueue: new ShuffleQueue(),
      currentShuffleItem: null,
      currentVideoFile: null,
      currentVideoSrc: null,
      lastPlaybackTime: null,
      fileError: null,
      selectedTag: null,
    }),
}));
