import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAllVideos } from '@/db/videos';
import { Video } from '@/types/video';
import { useDirectory } from '@/hooks/useDirectory';
import { useSettingsStore } from '@/stores/settingsStore';
import { EmptyState } from '@/components/video/EmptyState';
import { CoverflowCanvas } from '@/components/coverflow/CoverflowCanvas';
import { CoverflowNavbar } from '@/components/coverflow/CoverflowNavbar';
import { MovieInfoPanel } from '@/components/coverflow/MovieInfoPanel';
import { ZoomControls } from '@/components/coverflow/ZoomControls';
import { StatusPill } from '@/components/coverflow/StatusPill';
import { CoverflowScene } from '@/components/coverflow/three/CoverflowScene';
import { CoverflowMovie, VIEW_STATES, ViewMode, ViewState } from '@/components/coverflow/types';

interface CoverflowPageProps {
  isVisible?: boolean;
}

/**
 * 3D Coverflow 沉浸式封面流页面
 * 呈现类似经典 iTunes / 抖音的 3D 碟盒流式交互体验
 */
export const CoverflowPage: React.FC<CoverflowPageProps> = ({ isVisible = true }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme } = useSettingsStore();

  const { directoryRef, directoryHandle, isScanning, hasDirectoryPermission } = useDirectory();
  const activeDirectory = useMemo(
    () =>
      directoryRef ||
      (directoryHandle ? { name: directoryHandle.name, handle: directoryHandle } : null),
    [directoryRef, directoryHandle]
  );

  const [scene, setScene] = useState<CoverflowScene | null>(null);
  const [movies, setMovies] = useState<CoverflowMovie[]>([]);
  const moviesRef = useRef<CoverflowMovie[]>([]);

  useEffect(() => {
    moviesRef.current = movies;
  }, [movies]);

  const [currentMovie, setCurrentMovie] = useState<CoverflowMovie | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalMovies, setTotalMovies] = useState(0);
  const [viewState, setViewState] = useState<ViewState>(VIEW_STATES.LIST);
  const [viewMode, setViewMode] = useState<ViewMode>('front');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 记录所有创建的 ObjectURL，用于在组件卸载或更新时释放内存
  const createdUrlsRef = useRef<string[]>([]);

  // 1. 同步深浅色主题至 Three.js 场景
  useEffect(() => {
    if (!scene) return;

    const applyCurrentTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      scene.setTheme(isDark ? 'dark' : 'light');
    };

    applyCurrentTheme();

    // 观察根节点 dark 类名变更
    const observer = new MutationObserver(() => {
      applyCurrentTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, [scene, theme]);

  // 2. 响应页面可见性：激活时恢复并重算布局，非激活时暂停动画以节约系统资源
  useEffect(() => {
    if (!scene) return;
    if (isVisible) {
      scene.resume();
      requestAnimationFrame(() => {
        scene.onResize();
      });
    } else {
      scene.pause();
    }
  }, [isVisible, scene]);

  // 3. 加载并过滤包含封面的视频数据（直接使用数据库中已有的视频元数据）
  const loadCoverflowMovies = useCallback(async () => {
    setIsLoading(true);
    try {
      const allVideos = await getAllVideos();

      // 仅筛选拥有真实封面图片的视频文件夹
      const coverVideos = allVideos.filter(
        (v: Video) => v.hasCover === true && Boolean(v.thumbnail)
      );

      // 清理旧 ObjectURL
      createdUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      createdUrlsRef.current = [];

      // 构建 Coverflow 展示对象，直接使用持久化在 Dexie 的元数据（名称、类别、演员、描述）
      const loadedMovies: CoverflowMovie[] = coverVideos.map((video: Video) => {
        const textureUrl = URL.createObjectURL(video.thumbnail!);
        createdUrlsRef.current.push(textureUrl);

        return {
          id: video.id,
          title: video.name || video.folderName,
          textureUrl,
          category: video.category,
          actor: video.actor,
          description: video.description,
          video,
        };
      });

      setMovies(loadedMovies);
    } catch (err) {
      console.error('Failed to load Coverflow movies:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 4. 检查视频数据是否产生变动，仅在数据真正更新时触发重构
  const checkAndReloadMovies = useCallback(async () => {
    try {
      const allVideos = await getAllVideos();
      const coverVideos = allVideos.filter(
        (v: Video) => v.hasCover === true && Boolean(v.thumbnail)
      );

      const isChanged =
        coverVideos.length !== moviesRef.current.length ||
        coverVideos.some((v, idx) => {
          const cur = moviesRef.current[idx];
          return (
            !cur ||
            cur.id !== v.id ||
            cur.video.updatedAt !== v.updatedAt ||
            cur.title !== (v.name || v.folderName) ||
            cur.category !== v.category ||
            cur.actor !== v.actor ||
            cur.description !== v.description
          );
        });

      if (isChanged || moviesRef.current.length === 0) {
        await loadCoverflowMovies();
      }
    } catch (err) {
      console.error('Failed to check Coverflow videos update:', err);
    }
  }, [loadCoverflowMovies]);

  // 5. 当页面可见且扫描结束时，检测并执行必要的数据刷新
  useEffect(() => {
    if (isVisible && !isScanning) {
      checkAndReloadMovies();
    }
  }, [isVisible, isScanning, checkAndReloadMovies]);

  // 组件完全卸载时释放所有 ObjectURL
  useEffect(() => {
    return () => {
      createdUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      createdUrlsRef.current = [];
    };
  }, []);

  // 3. 当数据和 Scene 准备就绪时载入模型
  useEffect(() => {
    if (scene && movies.length > 0) {
      scene.setMovies(movies);
    }
  }, [scene, movies]);

  // 4. 视图模式切换 (正面 0° vs 斜角 56° vs 侧面 90°)
  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      scene?.setListViewMode(mode);
    },
    [scene]
  );

  // 5. 播放视频跳转
  const handlePlayVideo = useCallback(
    (videoId: string) => {
      navigate(`/videos/${videoId}`);
    },
    [navigate]
  );

  // 6. 键盘快捷键交互
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!scene || movies.length === 0) return;

      if (e.key === 'ArrowLeft') {
        scene.prevCard();
      } else if (e.key === 'ArrowRight') {
        scene.nextCard();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (viewState === VIEW_STATES.LIST) {
          scene.setState(VIEW_STATES.EXPANDED);
        } else if (viewState === VIEW_STATES.EXPANDED) {
          scene.setState(VIEW_STATES.DETAIL);
        } else if (viewState === VIEW_STATES.DETAIL) {
          scene.toggleFlipCard();
        }
      } else if (e.key === 'Escape') {
        if (viewState !== VIEW_STATES.LIST) {
          scene.setState(VIEW_STATES.LIST);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scene, viewState, movies.length]);

  // 空状态展示判定
  if (!hasDirectoryPermission) {
    return <EmptyState type="permission-needed" className="h-full" />;
  }

  if (!activeDirectory) {
    return <EmptyState type="no-directory" className="h-full" />;
  }

  if (isScanning) {
    return <EmptyState type="scanning" className="h-full" />;
  }

  if (isLoading) {
    return <EmptyState type="loading" className="h-full" />;
  }

  if (movies.length === 0) {
    return (
      <EmptyState
        type="no-videos"
        className="h-full"
        title={t('coverflow.noCoversTitle', '未检测到带封面的视频')}
        description={t(
          'coverflow.noCoversDesc',
          '3D 封面流需要视频文件夹内包含封面图片（如 cover.jpg）。请在视频子目录下添加封面后重新扫描。'
        )}
      />
    );
  }

  return (
    <div className="@container relative w-full h-full overflow-hidden select-none">
      {/* 3D WebGL 画布 */}
      <CoverflowCanvas
        onSceneReady={(s) => setScene(s)}
        onMovieChange={(movie, index, total) => {
          setCurrentMovie(movie);
          setCurrentIndex(index);
          setTotalMovies(total);
        }}
        onStateChange={(st) => setViewState(st)}
      />

      {/* 顶部极简导航栏 (仅视图切换，详情模式自动隐藏) */}
      <CoverflowNavbar
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        isHidden={viewState === VIEW_STATES.DETAIL}
      />

      {/* 放大聚焦模式浮层控制条 (翻转与退出) */}
      <ZoomControls
        onFlip={() => scene?.toggleFlipCard()}
        onExit={() => scene?.setState(VIEW_STATES.LIST)}
        isHidden={viewState !== VIEW_STATES.DETAIL}
      />

      {/* 视频详细信息面板 (仅在详情聚焦模式展示) */}
      <MovieInfoPanel
        movie={currentMovie}
        currentIndex={currentIndex}
        totalMovies={totalMovies}
        onPrev={() => scene?.prevCard()}
        onNext={() => scene?.nextCard()}
        onPlay={handlePlayVideo}
        isHidden={viewState !== VIEW_STATES.DETAIL}
      />

      {/* 状态胶囊指示器 */}
      <StatusPill state={viewState} />
    </div>
  );
};
