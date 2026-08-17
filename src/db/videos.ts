import { db } from '@/db/database';
import { Video } from '@/types/video';

export async function getAllVideos(): Promise<Video[]> {
  return await db.videos.toArray();
}

export async function getVideoById(id: string): Promise<Video | undefined> {
  return await db.videos.get(id);
}

export async function saveVideo(video: Video): Promise<void> {
  await db.videos.put(video);
}

export async function saveVideos(videos: Video[]): Promise<void> {
  await db.videos.bulkPut(videos);
}

export async function updateVideoClipsCount(videoId: string, count: number): Promise<void> {
  await db.videos.update(videoId, {
    clipsCount: count,
    updatedAt: Date.now(),
  });
}

export async function deleteVideo(id: string): Promise<void> {
  await db.transaction('rw', db.videos, db.clips, async () => {
    await db.videos.delete(id);
    await db.clips.where('videoId').equals(id).delete();
  });
}

export async function deleteVideos(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.transaction('rw', db.videos, db.clips, async () => {
    await db.videos.bulkDelete(ids);
    await db.clips.where('videoId').anyOf(ids).delete();
  });
}
