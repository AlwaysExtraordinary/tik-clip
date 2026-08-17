export interface Video {
  id: string;
  name: string;
  folderName: string;
  fileName: string;
  duration: number;
  thumbnail?: Blob; // 在 IndexedDB 中以 Blob 形式存储
  category?: string;
  clipsCount: number;
  createdAt: number;
  updatedAt: number;
  hasCover?: boolean;
  coverLastModified?: number;
  coverSize?: number;
  videoLastModified?: number;
  videoSize?: number;
}

export interface VideoMetadata {
  name?: string;
  category?: string;
  description?: string;
  tags?: string[];
}

export interface VideoScanItem {
  folderName: string;
  fileName: string;
  videoHandle: FileSystemFileHandle;
  coverHandle?: FileSystemFileHandle;
  dataJsonHandle?: FileSystemFileHandle;
}
