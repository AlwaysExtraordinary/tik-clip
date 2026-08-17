import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Input, Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { Clip } from '@/types/clip';
import { formatTime, parseTime } from '@/utils/time';
import { usePlayerStore } from '@/stores/playerStore';

interface ClipFormProps {
  videoDuration: number;
  currentVideoTime: number;
  editingClip: Clip | null;
  onSaveClip: (startTime: number, endTime: number, clipId?: string) => Promise<boolean>;
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
  const { editingPoint, setEditingPoint } = usePlayerStore();

  const [startStr, setStartStr] = useState('00:00:00');
  const [endStr, setEndStr] = useState('00:01:00');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 当编辑的片段改变时同步状态
  useEffect(() => {
    if (editingClip) {
      setStartStr(formatTime(editingClip.startTime));
      setEndStr(formatTime(editingClip.endTime));
    } else {
      // 默认从 0 到 min(60, 时长) 或当前播放时间
      setStartStr(formatTime(0));
      setEndStr(formatTime(Math.min(60, videoDuration || 60)));
    }
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
      const success = await onSaveClip(start, end, editingClip?.id);
      if (success && !editingClip) {
        // 重置表单以便继续添加下一个片段
        setStartStr(formatTime(end));
        setEndStr(formatTime(Math.min(end + 60, videoDuration || end + 60)));
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
      <div className="flex items-center justify-between gap-2 p-3 bg-background rounded-2xl border border-border">
        {/* 开始时间字段 */}
        <div className="flex-1 flex flex-col items-center gap-1.5">
          <div className="w-full">
            <Input
              value={startStr}
              onChange={(e) => {
                setStartStr(e.target.value);
                setErrorMessage(null);
              }}
              onFocus={() => setEditingPoint('start')}
              className={`w-full text-center text-xs font-semibold ${
                editingPoint === 'start' ? 'ring-1 ring-accent border-accent' : ''
              }`}
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
        <span className="text-foreground-muted font-bold text-sm px-1 mb-6">—</span>

        {/* 结束时间字段 */}
        <div className="flex-1 flex flex-col items-center gap-1.5">
          <div className="w-full">
            <Input
              value={endStr}
              onChange={(e) => {
                setEndStr(e.target.value);
                setErrorMessage(null);
              }}
              onFocus={() => setEditingPoint('end')}
              className={`w-full text-center text-xs font-semibold ${
                editingPoint === 'end' ? 'ring-1 ring-accent border-accent' : ''
              }`}
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

      {/* 错误提示 */}
      {errorMessage && (
        <p className="text-[11px] text-danger font-medium text-center">{errorMessage}</p>
      )}

      {/* 提交按钮组 */}
      <div className="flex gap-2">
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
          <Icon icon={editingClip ? 'lucide:check' : 'lucide:plus'} className="w-3.5 h-3.5" />
          <span>{editingClip ? t('clipForm.saveClip') : t('clipForm.addClip')}</span>
        </Button>
      </div>
    </form>
  );
};
