import { create } from 'zustand';
import { ScanProgress } from '@/services/videoScanner';

interface AppState {
  directoryHandle: FileSystemDirectoryHandle | null;
  directoryName: string;
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  isHandleRestoring: boolean;
  errorMessage: string | null;

  setDirectoryHandle: (handle: FileSystemDirectoryHandle | null, name?: string) => void;
  setIsScanning: (isScanning: boolean) => void;
  setScanProgress: (progress: ScanProgress | null) => void;
  setIsHandleRestoring: (restoring: boolean) => void;
  setErrorMessage: (msg: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  directoryHandle: null,
  directoryName: '',
  isScanning: false,
  scanProgress: null,
  isHandleRestoring: true,
  errorMessage: null,

  setDirectoryHandle: (handle, name) =>
    set({
      directoryHandle: handle,
      directoryName: name ?? (handle ? handle.name : ''),
    }),
  setIsScanning: (isScanning) => set({ isScanning }),
  setScanProgress: (scanProgress) => set({ scanProgress }),
  setIsHandleRestoring: (isHandleRestoring) => set({ isHandleRestoring }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
}));
