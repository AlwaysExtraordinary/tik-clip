import { Video } from '@/types/video';
import { Clip } from '@/types/clip';

export interface DirectoryRef {
  name: string;
  handle?: FileSystemDirectoryHandle; // Web 浏览器环境句柄
  path?: string; // Tauri 桌面环境绝对路径
}

export interface VideoMediaSource {
  type: 'url' | 'file';
  src: string; // Web 下为 Blob URL，Tauri 下为 asset:// 流式协议 URL
  file?: File; // Web 下为 File 对象
}

export interface ScanProgress {
  totalFolders: number;
  currentFolderIndex: number;
  currentFolderName: string;
}

export interface IFileSystemAdapter {
  readonly isTauri: boolean;

  /**
   * 检查当前环境是否支持该文件系统适配器
   */
  isSupported(): boolean;

  /**
   * 弹出目录选择对话框
   */
  selectDirectory(): Promise<DirectoryRef | null>;

  /**
   * 验证目录读写权限
   */
  verifyPermission(target: DirectoryRef, mode?: 'read' | 'readwrite'): Promise<boolean>;

  /**
   * 获取视频可播放媒体源
   */
  getVideoSource(
    target: DirectoryRef,
    folderName: string,
    fileName: string
  ): Promise<VideoMediaSource>;

  /**
   * 获取图片 Blob
   */
  getImageBlob(target: DirectoryRef, folderName: string, fileName: string): Promise<Blob | null>;

  /**
   * 读取 data.json 元数据
   */
  getDataJson(
    target: DirectoryRef,
    folderName: string,
    fileName?: string
  ): Promise<Record<string, unknown> | null>;

  /**
   * 写入 data.json 元数据
   */
  saveDataJson(
    target: DirectoryRef,
    folderName: string,
    data: Record<string, unknown>,
    fileName?: string
  ): Promise<void>;

  /**
   * 同步视频片段列表与信息至 data.json
   */
  syncVideoClipsToDataJson(
    target: DirectoryRef,
    video: Pick<Video, 'folderName' | 'name' | 'category'>,
    clips: Clip[]
  ): Promise<void>;

  /**
   * 更新视频名称至 data.json
   */
  updateVideoNameInDataJson(target: DirectoryRef, folderName: string, name: string): Promise<void>;

  /**
   * 标记视频隐藏至 data.json
   */
  hideVideoInDataJson(target: DirectoryRef, folderName: string): Promise<void>;

  /**
   * 扫描目录中的视频并生成缩略图与索引
   */
  scanVideos(target: DirectoryRef, onProgress?: (progress: ScanProgress) => void): Promise<Video[]>;
}
