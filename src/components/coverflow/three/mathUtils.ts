/**
 * @file mathUtils.ts
 * @description 3D Coverflow 动画插值与物理动力学数学工具函数
 * 提供三次贝塞尔平滑缓动曲线（Ease-In-Out Cubic）与数值区间约束函数。
 */

/**
 * 平滑缓动函数 (Ease-In-Out，支持自定义曲线强度)
 * @param t 当前归一化进度 [0, 1]
 * @param intensity 缓动强度/幂次 (默认 3 为三次立方缓动，数值越大起止越平缓、中间加速越陡峭)
 */
export function easeInOutCubic(t: number, intensity = 3): number {
  return t < 0.5
    ? Math.pow(2, intensity - 1) * Math.pow(t, intensity)
    : 1 - Math.pow(-2 * t + 2, intensity) / 2;
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
