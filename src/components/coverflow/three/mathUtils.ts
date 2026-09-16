/**
 * @file mathUtils.ts
 * @description 3D Coverflow 动画插值与物理动力学数学工具函数
 * 提供三次贝塞尔平滑缓动曲线（Ease-In-Out Cubic）与数值区间约束函数。
 */

// 三次贝塞尔缓动函数 (Ease-In-Out Cubic)
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 约束数值在 [min, max] 区间内
 * @param value 输入值
 * @param min 最小值
 * @param max 最大值
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
