import React from 'react';
import { Icon } from '@iconify/react';
import { Modal, Tabs, Button, Select, ListBox, Switch, useOverlayState } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settingsStore';
import { useDirectory } from '@/hooks/useDirectory';
import { ThemeMode, SupportedLanguage } from '@/types/settings';

export const SettingsModal: React.FC = () => {
  const { t } = useTranslation();
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    theme,
    setTheme,
    language,
    setLanguage,
    showThumbnailPreview,
    setShowThumbnailPreview,
  } = useSettingsStore();
  const { directoryName, selectDirectory, performScan, directoryRef, directoryHandle, isScanning } =
    useDirectory();
  const activeDirectory = React.useMemo(
    () =>
      directoryRef ||
      (directoryHandle ? { name: directoryHandle.name, handle: directoryHandle } : null),
    [directoryRef, directoryHandle]
  );

  const modalState = useOverlayState({
    isOpen: isSettingsOpen,
    onOpenChange: setIsSettingsOpen,
  });

  const themes: { id: ThemeMode; label: string; icon: string }[] = [
    { id: 'light', label: t('settings.themeLight'), icon: 'lucide:sun' },
    { id: 'dark', label: t('settings.themeDark'), icon: 'lucide:moon' },
    { id: 'system', label: t('settings.themeSystem'), icon: 'lucide:laptop' },
  ];

  const languages: { id: SupportedLanguage; label: string }[] = [
    { id: 'zh', label: '简体中文' },
    { id: 'en', label: 'English' },
    { id: 'ja', label: '日本語' },
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

            <Modal.Body className="py-5 space-y-5 overflow-y-auto max-h-[60vh]">
              {/* 视频目录 */}
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium text-foreground shrink-0">
                  {t('settings.videoDirectory')}
                </label>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 px-3 py-1.5 bg-(--field-background) border border-border rounded-full">
                    <Icon icon="lucide:folder" className="size-4 text-foreground-muted shrink-0" />
                    <span className="text-sm truncate text-foreground">
                      {directoryName || t('settings.noDirectorySelected')}
                    </span>
                  </div>
                  <Button size="sm" variant="secondary" onPress={selectDirectory}>
                    {t('settings.change')}
                  </Button>
                </div>
              </div>

              {/* 重新扫描 */}
              {activeDirectory && (
                <div className="flex justify-end -mt-2">
                  <div
                    className="text-xs flex gap-1.5 items-center py-1 px-2 hover:bg-surface-hover rounded-full cursor-pointer"
                    onClick={() => {
                      if (!isScanning) performScan(activeDirectory);
                    }}
                  >
                    <Icon
                      icon="lucide:refresh-cw"
                      className={`size-3.5 ${isScanning ? 'animate-spin' : ''}`}
                    />
                    {isScanning ? t('settings.scanning') : t('settings.rescanFolder')}
                  </div>
                </div>
              )}

              {/* 语言 */}
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium text-foreground shrink-0">
                  {t('settings.language')}
                </label>
                <Select
                  value={language}
                  onChange={(key) => {
                    if (key) setLanguage(key as SupportedLanguage);
                  }}
                  aria-label={t('settings.language')}
                  className="w-40"
                >
                  <Select.Trigger className=" text-sm rounded-full">
                    <div className="flex items-center gap-1.5">
                      <Icon icon="lucide:languages" className="size-4 text-foreground-muted" />
                      <Select.Value />
                    </div>
                    <Select.Indicator className="text-foreground-muted" />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {languages.map((lang) => (
                        <ListBox.Item key={lang.id} id={lang.id} textValue={lang.label}>
                          <span>{lang.label}</span>
                          <ListBox.ItemIndicator className="text-accent" />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              {/* 主题 */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground shrink-0">
                  {t('settings.theme')}
                </label>
                <Tabs selectedKey={theme} onSelectionChange={(key) => setTheme(key as ThemeMode)}>
                  <Tabs.ListContainer className="min-w-0">
                    <Tabs.List>
                      {themes.map((tItem) => (
                        <Tabs.Tab key={tItem.id} id={tItem.id} className="w-25">
                          <Icon icon={tItem.icon} className="size-4 mr-1" />
                          <span className="text-xs">{tItem.label}</span>
                          <Tabs.Indicator />
                        </Tabs.Tab>
                      ))}
                    </Tabs.List>
                  </Tabs.ListContainer>
                </Tabs>
              </div>

              {/* 进度条缩略图预览 */}
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <label className="text-sm font-medium text-foreground">
                    {t('settings.thumbnailPreview')}
                  </label>
                </div>
                <Switch
                  isSelected={showThumbnailPreview}
                  onChange={setShowThumbnailPreview}
                  aria-label={t('settings.thumbnailPreview')}
                  size="md"
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
              </div>
            </Modal.Body>

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
