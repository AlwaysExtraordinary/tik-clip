/**
 * @file GeneralSettings.tsx
 * @description 通用设置模块：视频目录与授权、扫描、启动页面、语言、主题模式
 */

import React from 'react';
import { Icon } from '@iconify/react';
import { Button, Select, ListBox, Tabs } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settingsStore';
import { useDirectory } from '@/hooks/useDirectory';
import { ThemeMode, SupportedLanguage, StartupPage } from '@/types/settings';

export const GeneralSettings: React.FC = () => {
  const { t } = useTranslation();
  const {
    theme,
    setTheme,
    language,
    setLanguage,
    startupPage,
    setStartupPage,
  } = useSettingsStore();

  const {
    directoryName,
    selectDirectory,
    reauthorizeDirectory,
    performScan,
    directoryRef,
    directoryHandle,
    isScanning,
    hasDirectoryPermission,
  } = useDirectory();

  const activeDirectory = React.useMemo(
    () =>
      directoryRef ||
      (directoryHandle ? { name: directoryHandle.name, handle: directoryHandle } : null),
    [directoryRef, directoryHandle]
  );

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

  const startupPages: { id: StartupPage; label: string; icon: string }[] = [
    { id: '/clips', label: t('nav.clips'), icon: 'lucide:zap' },
    { id: '/videos', label: t('nav.videos'), icon: 'lucide:square-play' },
    { id: '/coverflow', label: t('nav.coverflow'), icon: 'lucide:gallery-horizontal-end' },
  ];

  // 处理文件夹重新扫描
  const handleRescan = () => {
    if (isScanning || !activeDirectory) return;
    if (!hasDirectoryPermission) {
      reauthorizeDirectory();
    } else {
      performScan(activeDirectory);
    }
  };

  return (
    <div className="space-y-5">
      {/* 视频目录 */}
      <div className="flex items-center justify-between gap-4">
        <label className="text-sm font-medium text-foreground shrink-0">
          {t('settings.videoDirectory')}
        </label>
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="flex items-center gap-1.5 min-w-0 px-3 py-1.5 bg-(--field-background) border border-border rounded-full cursor-pointer"
            onClick={hasDirectoryPermission ? selectDirectory : reauthorizeDirectory}
          >
            <Icon icon="lucide:folder" className="size-4 text-foreground-muted shrink-0" />
            <span className="text-sm truncate text-foreground">
              {directoryName || t('settings.noDirectorySelected')}
            </span>
          </div>
          {!hasDirectoryPermission && directoryName ? (
            <Button size="sm" variant="primary" onPress={reauthorizeDirectory}>
              {t('emptyState.authorizeFolder')}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onPress={selectDirectory}>
              {t('settings.change')}
            </Button>
          )}
        </div>
      </div>

      {/* 重新扫描 */}
      {activeDirectory && (
        <div className="flex justify-end -mt-2">
          <div
            className="text-xs flex gap-1.5 items-center py-1 px-2 hover:bg-surface-hover rounded-full cursor-pointer"
            onClick={handleRescan}
          >
            <Icon
              icon="lucide:refresh-cw"
              className={`size-3.5 ${isScanning ? 'animate-spin' : ''}`}
            />
            {isScanning ? t('settings.scanning') : t('settings.rescanFolder')}
          </div>
        </div>
      )}

      {/* 启动页面 */}
      <div className="flex items-center justify-between gap-4">
        <label className="text-sm font-medium text-foreground shrink-0">
          {t('settings.startupPage')}
        </label>
        <Select
          value={startupPage}
          onChange={(key) => {
            if (key) setStartupPage(key as StartupPage);
          }}
          aria-label={t('settings.startupPage')}
          className="w-40"
        >
          <Select.Trigger className="text-sm rounded-full">
            <div className="flex items-center gap-1.5 min-w-0">
              <Select.Value className="text-sm truncate" />
            </div>
            <Select.Indicator className="text-foreground-muted" />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {startupPages.map((page) => (
                <ListBox.Item key={page.id} id={page.id} textValue={page.label}>
                  <div className="flex items-center gap-2">
                    <Icon
                      icon={page.icon}
                      className="size-4 text-foreground-muted shrink-0"
                    />
                    <span>{page.label}</span>
                  </div>
                  <ListBox.ItemIndicator className="text-accent" />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

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
          <Select.Trigger className="text-sm rounded-full">
            <div className="flex items-center gap-1.5">
              <Icon icon="lucide:languages" className="size-4 text-foreground-muted" />
              <Select.Value className="text-sm" />
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
    </div>
  );
};
