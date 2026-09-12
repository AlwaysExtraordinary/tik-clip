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
  selectedCategory: string | null;
  selectedActor: string | null;
  allItems: ShuffleItem[];

  setCurrentShuffleItem: (item: ShuffleItem | null) => void;
  setCurrentVideoFile: (file: File | null) => void;
  setCurrentVideoSrc: (src: string | null) => void;
  setLastPlaybackTime: (time: number | null) => void;
  setFileError: (error: string | null) => void;
  setSelectedTag: (tag: string | null) => void;
  setSelectedCategory: (category: string | null) => void;
  setSelectedActor: (actor: string | null) => void;
  setAllItems: (items: ShuffleItem[]) => void;
  resetFilters: () => void;
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
  selectedCategory: null,
  selectedActor: null,
  allItems: [],

  setCurrentShuffleItem: (currentShuffleItem) => set({ currentShuffleItem }),
  setCurrentVideoFile: (currentVideoFile) => set({ currentVideoFile }),
  setCurrentVideoSrc: (currentVideoSrc) => set({ currentVideoSrc }),
  setLastPlaybackTime: (lastPlaybackTime) => set({ lastPlaybackTime }),
  setFileError: (fileError) => set({ fileError }),
  setSelectedTag: (tag) =>
    set({ selectedTag: !tag || tag === 'all' ? null : tag }),
  setSelectedCategory: (category) =>
    set({ selectedCategory: !category || category === 'all' ? null : category }),
  setSelectedActor: (actor) =>
    set({ selectedActor: !actor || actor === 'all' ? null : actor }),
  setAllItems: (allItems) => set({ allItems }),
  resetFilters: () =>
    set({
      selectedTag: null,
      selectedCategory: null,
      selectedActor: null,
    }),
  resetFeed: () =>
    set((state) => {
      if (
        state.currentShuffleItem === null &&
        state.currentVideoFile === null &&
        state.currentVideoSrc === null &&
        state.lastPlaybackTime === null &&
        state.fileError === null &&
        state.selectedTag === null &&
        state.selectedCategory === null &&
        state.selectedActor === null &&
        state.allItems.length === 0 &&
        state.shuffleQueue.totalCount === 0
      ) {
        return state;
      }
      return {
        shuffleQueue: new ShuffleQueue(),
        currentShuffleItem: null,
        currentVideoFile: null,
        currentVideoSrc: null,
        lastPlaybackTime: null,
        fileError: null,
        selectedTag: null,
        selectedCategory: null,
        selectedActor: null,
        allItems: [],
      };
    }),
}));
