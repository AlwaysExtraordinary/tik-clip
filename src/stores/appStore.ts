import { create } from 'zustand';
import { ScanProgress, DirectoryRef } from '@/services/fileSystem/index';

interface AppState {
  directoryRef: DirectoryRef | null;
  directoryHandle: FileSystemDirectoryHandle | null;
  directoryName: string;
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  isHandleRestoring: boolean;
  hasDirectoryPermission: boolean;
  errorMessage: string | null;

  setDirectoryRef: (ref: DirectoryRef | null) => void;
  setDirectoryHandle: (handle: FileSystemDirectoryHandle | null, name?: string) => void;
  setIsScanning: (isScanning: boolean) => void;
  setScanProgress: (progress: ScanProgress | null) => void;
  setIsHandleRestoring: (restoring: boolean) => void;
  setHasDirectoryPermission: (hasPerm: boolean) => void;
  setErrorMessage: (msg: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  directoryRef: null,
  directoryHandle: null,
  directoryName: '',
  isScanning: false,
  scanProgress: null,
  isHandleRestoring: true,
  hasDirectoryPermission: false,
  errorMessage: null,

  setDirectoryRef: (ref) =>
    set({
      directoryRef: ref,
      directoryHandle: ref?.handle || null,
      directoryName: ref?.name || '',
      ...(ref === null ? { hasDirectoryPermission: false } : {}),
    }),
  setDirectoryHandle: (handle, name) =>
    set({
      directoryRef: handle ? { name: name ?? handle.name, handle } : null,
      directoryHandle: handle,
      directoryName: name ?? (handle ? handle.name : ''),
      ...(handle === null ? { hasDirectoryPermission: false } : {}),
    }),
  setIsScanning: (isScanning) => set({ isScanning }),
  setScanProgress: (scanProgress) => set({ scanProgress }),
  setIsHandleRestoring: (isHandleRestoring) => set({ isHandleRestoring }),
  setHasDirectoryPermission: (hasDirectoryPermission) => set({ hasDirectoryPermission }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
}));
