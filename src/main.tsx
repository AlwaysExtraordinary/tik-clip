import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/i18n';
import { App } from '@/app/App';
import '@/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
