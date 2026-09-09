import React from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';

interface ZoomControlsProps {
  onFlip: () => void;
  onExit: () => void;
  isHidden?: boolean;
}

/**
 * Coverflow 放大聚焦模式浮层控制条组件
 * 悬浮于右上角，提供 3D 卡片正反面翻转与退出聚焦视图按钮
 */
export const ZoomControls: React.FC<ZoomControlsProps> = ({ onFlip, onExit, isHidden = false }) => {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'absolute top-3 right-3 gap-2 @[480px]:top-5 @[480px]:right-6 @[480px]:gap-2.5 z-30 flex items-center transition-all duration-300 ease-in-out',
        isHidden && 'opacity-0 -translate-y-4 pointer-events-none'
      )}
    >
      {/* 翻转卡片 */}
      <Button
        variant="primary"
        size="sm"
        onPress={onFlip}
        className="flex items-center gap-1.5 rounded-full px-2.5 @[480px]:px-3.5 shadow-subtle cursor-pointer"
      >
        <Icon icon="lucide:rotate-cw" className="size-3.5" />
        <span className="text-xs font-medium">{t('coverflow.flip', '翻转')}</span>
      </Button>

      {/* 返回列表 */}
      <Button
        variant="outline"
        size="sm"
        onPress={onExit}
        className="flex items-center gap-1.5 rounded-full px-2.5 @[480px]:px-3.5 bg-surface/80 backdrop-blur-md border border-border shadow-subtle cursor-pointer hover:bg-surface-hover"
      >
        <Icon icon="lucide:x" className="size-3.5" />
        <span className="text-xs font-medium">{t('coverflow.exit', '返回')}</span>
      </Button>
    </div>
  );
};
