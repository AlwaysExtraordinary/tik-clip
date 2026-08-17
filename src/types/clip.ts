import { Video } from '@/types/video';

export interface Clip {
  id: string;
  videoId: string;
  startTime: number;
  endTime: number;
  createdAt: number;
  updatedAt: number;
}

export interface ShuffleItem {
  clip: Clip;
  video: Video;
}
