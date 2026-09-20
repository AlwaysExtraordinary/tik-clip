/**
 * @file CoverflowScene.ts
 * @description 3D Coverflow 渲染引擎核心调度器
 * 负责 WebGL 渲染管线生命周期、透视相机动态推拉与自适应、卡片三维流式布局算法（正面/斜角/侧面/单张聚焦）、
 * 统一触控与鼠标拖拽/滚轮切卡事件分发、边界弹性回弹模拟及 60FPS 渲染循环总协调。
 */

import * as THREE from 'three';
import { Video } from '@/types/video';
import { CoverflowMovie, VIEW_STATES, ViewMode, ViewState } from '../types';
import { BookTransitionManager } from './bookTransitionManager';
import { CardManager } from './cardManager';
import {
  BOUNCE_CONFIG,
  CAMERA_CONFIG,
  CARD_CONFIG,
  LERP_CONFIG,
  SCROLL_CONFIG,
  THEME_CONFIG,
  WHEEL_CONFIG,
} from './config';
import { BookOpenTransitionOptions, CardMesh, ThemeMode, TransitionDirection } from './types';

// 导出供外部组件引用的选项接口与卡片类型
export type { BookOpenTransitionOptions, CardMesh };

/**
 * 3D Coverflow 渲染引擎核心调度器
 * 负责 Three.js 场景构建、相机视角、卡片流式布局、惯性滚动与状态流转
 */
export class CoverflowScene {
  private canvas: HTMLCanvasElement;
  private onMovieChange?: (movie: CoverflowMovie | null, index: number, total: number) => void;
  private onStateChange?: (state: ViewState) => void;
  private onPlayVideo?: (videoId: string) => void;
  private onCoverOpenChange?: (isOpen: boolean) => void;
  private currentLoadSession = 0;

  // Three.js 核心对象
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private raycaster!: THREE.Raycaster;
  private mouse!: THREE.Vector2;

  // 子系统管理器
  private cardManager: CardManager;
  private bookTransitionManager: BookTransitionManager;

  // 主题与场景背景色
  private bgColorDark = new THREE.Color(THEME_CONFIG.bgColorDark);
  private bgColorLight = new THREE.Color(THEME_CONFIG.bgColorLight);
  private currentThemeMode: ThemeMode = 'dark';

  // 状态与布局
  private state: ViewState = VIEW_STATES.LIST;
  private selectedIndex = 0;
  private scrollIndex = 0;
  private targetScrollIndex = 0;
  private scrollVelocity = 0;
  private isFlipped = false;
  private listViewMode: ViewMode = 'front';
  private transitionDirection: TransitionDirection = null;

  // 边界弹性回弹状态 (物理弹簧阻尼模型)
  private boundaryBounceOffset = 0;
  private boundaryBounceVelocity = 0;

  // 交互控制量
  private isDragging = false;
  private startX = 0;
  private dragStartScroll = 0;

  private isZoomDragging = false;
  private zoomDragStartX = 0;
  private zoomDragStartY = 0;
  private zoomDragStartRotY = 0;
  private zoomDragStartRotX = 0;
  private zoomDragDistance = 0;

  private wheelAccumulator = 0;
  private lastWheelTime = 0;
  private lastWheelStepTime = 0;

  // 动画与生命周期
  private animId: number | null = null;
  private isDestroyed = false;
  private isPaused = false;
  private isMobile = false;
  private cameraTargetZ: number = CAMERA_CONFIG.baseZ;
  private currentDetailTargetX = 0.9;

  // 事件解绑句柄
  private boundOnResize: () => void;
  private boundOnWheel: (e: WheelEvent) => void;
  private boundOnTouchStart: (e: TouchEvent) => void;
  private boundOnTouchMove: (e: TouchEvent) => void;
  private boundOnTouchEnd: () => void;
  private boundOnPointerDown: (e: PointerEvent) => void;
  private boundOnPointerMove: (e: PointerEvent) => void;
  private boundOnPointerUp: () => void;
  private boundOnClick: (e: MouseEvent) => void;

  /**
   * 构造函数：初始化场景、相机、子系统与事件监听
   * @param canvasElement WebGL Canvas 元素
   * @param onMovieChange 选中视频变更回调
   * @param onStateChange 视图状态变更回调
   * @param onPlayVideo 播放视频回调
   * @param onCoverOpenChange 封面展开状态变更回调
   */
  constructor(
    canvasElement: HTMLCanvasElement,
    onMovieChange?: (movie: CoverflowMovie | null, index: number, total: number) => void,
    onStateChange?: (state: ViewState) => void,
    onPlayVideo?: (videoId: string) => void,
    onCoverOpenChange?: (isOpen: boolean) => void
  ) {
    this.canvas = canvasElement;
    this.onMovieChange = onMovieChange;
    this.onStateChange = onStateChange;
    this.onPlayVideo = onPlayVideo;
    this.onCoverOpenChange = onCoverOpenChange;

    this.cardManager = new CardManager();
    this.bookTransitionManager = new BookTransitionManager();
    this.bookTransitionManager.onCoverStateChange = (isOpen) => {
      this.onCoverOpenChange?.(isOpen);
    };

    this.boundOnResize = this.onResize.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);
    this.boundOnTouchStart = this.onTouchStart.bind(this);
    this.boundOnTouchMove = this.onTouchMove.bind(this);
    this.boundOnTouchEnd = this.onPointerRelease.bind(this);
    this.boundOnPointerDown = this.onPointerDown.bind(this);
    this.boundOnPointerMove = this.onPointerMove.bind(this);
    this.boundOnPointerUp = this.onPointerRelease.bind(this);
    this.boundOnClick = this.onClick.bind(this);

    this.initThree();
    this.initEvents();
    this.animate();

    this.onStateChange?.(this.state);
  }

  // 初始化 Three.js 场景、相机与渲染器
  private initThree(): void {
    this.scene = new THREE.Scene();
    this.scene.background = this.bgColorDark.clone();

    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(CAMERA_CONFIG.fov, width / height, 0.1, 100);
    this.camera.position.set(0, 0.2, CAMERA_CONFIG.baseZ);
    this.cameraTargetZ = CAMERA_CONFIG.baseZ;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
  }

  /**
   * 切换亮色/暗色主题，同步背景色与材质
   * @param themeMode 主题模式
   */
  public setTheme(themeMode: ThemeMode): void {
    this.currentThemeMode = themeMode;
    const isDark = themeMode === 'dark';
    const targetBg = isDark ? this.bgColorDark : this.bgColorLight;

    if (this.scene) {
      this.scene.background = targetBg.clone();
    }
    this.cardManager.setTheme(themeMode);
  }

  /**
   * 设置列表视图模式：front（0° 正面）、angled（56° 斜角）或 vertical（90° 侧面）
   * @param mode 视图模式
   */
  public setListViewMode(mode: ViewMode): void {
    this.listViewMode = mode;
    if (this.state !== VIEW_STATES.LIST) {
      this.setState(VIEW_STATES.LIST);
    } else {
      this.updateCardPositions();
    }
  }

  // 获取当前选中的电影数据
  public getSelectedMovie(): CoverflowMovie | null {
    const movies = this.cardManager.getMovies();
    if (this.selectedIndex >= 0 && this.selectedIndex < movies.length) {
      return movies[this.selectedIndex];
    }
    return null;
  }

  // 获取当前场景的视图状态
  public getState(): ViewState {
    return this.state;
  }

  // 暂停动画渲染循环
  public pause(): void {
    this.isPaused = true;
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  // 恢复动画渲染循环
  public resume(): void {
    if (!this.isPaused && this.animId !== null) return;
    this.isPaused = false;
    this.onResize();
    this.animate();
  }

  // 通知外部选中电影变更
  private emitCurrentMovieChange(): void {
    if (!this.onMovieChange) return;
    const movies = this.cardManager.getMovies();
    if (!movies.length || this.selectedIndex < 0) {
      this.onMovieChange(null, 0, 0);
      return;
    }
    const safeIndex = Math.max(0, Math.min(movies.length - 1, this.selectedIndex));
    this.selectedIndex = safeIndex;
    this.onMovieChange(movies[safeIndex], safeIndex, movies.length);
  }

  /**
   * 更新指定视频的元数据信息并通知外部变更
   * @param updatedVideo 更新后的视频对象
   */
  public updateMovie(updatedVideo: Video): void {
    this.cardManager.updateMovie(updatedVideo);
    this.emitCurrentMovieChange();
  }

  /**
   * 载入电影列表并生成 3D 实体模型与倒影
   * 采用后台异步并发批处理与无闪烁原子置换机制
   * @param movieList 视频封面数据数组
   * @param targetIndex 可选的指定目标索引
   */
  public async setMovies(movieList: CoverflowMovie[], targetIndex?: number): Promise<void> {
    const wasDetailOrExpanded = this.state !== VIEW_STATES.LIST;
    if (wasDetailOrExpanded) {
      this.state = VIEW_STATES.LIST;
      this.resetCardRotations();
      this.boundaryBounceOffset = 0;
      this.boundaryBounceVelocity = 0;
      this.updateCameraTargetZ(true);
      this.onStateChange?.(VIEW_STATES.LIST);
    }

    const currentMovies = this.cardManager.getMovies();
    const isSame =
      currentMovies.length === movieList.length &&
      currentMovies.every(
        (m, idx) =>
          m.id === movieList[idx].id &&
          m.textureUrl === movieList[idx].textureUrl &&
          m.title === movieList[idx].title
      );

    if (isSame) {
      this.cardManager.setMoviesList(movieList);
      this.cardManager.getCardMeshes().forEach((mesh, idx) => {
        if (mesh && movieList[idx]) {
          mesh.userData.movie = movieList[idx];
        }
      });
      if (targetIndex !== undefined || wasDetailOrExpanded) {
        const safeIdx =
          targetIndex !== undefined
            ? Math.max(0, Math.min(movieList.length - 1, targetIndex))
            : this.selectedIndex;
        this.selectedIndex = safeIdx;
        this.scrollIndex = safeIdx;
        this.targetScrollIndex = safeIdx;
        this.scrollVelocity = 0;
        this.updateCardPositions(true);
        this.renderer.render(this.scene, this.camera);
      }
      this.emitCurrentMovieChange();
      return;
    }

    const sessionId = ++this.currentLoadSession;
    const prevSelectedId = currentMovies[this.selectedIndex]?.id;

    if (movieList.length === 0) {
      this.cardManager.disposeCards();
      this.selectedIndex = 0;
      this.scrollIndex = 0;
      this.targetScrollIndex = 0;
      this.emitCurrentMovieChange();
      return;
    }

    const newMeshes: CardMesh[] = [];
    const newMovies: CoverflowMovie[] = [];
    const BATCH_SIZE = 6;

    for (let i = 0; i < movieList.length; i += BATCH_SIZE) {
      if (this.isDestroyed || this.currentLoadSession !== sessionId) {
        this.cardManager.disposeMeshList(newMeshes);
        return;
      }

      const batch = movieList.slice(i, i + BATCH_SIZE);
      const batchMeshes = await Promise.all(
        batch.map((movie, batchIdx) => this.cardManager.createCardMesh(movie, i + batchIdx))
      );

      if (this.isDestroyed || this.currentLoadSession !== sessionId) {
        this.cardManager.disposeMeshList(newMeshes);
        this.cardManager.disposeMeshList(batchMeshes.filter(Boolean) as CardMesh[]);
        return;
      }

      batchMeshes.forEach((mesh, batchIdx) => {
        if (mesh) {
          newMeshes.push(mesh);
          newMovies.push(batch[batchIdx]);
        }
      });
    }

    if (this.isDestroyed || this.currentLoadSession !== sessionId) {
      this.cardManager.disposeMeshList(newMeshes);
      return;
    }

    // 原子挂载新卡片列表
    this.cardManager.mountCards(newMovies, newMeshes, this.scene);

    let finalTargetIndex = 0;
    if (targetIndex !== undefined) {
      finalTargetIndex = Math.max(0, Math.min(newMovies.length - 1, targetIndex));
    } else if (prevSelectedId) {
      const foundIdx = newMovies.findIndex((m) => m.id === prevSelectedId);
      if (foundIdx !== -1) {
        finalTargetIndex = foundIdx;
      }
    }

    this.selectedIndex = finalTargetIndex;
    this.scrollIndex = finalTargetIndex;
    this.targetScrollIndex = finalTargetIndex;
    this.scrollVelocity = 0;

    this.updateCardPositions(true);
    this.renderer.render(this.scene, this.camera);
    this.emitCurrentMovieChange();
  }

  // 绑定交互与窗口监听
  private initEvents(): void {
    window.addEventListener('resize', this.boundOnResize);
    this.canvas.addEventListener('wheel', this.boundOnWheel, { passive: false });
    this.canvas.addEventListener('touchstart', this.boundOnTouchStart, { passive: true });
    window.addEventListener('touchmove', this.boundOnTouchMove, { passive: true });
    window.addEventListener('touchend', this.boundOnTouchEnd);

    this.canvas.addEventListener('pointerdown', this.boundOnPointerDown);
    window.addEventListener('pointermove', this.boundOnPointerMove);
    window.addEventListener('pointerup', this.boundOnPointerUp);
    this.canvas.addEventListener('click', this.boundOnClick);
  }

  /**
   * 根据视口像素坐标更新归一化鼠标坐标与射线投射器
   * @param clientX 视口 X 坐标
   * @param clientY 视口 Y 坐标
   * @returns 画布视口边界矩形
   */
  private updateRaycasterFromPointer(clientX: number, clientY: number): DOMRect {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return rect;
  }

  // 隐藏背景卡片网格及其倒影，避免与 3D 书本翻开展开装配体穿模
  private hideCardsForTransition = (): void => {
    this.cardManager.getCardMeshes().forEach((mesh) => {
      mesh.visible = false;
      if (mesh.reflectionMesh) {
        mesh.reflectionMesh.visible = false;
      }
    });
  };

  private handleDragStart(clientX: number, clientY: number): void {
    this.startX = clientX;
    if (this.bookTransitionManager.isCoverOpen) {
      const rect = this.updateRaycasterFromPointer(clientX, clientY);

      const hitDisc = this.bookTransitionManager.handlePointerDown(
        this.raycaster,
        this.camera,
        clientX,
        clientY,
        rect
      );
      if (hitDisc) {
        this.canvas.style.cursor = 'grabbing';
        return;
      }
    }

    if (this.state === VIEW_STATES.LIST) {
      this.isDragging = true;
      this.dragStartScroll = this.targetScrollIndex;
    } else if (this.state === VIEW_STATES.EXPANDED || this.state === VIEW_STATES.DETAIL) {
      if (this.bookTransitionManager.isCoverOpen) return;
      const selectedMesh = this.cardManager.getCardMeshes()[this.selectedIndex];
      if (selectedMesh) {
        this.isZoomDragging = true;
        this.zoomDragStartX = clientX;
        this.zoomDragStartY = clientY;
        this.zoomDragStartRotY = selectedMesh.targetRotationY;
        this.zoomDragStartRotX = selectedMesh.rotation.x;
        this.zoomDragDistance = 0;
      }
    }
  }

  private handleDragMove(clientX: number, clientY: number): void {
    if (this.bookTransitionManager.isCoverOpen && this.bookTransitionManager.isDraggingDisc) {
      const rect = this.updateRaycasterFromPointer(clientX, clientY);

      this.bookTransitionManager.handlePointerMoveDrag(
        this.raycaster,
        this.camera,
        clientX,
        clientY,
        rect
      );
      return;
    }

    const movies = this.cardManager.getMovies();
    if (this.state === VIEW_STATES.LIST && this.isDragging) {
      if (!movies.length) return;
      const dx = clientX - this.startX;
      const scrollDiff = -dx / SCROLL_CONFIG.dragFactor;
      this.targetScrollIndex = Math.max(
        0,
        Math.min(movies.length - 1, this.dragStartScroll + scrollDiff)
      );
      this.selectedIndex = Math.round(this.targetScrollIndex);
      this.emitCurrentMovieChange();
    } else if (
      (this.state === VIEW_STATES.EXPANDED || this.state === VIEW_STATES.DETAIL) &&
      this.isZoomDragging
    ) {
      const dx = clientX - this.zoomDragStartX;
      const dy = clientY - this.zoomDragStartY;
      this.zoomDragDistance = Math.hypot(dx, dy);

      const selectedMesh = this.cardManager.getCardMeshes()[this.selectedIndex];
      if (selectedMesh) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasWidth = rect.width || window.innerWidth;
        const canvasHeight = rect.height || window.innerHeight;

        const rotDeltaY = (dx / canvasWidth) * Math.PI * 2.0;
        const rawRotY = this.zoomDragStartRotY + rotDeltaY;
        const maxRotY = 1.5 * Math.PI;
        selectedMesh.targetRotationY = THREE.MathUtils.clamp(rawRotY, -maxRotY, maxRotY);

        const rotDeltaX = (dy / canvasHeight) * Math.PI * 1.2;
        const rawRotX = this.zoomDragStartRotX + rotDeltaX;
        selectedMesh.targetRotationX = THREE.MathUtils.clamp(
          rawRotX,
          -Math.PI / 2.5,
          Math.PI / 2.5
        );
      }
    }
  }

  // 滚轮事件处理
  private onWheel(e: WheelEvent): void {
    if (this.bookTransitionManager.isTransitioning) return;
    e.preventDefault();

    if (this.state === VIEW_STATES.LIST) {
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY)
          ? e.deltaX * SCROLL_CONFIG.sensitivity
          : e.deltaY * SCROLL_CONFIG.sensitivity;
      this.scrollVelocity += delta;
      return;
    }

    if (this.state === VIEW_STATES.EXPANDED || this.state === VIEW_STATES.DETAIL) {
      const now = performance.now();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;

      if (now - this.lastWheelTime > WHEEL_CONFIG.accumulatorResetTime) {
        this.wheelAccumulator = 0;
      }
      this.lastWheelTime = now;

      if ((delta > 0 && this.wheelAccumulator < 0) || (delta < 0 && this.wheelAccumulator > 0)) {
        this.wheelAccumulator = 0;
      }

      this.wheelAccumulator += delta;

      if (now - this.lastWheelStepTime >= WHEEL_CONFIG.stepCooldown) {
        if (this.wheelAccumulator >= WHEEL_CONFIG.stepThreshold) {
          this.nextCard();
          this.wheelAccumulator = 0;
          this.lastWheelStepTime = now;
        } else if (this.wheelAccumulator <= -WHEEL_CONFIG.stepThreshold) {
          this.prevCard();
          this.wheelAccumulator = 0;
          this.lastWheelStepTime = now;
        }
      }
    }
  }

  // 触摸开始监听
  private onTouchStart(e: TouchEvent): void {
    if (this.bookTransitionManager.isTransitioning) return;
    if (e.touches.length === 1) {
      this.handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  }

  // 触摸移动监听
  private onTouchMove(e: TouchEvent): void {
    if (e.touches.length === 1) {
      this.handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }

  // 指针按下监听
  private onPointerDown(e: PointerEvent): void {
    if (this.bookTransitionManager.isTransitioning) return;
    this.handleDragStart(e.clientX, e.clientY);
  }

  // 指针移动监听
  private onPointerMove(e: PointerEvent): void {
    this.handleDragMove(e.clientX, e.clientY);

    // 光标悬停交互
    if (this.isDragging || this.isZoomDragging) {
      this.canvas.style.cursor = 'grabbing';
    } else {
      this.updateRaycasterFromPointer(e.clientX, e.clientY);

      if (this.bookTransitionManager.isCoverOpen) {
        if (this.bookTransitionManager.isDraggingDisc) {
          this.canvas.style.cursor = 'grabbing';
          return;
        }
        const isOverDisc = this.bookTransitionManager.handlePointerMove(this.raycaster);
        this.canvas.style.cursor = isOverDisc ? 'pointer' : 'default';
        return;
      }

      const visibleMeshes = this.cardManager.getCardMeshes().filter((m) => m.visible);
      const intersects = this.raycaster.intersectObjects(visibleMeshes, false);
      this.canvas.style.cursor = intersects.length > 0 ? 'pointer' : 'default';
    }
  }

  private onPointerRelease(): void {
    if (this.bookTransitionManager.isCoverOpen && this.bookTransitionManager.isDraggingDisc) {
      this.bookTransitionManager.handlePointerUp();
      this.canvas.style.cursor = 'pointer';
      return;
    }

    if (this.isDragging) {
      this.isDragging = false;
      this.targetScrollIndex = Math.round(this.targetScrollIndex);
    }

    if (this.isZoomDragging) {
      this.isZoomDragging = false;
      const selectedMesh = this.cardManager.getCardMeshes()[this.selectedIndex];
      if (selectedMesh) {
        selectedMesh.targetRotationX = 0;
        if (this.zoomDragDistance > 6) {
          const rotY = selectedMesh.targetRotationY;
          if (Math.abs(rotY) > Math.PI / 2) {
            selectedMesh.targetRotationY = rotY < 0 ? -Math.PI : Math.PI;
            this.isFlipped = true;
          } else {
            selectedMesh.targetRotationY = 0;
            this.isFlipped = false;
          }
        }
      }
    }
  }

  // 点击事件监听
  private onClick(e: MouseEvent): void {
    if (this.bookTransitionManager.isTransitioning) return;

    // 展开状态下的点击分发：点击光盘播放，点击光盘以外其区域均恢复原状
    if (this.bookTransitionManager.isCoverOpen) {
      if (this.bookTransitionManager.consumeDiscDrag()) {
        return;
      }

      this.updateRaycasterFromPointer(e.clientX, e.clientY);

      const hitType = this.bookTransitionManager.handleClick(this.raycaster);
      if (hitType === 'disc') {
        const currentMovie = this.cardManager.getMovies()[this.selectedIndex];
        if (currentMovie && this.onPlayVideo) {
          this.onPlayVideo(currentMovie.id);
        } else {
          this.bookTransitionManager.playFromOpened();
        }
      } else {
        this.closeCover();
      }
      return;
    }

    if (this.zoomDragDistance > 6) {
      this.zoomDragDistance = 0;
      return;
    }

    this.updateRaycasterFromPointer(e.clientX, e.clientY);

    const visibleMeshes = this.cardManager.getCardMeshes().filter((m) => m.visible);
    const intersects = this.raycaster.intersectObjects(visibleMeshes, false);

    if (intersects.length > 0) {
      const hitObj = intersects[0].object;
      const clickedIndex =
        hitObj.userData?.index !== undefined
          ? hitObj.userData.index
          : (hitObj.parent as CardMesh)?.userData?.index;
      if (clickedIndex !== undefined) {
        this.handleCardInteraction(clickedIndex);
      }
    } else {
      if (this.state !== VIEW_STATES.LIST) {
        this.setState(VIEW_STATES.LIST);
      }
    }
  }

  /**
   * 点击卡片交互流转：LIST -> EXPANDED -> DETAIL -> 翻转
   * @param index 卡片索引
   */
  public handleCardInteraction(index: number): void {
    if (this.state === VIEW_STATES.LIST) {
      this.resetCardRotations();
      this.selectedIndex = index;
      this.targetScrollIndex = index;
      this.setState(VIEW_STATES.EXPANDED);
    } else if (this.state === VIEW_STATES.EXPANDED) {
      if (index === this.selectedIndex) {
        this.setState(VIEW_STATES.DETAIL);
      } else {
        this.resetCardRotations();
        this.selectedIndex = index;
        this.targetScrollIndex = index;
        this.scrollIndex = index;
        this.updateCardPositions();
        this.emitCurrentMovieChange();
      }
    } else if (this.state === VIEW_STATES.DETAIL) {
      this.toggleFlipCard();
    }
  }

  // 重置卡片旋转
  private resetCardRotations(): void {
    this.isFlipped = false;
    this.cardManager.getCardMeshes().forEach((mesh) => {
      mesh.targetRotationX = 0;
    });
  }

  // 翻转选中的卡片 (DETAIL 模式下 180° 正反面切换)
  public toggleFlipCard(): void {
    if (this.state !== VIEW_STATES.DETAIL || this.bookTransitionManager.isTransitioning) return;
    this.isFlipped = !this.isFlipped;

    const selectedMesh = this.cardManager.getCardMeshes()[this.selectedIndex];
    if (selectedMesh) {
      selectedMesh.targetRotationY = this.isFlipped ? Math.PI : 0;
    }

    this.updateCardPositions();
  }

  /**
   * 切换视图状态 (LIST / EXPANDED / DETAIL)
   * @param newState 目标状态
   */
  public setState(newState: ViewState): void {
    if (this.bookTransitionManager.isTransitioning) return;
    if (this.bookTransitionManager.isCoverOpen) {
      const selectedMesh = this.cardManager.getCardMeshes()[this.selectedIndex];
      this.bookTransitionManager.reset(selectedMesh, this.scene);
    }
    this.state = newState;
    this.boundaryBounceOffset = 0;
    this.boundaryBounceVelocity = 0;
    if (newState === VIEW_STATES.LIST) {
      this.resetCardRotations();
      this.scrollIndex = this.selectedIndex;
      this.targetScrollIndex = this.selectedIndex;
      this.scrollVelocity = 0;
    }

    this.updateCameraTargetZ();
    this.updateCardPositions();
    this.onStateChange?.(newState);
    this.emitCurrentMovieChange();
  }

  // 切换下一张卡片
  public nextCard(): void {
    if (this.bookTransitionManager.isTransitioning) return;
    const count = this.cardManager.getMovies().length;
    if (this.selectedIndex >= 0 && this.selectedIndex < count - 1) {
      this.resetCardRotations();
      this.selectedIndex += 1;
      this.targetScrollIndex = this.selectedIndex;
      this.scrollIndex = this.selectedIndex;
      this.transitionDirection = 'next';
      this.updateCardPositions();
      this.emitCurrentMovieChange();
    } else if (this.state === VIEW_STATES.DETAIL && this.selectedIndex >= count - 1) {
      this.triggerBoundaryBounce('next');
    }
  }

  // 切换上一张卡片
  public prevCard(): void {
    if (this.bookTransitionManager.isTransitioning) return;
    if (this.selectedIndex > 0) {
      this.resetCardRotations();
      this.selectedIndex -= 1;
      this.targetScrollIndex = this.selectedIndex;
      this.scrollIndex = this.selectedIndex;
      this.transitionDirection = 'prev';
      this.updateCardPositions();
      this.emitCurrentMovieChange();
    } else if (this.state === VIEW_STATES.DETAIL && this.selectedIndex <= 0) {
      this.triggerBoundaryBounce('prev');
    }
  }

  // 触发详情聚焦模式下的边界弹性回弹
  private triggerBoundaryBounce(direction: 'prev' | 'next'): void {
    if (this.state !== VIEW_STATES.DETAIL || this.cardManager.getCardMeshes().length === 0) return;
    const impulse = direction === 'prev' ? BOUNCE_CONFIG.impulse : -BOUNCE_CONFIG.impulse;
    this.boundaryBounceVelocity = THREE.MathUtils.clamp(
      this.boundaryBounceVelocity + impulse,
      -BOUNCE_CONFIG.maxVelocity,
      BOUNCE_CONFIG.maxVelocity
    );
  }

  /**
   * 滚动并聚焦到指定索引的卡片
   * @param index 目标卡片索引
   * @param immediate 是否立即跳转无过渡
   */
  public scrollToIndex(index: number, immediate = false): void {
    const movies = this.cardManager.getMovies();
    if (movies.length === 0) return;
    const safeIndex = Math.max(0, Math.min(movies.length - 1, index));
    this.resetCardRotations();
    this.selectedIndex = safeIndex;
    this.targetScrollIndex = safeIndex;
    this.scrollVelocity = 0;
    if (immediate) {
      this.scrollIndex = safeIndex;
      this.updateCardPositions(true);
      this.renderer.render(this.scene, this.camera);
    } else {
      this.updateCardPositions();
    }
    this.emitCurrentMovieChange();
  }

  /**
   * 计算卡片目标位置、旋转角与缩放比例
   * @param immediate 是否立即应用无过渡
   */
  public updateCardPositions(immediate = false): void {
    const meshes = this.cardManager.getCardMeshes();
    meshes.forEach((mesh, i) => {
      const dx = i - this.scrollIndex;

      let targetX = 0;
      let targetY = 0;
      let targetZ = 0;
      let targetRotY = 0;
      const targetRotX = 0;
      let targetScale = 1.0;

      if (this.state === VIEW_STATES.LIST) {
        mesh.visible = true;
        let currentSpacing = CARD_CONFIG.spacing;
        if (this.listViewMode === 'front') {
          currentSpacing = CARD_CONFIG.width + (this.isMobile ? 0.35 : 0.65);
        } else if (this.isMobile) {
          currentSpacing = CARD_CONFIG.spacing * 0.85;
        }

        targetX = dx * currentSpacing;
        targetY = 0;
        targetZ = 0;

        if (this.listViewMode === 'vertical') {
          targetRotY = Math.PI / 2;
        } else if (this.listViewMode === 'front') {
          targetRotY = 0;
        } else {
          targetRotY = Math.PI / 3.2;
        }
      } else if (this.state === VIEW_STATES.EXPANDED) {
        mesh.visible = true;

        if (i === this.selectedIndex) {
          targetX = 0;
          targetY = this.isMobile ? 0.2 : 0;
          targetZ = this.isMobile ? 1.0 : 1.2;
          targetScale = this.isMobile ? 1.0 : 1.15;
          targetRotY = !this.isZoomDragging ? (this.isFlipped ? Math.PI : 0) : mesh.targetRotationY;
        } else if (i < this.selectedIndex) {
          targetX =
            (i - this.selectedIndex) *
              (this.isMobile ? CARD_CONFIG.spacing * 0.85 : CARD_CONFIG.spacing) -
            2.8;
          targetZ = -1.2;
          targetRotY = Math.PI / 2.8;
          targetScale = 0.9;
        } else {
          targetX =
            (i - this.selectedIndex) *
              (this.isMobile ? CARD_CONFIG.spacing * 0.85 : CARD_CONFIG.spacing) +
            2.8;
          targetZ = -1.2;
          targetRotY = Math.PI / 3.5;
          targetScale = 0.9;
        }
      } else if (this.state === VIEW_STATES.DETAIL) {
        const detailTargetY = this.isMobile ? 1.3 : 0.15;
        const detailTargetZ = this.isMobile ? 3.5 : 3.6;

        let detailTargetX = 0;
        let detailTargetScale = this.isMobile ? 0.76 : 0.92;

        if (!this.isMobile && this.canvas) {
          const parent = this.canvas.parentElement;
          const rect = parent
            ? parent.getBoundingClientRect()
            : this.canvas.getBoundingClientRect();
          const width = rect.width || window.innerWidth;
          const panelWidth = 344;

          const centerOffsetPx = panelWidth / 2;
          const ndcX = centerOffsetPx / (width / 2);

          const camZ = this.cameraTargetZ || this.camera.position.z;
          const dist = Math.max(camZ - detailTargetZ, 1.0);
          const fovRad = (this.camera.fov * Math.PI) / 180;
          const visibleHalfWidth = dist * Math.tan(fovRad / 2) * this.camera.aspect;
          detailTargetX = Math.max(0.6, Math.min(ndcX * visibleHalfWidth, 2.6));

          const baseDist = CAMERA_CONFIG.baseZ - 3.6;
          const zoomRatio = dist / baseDist;
          const compensatedScale = 0.92 * Math.min(Math.sqrt(zoomRatio), 1.25);

          const cardPixelWidth =
            ((CARD_CONFIG.width * compensatedScale) / (2 * visibleHalfWidth)) * width;
          const maxAllowedWidth = (width - panelWidth) * 0.75;
          if (cardPixelWidth > maxAllowedWidth && cardPixelWidth > 0) {
            detailTargetScale = compensatedScale * (maxAllowedWidth / cardPixelWidth);
          } else {
            detailTargetScale = compensatedScale;
          }
        }

        this.currentDetailTargetX = detailTargetX;

        if (i === this.selectedIndex) {
          mesh.visible = true;
          targetX = detailTargetX;
          targetY = detailTargetY;
          targetZ = detailTargetZ;
          targetScale = detailTargetScale;
          targetRotY = !this.isZoomDragging ? (this.isFlipped ? Math.PI : 0) : mesh.targetRotationY;

          if (this.transitionDirection === 'next') {
            mesh.position.set(detailTargetX + 4.8, detailTargetY, detailTargetZ - 0.6);
            mesh.rotation.set(0, Math.PI / 10, 0);
            mesh.scale.set(
              detailTargetScale * 0.75,
              detailTargetScale * 0.75,
              detailTargetScale * 0.75
            );
          } else if (this.transitionDirection === 'prev') {
            mesh.position.set(detailTargetX - 4.8, detailTargetY, detailTargetZ - 0.6);
            mesh.rotation.set(0, -Math.PI / 10, 0);
            mesh.scale.set(
              detailTargetScale * 0.75,
              detailTargetScale * 0.75,
              detailTargetScale * 0.75
            );
          }
        } else {
          const isPrevExiting = this.transitionDirection === 'next' && i === this.selectedIndex - 1;
          const isNextExiting = this.transitionDirection === 'prev' && i === this.selectedIndex + 1;

          if (isPrevExiting) {
            mesh.visible = true;
            targetX = detailTargetX - 4.8;
            targetY = detailTargetY;
            targetZ = detailTargetZ - 0.6;
            targetRotY = -Math.PI / 10;
            targetScale = detailTargetScale * 0.75;
          } else if (isNextExiting) {
            mesh.visible = true;
            targetX = detailTargetX + 4.8;
            targetY = detailTargetY;
            targetZ = detailTargetZ - 0.6;
            targetRotY = Math.PI / 10;
            targetScale = detailTargetScale * 0.75;
          } else {
            mesh.visible = false;
            targetX = (i - this.selectedIndex) * 8.0;
            targetY = 0;
            targetZ = -15;
            targetRotY = 0;
            targetScale = 0.5;
          }
        }
      }

      if (this.bookTransitionManager.isCoverOpen) {
        mesh.visible = false;
        if (mesh.reflectionMesh) {
          mesh.reflectionMesh.visible = false;
        }
      }

      mesh.targetPosition.set(targetX, targetY, targetZ);
      if (!this.isZoomDragging || i !== this.selectedIndex) {
        mesh.targetRotationY = targetRotY;
        mesh.targetRotationX = targetRotX;
      }
      mesh.targetScale = targetScale;

      if (immediate || this.bookTransitionManager.isCoverOpen) {
        mesh.position.copy(mesh.targetPosition);
        mesh.rotation.y = mesh.targetRotationY;
        mesh.rotation.x = mesh.targetRotationX;
        mesh.scale.set(targetScale, targetScale, targetScale);
      }
    });

    this.transitionDirection = null;
  }

  // 60FPS 动画主循环与惯性物理模拟
  private animate(): void {
    if (this.isDestroyed || this.isPaused) return;
    this.animId = requestAnimationFrame(this.animate.bind(this));

    // 书本翻开与光盘飞行动画接管渲染
    if (this.bookTransitionManager.isCoverOpen || this.bookTransitionManager.isTransitioning) {
      const selectedMesh = this.cardManager.getCardMeshes()[this.selectedIndex];
      this.bookTransitionManager.update(
        performance.now(),
        this.camera,
        this.isNarrowLayout(),
        LERP_CONFIG.cardSpeed,
        this.cardManager.getPlasticEdgeMat(),
        this.currentThemeMode,
        this.scene,
        selectedMesh,
        this.hideCardsForTransition
      );
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // 1. 惯性物理模拟
    if (this.state === VIEW_STATES.LIST) {
      const count = this.cardManager.getMovies().length;
      if (Math.abs(this.scrollVelocity) > 0.0001) {
        this.targetScrollIndex += this.scrollVelocity;
        this.targetScrollIndex = Math.max(
          0,
          Math.min(Math.max(count - 1, 0), this.targetScrollIndex)
        );
        this.scrollVelocity *= SCROLL_CONFIG.friction;
      } else {
        this.scrollVelocity = 0;
      }

      const diff = this.targetScrollIndex - this.scrollIndex;
      if (Math.abs(diff) > 0.0001) {
        this.scrollIndex += diff * SCROLL_CONFIG.followSpeed;
        this.updateCardPositions();

        const roundedIndex = Math.round(this.scrollIndex);
        if (roundedIndex !== this.selectedIndex && roundedIndex >= 0 && roundedIndex < count) {
          this.selectedIndex = roundedIndex;
          this.emitCurrentMovieChange();
        }
      }
    }

    // 2. 顺滑 Lerp 运动插值
    if (Math.abs(this.camera.position.z - this.cameraTargetZ) > 0.001) {
      this.camera.position.z +=
        (this.cameraTargetZ - this.camera.position.z) * LERP_CONFIG.cameraSpeed;
      this.camera.updateProjectionMatrix();
    }

    this.cardManager.getCardMeshes().forEach((mesh) => {
      if (!mesh.visible) return;
      mesh.position.x += (mesh.targetPosition.x - mesh.position.x) * LERP_CONFIG.cardSpeed;
      mesh.position.y += (mesh.targetPosition.y - mesh.position.y) * LERP_CONFIG.cardSpeed;
      mesh.position.z += (mesh.targetPosition.z - mesh.position.z) * LERP_CONFIG.cardSpeed;

      mesh.rotation.y += (mesh.targetRotationY - mesh.rotation.y) * LERP_CONFIG.cardSpeed;
      mesh.rotation.x += (mesh.targetRotationX - mesh.rotation.x) * LERP_CONFIG.cardSpeed;

      const currentScale = mesh.scale.x;
      const nextScale = currentScale + (mesh.targetScale - currentScale) * LERP_CONFIG.cardSpeed;
      mesh.scale.set(nextScale, nextScale, nextScale);

      if (this.state === VIEW_STATES.DETAIL && mesh.userData.index !== this.selectedIndex) {
        if (Math.abs(mesh.position.x - this.currentDetailTargetX) > 4.2) {
          mesh.visible = false;
        }
      }
    });

    // 倒影动态衰减与深度排序更新
    this.cardManager.updateReflectionDynamics(this.selectedIndex, this.state);

    // 3. 详情模式 (DETAIL) 边界回弹阻尼物理模拟
    if (this.state === VIEW_STATES.DETAIL) {
      if (
        Math.abs(this.boundaryBounceOffset) > 0.0001 ||
        Math.abs(this.boundaryBounceVelocity) > 0.0001
      ) {
        const springForce = -BOUNCE_CONFIG.stiffness * this.boundaryBounceOffset;
        this.boundaryBounceVelocity =
          (this.boundaryBounceVelocity + springForce) * BOUNCE_CONFIG.damping;
        this.boundaryBounceOffset += this.boundaryBounceVelocity;
        this.boundaryBounceOffset = THREE.MathUtils.clamp(
          this.boundaryBounceOffset,
          -BOUNCE_CONFIG.maxOffset,
          BOUNCE_CONFIG.maxOffset
        );

        if (
          Math.abs(this.boundaryBounceOffset) < 0.0005 &&
          Math.abs(this.boundaryBounceVelocity) < 0.0005
        ) {
          this.boundaryBounceOffset = 0;
          this.boundaryBounceVelocity = 0;
        }
      }
    } else {
      this.boundaryBounceOffset = 0;
      this.boundaryBounceVelocity = 0;
    }

    const hasBounce =
      this.state === VIEW_STATES.DETAIL && Math.abs(this.boundaryBounceOffset) > 0.0001;
    const selectedMesh = hasBounce ? this.cardManager.getCardMeshes()[this.selectedIndex] : null;

    let appliedBounceX = 0;
    let appliedBounceRotY = 0;

    if (selectedMesh && selectedMesh.visible) {
      appliedBounceX = this.boundaryBounceOffset;
      selectedMesh.position.x += appliedBounceX;

      if (!this.isZoomDragging) {
        const tiltSign = this.isFlipped ? -1 : 1;
        appliedBounceRotY = -this.boundaryBounceOffset * BOUNCE_CONFIG.tiltRatio * tiltSign;
        selectedMesh.rotation.y += appliedBounceRotY;
      }
    }

    this.renderer.render(this.scene, this.camera);

    if (selectedMesh && selectedMesh.visible) {
      selectedMesh.position.x -= appliedBounceX;
      selectedMesh.rotation.y -= appliedBounceRotY;
    }
  }

  // 根据视口宽高比与当前模式更新相机目标 Z 轴距离
  private updateCameraTargetZ(immediate = false): void {
    if (!this.canvas) return;
    const aspect = this.camera.aspect;
    const baseCamZ = CAMERA_CONFIG.baseZ;
    let targetCamZ = baseCamZ;
    if (aspect < 1.6) {
      const maxZoomFactor = this.state === VIEW_STATES.DETAIL ? 1.3 : 1.55;
      const zoomFactor = Math.min(1.45 / Math.max(aspect, 0.45), maxZoomFactor);
      targetCamZ = baseCamZ * zoomFactor;
    }
    this.cameraTargetZ = Math.min(Math.max(targetCamZ, 9.0), 16.0);
    if (immediate) {
      this.camera.position.z = this.cameraTargetZ;
      this.camera.updateProjectionMatrix();
    }
  }

  // 判断当前容器是否处于窄屏上下堆叠布局 (< 768px)
  private isNarrowLayout(): boolean {
    if (!this.canvas) return this.isMobile;
    const parent = this.canvas.parentElement;
    const rect = parent ? parent.getBoundingClientRect() : this.canvas.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    return width < 768;
  }

  /**
   * 响应容器尺寸变化
   * @param immediate 是否立即重置相机与卡片位置
   */
  public onResize(immediate: boolean | unknown = false): void {
    if (this.isDestroyed || !this.canvas) return;

    const parent = this.canvas.parentElement;
    const rect = parent ? parent.getBoundingClientRect() : this.canvas.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;

    if (width === 0 || height === 0) return;

    const isImmediate = immediate === true;
    this.isMobile = width < 768;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.updateCameraTargetZ(isImmediate);
    this.updateCardPositions(isImmediate);

    const selectedMesh = this.cardManager.getCardMeshes()[this.selectedIndex];
    this.bookTransitionManager.onResize(selectedMesh, this.isMobile);

    const pixelRatio = this.renderer.getPixelRatio();
    const physicalWidth = Math.floor(width * pixelRatio);
    const physicalHeight = Math.floor(height * pixelRatio);

    if (this.canvas.width !== physicalWidth || this.canvas.height !== physicalHeight) {
      this.renderer.setSize(width, height);
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * 执行书本翻开展开动画并平滑过渡到视频播放
   * @param options 过渡参数与完成回调
   */
  public playBookOpenTransition(options: BookOpenTransitionOptions): void {
    const selectedMesh = this.cardManager.getCardMeshes()[this.selectedIndex];
    this.bookTransitionManager.play(
      options,
      selectedMesh,
      this.cardManager.getPlasticEdgeMat(),
      this.currentThemeMode,
      this.scene,
      this.hideCardsForTransition
    );
  }

  // 重置书本翻开展开状态，安全卸载 3D 装配体
  public resetBookOpenTransition(): void {
    const selectedMesh = this.cardManager.getCardMeshes()[this.selectedIndex];
    this.bookTransitionManager.reset(selectedMesh, this.scene);

    this.camera.position.set(0, 0.2, this.cameraTargetZ);
    this.camera.updateProjectionMatrix();

    this.canvas.style.cursor = 'default';
    this.updateCardPositions(true);
    this.renderer.render(this.scene, this.camera);
  }

  // 打开当前选中卡片的封面并展开停留
  public openCover(): void {
    if (this.state !== VIEW_STATES.DETAIL) {
      this.setState(VIEW_STATES.DETAIL);
    }
    const currentMovie = this.cardManager.getMovies()[this.selectedIndex];
    const selectedMesh = this.cardManager.getCardMeshes()[this.selectedIndex];
    if (!currentMovie || !selectedMesh) return;

    this.bookTransitionManager.openCover(
      { movie: currentMovie },
      selectedMesh,
      this.cardManager.getPlasticEdgeMat(),
      this.currentThemeMode,
      this.scene,
      this.hideCardsForTransition
    );
  }

  // 关闭展开的封面
  public closeCover(): void {
    this.bookTransitionManager.closeCover();
  }

  // 获取封面当前是否已展开
  public get isCoverOpen(): boolean {
    return this.bookTransitionManager.isCoverOpen;
  }

  // 完全销毁场景并释放全部 WebGL 资源
  public destroy(): void {
    this.isDestroyed = true;
    this.bookTransitionManager.destroy(this.scene);
    this.boundaryBounceOffset = 0;
    this.boundaryBounceVelocity = 0;
    this.currentLoadSession++;

    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }

    window.removeEventListener('resize', this.boundOnResize);
    this.canvas.removeEventListener('wheel', this.boundOnWheel);
    this.canvas.removeEventListener('touchstart', this.boundOnTouchStart);
    window.removeEventListener('touchmove', this.boundOnTouchMove);
    window.removeEventListener('touchend', this.boundOnTouchEnd);
    this.canvas.removeEventListener('pointerdown', this.boundOnPointerDown);
    window.removeEventListener('pointermove', this.boundOnPointerMove);
    window.removeEventListener('pointerup', this.boundOnPointerUp);
    this.canvas.removeEventListener('click', this.boundOnClick);

    this.cardManager.destroy();

    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
