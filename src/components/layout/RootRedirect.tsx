import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSettingsStore } from '@/stores/settingsStore';

// 根路径重定向组件：根据用户配置的启动页面动态跳转
export const RootRedirect: React.FC = () => {
  const startupPage = useSettingsStore((state) => state.startupPage);
  return <Navigate to={startupPage || '/clips'} replace />;
};
