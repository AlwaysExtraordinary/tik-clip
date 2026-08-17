import { create } from 'zustand';

interface SidebarState {
  isOpen: boolean;
  isMobile: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  setIsMobile: (isMobile: boolean) => void;
  setIsOpen: (isOpen: boolean) => void;
}

const checkIsMobile = () => {
  if (typeof window !== 'undefined') {
    return window.innerWidth < 768;
  }
  return false;
};

const initialIsMobile = checkIsMobile();

export const useSidebarStore = create<SidebarState>((set) => ({
  isMobile: initialIsMobile,
  isOpen: !initialIsMobile,

  openSidebar: () => set({ isOpen: true }),
  closeSidebar: () => set({ isOpen: false }),
  toggleSidebar: () => set((state) => ({ isOpen: !state.isOpen })),
  setIsOpen: (isOpen) => set({ isOpen }),
  setIsMobile: (isMobile) =>
    set((state) => {
      // 当从桌面端切换到移动端时，默认收起
      if (isMobile && !state.isMobile) {
        return { isMobile, isOpen: false };
      }
      // 当从移动端切换到桌面端时，默认展开
      if (!isMobile && state.isMobile) {
        return { isMobile, isOpen: true };
      }
      return { isMobile };
    }),
}));
