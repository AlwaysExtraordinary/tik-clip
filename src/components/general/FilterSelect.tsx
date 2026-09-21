import React from 'react';
import { Select, ListBox } from '@heroui/react';
import { Icon } from '@iconify/react';
import { cn } from '@/utils/cn';

export interface FilterSelectProps {
  /** 当前选中的值，为 null 或 'all' 时代表默认项 */
  value: string | null;
  /** 选中值发生变更时的回调函数 */
  onChange: (value: string | null) => void;
  /** 前置图标名称（如 'lucide:folder', 'lucide:user', 'lucide:tag'） */
  icon: string;
  /** 默认选项显示的文案（如“全部类别”、“全部演员”、“默认”） */
  defaultLabel: string;
  /** 可供选择的选项字符串列表 */
  options: string[];
  /** 占位符提示文本（可选） */
  placeholder?: string;
  /** 无障碍标签文本（可选） */
  ariaLabel?: string;
  /** 是否展示默认值文本 (可选) */
  isShowDefautText?: boolean;
  /** 触发紧凑仅图标显示的宽度收缩断点（默认为 '500px'） */
  shrinkPoint?: string | number;
  /** 自定义外层触发器容器样式（可选） */
  className?: string;
}

// 常见断点与 Tailwind 响应式隐藏类映射
const shrinkClassMap: Record<string, string> = {
  sm: 'max-sm:hidden',
  md: 'max-md:hidden',
  lg: 'max-lg:hidden',
};

/**
 * 根据配置项获取收缩隐藏类名
 * @param point 收缩断点（如 '500px', '768px', 768 等）
 */
const getShrinkPointClass = (point?: string | number): string => {
  if (!point) return 'max-[500px]:hidden';
  const str = typeof point === 'number' ? `${point}px` : point;
  return shrinkClassMap[str] || `max-[${str}]:hidden`;
};

/**
 * 通用圆角胶囊风格筛选选择器组件
 * 专用于视频列表与片段流中的类别、演员、标签等多维度条件筛选
 * 选中默认项时文本与图标自适应呈现 text-foreground-muted，选中具体项时高亮
 */
export const FilterSelect: React.FC<FilterSelectProps> = ({
  value,
  onChange,
  icon,
  defaultLabel,
  options,
  placeholder,
  ariaLabel,
  className,
  isShowDefautText = true,
  shrinkPoint = '500px',
}) => {
  const isDefault = !value || value === 'all';

  return (
    <Select
      value={value || 'all'}
      onChange={(key) => {
        const strKey = key as string | null;
        onChange(!strKey || strKey === 'all' ? null : strKey);
      }}
      placeholder={placeholder || defaultLabel}
      aria-label={ariaLabel || placeholder || defaultLabel}
    >
      <Select.Trigger className={cn('text-xs rounded-full min-h-0 py-1.5', className)}>
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <Icon
            icon={icon}
            className={cn(
              'size-3.5 shrink-0',
              isDefault ? 'text-foreground-muted' : 'text-foreground'
            )}
          />
          <Select.Value
            className={cn(
              getShrinkPointClass(shrinkPoint),
              'max-w-12 truncate text-[11px] sm:text-[12px] sm:max-w-20 lg:max-w-30',
              isDefault
                ? `text-foreground-muted ${isShowDefautText ? '' : 'hidden'}`
                : 'text-foreground font-medium'
            )}
          />
        </div>
        <Select.Indicator className="text-foreground-muted" />
      </Select.Trigger>
      <Select.Popover className="rounded-xl">
        <ListBox>
          <ListBox.Item
            id="all"
            textValue={defaultLabel}
            className={cn(
              'text-[11px] sm:text-[12px] min-h-0 py-1 rounded-md transition-colors cursor-pointer',
              'data-[selected=true]:bg-accent/15 data-[selected=true]:text-accent data-[selected=true]:font-medium',
              isDefault
                ? 'bg-accent/15 text-accent font-medium hover:bg-accent/20'
                : 'text-foreground-muted hover:text-foreground'
            )}
          >
            <span>{defaultLabel}</span>
          </ListBox.Item>
          {options.map((option) => {
            const isSelected = value === option;
            return (
              <ListBox.Item
                key={option}
                id={option}
                textValue={option}
                className={cn(
                  'text-[11px] sm:text-[12px] min-h-0 py-1 rounded-md transition-colors cursor-pointer',
                  'data-[selected=true]:bg-accent/15 data-[selected=true]:text-accent data-[selected=true]:font-medium',
                  isSelected
                    ? 'bg-accent/15 text-accent font-medium hover:bg-accent/20'
                    : 'text-foreground hover:text-foreground'
                )}
              >
                <span>{option}</span>
              </ListBox.Item>
            );
          })}
        </ListBox>
      </Select.Popover>
    </Select>
  );
};
