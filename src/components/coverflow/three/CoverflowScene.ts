import * as THREE from 'three';
import { processCoverSpreadTexture } from './textureProcessor';
import { CoverflowMovie, VIEW_STATES, ViewMode, ViewState } from '../types';

/** 拓展带有平滑插值目标属性的 Mesh */
interface CardMesh extends THREE.Mesh {
  targetPosition: THREE.Vector3;
  targetRotationY: number;
  targetRotationX: number;
  targetScale: number;
  userData: {
    index: number;
    movie: CoverflowMovie;
  };
}

/**
 * 3D Coverflow 渲染引擎核心类
 * 负责 Three.js 场景构建、相机视角、卡片流式布局、惯性滚动与状态流转
 */
export class CoverflowScene {
  private canvas: HTMLCanvasElement;
  private onMovieChange?: (movie: CoverflowMovie | null, index: number, total: number) => void;
  private onStateChange?: (state: ViewState) => void;

  // Three.js 核心对象
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private raycaster!: THREE.Raycaster;
  private mouse!: THREE.Vector2;
  private plasticEdgeMat!: THREE.MeshBasicMaterial;
  private boxGeometry!: THREE.BoxGeometry;

  // 主题配色
  private bgColorDark = new THREE.Color('#121214');
  private bgColorLight = new THREE.Color('#f3f4f6');

  // 数据与状态
  private movies: CoverflowMovie[] = [];
  private cardMeshes: CardMesh[] = [];
  private state: ViewState = VIEW_STATES.LIST;
  private selectedIndex = 0;
  private scrollIndex = 0;
  private targetScrollIndex = 0;
  private scrollVelocity = 0;
  private isFlipped = false;
  private listViewMode: ViewMode = 'front'; // 'front' (正面 0°), 'angled' (斜角 56°), 'vertical' (侧面 90°)

  // 滚轮步进防抖与累加器 (在 EXPANDED 和 DETAIL 状态生效)
  private wheelAccumulator = 0;
  private lastWheelTime = 0;
  private lastWheelStepTime = 0;

  // 详情模式切卡过渡方向 (用于驱动进入与退出切入动画)
  private transitionDirection: 'next' | 'prev' | null = null;

  // 交互标志量
  private isDragging = false;
  private startX = 0;
  private dragStartScroll = 0;

  // 3D 旋转交互标志量 (在 EXPANDED 和 DETAIL 状态生效)
  private isZoomDragging = false;
  private zoomDragStartX = 0;
  private zoomDragStartY = 0;
  private zoomDragStartRotY = 0;
  private zoomDragStartRotX = 0;
  private zoomDragDistance = 0;

  // 尺寸参数
  private cardHeight = 4.2;
  private cardWidth = 4.2 * (379.5 / 537); // 约 2.97
  private cardDepth = 4.2 * (41 / 537); // 约 0.32
  private spacing = 2;

  // 动画与生命周期
  private animId: number | null = null;
  private isDestroyed = false;
  private isPaused = false;
  private isMobile = false;
  private cameraTargetZ = 9.5;
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
   * 构造函数：初始化场景、材质与事件监听
   * @param canvasElement WebGL Canvas 元素
   * @param onMovieChange 选中视频变更回调
   * @param onStateChange 视图状态变更回调
   */
  constructor(
    canvasElement: HTMLCanvasElement,
    onMovieChange?: (movie: CoverflowMovie | null, index: number, total: number) => void,
    onStateChange?: (state: ViewState) => void
  ) {
    this.canvas = canvasElement;
    this.onMovieChange = onMovieChange;
    this.onStateChange = onStateChange;

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
  }

  // 初始化 Three.js 场景、相机、渲染器与材质
  private initThree(): void {
    this.scene = new THREE.Scene();
    this.scene.background = this.bgColorDark.clone();

    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0.2, 9.5);
    this.cameraTargetZ = 9.5;

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

    this.plasticEdgeMat = new THREE.MeshBasicMaterial({
      color: '#1e293b',
    });

    this.boxGeometry = new THREE.BoxGeometry(this.cardWidth, this.cardHeight, this.cardDepth);
  }

  /**
   * 切换亮色/暗色主题，同步背景色与塑料边框材质
   * @param themeMode 主题模式
   */
  public setTheme(themeMode: 'dark' | 'light'): void {
    const isDark = themeMode === 'dark';
    const targetBg = isDark ? this.bgColorDark : this.bgColorLight;

    if (this.scene) {
      this.scene.background = targetBg.clone();
    }
    if (this.plasticEdgeMat) {
      this.plasticEdgeMat.color.set(isDark ? '#1e293b' : '#e2e8f0');
    }
  }

  /**
   * 设置列表视图模式：front（0° 正面）、angled（56° 斜角）或 vertical（90° 侧面）
   * 若当前处于选中封面或详情聚焦状态，则自动平滑返回影片列表并切换到对应视图
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

  /**
   * 获取当前选中的卡片索引与电影对象
   */
  public getSelectedMovie(): CoverflowMovie | null {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.movies.length) {
      return this.movies[this.selectedIndex];
    }
    return null;
  }

  /**
   * 暂停动画渲染循环（离开页面时降低 CPU/GPU 占用）
   */
  public pause(): void {
    this.isPaused = true;
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  /**
   * 恢复动画渲染循环并自适应当前尺寸
   */
  public resume(): void {
    if (!this.isPaused && this.animId !== null) return;
    this.isPaused = false;
    this.onResize();
    this.animate();
  }

  // 通知外部选中电影变更
  private emitCurrentMovieChange(): void {
    if (!this.onMovieChange) return;

    if (!this.movies.length || this.selectedIndex < 0) {
      this.onMovieChange(null, 0, 0);
      return;
    }

    const safeIndex = Math.max(0, Math.min(this.movies.length - 1, this.selectedIndex));
    this.selectedIndex = safeIndex;
    this.onMovieChange(this.movies[safeIndex], safeIndex, this.movies.length);
  }

  /**
   * 载入电影列表，为每个包含有效封面的视频生成 3D 实体模型
   * @param movieList 视频封面数据数组
   */
  public async setMovies(movieList: CoverflowMovie[]): Promise<void> {
    // 销毁并移除旧网格模型
    this.disposeCards();
    this.movies = movieList;

    for (let i = 0; i < movieList.length; i++) {
      if (this.isDestroyed) return;
      const movie = movieList[i];

      try {
        // 裁切与生成 front, spine, back 3 张纹理
        const { frontCanvas, spineCanvas, backCanvas } = await processCoverSpreadTexture(
          movie.textureUrl,
          movie.title
        );

        if (this.isDestroyed) return;

        const frontTex = new THREE.CanvasTexture(frontCanvas);
        const spineTex = new THREE.CanvasTexture(spineCanvas);
        const backTex = new THREE.CanvasTexture(backCanvas);

        [frontTex, spineTex, backTex].forEach((t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.generateMipmaps = true;
          t.minFilter = THREE.LinearMipmapLinearFilter;
          t.magFilter = THREE.LinearFilter;
        });

        // 立方体 6 面材质映射
        const materials: THREE.Material[] = [
          this.plasticEdgeMat,
          new THREE.MeshBasicMaterial({ map: spineTex }),
          this.plasticEdgeMat,
          this.plasticEdgeMat,
          new THREE.MeshBasicMaterial({ map: frontTex }),
          new THREE.MeshBasicMaterial({ map: backTex }),
        ];

        const mesh = new THREE.Mesh(this.boxGeometry, materials) as unknown as CardMesh;
        mesh.userData = { index: i, movie };

        // 初始化平滑插值目标变换
        mesh.targetPosition = new THREE.Vector3();
        mesh.targetRotationY = 0;
        mesh.targetRotationX = 0;
        mesh.targetScale = 1.0;

        this.scene.add(mesh);
        this.cardMeshes.push(mesh);
      } catch (err) {
        console.warn(`Failed to process cover texture for movie "${movie.title}":`, err);
      }
    }

    this.selectedIndex = 0;
    this.scrollIndex = 0;
    this.targetScrollIndex = 0;
    this.scrollVelocity = 0;
    this.updateCardPositions(true);

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

  // 滚轮滑动事件处理
  private onWheel(e: WheelEvent): void {
    e.preventDefault();

    // 列表视图：平滑惯性连续滚动
    if (this.state === VIEW_STATES.LIST) {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX * 0.0012 : e.deltaY * 0.0012;
      this.scrollVelocity += delta;
      return;
    }

    // 选中封面 (EXPANDED) 或 详情模式 (DETAIL)：滚轮滑动切换上一个/下一个封面
    if (this.state === VIEW_STATES.EXPANDED || this.state === VIEW_STATES.DETAIL) {
      const now = performance.now();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;

      // 超过 300ms 无滚轮事件则重置累加器
      if (now - this.lastWheelTime > 300) {
        this.wheelAccumulator = 0;
      }
      this.lastWheelTime = now;

      // 滚动方向反转时立即重置累加器，确保反向切换灵敏无阻滞
      if ((delta > 0 && this.wheelAccumulator < 0) || (delta < 0 && this.wheelAccumulator > 0)) {
        this.wheelAccumulator = 0;
      }

      this.wheelAccumulator += delta;

      // 切换阈值与冷却时间（有效过滤触控板惯性拖尾，防止快速跳页）
      const THRESHOLD = 50;
      const COOLDOWN = 180; // 毫秒

      if (now - this.lastWheelStepTime >= COOLDOWN) {
        if (this.wheelAccumulator >= THRESHOLD) {
          this.nextCard();
          this.wheelAccumulator = 0;
          this.lastWheelStepTime = now;
        } else if (this.wheelAccumulator <= -THRESHOLD) {
          this.prevCard();
          this.wheelAccumulator = 0;
          this.lastWheelStepTime = now;
        }
      }
    }
  }

  // 触摸开始
  private onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      this.startX = touch.clientX;

      if (this.state === VIEW_STATES.LIST) {
        this.isDragging = true;
        this.dragStartScroll = this.targetScrollIndex;
      } else if (this.state === VIEW_STATES.EXPANDED || this.state === VIEW_STATES.DETAIL) {
        const selectedMesh = this.cardMeshes[this.selectedIndex];
        if (selectedMesh) {
          this.isZoomDragging = true;
          this.zoomDragStartX = touch.clientX;
          this.zoomDragStartY = touch.clientY;
          this.zoomDragStartRotY = selectedMesh.targetRotationY;
          this.zoomDragStartRotX = selectedMesh.rotation.x;
          this.zoomDragDistance = 0;
        }
      }
    }
  }

  // 触摸移动
  private onTouchMove(e: TouchEvent): void {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (this.state === VIEW_STATES.LIST && this.isDragging) {
        if (!this.movies.length) return;
        const dx = touch.clientX - this.startX;
        const scrollDiff = -dx / 350;
        this.targetScrollIndex = Math.max(
          0,
          Math.min(this.movies.length - 1, this.dragStartScroll + scrollDiff)
        );
        this.selectedIndex = Math.round(this.targetScrollIndex);
        this.emitCurrentMovieChange();
      } else if (
        (this.state === VIEW_STATES.EXPANDED || this.state === VIEW_STATES.DETAIL) &&
        this.isZoomDragging
      ) {
        const dx = touch.clientX - this.zoomDragStartX;
        const dy = touch.clientY - this.zoomDragStartY;
        this.zoomDragDistance = Math.hypot(dx, dy);

        const selectedMesh = this.cardMeshes[this.selectedIndex];
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
  }

  // 指针按下
  private onPointerDown(e: PointerEvent): void {
    this.startX = e.clientX;

    if (this.state === VIEW_STATES.LIST) {
      this.isDragging = true;
      this.dragStartScroll = this.targetScrollIndex;
    } else if (this.state === VIEW_STATES.EXPANDED || this.state === VIEW_STATES.DETAIL) {
      const selectedMesh = this.cardMeshes[this.selectedIndex];
      if (selectedMesh) {
        this.isZoomDragging = true;
        this.zoomDragStartX = e.clientX;
        this.zoomDragStartY = e.clientY;
        this.zoomDragStartRotY = selectedMesh.targetRotationY;
        this.zoomDragStartRotX = selectedMesh.rotation.x;
        this.zoomDragDistance = 0;
      }
    }
  }

  // 指针移动
  private onPointerMove(e: PointerEvent): void {
    if (this.state === VIEW_STATES.LIST && this.isDragging) {
      if (!this.movies.length) return;
      const dx = e.clientX - this.startX;
      const scrollDiff = -dx / 350;
      this.targetScrollIndex = Math.max(
        0,
        Math.min(this.movies.length - 1, this.dragStartScroll + scrollDiff)
      );
      this.selectedIndex = Math.round(this.targetScrollIndex);
      this.emitCurrentMovieChange();
    } else if (
      (this.state === VIEW_STATES.EXPANDED || this.state === VIEW_STATES.DETAIL) &&
      this.isZoomDragging
    ) {
      const dx = e.clientX - this.zoomDragStartX;
      const dy = e.clientY - this.zoomDragStartY;
      this.zoomDragDistance = Math.hypot(dx, dy);

      const selectedMesh = this.cardMeshes[this.selectedIndex];
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

    // 光标悬停交互
    if (this.isDragging || this.isZoomDragging) {
      this.canvas.style.cursor = 'grabbing';
    } else {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const visibleMeshes = this.cardMeshes.filter((m) => m.visible);
      const intersects = this.raycaster.intersectObjects(visibleMeshes);

      this.canvas.style.cursor = intersects.length > 0 ? 'pointer' : 'default';
    }
  }

  // 指针释放
  private onPointerRelease(): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.targetScrollIndex = Math.round(this.targetScrollIndex);
    }

    if (this.isZoomDragging) {
      this.isZoomDragging = false;
      const selectedMesh = this.cardMeshes[this.selectedIndex];

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

  // 画布点击事件
  private onClick(e: MouseEvent): void {
    if (this.zoomDragDistance > 6) {
      this.zoomDragDistance = 0;
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const visibleMeshes = this.cardMeshes.filter((m) => m.visible);
    const intersects = this.raycaster.intersectObjects(visibleMeshes);

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object as CardMesh;
      const clickedIndex = clickedMesh.userData.index;
      this.handleCardInteraction(clickedIndex);
    } else {
      // 点击空白背景退出聚焦
      if (this.state !== VIEW_STATES.LIST) {
        this.setState(VIEW_STATES.LIST);
      }
    }
  }

  /**
   * 点击卡片流转处理：LIST -> EXPANDED -> DETAIL -> 翻牌
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
    this.cardMeshes.forEach((mesh) => {
      mesh.targetRotationX = 0;
    });
  }

  /**
   * 翻转选中的卡片 (DETAIL 模式下 180° 正反面切换)
   */
  public toggleFlipCard(): void {
    if (this.state !== VIEW_STATES.DETAIL) return;
    this.isFlipped = !this.isFlipped;

    const selectedMesh = this.cardMeshes[this.selectedIndex];
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
    this.state = newState;
    if (newState === VIEW_STATES.LIST) {
      this.resetCardRotations();
      this.scrollIndex = this.selectedIndex;
      this.targetScrollIndex = this.selectedIndex;
      this.scrollVelocity = 0;
    }

    this.updateCameraTargetZ();
    this.updateCardPositions();

    if (this.onStateChange) {
      this.onStateChange(newState);
    }
    this.emitCurrentMovieChange();
  }

  /**
   * 切换下一张卡片
   */
  public nextCard(): void {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.movies.length - 1) {
      this.resetCardRotations();
      this.selectedIndex += 1;
      this.targetScrollIndex = this.selectedIndex;
      this.scrollIndex = this.selectedIndex;
      this.transitionDirection = 'next';
      this.updateCardPositions();
      this.emitCurrentMovieChange();
    }
  }

  /**
   * 切换上一张卡片
   */
  public prevCard(): void {
    if (this.selectedIndex > 0) {
      this.resetCardRotations();
      this.selectedIndex -= 1;
      this.targetScrollIndex = this.selectedIndex;
      this.scrollIndex = this.selectedIndex;
      this.transitionDirection = 'prev';
      this.updateCardPositions();
      this.emitCurrentMovieChange();
    }
  }

  /**
   * 计算卡片目标位置、旋转角与缩放比例
   * @param immediate 是否立即应用无过渡
   */
  public updateCardPositions(immediate = false): void {
    this.cardMeshes.forEach((mesh, i) => {
      const dx = i - this.scrollIndex;

      let targetX = 0;
      let targetY = 0;
      let targetZ = 0;
      let targetRotY = 0;
      const targetRotX = 0;
      let targetScale = 1.0;

      if (this.state === VIEW_STATES.LIST) {
        mesh.visible = true;

        let currentSpacing = this.spacing;
        if (this.listViewMode === 'front') {
          currentSpacing = this.cardWidth + (this.isMobile ? 0.35 : 0.65);
        } else if (this.isMobile) {
          currentSpacing = this.spacing * 0.85;
        }

        targetX = dx * currentSpacing;
        targetY = 0;
        targetZ = 0;

        if (this.listViewMode === 'vertical') {
          targetRotY = Math.PI / 2; // 90° 侧面书脊视图
        } else if (this.listViewMode === 'front') {
          targetRotY = 0; // 0° 正面视图
        } else {
          targetRotY = Math.PI / 3.2; // 56° 斜角侧视图
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
            (i - this.selectedIndex) * (this.isMobile ? this.spacing * 0.85 : this.spacing) - 2.8;
          targetZ = -1.2;
          targetRotY = Math.PI / 2.8;
          targetScale = 0.9;
        } else {
          targetX =
            (i - this.selectedIndex) * (this.isMobile ? this.spacing * 0.85 : this.spacing) + 2.8;
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
          const panelWidth = 344; // 左侧信息面板占用宽度 (left-6: 24px + w-80: 320px)

          // 右侧剩余可用区域的屏幕中心偏移量 (相对画布正中)
          const centerOffsetPx = panelWidth / 2; // +172px
          const ndcX = centerOffsetPx / (width / 2); // 归一化屏幕坐标 [0, 1]

          // 根据当前透视相机与目标 Z 轴，反算居中于右侧区域所需的 3D 世界坐标 X
          const camZ = this.cameraTargetZ || this.camera.position.z;
          const dist = Math.max(camZ - detailTargetZ, 1.0);
          const fovRad = (this.camera.fov * Math.PI) / 180;
          const visibleHalfWidth = dist * Math.tan(fovRad / 2) * this.camera.aspect;
          detailTargetX = Math.max(0.6, Math.min(ndcX * visibleHalfWidth, 2.6));

          // 适度补偿相机拉远带来的体量收缩，保持封面饱满体量感
          const baseDist = 9.5 - 3.6; // 5.9 基准距离
          const zoomRatio = dist / baseDist;
          const compensatedScale = 0.92 * Math.min(Math.sqrt(zoomRatio), 1.25);

          // 校验右侧可用宽度是否能容纳补偿后的卡片，确保不与左侧面板或右侧边缘冲突
          const cardPixelWidth =
            ((this.cardWidth * compensatedScale) / (2 * visibleHalfWidth)) * width;
          const maxAllowedWidth = (width - panelWidth) * 0.75; // 最多占右侧可用空间的 75%
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

          // 详情模式切卡动画：强制设置切入起点，确保入场滑入动画必定触发
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
          // 上一张卡片退出动画：顺滑滑出屏幕边缘
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
            // 其他卡片退至远景隐藏
            mesh.visible = false;
            targetX = (i - this.selectedIndex) * 8.0;
            targetY = 0;
            targetZ = -15;
            targetRotY = 0;
            targetScale = 0.5;
          }
        }
      }

      mesh.targetPosition.set(targetX, targetY, targetZ);
      if (!this.isZoomDragging || i !== this.selectedIndex) {
        mesh.targetRotationY = targetRotY;
        mesh.targetRotationX = targetRotX;
      }
      mesh.targetScale = targetScale;

      if (immediate) {
        mesh.position.copy(mesh.targetPosition);
        mesh.rotation.y = mesh.targetRotationY;
        mesh.rotation.x = mesh.targetRotationX;
        mesh.scale.set(targetScale, targetScale, targetScale);
      }
    });

    // 重置过渡方向，避免被后续被动刷新（如 resize）重复消费
    this.transitionDirection = null;
  }

  // 60FPS 动画循环与惯性物理模拟
  private animate(): void {
    if (this.isDestroyed || this.isPaused) return;
    this.animId = requestAnimationFrame(this.animate.bind(this));

    // 1. 惯性物理模拟
    if (this.state === VIEW_STATES.LIST) {
      const count = this.movies.length;

      if (Math.abs(this.scrollVelocity) > 0.0001) {
        this.targetScrollIndex += this.scrollVelocity;
        this.targetScrollIndex = Math.max(
          0,
          Math.min(Math.max(count - 1, 0), this.targetScrollIndex)
        );
        this.scrollVelocity *= 0.88;
      } else {
        this.scrollVelocity = 0;
      }

      const diff = this.targetScrollIndex - this.scrollIndex;
      if (Math.abs(diff) > 0.0001) {
        this.scrollIndex += diff * 0.1;
        this.updateCardPositions();

        const roundedIndex = Math.round(this.scrollIndex);
        if (roundedIndex !== this.selectedIndex && roundedIndex >= 0 && roundedIndex < count) {
          this.selectedIndex = roundedIndex;
          this.emitCurrentMovieChange();
        }
      }
    }

    // 2. 顺滑 Lerp 运动插值
    const lerpSpeed = 0.12;

    // 顺滑插值相机 Z 轴位置 (列表与详情模式切换时提供沉浸式镜头推拉)
    if (Math.abs(this.camera.position.z - this.cameraTargetZ) > 0.001) {
      this.camera.position.z += (this.cameraTargetZ - this.camera.position.z) * 0.1;
      this.camera.updateProjectionMatrix();
    }

    this.cardMeshes.forEach((mesh) => {
      if (!mesh.visible) return;
      mesh.position.x += (mesh.targetPosition.x - mesh.position.x) * lerpSpeed;
      mesh.position.y += (mesh.targetPosition.y - mesh.position.y) * lerpSpeed;
      mesh.position.z += (mesh.targetPosition.z - mesh.position.z) * lerpSpeed;

      mesh.rotation.y += (mesh.targetRotationY - mesh.rotation.y) * lerpSpeed;
      mesh.rotation.x += (mesh.targetRotationX - mesh.rotation.x) * lerpSpeed;

      const currentScale = mesh.scale.x;
      const nextScale = currentScale + (mesh.targetScale - currentScale) * lerpSpeed;
      mesh.scale.set(nextScale, nextScale, nextScale);

      // DETAIL 模式下：如果旧卡片已滑出视野（距离目标中心足够远），将其隐藏以节约渲染开销
      if (this.state === VIEW_STATES.DETAIL && mesh.userData.index !== this.selectedIndex) {
        if (Math.abs(mesh.position.x - this.currentDetailTargetX) > 4.2) {
          mesh.visible = false;
        }
      }
    });

    this.renderer.render(this.scene, this.camera);
  }

  // 根据视口宽高比与当前视图模式更新相机目标 Z 轴距离
  private updateCameraTargetZ(immediate = false): void {
    if (!this.canvas) return;
    const aspect = this.camera.aspect;
    const baseCamZ = 9.5;
    let targetCamZ = baseCamZ;
    if (aspect < 1.6) {
      // 详情模式以单张聚焦封面为主，相机无需像列表模式那样大幅后退
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

  /**
   * 响应容器与视口尺寸变化，重新计算画布大小与相机视口
   * @param immediate 是否立即重置相机与卡片位置（默认 false，保持平滑插值过渡）
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

    // 自适应相机距离与视场，确保不同窗口宽高比下 3D 封面均完整展示不被裁切
    this.updateCameraTargetZ(isImmediate);
    this.updateCardPositions(isImmediate);

    const pixelRatio = this.renderer.getPixelRatio();
    const physicalWidth = Math.floor(width * pixelRatio);
    const physicalHeight = Math.floor(height * pixelRatio);

    if (this.canvas.width !== physicalWidth || this.canvas.height !== physicalHeight) {
      this.renderer.setSize(width, height);
      // WebGL 在修改物理像素尺寸后会清空绘制缓冲，立即同步补绘一帧，消除黑白闪烁与空白帧
      this.renderer.render(this.scene, this.camera);
    }
  }

  // 释放所有卡片的网格、材质与纹理
  private disposeCards(): void {
    this.cardMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => {
          if (mat !== this.plasticEdgeMat) {
            if ('map' in mat && mat.map) {
              (mat.map as THREE.Texture).dispose();
            }
            mat.dispose();
          }
        });
      }
    });
    this.cardMeshes = [];
  }

  /**
   * 完全销毁场景，释放 WebGL 上下文与所有监听，防止内存泄露
   */
  public destroy(): void {
    this.isDestroyed = true;

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

    this.disposeCards();

    if (this.boxGeometry) {
      this.boxGeometry.dispose();
    }
    if (this.plasticEdgeMat) {
      this.plasticEdgeMat.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
