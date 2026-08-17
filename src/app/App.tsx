import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/app/router';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/stores/settingsStore';

export const App: React.FC = () => {
  useTheme();
  const initLanguage = useSettingsStore((state) => state.initLanguage);

  useEffect(() => {
    initLanguage();
  }, [initLanguage]);

  return <RouterProvider router={router} />;
};
