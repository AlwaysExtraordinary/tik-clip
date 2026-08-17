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

export class ShuffleQueue {
  private rawItems: ShuffleItem[] = [];
  private shuffledQueue: ShuffleItem[] = [];
  private history: ShuffleItem[] = [];
  private currentIndex = -1;

  public setItems(items: ShuffleItem[]) {
    this.rawItems = items;
    this.reset();
  }

  public reset() {
    this.shuffledQueue = shuffleArray(this.rawItems);
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * 增量同步最新的片段列表，同时保留现有的播放队列游标和历史记录
   */
  public syncItems(items: ShuffleItem[], currentClipId?: string) {
    this.rawItems = items;
    const itemMap = new Map<string, ShuffleItem>();
    items.forEach((it) => itemMap.set(it.clip.id, it));

    // 1. 同步 history：移除已不存在的，更新已更改的
    this.history = this.history
      .filter((it) => itemMap.has(it.clip.id))
      .map((it) => itemMap.get(it.clip.id)!);

    // 2. 同步 shuffledQueue：更新已更改的，移除已删除的
    const updatedQueue: ShuffleItem[] = [];
    const seenIds = new Set<string>();

    for (const queueItem of this.shuffledQueue) {
      const latest = itemMap.get(queueItem.clip.id);
      if (latest) {
        updatedQueue.push(latest);
        seenIds.add(latest.clip.id);
      }
    }

    // 将新增的片段洗牌后追加到未播队列后方
    const newItems = items.filter((it) => !seenIds.has(it.clip.id));
    if (newItems.length > 0) {
      updatedQueue.push(...shuffleArray(newItems));
    }

    this.shuffledQueue = updatedQueue;

    // 3. 如果指定了当前 clipId，将游标指向该项
    if (currentClipId && this.shuffledQueue.length > 0) {
      const idx = this.shuffledQueue.findIndex((it) => it.clip.id === currentClipId);
      if (idx !== -1) {
        this.currentIndex = idx;
      } else {
        this.currentIndex = Math.min(this.currentIndex, this.shuffledQueue.length - 1);
      }
    } else {
      this.currentIndex = Math.min(Math.max(-1, this.currentIndex), this.shuffledQueue.length - 1);
    }
  }

  public get totalCount(): number {
    return this.rawItems.length;
  }

  public get hasItems(): boolean {
    return this.rawItems.length > 0;
  }

  /**
   * 获取下一个片段。
   * 如果当前队列到达末尾，则重新洗牌所有项目并继续播放，
   * 同时确保新队列的首项不与上一轮最后播放的片段重复。
   */
  public next(): ShuffleItem | null {
    if (this.rawItems.length === 0) return null;
    if (this.rawItems.length === 1) return this.rawItems[0];

    this.currentIndex++;

    if (this.currentIndex >= this.shuffledQueue.length) {
      const lastItem = this.shuffledQueue[this.shuffledQueue.length - 1];
      const newQueue = shuffleArray(this.rawItems);

      // 如果新队列的首项与上一项相同，则与其它项交换
      if (newQueue.length > 1 && newQueue[0].clip.id === lastItem?.clip.id) {
        const swapIndex = 1 + Math.floor(Math.random() * (newQueue.length - 1));
        [newQueue[0], newQueue[swapIndex]] = [newQueue[swapIndex], newQueue[0]];
      }

      this.shuffledQueue = newQueue;
      this.currentIndex = 0;
    }

    const current = this.shuffledQueue[this.currentIndex];
    this.history.push(current);
    return current;
  }

  /**
   * 预查看下一个片段（不改变队列指针）
   */
  public peekNext(): ShuffleItem | null {
    if (this.rawItems.length === 0) return null;
    if (this.rawItems.length === 1) return this.rawItems[0];
    const nextIndex = this.currentIndex + 1;
    if (nextIndex < this.shuffledQueue.length) {
      return this.shuffledQueue[nextIndex];
    }
    return this.rawItems[0] || null;
  }

  /**
   * 预查看上一个片段（不改变历史记录）
   */
  public peekPrevious(): ShuffleItem | null {
    if (this.history.length > 1) {
      return this.history[this.history.length - 2];
    }
    return this.history[0] || null;
  }

  /**
   * 从历史记录中获取上一个片段
   */
  public previous(): ShuffleItem | null {
    if (this.history.length > 1) {
      this.history.pop(); // 移除当前项
      const prev = this.history[this.history.length - 1];
      return prev;
    }
    return this.history[0] || null;
  }
}
