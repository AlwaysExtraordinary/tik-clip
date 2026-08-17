import { Video } from '@/types/video';
import { Clip } from '@/types/clip';
import { generateVideoId, generateClipId } from '@/utils/id';
import { generateVideoThumbnail, getVideoDuration } from '@/services/thumbnail';
import { deleteVideos, getVideoById, saveVideos } from '@/db/videos';
import { db } from '@/db/database';

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

export interface ScanProgress {
  totalFolders: number;
  currentFolderIndex: number;
  currentFolderName: string;
}

export async function scanVideoDirectory(
  rootDirHandle: FileSystemDirectoryHandle,
  onProgress?: (progress: ScanProgress) => void
): Promise<Video[]> {
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
        // 该文件夹中未找到视频文件，跳过
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
                createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
                updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : Date.now(),
              }));
          }
        } catch (e) {
          console.warn(`Failed to parse data.json in ${folderName}:`, e);
        }
      }

      // 同步片段到数据库，并计算片段数量
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

          // 检查封面文件是否与已缓存记录一致且未被修改
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

        // 获取时长：若视频文件未被修改则复用缓存的时长
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
        // 文件夹中不存在封面图片。
        // 若原有记录曾有封面或缺少缩略图，则从视频重新截取生成缩略图。
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

  // 批量保存到数据库
  if (scannedVideos.length > 0) {
    await saveVideos(scannedVideos);
  }

  // 清理目录中已不存在的陈旧视频索引及其关联片段
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
