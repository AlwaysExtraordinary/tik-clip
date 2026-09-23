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

/** 防抖配置选项 */
export interface DebounceOptions {
  /** 是否在延迟周期的起始边缘立即调用，默认为 false */
  leading?: boolean;
  /** 是否在延迟周期的结束边缘调用，默认为 true */
  trailing?: boolean;
  /** 允许被延迟的最大时间（毫秒） */
  maxWait?: number;
}

/** 节流配置选项 */
export interface ThrottleOptions {
  /** 是否在节流周期的起始边缘立即调用，默认为 true */
  leading?: boolean;
  /** 是否在节流周期的结束边缘调用，默认为 true */
  trailing?: boolean;
}

/** 包装后的防抖/节流函数接口，带有取消、立即执行和待处理检查方法 */
export interface DebouncedFunction<T extends (...args: never[]) => unknown> {
  (...args: Parameters<T>): void;
  /** 取消当前延迟的调用 */
  cancel: () => void;
  /** 立即执行当前挂起的调用（若有） */
  flush: () => ReturnType<T> | undefined;
  /** 检查当前是否有挂起的调用未执行 */
  pending: () => boolean;
}

export type ThrottledFunction<T extends (...args: never[]) => unknown> = DebouncedFunction<T>;

/**
 * 创建一个防抖函数，该函数会从上一次被调用后延迟 wait 毫秒后调用原函数
 * @param fn 需要防抖的目标函数
 * @param wait 需要延迟的毫秒数
 * @param options 配置选项（leading, trailing, maxWait）
 * @returns 包装后的防抖函数
 */
export function debounce<T extends (...args: never[]) => unknown>(
  fn: T,
  wait: number,
  options: DebounceOptions = {}
): DebouncedFunction<T> {
  const { leading = false, trailing = true, maxWait } = options;
  const hasMaxWait = typeof maxWait === 'number';

  let timerId: ReturnType<typeof setTimeout> | null = null;
  let maxTimerId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime: number | null = null;
  let result: ReturnType<T> | undefined;

  // 执行目标函数并记录返回值
  function invoke(): ReturnType<T> | undefined {
    const args = lastArgs;
    lastArgs = null;
    if (args) {
      result = fn(...args) as ReturnType<T>;
    }
    return result;
  }

  // 清除防抖相关定时器
  function clearTimers(): void {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (maxTimerId !== null) {
      clearTimeout(maxTimerId);
      maxTimerId = null;
    }
  }

  // 延迟等待时间到期处理
  function timerExpired(): void {
    const time = Date.now();
    const timeSinceLastCall = lastCallTime === null ? 0 : time - lastCallTime;

    if (timeSinceLastCall < wait && timeSinceLastCall >= 0) {
      timerId = setTimeout(timerExpired, wait - timeSinceLastCall);
    } else {
      clearTimers();
      if (trailing && lastArgs) {
        invoke();
      } else {
        lastArgs = null;
      }
    }
  }

  // 达到允许的最大延迟时间时强制触发
  function maxTimerExpired(): void {
    clearTimers();
    if (trailing && lastArgs) {
      invoke();
    } else {
      lastArgs = null;
    }
  }

  // 防抖包装入口函数
  function debounced(...args: Parameters<T>): void {
    const time = Date.now();
    lastArgs = args;
    lastCallTime = time;

    const isInvoking = timerId === null;

    if (isInvoking) {
      if (leading) {
        invoke();
      }
      timerId = setTimeout(timerExpired, wait);
      if (hasMaxWait && maxTimerId === null) {
        maxTimerId = setTimeout(maxTimerExpired, maxWait);
      }
    } else {
      if (timerId !== null) {
        clearTimeout(timerId);
      }
      timerId = setTimeout(timerExpired, wait);
    }
  }

  // 取消延迟执行
  debounced.cancel = (): void => {
    clearTimers();
    lastArgs = null;
    lastCallTime = null;
  };

  // 立即触发挂起的执行
  debounced.flush = (): ReturnType<T> | undefined => {
    if (timerId !== null || maxTimerId !== null) {
      clearTimers();
      if (lastArgs) {
        return invoke();
      }
    }
    return result;
  };

  // 查询是否有挂起的延迟执行
  debounced.pending = (): boolean => {
    return timerId !== null || maxTimerId !== null;
  };

  return debounced;
}

/**
 * 创建一个节流函数，在 wait 毫秒内最多执行一次
 * @param fn 需要节流的目标函数
 * @param wait 节流间隔时间（毫秒）
 * @param options 配置选项（leading 默认为 true，trailing 默认为 true）
 * @returns 包装后的节流函数
 */
export function throttle<T extends (...args: never[]) => unknown>(
  fn: T,
  wait: number,
  options: ThrottleOptions = {}
): ThrottledFunction<T> {
  const { leading = true, trailing = true } = options;

  let timerId: ReturnType<typeof setTimeout> | null = null;
  let lastExecTime = 0;
  let lastArgs: Parameters<T> | null = null;
  let result: ReturnType<T> | undefined;

  // 清除节流定时器
  function clearTimer(): void {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  // 节流包装入口函数
  function throttled(...args: Parameters<T>): void {
    const now = Date.now();
    lastArgs = args;

    if (lastExecTime === 0 && !leading) {
      lastExecTime = now;
    }

    const remaining = wait - (now - lastExecTime);

    if (remaining <= 0 || remaining > wait) {
      clearTimer();
      lastExecTime = now;
      const currentArgs = lastArgs;
      lastArgs = null;
      if (currentArgs) {
        result = fn(...currentArgs) as ReturnType<T>;
      }
    } else if (trailing && timerId === null) {
      timerId = setTimeout(() => {
        timerId = null;
        lastExecTime = leading ? Date.now() : 0;
        const currentArgs = lastArgs;
        lastArgs = null;
        if (trailing && currentArgs) {
          result = fn(...currentArgs) as ReturnType<T>;
        }
      }, remaining);
    }
  }

  // 取消节流调用
  throttled.cancel = (): void => {
    clearTimer();
    lastExecTime = 0;
    lastArgs = null;
  };

  // 立即触发挂起的节流调用
  throttled.flush = (): ReturnType<T> | undefined => {
    if (timerId !== null) {
      clearTimer();
      if (lastArgs) {
        const currentArgs = lastArgs;
        lastArgs = null;
        lastExecTime = Date.now();
        result = fn(...currentArgs) as ReturnType<T>;
      }
    }
    return result;
  };

  // 查询是否有挂起的节流调用
  throttled.pending = (): boolean => {
    return timerId !== null;
  };

  return throttled;
}
