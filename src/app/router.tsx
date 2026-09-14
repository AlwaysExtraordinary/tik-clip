import { createBrowserRouter } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { RootRedirect } from '@/components/layout/RootRedirect';
import { ClipsPage } from '@/pages/ClipsPage';
import { VideosPage } from '@/pages/VideosPage';
import { VideoDetailPage } from '@/pages/VideoDetailPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <RootRedirect />,
      },
      {
        path: 'clips',
        element: <ClipsPage />,
      },
      {
        path: 'videos',
        element: <VideosPage />,
      },
      {
        path: 'videos/:videoId',
        element: <VideoDetailPage />,
      },
      {
        path: 'coverflow',
        element: null,
      },
    ],
  },
]);
