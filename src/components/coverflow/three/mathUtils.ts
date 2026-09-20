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

/**
 * 具有回弹过冲特性的缓动函数 (Ease-Out-Back)
 * 产生平滑到达并在末端带有轻微惯性回弹的物理质感
 * @param t 当前归一化进度 [0, 1]
 * @param s 回弹过冲强度系数 (默认 1.35)
 */
export function easeOutBack(t: number, s = 1.35): number {
  const c1 = s;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * 具有平滑起止特性的非对称惯性冲击与阻尼恢复脉冲函数
 * 适用于物体受力冲击位移后平滑复原物理质感（C1 连续，起止速度与加速度平滑归零）
 * @param u 归一化进度 [0, 1]
 * @param attackRatio 冲击达到峰值的时间比例 (默认 0.35)
 */
export function smoothInertiaPulse(u: number, attackRatio = 0.35): number {
  if (u <= 0 || u >= 1) return 0;
  if (u < attackRatio) {
    const p = u / attackRatio;
    return Math.pow(Math.sin((Math.PI / 2) * p), 2);
  } else {
    const p = (u - attackRatio) / (1 - attackRatio);
    return 0.5 * (1 + Math.cos(Math.PI * p));
  }
}

/**
 * 将任意弧度角归一化至 (-π, π] 区间
 * @param angle 待归一化的弧度值
 */
export function normalizeAngle(angle: number): number {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}
