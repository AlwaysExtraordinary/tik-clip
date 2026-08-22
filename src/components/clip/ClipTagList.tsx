import React, { useMemo, useRef, useState, useCallback, useLayoutEffect, useEffect } from 'react';

interface ClipTagListProps {
  tags?: string[];
}

export const ClipTagList: React.FC<ClipTagListProps> = ({ tags }) => {
  const validTags = useMemo(() => {
    return tags?.filter((t) => Boolean(t?.trim())) || [];
  }, [tags]);

  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState<number>(validTags.length);

  const updateVisibleCount = useCallback(() => {
    if (!containerRef.current || !measureRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    if (containerWidth <= 0) return;

    const measureItems = measureRef.current.children;
    if (measureItems.length === 0) return;

    const ellipsisEl = measureItems[measureItems.length - 1] as HTMLElement;
    const ellipsisWidth = ellipsisEl ? ellipsisEl.offsetWidth : 28;
    const gap = 6; // gap-1.5 = 6px

    let totalWidth = 0;
    let count = 0;

    for (let i = 0; i < validTags.length; i++) {
      const itemEl = measureItems[i] as HTMLElement;
      const itemWidth = itemEl ? itemEl.offsetWidth : 0;
      const isFirst = count === 0;
      const currentTagWidthWithGap = isFirst ? itemWidth : gap + itemWidth;

      // 如果这是最后一个标签，不需要预留省略号空间
      if (i === validTags.length - 1) {
        if (totalWidth + currentTagWidthWithGap <= containerWidth) {
          count++;
          break;
        }
      }

      // 如果后续还有标签，需保证能放下当前标签以及省略号
      if (totalWidth + currentTagWidthWithGap + gap + ellipsisWidth <= containerWidth) {
        count++;
        totalWidth += currentTagWidthWithGap;
      } else {
        break;
      }
    }

    setVisibleCount(count);
  }, [validTags]);

  useLayoutEffect(() => {
    updateVisibleCount();
  }, [updateVisibleCount]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      updateVisibleCount();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateVisibleCount]);

  if (validTags.length === 0) return null;

  const visibleTags = validTags.slice(0, visibleCount);
  const hiddenTags = validTags.slice(visibleCount);

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1 overflow-hidden">
      {/* 隐藏的测量容器 */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="absolute top-0 left-0 invisible pointer-events-none flex items-center gap-1.5 whitespace-nowrap"
      >
        {validTags.map((tag, idx) => (
          <span
            key={idx}
            className="text-xs px-2 py-0.5 rounded-full bg-surface-active text-foreground-muted font-medium shrink-0"
          >
            {tag}
          </span>
        ))}
        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-active text-foreground-muted font-medium shrink-0">
          ...
        </span>
      </div>

      {/* 实际渲染的标签列表 */}
      <div className="flex items-center gap-1.5">
        {visibleTags.map((tag) => (
          <span
            key={tag}
            title={tag}
            className="text-xs px-2 py-0.5 rounded-full bg-surface-hover text-foreground-muted font-medium shrink-0"
          >
            {tag}
          </span>
        ))}
        {hiddenTags.length > 0 && (
          <span
            title={hiddenTags.join(', ')}
            className="text-xs px-2 py-0.5 rounded-full bg-surface-hover text-foreground-muted font-medium shrink-0 cursor-default"
          >
            ...
          </span>
        )}
      </div>
    </div>
  );
};
