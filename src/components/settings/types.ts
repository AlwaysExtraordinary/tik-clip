/**
 * @file types.ts
 * @description 设置弹窗与各分类模块的通用类型定义
 */

export type SettingCategory = 'general' | 'playback' | 'coverflow';

export interface SettingTabItem {
  id: SettingCategory;
  label: string;
  icon: string;
}
