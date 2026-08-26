import { Video } from '@/types/video';
import { Clip } from '@/types/clip';
import { DirectoryRef, IFileSystemAdapter, ScanProgress, VideoMediaSource } from './types';
import { generateVideoId, generateClipId } from '@/utils/id';
import { generateVideoThumbnail, getVideoDuration } from '@/services/thumbnail';
import { deleteVideos, getVideoById, saveVideos } from '@/db/videos';
import { db } from '@/db/database';

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.mkv'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

export class WebFileSystemAdapter implements IFileSystemAdapter {
  readonly isTauri = false;

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  async selectDirectory(): Promise<DirectoryRef | null> {
    if (!this.isSupported()) {
      throw new Error(
        'Your browser does not support local folder access. Please use Chrome or Edge.'
      );
    }

    try {
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });
      return {
        name: handle.name,
        handle,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }

  async verifyPermission(
    target: DirectoryRef,
    mode: 'read' | 'readwrite' = 'read'
  ): Promise<boolean> {
    if (!target.handle) return false;
    const options: FileSystemHandlePermissionDescriptor = { mode };

    try {
      if ((await target.handle.queryPermission(options)) === 'granted') {
        return true;
      }
      if ((await target.handle.requestPermission(options)) === 'granted') {
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  async getVideoSource(
    target: DirectoryRef,
    folderName: string,
    fileName: string
  ): Promise<VideoMediaSource> {
    if (!target.handle) {
      throw new Error('Directory handle is missing');
    }
    const folderHandle = await target.handle.getDirectoryHandle(folderName);
    const fileHandle = await folderHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return {
      type: 'file',
      file,
      src: URL.createObjectURL(file),
    };
  }

  async getImageBlob(
    target: DirectoryRef,
    folderName: string,
    fileName: string
  ): Promise<Blob | null> {
    if (!target.handle) return null;
    try {
      const folderHandle = await target.handle.getDirectoryHandle(folderName);
      const fileHandle = await folderHandle.getFileHandle(fileName);
      return await fileHandle.getFile();
    } catch {
      return null;
    }
  }

  async getDataJson(
    target: DirectoryRef,
    folderName: string,
    fileName = 'data.json'
  ): Promise<Record<string, unknown> | null> {
    if (!target.handle) return null;
    try {
      const folderHandle = await target.handle.getDirectoryHandle(folderName);
      const fileHandle = await folderHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async saveDataJson(
    target: DirectoryRef,
    folderName: string,
    data: Record<string, unknown>,
    fileName = 'data.json'
  ): Promise<void> {
    if (!target.handle) {
      throw new Error('Directory handle is missing');
    }
    const folderHandle = await target.handle.getDirectoryHandle(folderName);
    const fileHandle = await folderHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2) + '\n');
    await writable.close();
  }

  async syncVideoClipsToDataJson(
    target: DirectoryRef,
    video: Pick<Video, 'folderName' | 'name' | 'category'>,
    clips: Clip[]
  ): Promise<void> {
    const existingData = (await this.getDataJson(target, video.folderName)) || {};
    const updatedData: Record<string, unknown> = {
      ...existingData,
      name: existingData.name || video.name || video.folderName,
      ...(video.category || existingData.category
        ? { category: video.category || existingData.category }
        : {}),
      clips: clips.map((clip) => ({
        id: clip.id,
        startTime: clip.startTime,
        endTime: clip.endTime,
        tags: clip.tags || [],
        createdAt: clip.createdAt,
        updatedAt: clip.updatedAt,
      })),
    };

    await this.saveDataJson(target, video.folderName, updatedData);
  }

  async updateVideoNameInDataJson(
    target: DirectoryRef,
    folderName: string,
    name: string
  ): Promise<void> {
    const existingData = (await this.getDataJson(target, folderName)) || {};
    const updatedData: Record<string, unknown> = {
      ...existingData,
      name,
    };
    await this.saveDataJson(target, folderName, updatedData);
  }

  async hideVideoInDataJson(target: DirectoryRef, folderName: string): Promise<void> {
    const existingData = (await this.getDataJson(target, folderName)) || {};
    const updatedData: Record<string, unknown> = {
      ...existingData,
      hidden: true,
    };
    await this.saveDataJson(target, folderName, updatedData);
  }

  async scanVideos(
    target: DirectoryRef,
    onProgress?: (progress: ScanProgress) => void
  ): Promise<Video[]> {
    const rootDirHandle = target.handle;
    if (!rootDirHandle) {
      throw new Error('Root directory handle is required for Web scanning');
    }

    const folders: { name: string; handle: FileSystemDirectoryHandle }[] = [];

    // 1. 收集所有一级子目录
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const [name, handle] of (rootDirHandle as any).entries()) {
      if (handle.kind === 'directory' && !name.startsWith('.')) {
        folders.push({ name, handle: handle as FileSystemDirectoryHandle });
      }
    }

    const scannedVideos: Video[] = [];

    for (let i = 0; i < folders.length; i++) {
      const { name: folderName, handle: folderHandle } = folders[i];

      if (onProgress) {
        onProgress({
          totalFolders: folders.length,
          currentFolderIndex: i + 1,
          currentFolderName: folderName,
        });
      }

      try {
        let videoFileName = '';
        let videoFileHandle: FileSystemFileHandle | null = null;
        let coverFileHandle: FileSystemFileHandle | null = null;
        let fallbackImageHandle: FileSystemFileHandle | null = null;
        let dataJsonHandle: FileSystemFileHandle | null = null;

        // 扫描子文件夹中的文件
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for await (const [fileName, fileHandle] of (folderHandle as any).entries()) {
          if (fileHandle.kind === 'file') {
            const lowerName = fileName.toLowerCase();

            // 检测视频文件
            if (!videoFileHandle && VIDEO_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
              videoFileName = fileName;
              videoFileHandle = fileHandle as FileSystemFileHandle;
            }

            // 检测封面图片（优先选择名为 cover.* 的文件）
            if (
              !coverFileHandle &&
              lowerName.startsWith('cover.') &&
              IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
            ) {
              coverFileHandle = fileHandle as FileSystemFileHandle;
            } else if (
              !fallbackImageHandle &&
              IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
            ) {
              fallbackImageHandle = fileHandle as FileSystemFileHandle;
            }

            // 检测 data.json 元数据文件
            if (lowerName === 'data.json') {
              dataJsonHandle = fileHandle as FileSystemFileHandle;
            }
          }
        }

        if (!videoFileHandle || !videoFileName) {
          continue;
        }

        const activeCoverHandle = coverFileHandle || fallbackImageHandle;
        const videoId = generateVideoId(folderName, videoFileName);
        const existingVideo = await getVideoById(videoId);

        // 如果存在 data.json 则读取元数据与片段列表
        let displayName = folderName;
        let category: string | undefined = undefined;
        let clipsFromDataJson: Clip[] | null = null;

        if (dataJsonHandle) {
          try {
            const file = await dataJsonHandle.getFile();
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (parsed.hidden === true) {
              continue;
            }
            if (parsed.name && typeof parsed.name === 'string' && parsed.name.trim()) {
              displayName = parsed.name.trim();
            }
            if (parsed.category && typeof parsed.category === 'string') {
              category = parsed.category.trim();
            }
            if (Array.isArray(parsed.clips)) {
              clipsFromDataJson = parsed.clips
                .filter(
                  (c: unknown) =>
                    typeof c === 'object' &&
                    c !== null &&
                    'startTime' in c &&
                    'endTime' in c &&
                    typeof (c as { startTime: unknown }).startTime === 'number' &&
                    typeof (c as { endTime: unknown }).endTime === 'number' &&
                    !isNaN((c as { startTime: number }).startTime) &&
                    !isNaN((c as { endTime: number }).endTime)
                )
                .map((c: Record<string, unknown>) => ({
                  id: typeof c.id === 'string' && c.id ? c.id : generateClipId(),
                  videoId,
                  startTime: Number(c.startTime),
                  endTime: Number(c.endTime),
                  tags: Array.isArray(c.tags)
                    ? c.tags
                        .filter(
                          (t: unknown): t is string => typeof t === 'string' && t.trim() !== ''
                        )
                        .map((t: string) => t.trim())
                    : undefined,
                  createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
                  updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : Date.now(),
                }));
            }
          } catch (e) {
            console.warn(`Failed to parse data.json in ${folderName}:`, e);
          }
        }

        let clipsCount = 0;
        if (clipsFromDataJson !== null) {
          await db.transaction('rw', db.clips, async () => {
            await db.clips.where('videoId').equals(videoId).delete();
            if (clipsFromDataJson && clipsFromDataJson.length > 0) {
              await db.clips.bulkPut(clipsFromDataJson);
            }
          });
          clipsCount = clipsFromDataJson.length;
        } else {
          clipsCount = await db.clips.where('videoId').equals(videoId).count();
        }

        const videoFile = await videoFileHandle.getFile();
        const videoLastModified = videoFile.lastModified;
        const videoSize = videoFile.size;

        let thumbnailBlob: Blob | undefined = undefined;
        let duration = 0;
        let hasCover = false;
        let coverLastModified: number | undefined = undefined;
        let coverSize: number | undefined = undefined;

        if (activeCoverHandle) {
          hasCover = true;
          try {
            const coverFile = await activeCoverHandle.getFile();
            coverLastModified = coverFile.lastModified;
            coverSize = coverFile.size;

            const isCoverUnchanged =
              existingVideo?.hasCover === true &&
              existingVideo.coverLastModified === coverLastModified &&
              existingVideo.coverSize === coverSize &&
              !!existingVideo.thumbnail;

            if (isCoverUnchanged) {
              thumbnailBlob = existingVideo.thumbnail;
            } else {
              thumbnailBlob = coverFile;
            }
          } catch (err) {
            console.warn(`Failed to read cover for ${folderName}:`, err);
          }

          if (
            existingVideo?.duration &&
            existingVideo.videoLastModified === videoLastModified &&
            existingVideo.videoSize === videoSize
          ) {
            duration = existingVideo.duration;
          } else {
            try {
              duration = await getVideoDuration(videoFile);
            } catch (err) {
              console.warn(`Failed to get duration for ${folderName}:`, err);
              duration = existingVideo?.duration || 0;
            }
          }
        } else {
          hasCover = false;
          const wasCoverCleared = existingVideo?.hasCover === true;
          const isVideoUnchanged =
            existingVideo?.videoLastModified === videoLastModified &&
            existingVideo.videoSize === videoSize;

          const canReuseGeneratedThumbnail =
            !wasCoverCleared &&
            isVideoUnchanged &&
            !!existingVideo?.thumbnail &&
            (existingVideo?.duration || 0) > 0 &&
            existingVideo.hasCover === false;

          if (canReuseGeneratedThumbnail) {
            thumbnailBlob = existingVideo.thumbnail;
            duration = existingVideo.duration;
          } else {
            try {
              const thumbResult = await generateVideoThumbnail(videoFile);
              thumbnailBlob = thumbResult.blob;
              duration = thumbResult.duration;
            } catch (err) {
              console.warn(`Failed to generate thumbnail for ${folderName}/${videoFileName}:`, err);
              thumbnailBlob = existingVideo?.thumbnail;
              duration = existingVideo?.duration || 0;
            }
          }
        }

        const now = Date.now();
        const video: Video = {
          id: videoId,
          name: displayName,
          folderName,
          fileName: videoFileName,
          duration: duration || 0,
          thumbnail: thumbnailBlob,
          category,
          clipsCount,
          createdAt: existingVideo?.createdAt || now,
          updatedAt: now,
          hasCover,
          coverLastModified,
          coverSize,
          videoLastModified,
          videoSize,
        };

        scannedVideos.push(video);
      } catch (folderErr) {
        console.error(`Error scanning folder ${folderName}:`, folderErr);
      }
    }

    if (scannedVideos.length > 0) {
      await saveVideos(scannedVideos);
    }

    const scannedVideoIds = new Set(scannedVideos.map((v) => v.id));
    const allExistingVideos = await db.videos.toArray();
    const staleVideoIds = allExistingVideos
      .filter((v) => !scannedVideoIds.has(v.id))
      .map((v) => v.id);

    if (staleVideoIds.length > 0) {
      await deleteVideos(staleVideoIds);
    }

    return scannedVideos;
  }
}
