import { ShuffleItem } from '@/types/clip';

/**
 * Fisher-Yates 洗牌算法
 */
export function shuffleArray<T>(items: T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * 确定性无限洗牌播放队列：
 * 1. 维护平铺的播放列表序列，按需自动扩充洗牌批次；
 * 2. 同一索引（Index）处的内容恒定不变，彻底解决预载首帧与实际播放画面不一致的问题；
 * 3. 支持无缝的前进、回退与增量同步。
 */
export class ShuffleQueue {
  private rawItems: ShuffleItem[] = [];
  private playlist: ShuffleItem[] = [];
  private currentIndex = 0;

  /**
   * 设置原始片段列表并重置队列
   */
  public setItems(items: ShuffleItem[]) {
    this.rawItems = items;
    this.reset();
  }

  /**
   * 重置播放列表
   */
  public reset() {
    this.playlist = this.rawItems.length > 0 ? shuffleArray(this.rawItems) : [];
    this.currentIndex = 0;
  }

  /**
   * 增量同步最新的片段列表，保留现有的播放队列游标
   */
  public syncItems(items: ShuffleItem[], currentClipId?: string) {
    this.rawItems = items;
    if (items.length === 0) {
      this.playlist = [];
      this.currentIndex = 0;
      return;
    }

    const itemMap = new Map<string, ShuffleItem>();
    items.forEach((it) => itemMap.set(it.clip.id, it));

    // 更新 playlist 中已有项，过滤已删除项
    this.playlist = this.playlist
      .filter((it) => itemMap.has(it.clip.id))
      .map((it) => itemMap.get(it.clip.id)!);

    // 如果更新后为空，重新生成
    if (this.playlist.length === 0) {
      this.playlist = shuffleArray(items);
    }

    if (currentClipId) {
      const idx = this.playlist.findIndex((it) => it.clip.id === currentClipId);
      if (idx !== -1) {
        this.currentIndex = idx;
      }
    }
  }

  /**
   * 确保指定索引位置存在片段数据（按需动态追加洗牌批次）
   */
  private ensureCapacity(index: number) {
    if (this.rawItems.length === 0) return;
    while (this.playlist.length <= index + 5) {
      const lastItem = this.playlist[this.playlist.length - 1];
      const nextBatch = shuffleArray(this.rawItems);
      // 避免新批次的首项与上一批次末项重复
      if (nextBatch.length > 1 && nextBatch[0].clip.id === lastItem?.clip.id) {
        const swapIdx = 1 + Math.floor(Math.random() * (nextBatch.length - 1));
        [nextBatch[0], nextBatch[swapIdx]] = [nextBatch[swapIdx], nextBatch[0]];
      }
      this.playlist.push(...nextBatch);
    }
  }

  /**
   * 获取指定索引位置的片段项（确定性读取，保证预载与播放绝对一致）
   */
  public getItemAt(index: number): ShuffleItem | null {
    if (index < 0 || this.rawItems.length === 0) return null;
    this.ensureCapacity(index);
    return this.playlist[index] ?? null;
  }

  public get totalCount(): number {
    return this.rawItems.length;
  }

  public get hasItems(): boolean {
    return this.rawItems.length > 0;
  }

  public get currentIndexValue(): number {
    return this.currentIndex;
  }

  public setIndex(index: number) {
    this.currentIndex = Math.max(0, index);
  }

  public current(): ShuffleItem | null {
    return this.getItemAt(this.currentIndex);
  }

  public next(): ShuffleItem | null {
    if (this.rawItems.length === 0) return null;
    this.currentIndex++;
    return this.getItemAt(this.currentIndex);
  }

  public previous(): ShuffleItem | null {
    if (this.currentIndex <= 0) return this.getItemAt(0);
    this.currentIndex--;
    return this.getItemAt(this.currentIndex);
  }

  public peekNext(): ShuffleItem | null {
    return this.getItemAt(this.currentIndex + 1);
  }

  public peekPrevious(): ShuffleItem | null {
    return this.currentIndex > 0 ? this.getItemAt(this.currentIndex - 1) : null;
  }
}
