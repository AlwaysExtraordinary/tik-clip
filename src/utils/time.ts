/**
 * 将秒数格式化为 HH:MM:SS 或 MM:SS
 * @param seconds 总秒数
 * @param includeMs 是否包含毫秒精度（例如 00:01:23.500）
 */
export function formatTime(seconds: number, includeMs = false): string {
  if (isNaN(seconds) || seconds < 0) {
    return includeMs ? '00:00:00.000' : '00:00:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');

  let result = `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;

  if (includeMs) {
    const ms = Math.floor((seconds % 1) * 1000);
    result += `.${ms.toString().padStart(3, '0')}`;
  }

  return result;
}

/**
 * 将时间字符串（如 HH:MM:SS、HH:MM:SS.mmm 或 MM:SS）解析为秒数
 * 格式无效时返回 NaN
 */
export function parseTime(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') return NaN;
  const trimmed = timeStr.trim();

  // 如果存在毫秒部分则进行拆分
  const parts = trimmed.split('.');
  const timePart = parts[0];
  const msPart = parts[1] ? parseFloat(`0.${parts[1]}`) : 0;

  const segments = timePart.split(':').map((s) => Number(s));
  if (segments.some((n) => isNaN(n) || n < 0)) return NaN;

  if (segments.length === 3) {
    // HH:MM:SS
    const [h, m, s] = segments;
    return h * 3600 + m * 60 + s + msPart;
  } else if (segments.length === 2) {
    // MM:SS
    const [m, s] = segments;
    return m * 60 + s + msPart;
  } else if (segments.length === 1) {
    // SS
    return segments[0] + msPart;
  }

  return NaN;
}

/**
 * 格式化简短的剩余时间字符串：
 * - 1 小时及以上：显示时、分、秒（例如 "1h 12m 30s"）
 * - 小于 1 小时且大于等于 1 分钟：只显示分和秒（例如 "2m 30s"）
 * - 小于 1 分钟且大于等于 10 秒：只显示秒（例如 "45s"）
 * - 小于 10 秒：精确到 0.1 秒（例如 "9.4s", "0.0s"）
 */
export function formatSecondsShort(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0.0s';

  if (seconds < 10) {
    return `${seconds.toFixed(1)}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}min ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}min ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * 格式化片段时长显示
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}
