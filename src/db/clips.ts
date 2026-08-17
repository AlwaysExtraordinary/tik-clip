import { db } from '@/db/database';
import { Clip } from '@/types/clip';
import { updateVideoClipsCount } from '@/db/videos';

export async function getAllClips(): Promise<Clip[]> {
  return await db.clips.toArray();
}

export async function getClipsByVideoId(videoId: string): Promise<Clip[]> {
  return await db.clips.where('videoId').equals(videoId).sortBy('startTime');
}

export async function saveClip(clip: Clip): Promise<void> {
  await db.clips.put(clip);
  // 更新视频关联的片段数量
  const count = await db.clips.where('videoId').equals(clip.videoId).count();
  await updateVideoClipsCount(clip.videoId, count);
}

export async function deleteClip(id: string, videoId: string): Promise<void> {
  await db.clips.delete(id);
  // 更新视频关联的片段数量
  const count = await db.clips.where('videoId').equals(videoId).count();
  await updateVideoClipsCount(videoId, count);
}

export async function deleteClipsByVideoId(videoId: string): Promise<void> {
  await db.clips.where('videoId').equals(videoId).delete();
  await updateVideoClipsCount(videoId, 0);
}
