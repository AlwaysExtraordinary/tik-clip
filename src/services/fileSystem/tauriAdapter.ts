import { Video } from '@/types/video';
import { Clip } from '@/types/clip';
import { DirectoryRef, IFileSystemAdapter, ScanProgress, VideoMediaSource } from './types';
import { generateVideoId, generateClipId } from '@/utils/id';
import { generateVideoThumbnail, getVideoDuration } from '@/services/thumbnail';
import { deleteVideos, getVideoById, saveVideos } from '@/db/videos';
import { db } from '@/db/database';
import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir, readFile, readTextFile, writeTextFile, stat } from '@tauri-apps/plugin-fs';

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.mkv'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

function joinPath(base: string, ...segments: string[]): string {
  let result = base.replace(/[\\/]+$/, '');
  const isWindows = base.includes('\\') || /^[a-zA-Z]:/.test(base);
  const sep = isWindows ? '\\' : '/';

  for (const seg of segments) {
    const cleanSeg = seg.replace(/^[\\/]+/, '').replace(/[\\/]+$/, '');
    if (cleanSeg) {
      result += sep + cleanSeg;
    }
  }
  return result;
}

function getDirectoryName(fullPath: string): string {
  const normalized = fullPath.replace(/[\\/]+$/, '');
  const parts = normalized.split(/[\\/]/);
  return parts[parts.length - 1] || fullPath;
}

export class TauriFileSystemAdapter implements IFileSystemAdapter {
  readonly isTauri = true;

  isSupported(): boolean {
    return isTauri();
  }

  async selectDirectory(): Promise<DirectoryRef | null> {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择视频存储根目录',
    });

    if (!selected || typeof selected !== 'string') {
      return null;
    }

    return {
      name: getDirectoryName(selected),
      path: selected,
    };
  }

  /**
   * 静默查询目录权限状态（Tauri 下依赖本地文件路径有效性）
   */
  async queryPermission(target: DirectoryRef): Promise<boolean> {
    return Boolean(target.path);
  }

  /**
   * 请求目录权限（Tauri 原生桌面端无需浏览器弹窗）
   */
  async requestPermission(target: DirectoryRef): Promise<boolean> {
    return Boolean(target.path);
  }

  /**
   * 验证目录读写权限
   */
  async verifyPermission(target: DirectoryRef): Promise<boolean> {
    return Boolean(target.path);
  }

  async getVideoSource(
    target: DirectoryRef,
    folderName: string,
    fileName: string
  ): Promise<VideoMediaSource> {
    if (!target.path) {
      throw new Error('Directory path is missing in Tauri environment');
    }
    const fullPath = joinPath(target.path, folderName, fileName);
    const streamUrl = convertFileSrc(fullPath, 'stream');
    return {
      type: 'url',
      src: streamUrl,
    };
  }

  async getImageBlob(
    target: DirectoryRef,
    folderName: string,
    fileName: string
  ): Promise<Blob | null> {
    if (!target.path) return null;
    try {
      const fullPath = joinPath(target.path, folderName, fileName);
      const bytes = await readFile(fullPath);
      const ext = fileName.split('.').pop()?.toLowerCase() || 'jpeg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return new Blob([bytes], { type: mime });
    } catch {
      return null;
    }
  }

  async getDataJson(
    target: DirectoryRef,
    folderName: string,
    fileName = 'data.json'
  ): Promise<Record<string, unknown> | null> {
    if (!target.path) return null;
    try {
      const fullPath = joinPath(target.path, folderName, fileName);
      const text = await readTextFile(fullPath);
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
    if (!target.path) {
      throw new Error('Directory path is missing in Tauri environment');
    }
    const fullPath = joinPath(target.path, folderName, fileName);
    await writeTextFile(fullPath, JSON.stringify(data, null, 2) + '\n');
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
    const rootPath = target.path;
    if (!rootPath) {
      throw new Error('Root path is required for Tauri scanning');
    }

    // 1. 获取一级目录
    const rootEntries = await readDir(rootPath);
    const subfolders = rootEntries.filter(
      (entry) => entry.isDirectory && !entry.name.startsWith('.')
    );

    const scannedVideos: Video[] = [];

    for (let i = 0; i < subfolders.length; i++) {
      const folderName = subfolders[i].name;
      const folderFullPath = joinPath(rootPath, folderName);

      if (onProgress) {
        onProgress({
          totalFolders: subfolders.length,
          currentFolderIndex: i + 1,
          currentFolderName: folderName,
        });
      }

      try {
        const folderEntries = await readDir(folderFullPath);

        let videoFileName = '';
        let coverFileName = '';
        let fallbackImageFileName = '';
        let dataJsonFileName = '';

        for (const fileEntry of folderEntries) {
          if (fileEntry.isFile) {
            const fileName = fileEntry.name;
            const lowerName = fileName.toLowerCase();

            if (!videoFileName && VIDEO_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
              videoFileName = fileName;
            }

            if (
              !coverFileName &&
              lowerName.startsWith('cover.') &&
              IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
            ) {
              coverFileName = fileName;
            } else if (
              !fallbackImageFileName &&
              IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
            ) {
              fallbackImageFileName = fileName;
            }

            if (lowerName === 'data.json') {
              dataJsonFileName = fileName;
            }
          }
        }

        if (!videoFileName) {
          continue;
        }

        const activeCoverFileName = coverFileName || fallbackImageFileName;
        const videoId = generateVideoId(folderName, videoFileName);
        const existingVideo = await getVideoById(videoId);

        // 如果存在 data.json 则读取元数据与片段列表
        let displayName = folderName;
        let category: string | undefined = undefined;
        let clipsFromDataJson: Clip[] | null = null;

        if (dataJsonFileName) {
          try {
            const dataJsonFullPath = joinPath(folderFullPath, dataJsonFileName);
            const text = await readTextFile(dataJsonFullPath);
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

        const videoFullPath = joinPath(folderFullPath, videoFileName);
        const videoStatInfo = await stat(videoFullPath);
        const videoLastModified = videoStatInfo.mtime ? new Date(videoStatInfo.mtime).getTime() : 0;
        const videoSize = videoStatInfo.size;
        const videoStreamUrl = convertFileSrc(videoFullPath, 'stream');

        let thumbnailBlob: Blob | undefined = undefined;
        let duration = 0;
        let hasCover = false;
        let coverLastModified: number | undefined = undefined;
        let coverSize: number | undefined = undefined;

        if (activeCoverFileName) {
          hasCover = true;
          try {
            const coverFullPath = joinPath(folderFullPath, activeCoverFileName);
            const coverStatInfo = await stat(coverFullPath);
            coverLastModified = coverStatInfo.mtime ? new Date(coverStatInfo.mtime).getTime() : 0;
            coverSize = coverStatInfo.size;

            const isCoverUnchanged =
              existingVideo?.hasCover === true &&
              existingVideo.coverLastModified === coverLastModified &&
              existingVideo.coverSize === coverSize &&
              !!existingVideo.thumbnail;

            if (isCoverUnchanged) {
              thumbnailBlob = existingVideo.thumbnail;
            } else {
              const coverBytes = await readFile(coverFullPath);
              const ext = activeCoverFileName.split('.').pop()?.toLowerCase() || 'jpeg';
              const mime =
                ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
              thumbnailBlob = new Blob([coverBytes], { type: mime });
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
              duration = await getVideoDuration(videoStreamUrl);
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
              const thumbResult = await generateVideoThumbnail(videoStreamUrl);
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
