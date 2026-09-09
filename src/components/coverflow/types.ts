import { Video } from '@/types/video';

/** 视图状态枚举：列表侧视 -> 正面展开 -> 放大聚焦 */
export const VIEW_STATES = {
  LIST: 0,      // 状态 1：Coverflow 侧视图列表
  EXPANDED: 1,  // 状态 2：选中封面展开面向正面
  DETAIL: 2,    // 状态 3：单张放大聚焦视图
} as const;

export type ViewState = (typeof VIEW_STATES)[keyof typeof VIEW_STATES];

/** 列表视图模式：angled (斜角 56°) 或 vertical (垂直书脊 90°) */
export type ViewMode = 'angled' | 'vertical';

/** Coverflow 电影展示数据对象 */
export interface CoverflowMovie {
  id: string;
  title: string;
  textureUrl: string;
  category?: string;
  actor?: string;
  description?: string;
  video: Video;
}
