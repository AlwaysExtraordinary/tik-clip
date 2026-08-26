import { db } from '@/db/database';
import { Clip } from '@/types/clip';
import { updateVideoClipsCount } from '@/db/videos';

/**
 * 获取数据库中所有的视频片段
 * @returns 所有片段列表
 */
export async function getAllClips(): Promise<Clip[]> {
  return await db.clips.toArray();
}

/**
 * 根据视频 ID 获取该视频下所有的剪辑片段
 * @param videoId 视频 ID
 * @returns 按开始时间（startTime）升序排序的片段列表
 */
export async function getClipsByVideoId(videoId: string): Promise<Clip[]> {
  return await db.clips.where('videoId').equals(videoId).sortBy('startTime');
}

/**
 * 保存或更新剪辑片段，并自动同步更新对应视频的片段统计数量
 * @param clip 要保存的片段数据
 */
export async function saveClip(clip: Clip): Promise<void> {
  await db.clips.put(clip);
  // 更新视频关联的片段数量
  const count = await db.clips.where('videoId').equals(clip.videoId).count();
  await updateVideoClipsCount(clip.videoId, count);
}

/**
 * 根据片段 ID 删除指定的剪辑片段，并同步更新对应视频的片段统计数量
 * @param id 要删除的片段 ID
 * @param videoId 所属视频 ID
 */
export async function deleteClip(id: string, videoId: string): Promise<void> {
  await db.clips.delete(id);
  // 更新视频关联的片段数量
  const count = await db.clips.where('videoId').equals(videoId).count();
  await updateVideoClipsCount(videoId, count);
}

/**
 * 删除指定视频关联的所有剪辑片段，并将视频片段统计数重置为 0
 * @param videoId 视频 ID
 */
export async function deleteClipsByVideoId(videoId: string): Promise<void> {
  await db.clips.where('videoId').equals(videoId).delete();
  await updateVideoClipsCount(videoId, 0);
}
