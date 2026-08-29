import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/i18n';
import { setupIcons } from '@/utils/icons';
import { App } from '@/app/App';
import '@/index.css';

// 预加载并注册所有离线图标
setupIcons();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
