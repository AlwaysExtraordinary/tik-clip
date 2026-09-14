import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/app/router';
import { useTheme } from '@/hooks/useTheme';
import { useRestoreDirectory } from '@/hooks/useRestoreDirectory';
import { useSettingsStore } from '@/stores/settingsStore';
import { useDirectoryWatcher } from '@/hooks/useDirectoryWatcher';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';

export const App: React.FC = () => {
  useTheme();
  useRestoreDirectory();
  useDirectoryWatcher();
  useGlobalShortcuts();

  const initLanguage = useSettingsStore((state) => state.initLanguage);
  const initStartupPage = useSettingsStore((state) => state.initStartupPage);

  useEffect(() => {
    initLanguage();
    initStartupPage();
  }, [initLanguage, initStartupPage]);

  return <RouterProvider router={router} />;
};
