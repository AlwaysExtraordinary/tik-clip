/** 常见分隔符正则表达式（支持逗号、中文逗号、斜杠、顿号、分号及空白字符） */
export const TAG_SPLIT_REGEX = /[,，/、;\s]+/;

/**
 * 将字符串或字符串数组按常见分隔符切分为非空标签数组
 * @param value 待切分的字符串、字符串数组或空值
 * @returns 切分并去除首尾空白后的非空字符串数组
 */
export function parseTagList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (typeof item === 'string' ? item.split(TAG_SPLIT_REGEX) : []))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(TAG_SPLIT_REGEX)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}
