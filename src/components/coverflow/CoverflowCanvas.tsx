import React, { useEffect, useRef } from 'react';
import { CoverflowScene } from './three/coverflowScene';
import { CoverflowMovie, ViewState } from './types';

interface CoverflowCanvasProps {
  onSceneReady?: (scene: CoverflowScene) => void;
  onMovieChange?: (movie: CoverflowMovie | null, index: number, total: number) => void;
  onStateChange?: (state: ViewState) => void;
  onPlayVideo?: (videoId: string) => void;
  onCoverOpenChange?: (isOpen: boolean) => void;
  className?: string;
}

/**
 * 3D Coverflow 画布容器组件
 * 封装 WebGL Canvas 节点，自动适配容器尺寸变化，并提供生命周期安全释放机制
 */
export const CoverflowCanvas: React.FC<CoverflowCanvasProps> = ({
  onSceneReady,
  onMovieChange,
  onStateChange,
  onPlayVideo,
  onCoverOpenChange,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CoverflowScene | null>(null);

  const onMovieChangeRef = useRef(onMovieChange);
  const onStateChangeRef = useRef(onStateChange);
  const onSceneReadyRef = useRef(onSceneReady);
  const onPlayVideoRef = useRef(onPlayVideo);
  const onCoverOpenChangeRef = useRef(onCoverOpenChange);

  useEffect(() => {
    onMovieChangeRef.current = onMovieChange;
    onStateChangeRef.current = onStateChange;
    onSceneReadyRef.current = onSceneReady;
    onPlayVideoRef.current = onPlayVideo;
    onCoverOpenChangeRef.current = onCoverOpenChange;
  });

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // 实例化 Three.js 场景引擎
    const scene = new CoverflowScene(
      canvasRef.current,
      (movie, index, total) => {
        onMovieChangeRef.current?.(movie, index, total);
      },
      (state) => {
        onStateChangeRef.current?.(state);
      },
      (videoId) => {
        onPlayVideoRef.current?.(videoId);
      },
      (isOpen) => {
        onCoverOpenChangeRef.current?.(isOpen);
      }
    );

    sceneRef.current = scene;
    onSceneReadyRef.current?.(scene);
    // 挂载时立即同步场景初始状态至外部
    onStateChangeRef.current?.(scene.getState());

    // 监听父容器大小变动，通过 requestAnimationFrame 节流，自适应 Three.js 相机与视口
    let resizeRafId: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeRafId !== null) {
        cancelAnimationFrame(resizeRafId);
      }
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null;
        scene.onResize(false);
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      if (resizeRafId !== null) {
        cancelAnimationFrame(resizeRafId);
      }
      resizeObserver.disconnect();
      scene.destroy();
      sceneRef.current = null;
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative w-full h-full overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        id="coverflow-webgl-canvas"
        className="absolute inset-0 w-full h-full outline-none block"
      />
    </div>
  );
};
