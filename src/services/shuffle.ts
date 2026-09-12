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
   * 当筛选条件变动时重新构建播放列表：
   * 1. 若当前正在播放的片段存在于新的目标集合中，将其置于首位（index 0）保持平滑播放，
   *    将其余所有目标片段洗牌后紧随其后，确保后续切页立即呈现全量候选池；
   * 2. 若当前片段不在目标集合中，全量洗牌并从第 0 项开始播放。
   * @param items 最新的目标片段列表
   * @param currentClipId 当前正在播放的片段 ID（可选）
   */
  public resetWithCurrent(items: ShuffleItem[], currentClipId?: string) {
    this.rawItems = items;
    if (items.length === 0) {
      this.playlist = [];
      this.currentIndex = 0;
      return;
    }

    if (currentClipId) {
      const currentItem = items.find((it) => it.clip.id === currentClipId);
      if (currentItem) {
        const remaining = items.filter((it) => it.clip.id !== currentClipId);
        this.playlist = [currentItem, ...shuffleArray(remaining)];
        this.currentIndex = 0;
        return;
      }
    }

    this.playlist = shuffleArray(items);
    this.currentIndex = 0;
  }

  /**
   * 增量同步最新的片段列表：
   * 1. 保持当前播放队列序列稳定，原地更新已变更项，移除已删除项；
   * 2. 将新增片段洗牌后追加至队列后方；
   * 3. 精准维护当前正在播放项在队列中的索引指针（或保持在有效边界内）。
   * @param items 最新的目标片段列表
   * @param currentClipId 当前正在播放的片段 ID（可选）
   */
  public syncItems(items: ShuffleItem[], currentClipId?: string) {
    this.rawItems = items;
    if (items.length === 0) {
      this.playlist = [];
      this.currentIndex = 0;
      return;
    }

    // 若当前播放列表为空，直接重新初始化并洗牌
    if (this.playlist.length === 0) {
      this.reset();
      if (currentClipId) {
        const foundIdx = this.playlist.findIndex((it) => it.clip.id === currentClipId);
        if (foundIdx !== -1) {
          this.currentIndex = foundIdx;
        }
      }
      return;
    }

    const itemMap = new Map<string, ShuffleItem>();
    items.forEach((it) => itemMap.set(it.clip.id, it));

    // 1. 同步 playlist：原地更新已变更项，移除不再存在的项
    const updatedPlaylist: ShuffleItem[] = [];
    const seenIds = new Set<string>();

    for (const queueItem of this.playlist) {
      const latest = itemMap.get(queueItem.clip.id);
      if (latest) {
        updatedPlaylist.push(latest);
        seenIds.add(latest.clip.id);
      }
    }

    // 2. 将新增但尚未进入当前播放列表的片段洗牌后追加到后方
    const newItems = items.filter((it) => !seenIds.has(it.clip.id));
    if (newItems.length > 0) {
      updatedPlaylist.push(...shuffleArray(newItems));
    }

    this.playlist = updatedPlaylist;

    // 3. 精准定位当前播放项指针
    if (currentClipId && this.playlist.length > 0) {
      // 优先检查原当前索引位置是否依然是该片段
      if (this.playlist[this.currentIndex]?.clip.id === currentClipId) {
        // 当前索引精准匹配，无需变动
      } else {
        // 查找最接近当前索引的该片段实例
        let bestIdx = -1;
        let minDiff = Infinity;
        for (let i = 0; i < this.playlist.length; i++) {
          if (this.playlist[i].clip.id === currentClipId) {
            const diff = Math.abs(i - this.currentIndex);
            if (diff < minDiff) {
              minDiff = diff;
              bestIdx = i;
            }
          }
        }
        if (bestIdx !== -1) {
          this.currentIndex = bestIdx;
        } else {
          this.currentIndex = Math.min(this.currentIndex, this.playlist.length - 1);
        }
      }
    } else if (this.playlist.length > 0) {
      this.currentIndex = Math.min(Math.max(0, this.currentIndex), this.playlist.length - 1);
    } else {
      this.currentIndex = 0;
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
