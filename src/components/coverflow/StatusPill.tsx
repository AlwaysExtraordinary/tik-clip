import React from 'react';
import { Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { VIEW_STATES, ViewState } from './types';

interface StatusPillProps {
  state: ViewState;
}

/**
 * Coverflow 右下角状态指示胶囊组件
 * 反映当前 Coverflow 处于列表流览、封面正面展开还是详情聚焦模式
 */
export const StatusPill: React.FC<StatusPillProps> = ({ state }) => {
  const { t } = useTranslation();

  const getStatusText = (): string => {
    switch (state) {
      case VIEW_STATES.LIST:
        return t('coverflow.statusList', '影片列表');
      case VIEW_STATES.EXPANDED:
        return t('coverflow.statusExpanded', '选中封面');
      case VIEW_STATES.DETAIL:
        return t('coverflow.statusDetail', '详细信息');
      default:
        return '';
    }
  };

  return (
    <div className="absolute bottom-6 right-6 z-20 pointer-events-none transition-all duration-300 hidden @3xl:block">
      <Chip color="accent" variant="soft" size="sm">
        {getStatusText()}
      </Chip>
    </div>
  );
};
