import Dexie, { type Table } from 'dexie';
import { Video } from '@/types/video';
import { Clip } from '@/types/clip';
import { StoredSettingsEntry } from '@/types/settings';

export class TikClipDatabase extends Dexie {
  videos!: Table<Video, string>;
  clips!: Table<Clip, string>;
  settings!: Table<StoredSettingsEntry, string>;

  constructor() {
    super('TikClipDatabase');
    this.version(1).stores({
      videos: 'id, name, folderName, fileName, clipsCount, updatedAt',
      clips: 'id, videoId, startTime, endTime, createdAt',
      settings: 'key',
    });
  }
}

export const db = new TikClipDatabase();
