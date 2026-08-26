import Dexie, { type Table } from 'dexie';
import { Video } from '@/types/video';
import { Clip } from '@/types/clip';
import { StoredSettingsEntry } from '@/types/settings';

/**
 * TikClip 客户端 Dexie 数据库
 * 管理视频、剪辑片段以及用户设置相关的本地持久化存储
 */
export class TikClipDatabase extends Dexie {
  /** 视频数据表 */
  videos!: Table<Video, string>;
  /** 剪辑片段数据表 */
  clips!: Table<Clip, string>;
  /** 系统及应用设置数据表 */
  settings!: Table<StoredSettingsEntry, string>;

  /**
   * 初始化数据库并定义表结构与索引
   */
  constructor() {
    super('TikClipDatabase');
    this.version(1).stores({
      videos: 'id, name, folderName, fileName, clipsCount, updatedAt',
      clips: 'id, videoId, startTime, endTime, createdAt',
      settings: 'key',
    });
  }
}

/** 数据库全局单例 */
export const db = new TikClipDatabase();
