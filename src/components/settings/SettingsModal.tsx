/**
 * @file SettingsModal.tsx
 * @description 设置弹窗主容器，提供顶部 HeroUI Tabs 分类导航与各设置模块装载
 */

import React from 'react';
import { Icon } from '@iconify/react';
import { Modal, Tabs, Button, useOverlayState } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settingsStore';
import { GeneralSettings } from './GeneralSettings';
import { PlaybackSettings } from './PlaybackSettings';
import { CoverflowSettings } from './CoverflowSettings';
import { SettingCategory, SettingTabItem } from './types';

export const SettingsModal: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<SettingCategory>('general');
  const { isSettingsOpen, setIsSettingsOpen } = useSettingsStore();

  const modalState = useOverlayState({
    isOpen: isSettingsOpen,
    onOpenChange: setIsSettingsOpen,
  });

  const settingTabs: SettingTabItem[] = [
    { id: 'general', label: t('settings.tabGeneral'), icon: 'lucide:settings' },
    { id: 'playback', label: t('settings.tabPlayback'), icon: 'lucide:square-play' },
    { id: 'coverflow', label: t('settings.tabCoverflow'), icon: 'lucide:gallery-horizontal-end' },
  ];

  return (
    <Modal state={modalState}>
      <Modal.Backdrop variant="blur">
        <Modal.Container placement="center" size="md">
          <Modal.Dialog className="w-full bg-surface border border-border rounded-3xl p-6 sm:p-7 shadow-floating text-foreground relative max-h-[90vh] flex flex-col">
            <Modal.CloseTrigger className="absolute top-5 right-5" />

            <Modal.Header className="pb-4 border-b border-border">
              <Modal.Heading className="text-lg font-semibold">{t('settings.title')}</Modal.Heading>
            </Modal.Header>

            <Tabs
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(key as SettingCategory)}
              aria-label={t('settings.title')}
              className="w-full flex-1 flex flex-col min-h-0"
            >
              {/* 分类切换 Tabs */}
              <div className="pt-4">
                <Tabs.ListContainer className="w-full">
                  <Tabs.List className="w-full grid grid-cols-3">
                    {settingTabs.map((tab) => (
                      <Tabs.Tab
                        key={tab.id}
                        id={tab.id}
                        className="flex items-center justify-center gap-1 cursor-pointer py-1.5"
                      >
                        <Icon icon={tab.icon} className="size-4 shrink-0" />
                        <span className="text-xs sm:text-sm font-medium">{tab.label}</span>
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs.ListContainer>
              </div>

              <Modal.Body className="py-5 overflow-y-auto max-h-[60vh] min-h-50">
                {/* 通用设置 */}
                <Tabs.Panel id="general" className="p-0 outline-none m-0">
                  <GeneralSettings />
                </Tabs.Panel>

                {/* 播放设置 */}
                <Tabs.Panel id="playback" className="p-0 outline-none m-0">
                  <PlaybackSettings />
                </Tabs.Panel>

                {/* 封面流设置 */}
                <Tabs.Panel id="coverflow" className="p-0 outline-none m-0">
                  <CoverflowSettings />
                </Tabs.Panel>
              </Modal.Body>
            </Tabs>

            <Modal.Footer className="pt-2 flex justify-end">
              <Button variant="primary" onPress={() => setIsSettingsOpen(false)}>
                {t('settings.done')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
