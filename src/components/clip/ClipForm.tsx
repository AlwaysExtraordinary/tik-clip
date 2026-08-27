import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Input, Button, TagGroup, Tag } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { Clip } from '@/types/clip';
import { formatTime, parseTime } from '@/utils/time';
import { usePlayerStore } from '@/stores/playerStore';

interface ClipFormProps {
  videoDuration: number;
  currentVideoTime: number;
  editingClip: Clip | null;
  onSaveClip: (
    startTime: number,
    endTime: number,
    clipId?: string,
    tags?: string[]
  ) => Promise<boolean>;
  onCancelEdit: () => void;
}

export const ClipForm: React.FC<ClipFormProps> = ({
  videoDuration,
  currentVideoTime,
  editingClip,
  onSaveClip,
  onCancelEdit,
}) => {
  const { t } = useTranslation();
  const { setEditingPoint } = usePlayerStore();

  const [startStr, setStartStr] = useState('00:00:00');
  const [endStr, setEndStr] = useState('00:01:00');
  const [tags, setTags] = useState<string[]>([]);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 当编辑的片段改变时同步状态
  useEffect(() => {
    if (editingClip) {
      setStartStr(formatTime(editingClip.startTime));
      setEndStr(formatTime(editingClip.endTime));
      setTags(editingClip.tags || []);
    } else {
      // 默认从 0 到 min(60, 时长) 或当前播放时间
      setStartStr(formatTime(0));
      setEndStr(formatTime(Math.min(60, videoDuration || 60)));
      setTags([]);
    }
    setIsAddingTag(false);
    setTagInput('');
    setErrorMessage(null);
  }, [editingClip, videoDuration]);

  // 将当前视频播放时间填入当前激活的时间点
  const handleSetCurrentTimeToActivePoint = (point: 'start' | 'end') => {
    const formatted = formatTime(currentVideoTime);
    if (point === 'start') {
      setStartStr(formatted);
      setEditingPoint('start');
    } else {
      setEndStr(formatted);
      setEditingPoint('end');
    }
    setErrorMessage(null);
  };

  // 提交添加标签
  const commitAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
    setIsAddingTag(false);
  };

  // 取消添加标签
  const cancelAddTag = () => {
    setTagInput('');
    setIsAddingTag(false);
  };

  // 提交片段格式校验
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const start = parseTime(startStr);
    const end = parseTime(endStr);

    if (isNaN(start) || start < 0) {
      setErrorMessage(t('clipForm.errorInvalidStart'));
      return;
    }
    if (isNaN(end) || end <= 0) {
      setErrorMessage(t('clipForm.errorInvalidEnd'));
      return;
    }
    if (start >= end) {
      setErrorMessage(t('clipForm.errorEndBeforeStart'));
      return;
    }
    if (end - start < 0.1) {
      setErrorMessage(t('clipForm.errorTooShort'));
      return;
    }
    if (videoDuration > 0 && end > videoDuration + 0.5) {
      setErrorMessage(t('clipForm.errorExceedsDuration', { duration: formatTime(videoDuration) }));
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onSaveClip(start, end, editingClip?.id, tags);
      if (success && !editingClip) {
        // 重置表单以便继续添加下一个片段
        setStartStr(formatTime(end));
        setEndStr(formatTime(Math.min(end + 60, videoDuration || end + 60)));
        setTags([]);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(t('clipForm.errorSaveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* 时间范围输入框容器 */}
      <div className="flex items-center justify-between gap-2 px-3 py-4 bg-background rounded-2xl border border-border/60 mb-4">
        {/* 开始时间字段 */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full">
            <Input
              value={startStr}
              onChange={(e) => {
                setStartStr(e.target.value);
                setErrorMessage(null);
              }}
              onFocus={() => setEditingPoint('start')}
              className="w-full text-center text-xs font-semibold"
              placeholder="00:00:00"
            />
          </div>
          <span className="text-[10px] text-foreground-muted uppercase font-semibold">
            {t('clipForm.start')}
          </span>
          <Button
            size="sm"
            className="w-full text-xs"
            onPress={() => handleSetCurrentTimeToActivePoint('start')}
          >
            {t('clipForm.synchronize')}
          </Button>
        </div>

        {/* 分隔短横线 */}
        <span className="text-foreground-muted font-bold text-sm px-1 mb-16">—</span>

        {/* 结束时间字段 */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full">
            <Input
              value={endStr}
              onChange={(e) => {
                setEndStr(e.target.value);
                setErrorMessage(null);
              }}
              onFocus={() => setEditingPoint('end')}
              className="w-full text-center text-xs font-semibold"
              placeholder="00:01:00"
            />
          </div>
          <span className="text-[10px] text-foreground-muted uppercase font-semibold">
            {t('clipForm.end')}
          </span>
          <Button
            size="sm"
            className="w-full text-xs"
            onPress={() => handleSetCurrentTimeToActivePoint('end')}
          >
            {t('clipForm.synchronize')}
          </Button>
        </div>
      </div>

      {/* 标签管理区域 */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4 px-1 min-h-7">
        {tags.length > 0 && (
          <TagGroup
            aria-label={t('clipForm.tags')}
            size="sm"
            onRemove={(keys) => {
              const keySet = new Set(Array.from(keys));
              setTags((prev) => prev.filter((tag) => !keySet.has(tag)));
            }}
            className="contents"
          >
            <TagGroup.List className="contents">
              {tags.map((tag) => (
                <Tag
                  key={tag}
                  id={tag}
                  className="h-7 text-xs px-2.5 py-0 inline-flex items-center rounded-full"
                >
                  {tag}
                </Tag>
              ))}
            </TagGroup.List>
          </TagGroup>
        )}

        {isAddingTag ? (
          <Input
            autoFocus
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onBlur={commitAddTag}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitAddTag();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelAddTag();
              }
            }}
            className="w-24 h-7 text-xs font-medium px-2.5 py-0 rounded-full bg-surface
              focus:outline-none shrink-0"
            placeholder={t('clipForm.tagPlaceholder')}
            aria-label={t('clipForm.addTag')}
          />
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onPress={() => setIsAddingTag(true)}
            className="h-7 text-xs px-2.5 py-0 rounded-full inline-flex items-center gap-1 shrink-0"
          >
            <Icon icon="lucide:plus" className="size-3.5" />
            <span>{t('clipForm.addTag')}</span>
          </Button>
        )}
      </div>

      {/* 错误提示 */}
      {errorMessage && (
        <p className="text-[11px] text-danger font-medium text-center">{errorMessage}</p>
      )}

      {/* 提交按钮组 */}
      <div className="flex gap-2 w-95/100 m-auto">
        {editingClip && (
          <Button
            type="button"
            variant="secondary"
            className="flex-1 text-xs font-semibold"
            onPress={onCancelEdit}
          >
            {t('common.cancel')}
          </Button>
        )}
        <Button type="submit" isDisabled={isSubmitting} className="flex-1 text-xs font-semibold">
          <Icon icon={editingClip ? 'lucide:check' : 'lucide:plus'} className="size-4" />
          <span>{editingClip ? t('clipForm.saveClip') : t('clipForm.addClip')}</span>
        </Button>
      </div>
    </form>
  );
};
