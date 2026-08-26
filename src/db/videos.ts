import { db } from '@/db/database';
import { Video } from '@/types/video';

/**
 * 获取数据库中存储的所有视频列表
 * @returns 视频列表
 */
export async function getAllVideos(): Promise<Video[]> {
  return await db.videos.toArray();
}

/**
 * 根据视频 ID 获取单个视频信息
 * @param id 视频 ID
 * @returns 视频对象或未找到时返回 undefined
 */
export async function getVideoById(id: string): Promise<Video | undefined> {
  return await db.videos.get(id);
}

/**
 * 保存或更新单个视频信息
 * @param video 要保存的视频对象
 */
export async function saveVideo(video: Video): Promise<void> {
  await db.videos.put(video);
}

/**
 * 批量保存或更新视频列表
 * @param videos 要保存的视频列表
 */
export async function saveVideos(videos: Video[]): Promise<void> {
  await db.videos.bulkPut(videos);
}

/**
 * 更新指定视频的关联片段数量和更新时间
 * @param videoId 视频 ID
 * @param count 最新的片段数量
 */
export async function updateVideoClipsCount(videoId: string, count: number): Promise<void> {
  await db.videos.update(videoId, {
    clipsCount: count,
    updatedAt: Date.now(),
  });
}

/**
 * 删除指定视频及其关联的所有剪辑片段（数据库事务操作）
 * @param id 视频 ID
 */
export async function deleteVideo(id: string): Promise<void> {
  await db.transaction('rw', db.videos, db.clips, async () => {
    await db.videos.delete(id);
    await db.clips.where('videoId').equals(id).delete();
  });
}

/**
 * 批量删除指定视频及其关联的所有剪辑片段（数据库事务操作）
 * @param ids 要删除的视频 ID 列表
 */
export async function deleteVideos(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.transaction('rw', db.videos, db.clips, async () => {
    await db.videos.bulkDelete(ids);
    await db.clips.where('videoId').anyOf(ids).delete();
  });
}
