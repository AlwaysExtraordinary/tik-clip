/**
 * 64 位双种子哈希实现（cyrb53 变体）。
 * 产生两个 32 位哈希值以提供 64 位熵，具备高雪崩效应与抗碰撞性。
 */
function hash64(str: string, seed = 0): { h1: number; h2: number } {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return {
    h1: h1 >>> 0,
    h2: h2 >>> 0,
  };
}

/**
 * 生成指定长度的随机纯字母数字字符串。
 * 可用时优先使用 Web Crypto API 以获得高密码学随机性。
 *
 * @param length 随机字符串长度（默认：8）
 * @param charset 字符集（默认：小写字母数字 '0123456789abcdefghijklmnopqrstuvwxyz'）
 */
export function generateRandomAlphanumeric(
  length = 8,
  charset = '0123456789abcdefghijklmnopqrstuvwxyz'
): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buffer = new Uint8Array(length);
    crypto.getRandomValues(buffer);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset[buffer[i] % charset.length];
    }
    return result;
  }
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[Math.floor(Math.random() * charset.length)];
  }
  return result;
}

/**
 * 根据视频的相对路径生成稳定、确定性的唯一视频 ID。
 * 返回纯字母数字字符串（例如 vid + 14 位 base36 哈希）。
 *
 * @param folderName 视频所在的文件夹名称
 * @param fileName 视频文件名
 */
export function generateVideoId(folderName: string, fileName: string): string {
  const normalizedKey = `${folderName.trim()}/${fileName.trim()}`.toLowerCase();
  const { h1, h2 } = hash64(normalizedKey);
  const part1 = h1.toString(36).padStart(7, '0');
  const part2 = h2.toString(36).padStart(7, '0');
  return `vid${part1}${part2}`;
}

/**
 * 生成包含时间戳和随机字母数字后缀的唯一片段（Clip）ID。
 * 返回纯字母数字字符串（例如 clip + timestamp36 + random）。
 */
export function generateClipId(): string {
  const timestamp = Date.now().toString(36);
  const randomSuffix = generateRandomAlphanumeric(8);
  return `clip${timestamp}${randomSuffix}`;
}
