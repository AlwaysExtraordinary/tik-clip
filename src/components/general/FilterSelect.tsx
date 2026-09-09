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
  /** 自定义外层触发器容器样式（可选） */
  className?: string;
}

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
              'text-[11px] sm:text-[12px]',
              isDefault ? 'text-foreground-muted' : 'text-foreground font-medium'
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
            className="text-foreground-muted text-[11px] sm:text-[12px] min-h-0 py-1 rounded-md"
          >
            <span>{defaultLabel}</span>
            <ListBox.ItemIndicator className="text-accent" />
          </ListBox.Item>
          {options.map((option) => (
            <ListBox.Item
              key={option}
              id={option}
              textValue={option}
              className="text-[11px] sm:text-[12px] min-h-0 py-1 rounded-md"
            >
              <span>{option}</span>
              <ListBox.ItemIndicator className="text-accent" />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
};
