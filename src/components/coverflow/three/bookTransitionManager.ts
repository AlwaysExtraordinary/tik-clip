/**
 * @file bookTransitionManager.ts
 * @description 3D Coverflow 书本翻开展开与实体光盘飞行动画子系统
 * 负责装配体构建、封面铰链展开/停留、窄屏惯性滑出、鼠标悬浮 3D 抬升与微倾斜动力学模拟、
 * 点击播放飞出推进、反向平滑收合、窗口尺寸重适应及动态资源生命周期安全卸载。
 */

import * as THREE from 'three';
import { CoverflowMovie } from '../types';
import {
  createDiscCanvas,
  createDiscShadowCanvas,
  createDiscSheenCanvas,
  createLeftInsideCanvas,
  createRightInsideCanvas,
} from './bookCanvasGenerators';
import { BOOK_ANIM_CONFIG, CARD_CONFIG } from './config';
import { DiscHoverEffect } from './discHoverEffect';
import {
  clamp,
  easeInOutCubic,
  easeOutBack,
  normalizeAngle,
  smoothInertiaPulse,
} from './mathUtils';
import { BookOpenTransitionOptions, CardMesh, ThemeMode } from './types';

/** 书本装配体过渡生命周期状态 */
export type BookTransitionState =
  'idle' | 'pre_flipping' | 'opening' | 'opened' | 'closing' | 'flying_out';

/**
 * 3D 书本翻开展开、实体光盘飞出与交互动力学管理器
 */
export class BookTransitionManager {
  private transitionState: BookTransitionState = 'idle';
  private hoverEffect = new DiscHoverEffect();

  // 播放前翻转回正面
  private preFlipStartTime = 0;
  private preFlipStartRotY = 0;
  private preFlipStartRotX = 0;
  private preFlipOptions: BookOpenTransitionOptions | null = null;
  private preFlipSelectedMesh: CardMesh | null = null;

  // 3D 装配体总成
  private bookAssembly: THREE.Group | null = null;
  private bookCoverGroup: THREE.Group | null = null;
  private bookCoverMaterials: THREE.Material[] = [];
  private bookFrontCoverPivot: THREE.Group | null = null;
  private bookDiscMesh: THREE.Mesh | null = null;
  private bookDiscSheenMesh: THREE.Mesh | null = null;
  private bookDiscShadowMesh: THREE.Mesh | null = null;
  private bookDiscRestPos = new THREE.Vector3();
  private bookStartPos = new THREE.Vector3();

  // 动画插值与计时
  private isOpeningToPlay = false;
  private openStartTime = 0;
  private closeStartTime = 0;
  private closeStartCoverAngle = 0;
  private closeStartDiscY = 0;
  private closeStartDiscRotZ = 0;
  private closeStartDiscRotX = 0;
  private closeStartDiscRotY = 0;
  private closeStartDiscPos = new THREE.Vector3();
  private closeStartShadowOpacity = 0.22;
  private closeStartShadowScale = 1.0;
  private flyoutStartTime = 0;
  private flyoutStartRotZ = 0;
  private bookOpenOnComplete?: () => void;

  // 窄屏光盘边缘惯性位移动力学
  private narrowOpenInertiaStartTime = 0;
  private narrowCloseInertiaStartTime = 0;
  private closeStartCoverY = 0;


  // 动态创建的资源集合，用于安全释放
  private bookCreatedTextures: THREE.Texture[] = [];
  private bookCreatedMaterials: THREE.Material[] = [];
  private bookCreatedGeometries: THREE.BufferGeometry[] = [];

  // 封面展开/收起状态变更通知
  public onCoverStateChange?: (isOpen: boolean) => void;

  // 获取当前状态
  public get state(): BookTransitionState {
    return this.transitionState;
  }

  // 获取当前过渡是否处于进行中（阻止切卡等冲突交互）
  public get isTransitioning(): boolean {
    return (
      this.transitionState === 'opening' ||
      this.transitionState === 'closing' ||
      this.transitionState === 'flying_out' ||
      this.transitionState === 'pre_flipping'
    );
  }

  // 获取封面当前是否处于展开显示状态（用于控制按钮隐藏与场景交互）
  public get isCoverOpen(): boolean {
    return (
      this.transitionState === 'opening' ||
      this.transitionState === 'opened' ||
      this.transitionState === 'closing'
    );
  }

  // 获取封面当前是否处于完全就绪展开状态
  public get isOpened(): boolean {
    return this.transitionState === 'opened';
  }

  // 获取当前是否处于播放前背面翻转回正面状态
  public get isPreFlipping(): boolean {
    return this.transitionState === 'pre_flipping';
  }

  // 获取鼠标是否悬浮在光盘上
  public get isHoveringDisc(): boolean {
    return this.hoverEffect.hovered;
  }

  // 计算实体光盘在 3D 空间中的世界半径
  private getDiscRadius(): number {
    const { disc: discCfg, canvas: canvasCfg } = BOOK_ANIM_CONFIG;
    return (discCfg.outerRadius / canvasCfg.width) * CARD_CONFIG.width;
  }

  // 计算窄屏模式下光盘完整滑出的目标 Y 坐标
  private getNarrowExitY(): number {
    const { narrow } = BOOK_ANIM_CONFIG;
    return -CARD_CONFIG.height / 2 - this.getDiscRadius() - narrow.exitMargin;
  }

  /**
   * 同步更新光盘网格与柔和立体投影的位置
   * @param x X 轴坐标
   * @param y Y 轴坐标
   * @param z Z 轴坐标
   */
  private setDiscAndShadowPosition(x: number, y: number, z: number): void {
    if (this.bookDiscMesh) {
      this.bookDiscMesh.position.set(x, y, z);
    }
    if (this.bookDiscShadowMesh) {
      this.bookDiscShadowMesh.position.set(x, y, z - 0.0015);
    }
  }

  /**
   * 注册并托管封面部件材质生命周期
   * @param mat 待托管的材质对象
   */
  private registerCoverMaterial<T extends THREE.Material>(mat: T): T {
    this.bookCreatedMaterials.push(mat);
    this.bookCoverMaterials.push(mat);
    return mat;
  }

  /**
   * 克隆封面材质并配置透明度与生命周期托管
   * @param sourceMat 源材质
   */
  private createManagedCoverMaterial(sourceMat: THREE.Material): THREE.Material {
    const mat = sourceMat.clone();
    mat.transparent = true;
    mat.opacity = 1.0;
    return this.registerCoverMaterial(mat);
  }

  /**
   * 创建独立的 3D 实体光盘网格模型
   * @param themeMode 主题模式
   * @param frontImage 封面正面原始图像
   */
  private createDiscMesh(
    themeMode: ThemeMode,
    frontImage?: HTMLCanvasElement | HTMLImageElement
  ): THREE.Mesh {
    const W = CARD_CONFIG.width;
    const { disc, canvas } = BOOK_ANIM_CONFIG;
    const discDiameterWorld = ((2 * disc.outerRadius) / canvas.width) * W;
    const discGeo = new THREE.PlaneGeometry(discDiameterWorld, discDiameterWorld);
    this.bookCreatedGeometries.push(discGeo);

    const discCanvas = createDiscCanvas(themeMode, frontImage);
    const discTex = new THREE.CanvasTexture(discCanvas);
    discTex.colorSpace = THREE.SRGBColorSpace;
    this.bookCreatedTextures.push(discTex);

    const discMat = new THREE.MeshBasicMaterial({
      map: discTex,
      transparent: true,
      depthWrite: true,
      alphaTest: 0.005,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.bookCreatedMaterials.push(discMat);

    const discMesh = new THREE.Mesh(discGeo, discMat);
    discMesh.rotation.order = 'ZYX';

    // 创建独立的光盘各向异性彩虹激光反射光斑网格
    const discSheenCanvas = createDiscSheenCanvas();
    const discSheenTex = new THREE.CanvasTexture(discSheenCanvas);
    discSheenTex.colorSpace = THREE.SRGBColorSpace;
    this.bookCreatedTextures.push(discSheenTex);

    const discSheenMat = new THREE.MeshBasicMaterial({
      map: discSheenTex,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.bookCreatedMaterials.push(discSheenMat);

    const discSheenMesh = new THREE.Mesh(discGeo, discSheenMat);
    discSheenMesh.position.set(0, 0, 0.0006);
    discSheenMesh.renderOrder = 12;
    discSheenMesh.raycast = () => {};
    discMesh.add(discSheenMesh);
    this.bookDiscSheenMesh = discSheenMesh;

    return discMesh;
  }

  /**
   * 为指定视频构建 3D 书本展开装配体模型（底盒内页 + 实体光盘 + 柔和投影 + 封面铰链）
   * @param movie 电影数据
   * @param selectedMesh 当前选中的卡片网格
   * @param plasticEdgeMat 默认塑料边框材质
   * @param themeMode 主题模式
   */
  private createBookAssembly(
    movie: CoverflowMovie,
    selectedMesh: CardMesh,
    plasticEdgeMat: THREE.Material,
    themeMode: ThemeMode
  ): THREE.Group {
    const group = new THREE.Group();
    const W = CARD_CONFIG.width;
    const H = CARD_CONFIG.height;
    const D = CARD_CONFIG.depth;
    const coverThickness = BOOK_ANIM_CONFIG.thickness;

    const materials = selectedMesh ? (selectedMesh.material as THREE.Material[]) : [];
    const spineMat = materials[1] || plasticEdgeMat;
    const frontMat = materials[4] || plasticEdgeMat;
    const backMat = materials[5] || plasticEdgeMat;

    this.bookCoverMaterials = [];

    // 1. 书本封面与托盘底盒总成 (Tray Assembly)
    const coverGroup = new THREE.Group();
    const baseDepth = D - coverThickness;
    const trayGeo = new THREE.BoxGeometry(W, H, baseDepth);
    this.bookCreatedGeometries.push(trayGeo);

    const frontImage =
      frontMat instanceof THREE.MeshBasicMaterial && frontMat.map?.image
        ? (frontMat.map.image as HTMLCanvasElement | HTMLImageElement)
        : undefined;

    // 右侧内页艺术衬纸与模具托盘
    const rightInsideCanvas = createRightInsideCanvas(movie, themeMode);
    const rightInsideTex = new THREE.CanvasTexture(rightInsideCanvas);
    rightInsideTex.colorSpace = THREE.SRGBColorSpace;
    rightInsideTex.generateMipmaps = false;
    rightInsideTex.minFilter = THREE.LinearFilter;
    rightInsideTex.magFilter = THREE.LinearFilter;
    rightInsideTex.needsUpdate = true;
    this.bookCreatedTextures.push(rightInsideTex);

    const rightInsideMat = this.registerCoverMaterial(
      new THREE.MeshBasicMaterial({
        map: rightInsideTex,
        transparent: true,
        opacity: 1.0,
      })
    );

    // 克隆塑料边框、书脊与封底材质
    const edgeMat = this.createManagedCoverMaterial(plasticEdgeMat);
    const spineMatClone = this.createManagedCoverMaterial(spineMat);
    const backMatClone = this.createManagedCoverMaterial(backMat);

    const trayMesh = new THREE.Mesh(trayGeo, [
      edgeMat, // +X 右侧边
      spineMatClone, // -X 左侧书脊
      edgeMat, // +Y 顶部边
      edgeMat, // -Y 底部边
      rightInsideMat, // +Z 右侧内页托盘表面
      backMatClone, // -Z 封底背板
    ]);
    trayMesh.position.set(0, 0, -coverThickness / 2);
    coverGroup.add(trayMesh);

    // 2. 封面铰链总成 (Front Cover Pivot Group)
    const pivot = new THREE.Group();
    pivot.position.set(-W / 2, 0, D / 2 - coverThickness);

    // 左侧内页衬纸 Canvas 贴图
    const leftInsideCanvas = createLeftInsideCanvas(movie, themeMode);
    const leftInsideTex = new THREE.CanvasTexture(leftInsideCanvas);
    leftInsideTex.colorSpace = THREE.SRGBColorSpace;
    leftInsideTex.generateMipmaps = false;
    leftInsideTex.minFilter = THREE.LinearFilter;
    leftInsideTex.magFilter = THREE.LinearFilter;
    leftInsideTex.needsUpdate = true;
    this.bookCreatedTextures.push(leftInsideTex);

    const insideLeftMat = this.registerCoverMaterial(
      new THREE.MeshBasicMaterial({
        map: leftInsideTex,
        side: THREE.FrontSide,
        transparent: true,
        opacity: 1.0,
      })
    );

    // 正面封面单板 (+Z 闭合时朝向相机)
    const frontPlateGeo = new THREE.PlaneGeometry(W, H);
    this.bookCreatedGeometries.push(frontPlateGeo);

    const frontPlateMat =
      frontMat instanceof THREE.MeshBasicMaterial
        ? new THREE.MeshBasicMaterial({
            map: frontMat.map,
            color: frontMat.color,
            side: THREE.FrontSide,
            transparent: true,
            opacity: 1.0,
          })
        : frontMat.clone();
    frontPlateMat.transparent = true;
    frontPlateMat.opacity = 1.0;
    this.registerCoverMaterial(frontPlateMat);

    const frontPlate = new THREE.Mesh(frontPlateGeo, frontPlateMat);
    frontPlate.position.set(W / 2, 0, coverThickness);
    pivot.add(frontPlate);

    // 内衬背面单板 (展开到 -180° 后朝向相机)
    const insidePlateGeo = new THREE.PlaneGeometry(W, H);
    this.bookCreatedGeometries.push(insidePlateGeo);

    const insidePlate = new THREE.Mesh(insidePlateGeo, insideLeftMat);
    insidePlate.position.set(W / 2, 0, 0);
    insidePlate.rotation.y = Math.PI;
    pivot.add(insidePlate);

    coverGroup.add(pivot);
    this.bookFrontCoverPivot = pivot;
    this.bookCoverGroup = coverGroup;
    group.add(coverGroup);

    // 3. 独立 3D 实体光盘网格与柔和立体投影
    const discMesh = this.createDiscMesh(themeMode, frontImage);
    discMesh.renderOrder = 10;
    const restY = (0.5 - BOOK_ANIM_CONFIG.disc.centerY / BOOK_ANIM_CONFIG.canvas.height) * H;
    const restZ = D / 2 - coverThickness + 0.003;
    this.bookDiscRestPos.set(0, restY, restZ);
    discMesh.position.copy(this.bookDiscRestPos);

    // 柔和投影网格
    const discDiameterWorld =
      ((2 * BOOK_ANIM_CONFIG.disc.outerRadius) / BOOK_ANIM_CONFIG.canvas.width) * W;
    const shadowGeo = new THREE.PlaneGeometry(discDiameterWorld * 1.06, discDiameterWorld * 1.06);
    this.bookCreatedGeometries.push(shadowGeo);

    const shadowCanvas = createDiscShadowCanvas();
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    shadowTex.colorSpace = THREE.SRGBColorSpace;
    this.bookCreatedTextures.push(shadowTex);

    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    this.bookCreatedMaterials.push(shadowMat);

    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.renderOrder = 9;
    shadowMesh.position.set(0, restY, restZ - 0.0015);
    group.add(shadowMesh);
    this.bookDiscShadowMesh = shadowMesh;

    group.add(discMesh);
    this.bookDiscMesh = discMesh;

    return group;
  }

  // 组装并启动展开装配体
  private startAssemblyAndOpen(
    options: BookOpenTransitionOptions,
    selectedMesh: CardMesh,
    plasticEdgeMat: THREE.Material,
    themeMode: ThemeMode,
    scene: THREE.Scene,
    onHideOtherCards: () => void
  ): void {
    this.transitionState = 'opening';
    this.openStartTime = performance.now();
    this.bookOpenOnComplete = options.onComplete;
    this.narrowOpenInertiaStartTime = 0;
    this.narrowCloseInertiaStartTime = 0;
    this.closeStartCoverY = 0;

    selectedMesh.rotation.set(0, 0, 0);
    selectedMesh.targetRotationY = 0;
    selectedMesh.targetRotationX = 0;

    this.bookStartPos.copy(selectedMesh.position);
    onHideOtherCards();

    this.bookAssembly = this.createBookAssembly(
      options.movie,
      selectedMesh,
      plasticEdgeMat,
      themeMode
    );
    this.bookAssembly.position.copy(selectedMesh.position);
    this.bookAssembly.rotation.set(0, 0, 0);
    this.bookAssembly.scale.copy(selectedMesh.scale);
    scene.add(this.bookAssembly);

    this.onCoverStateChange?.(true);
  }

  /**
   * 准备并启动书本装配体展开流程（支持单纯展开停留或展开后连贯播放）
   * @param options 过渡选项
   * @param selectedMesh 当前卡片网格
   * @param plasticEdgeMat 塑料边框材质
   * @param themeMode 主题模式
   * @param scene Three.js 场景对象
   * @param onHideOtherCards 隐藏背景卡片回调
   * @param toPlay 是否在展开完成后连贯过渡到视频播放
   */
  private prepareCoverTransition(
    options: BookOpenTransitionOptions,
    selectedMesh: CardMesh,
    plasticEdgeMat: THREE.Material,
    themeMode: ThemeMode,
    scene: THREE.Scene,
    onHideOtherCards: () => void,
    toPlay: boolean
  ): void {
    this.isOpeningToPlay = toPlay;

    const currentRotY = normalizeAngle(selectedMesh.rotation.y);
    const isBackFacing = Math.abs(currentRotY) > 0.05;

    if (isBackFacing) {
      this.transitionState = 'pre_flipping';
      this.preFlipStartTime = performance.now();
      this.preFlipStartRotY = currentRotY;
      this.preFlipStartRotX = selectedMesh.rotation.x;
      this.preFlipOptions = options;
      this.preFlipSelectedMesh = selectedMesh;
      selectedMesh.targetRotationY = 0;
      selectedMesh.targetRotationX = 0;
      this.onCoverStateChange?.(true);
      return;
    }

    this.startAssemblyAndOpen(
      options,
      selectedMesh,
      plasticEdgeMat,
      themeMode,
      scene,
      onHideOtherCards
    );
  }

  /**
   * 打开封面展开并停留在 180°（宽屏）/ 底部滑出（窄屏）
   * @param options 过渡选项
   * @param selectedMesh 当前卡片网格
   * @param plasticEdgeMat 塑料边框材质
   * @param themeMode 主题模式
   * @param scene Three.js 场景对象
   * @param onHideOtherCards 隐藏背景卡片回调
   */
  public openCover(
    options: BookOpenTransitionOptions,
    selectedMesh: CardMesh | undefined,
    plasticEdgeMat: THREE.Material,
    themeMode: ThemeMode,
    scene: THREE.Scene,
    onHideOtherCards: () => void
  ): void {
    if (this.isCoverOpen || !selectedMesh) return;
    this.prepareCoverTransition(
      options,
      selectedMesh,
      plasticEdgeMat,
      themeMode,
      scene,
      onHideOtherCards,
      false
    );
  }

  /**
   * 执行完整的书本展开并过渡到视频播放
   * 若当前已在 180° 展开停留状态，则平滑执行后续飞出
   * @param options 过渡选项
   * @param selectedMesh 当前卡片网格
   * @param plasticEdgeMat 塑料边框材质
   * @param themeMode 主题模式
   * @param scene Three.js 场景对象
   * @param onHideOtherCards 隐藏背景卡片回调
   */
  public play(
    options: BookOpenTransitionOptions,
    selectedMesh: CardMesh | undefined,
    plasticEdgeMat: THREE.Material,
    themeMode: ThemeMode,
    scene: THREE.Scene,
    onHideOtherCards: () => void
  ): void {
    if (this.transitionState === 'opened') {
      this.playFromOpened(options.onComplete);
      return;
    }

    if (this.isTransitioning || !selectedMesh) {
      options.onComplete?.();
      return;
    }

    this.prepareCoverTransition(
      options,
      selectedMesh,
      plasticEdgeMat,
      themeMode,
      scene,
      onHideOtherCards,
      true
    );
  }

  /**
   * 平滑收起已展开的封面
   */
  public closeCover(): void {
    if (this.transitionState !== 'opened' && this.transitionState !== 'opening') return;

    this.closeStartTime = performance.now();
    this.closeStartCoverAngle = this.bookFrontCoverPivot?.rotation.y ?? -Math.PI;
    this.closeStartDiscY = this.bookDiscMesh?.position.y ?? this.bookDiscRestPos.y;
    this.closeStartCoverY = this.bookCoverGroup?.position.y ?? 0;
    this.narrowCloseInertiaStartTime = 0;

    // 规范化当前光盘 Z 轴旋转弧度至 (-π, π]，确保恢复动画以最短路径平滑旋回 0
    this.closeStartDiscRotZ = normalizeAngle(this.bookDiscMesh?.rotation.z ?? 0);
    this.closeStartDiscRotX = this.bookDiscMesh?.rotation.x ?? 0;
    this.closeStartDiscRotY = this.bookDiscMesh?.rotation.y ?? 0;
    this.closeStartDiscPos.copy(this.bookDiscMesh?.position ?? this.bookDiscRestPos);

    if (this.bookDiscShadowMesh) {
      const mat = this.bookDiscShadowMesh.material as THREE.MeshBasicMaterial;
      this.closeStartShadowOpacity = mat?.opacity ?? 0.22;
      this.closeStartShadowScale = this.bookDiscShadowMesh.scale.x;
    }

    this.hoverEffect.stopHover();
    this.transitionState = 'closing';
  }

  /**
   * 从已展开停顿状态启动飞向镜头的后半段飞行动画并播放视频
   * @param onComplete 播放跳转回调
   */
  public playFromOpened(onComplete?: () => void): void {
    if (this.transitionState !== 'opened') {
      onComplete?.();
      return;
    }

    this.flyoutStartTime = performance.now();
    this.flyoutStartRotZ = this.hoverEffect.discRotation;
    if (onComplete) {
      this.bookOpenOnComplete = onComplete;
    }

    this.hoverEffect.reset(
      this.bookDiscMesh,
      this.bookDiscShadowMesh,
      this.bookDiscRestPos,
      this.bookDiscSheenMesh
    );
    this.transitionState = 'flying_out';
  }

  // 获取当前是否正处于光盘拖拽旋转状态
  public get isDraggingDisc(): boolean {
    return this.hoverEffect.isDraggingDisc;
  }

  // 消耗拖拽旋转事件（防止触发点击播放）
  public consumeDiscDrag(): boolean {
    return this.hoverEffect.consumeDrag();
  }

  /**
   * 拖拽按下处理
   * @param raycaster Three.js 射线对象
   * @param camera 相机对象
   * @param clientX 屏幕 X 坐标
   * @param clientY 屏幕 Y 坐标
   * @param canvasRect 画布视口边界矩形
   */
  public handlePointerDown(
    raycaster: THREE.Raycaster,
    camera: THREE.Camera,
    clientX: number,
    clientY: number,
    canvasRect: DOMRect
  ): boolean {
    if (this.transitionState !== 'opened') return false;
    return this.hoverEffect.handlePointerDown(
      raycaster,
      camera,
      this.bookDiscMesh,
      clientX,
      clientY,
      canvasRect
    );
  }

  /**
   * 拖拽移动处理
   * @param raycaster Three.js 射线对象
   * @param camera 相机对象
   * @param clientX 屏幕 X 坐标
   * @param clientY 屏幕 Y 坐标
   * @param canvasRect 画布视口边界矩形
   */
  public handlePointerMoveDrag(
    raycaster: THREE.Raycaster,
    camera: THREE.Camera,
    clientX: number,
    clientY: number,
    canvasRect: DOMRect
  ): void {
    if (this.transitionState !== 'opened') return;
    this.hoverEffect.handlePointerMoveDrag(
      raycaster,
      camera,
      this.bookDiscMesh,
      clientX,
      clientY,
      canvasRect
    );
  }

  // 释放光盘拖拽
  public handlePointerUp(): void {
    this.hoverEffect.handlePointerUp();
  }

  /**
   * 处理鼠标悬浮射线检测
   * @param raycaster Three.js 射线对象
   */
  public handlePointerMove(raycaster: THREE.Raycaster): boolean {
    if (this.transitionState !== 'opened') return false;
    return this.hoverEffect.handlePointer(raycaster, this.bookDiscMesh);
  }

  /**
   * 处理点击测试交互分发
   * @param raycaster Three.js 射线对象
   */
  public handleClick(raycaster: THREE.Raycaster): 'disc' | 'cover' | 'outside' {
    if (this.transitionState !== 'opened') return 'outside';

    if (this.bookDiscMesh && this.bookDiscMesh.visible) {
      const discHits = raycaster.intersectObject(this.bookDiscMesh, false);
      if (discHits.length > 0) return 'disc';
    }

    if (this.bookAssembly) {
      const coverHits = raycaster.intersectObject(this.bookAssembly, true);
      if (coverHits.length > 0) return 'cover';
    }

    return 'outside';
  }


  /**
   * 逐帧更新 3D 书本翻开与飞碟飞行动画
   * @param now 当前时间戳
   * @param camera 相机对象
   * @param isNarrow 是否为窄屏模式
   * @param cardLerpSpeed 插值速度
   * @param selectedMesh 当前选中的卡片网格
   * @param scene Three.js 场景对象
   */
  private updateBookTransition(
    now: number,
    camera: THREE.PerspectiveCamera,
    isNarrow: boolean,
    cardLerpSpeed: number,
    selectedMesh: CardMesh | undefined,
    scene: THREE.Scene
  ): void {
    if (!this.bookAssembly || !this.bookFrontCoverPivot) return;

    const { wide, narrow, retreat } = BOOK_ANIM_CONFIG;
    const exitY = this.getNarrowExitY();

    // 1. 展开过程 (Phase 1)
    if (this.transitionState === 'opening') {
      const openDuration = isNarrow
        ? narrow.duration * narrow.slideOutRatio
        : wide.duration * wide.coverOpenRatio;
      const elapsed = now - this.openStartTime;
      const t = clamp(elapsed / openDuration, 0, 1);

      if (isNarrow) {
        this.bookFrontCoverPivot.rotation.y = 0;
        // 窄屏向下滑出：仅在展开封面停留查看时产生惯性回弹 (easeOutBack)，直接播放视频过渡时保持平滑无回弹 (easeInOutCubic)
        const easeSlide = this.isOpeningToPlay ? easeInOutCubic(t) : easeOutBack(t, 1.35);
        const targetDiscY = THREE.MathUtils.lerp(this.bookDiscRestPos.y, exitY, easeSlide);

        this.setDiscAndShadowPosition(
          this.bookDiscRestPos.x,
          targetDiscY,
          this.bookDiscRestPos.z
        );

        // 光盘向下滑动到封面边缘时，给封面一个轻微向下的惯性位移然后平滑恢复
        const coverBottomEdge = -CARD_CONFIG.height / 2;
        const discEdgeContactY = coverBottomEdge + this.getDiscRadius();
        if (this.narrowOpenInertiaStartTime === 0 && targetDiscY <= discEdgeContactY) {
          this.narrowOpenInertiaStartTime = now;
        }

        if (this.bookCoverGroup) {
          if (this.narrowOpenInertiaStartTime > 0) {
            const elapsedInertia = now - this.narrowOpenInertiaStartTime;
            const uInertia = clamp(elapsedInertia / narrow.openInertiaDuration, 0, 1);
            const pulse = smoothInertiaPulse(uInertia, 0.35);
            this.bookCoverGroup.position.y = -pulse * narrow.edgeInertiaOffset;
          } else {
            this.bookCoverGroup.position.y = 0;
          }
        }
      } else {
        if (this.bookCoverGroup) {
          this.bookCoverGroup.position.y = 0;
        }
        // 宽屏就地展开至 180° (-π)
        const easeCover = easeInOutCubic(t);
        this.bookFrontCoverPivot.rotation.y = wide.coverOpenMaxAngle * easeCover;
        this.setDiscAndShadowPosition(
          this.bookDiscRestPos.x,
          this.bookDiscRestPos.y,
          this.bookDiscRestPos.z
        );
      }

      if (t >= 1) {
        if (this.bookCoverGroup) {
          this.bookCoverGroup.position.y = 0;
        }
        if (this.isOpeningToPlay) {
          this.flyoutStartTime = now;
          this.transitionState = 'flying_out';
        } else {
          if (isNarrow) {
            this.setDiscAndShadowPosition(
              this.bookDiscRestPos.x,
              exitY,
              this.bookDiscRestPos.z
            );
          } else {
            this.bookFrontCoverPivot.rotation.y = wide.coverOpenMaxAngle;
          }
          this.transitionState = 'opened';
        }
      }
      return;
    }

    // 2. 停留在 180° 展开或窄屏滑出状态，执行鼠标悬浮 3D 抬起与微倾斜物理插值
    if (this.transitionState === 'opened') {
      if (this.bookCoverGroup) {
        this.bookCoverGroup.position.y = 0;
      }
      const restPos = isNarrow
        ? new THREE.Vector3(this.bookDiscRestPos.x, exitY, this.bookDiscRestPos.z)
        : this.bookDiscRestPos;

      this.hoverEffect.update(
        this.bookDiscMesh,
        this.bookDiscShadowMesh,
        restPos,
        cardLerpSpeed * 1.2,
        this.bookDiscSheenMesh
      );
      return;
    }

    // 3. 点击外部区域或 Esc 触发的反向收起动画
    if (this.transitionState === 'closing') {
      const closeDuration = isNarrow ? 520 : 640;
      const elapsed = now - this.closeStartTime;
      const t = clamp(elapsed / closeDuration, 0, 1);
      const ease = easeInOutCubic(t);

      // 光盘自旋与微倾斜平滑复位到 0
      if (this.bookDiscMesh) {
        const targetRotZ = THREE.MathUtils.lerp(this.closeStartDiscRotZ, 0, ease);
        const targetRotX = THREE.MathUtils.lerp(this.closeStartDiscRotX, 0, ease);
        const targetRotY = THREE.MathUtils.lerp(this.closeStartDiscRotY, 0, ease);
        this.bookDiscMesh.rotation.set(targetRotX, targetRotY, targetRotZ);
        if (this.bookDiscSheenMesh) {
          this.bookDiscSheenMesh.rotation.z = -targetRotZ;
        }
      }

      if (isNarrow) {
        const targetDiscY = THREE.MathUtils.lerp(
          this.closeStartDiscY,
          this.bookDiscRestPos.y,
          ease
        );
        const targetDiscZ = THREE.MathUtils.lerp(
          this.closeStartDiscPos.z,
          this.bookDiscRestPos.z,
          ease
        );

        this.setDiscAndShadowPosition(this.bookDiscRestPos.x, targetDiscY, targetDiscZ);

        // 光盘向上滑动接触封面边缘时，给封面一个轻微向上的位移然后平滑恢复
        const coverBottomEdge = -CARD_CONFIG.height / 2;
        const discTouchEdgeY = coverBottomEdge - this.getDiscRadius();
        if (
          this.narrowCloseInertiaStartTime === 0 &&
          this.closeStartDiscY < discTouchEdgeY + 0.1 &&
          targetDiscY >= discTouchEdgeY
        ) {
          this.narrowCloseInertiaStartTime = now;
        }

        if (this.bookCoverGroup) {
          let coverY = 0;
          if (this.narrowCloseInertiaStartTime > 0) {
            const elapsedInertia = now - this.narrowCloseInertiaStartTime;
            const uInertia = clamp(elapsedInertia / narrow.closeInertiaDuration, 0, 1);
            const pulse = smoothInertiaPulse(uInertia, 0.35);
            coverY = pulse * narrow.edgeInertiaOffset;
          }
          // 若收合前封面有残余位移（如展开中途被打断），平滑衰减并叠加冲量
          if (this.closeStartCoverY !== 0) {
            coverY += THREE.MathUtils.lerp(this.closeStartCoverY, 0, ease);
          }
          this.bookCoverGroup.position.y = coverY;
        }
      } else {
        if (this.bookCoverGroup) {
          this.bookCoverGroup.position.y = 0;
        }
        const targetAngle = THREE.MathUtils.lerp(this.closeStartCoverAngle, 0, ease);
        this.bookFrontCoverPivot.rotation.y = targetAngle;

        const targetDiscZ = THREE.MathUtils.lerp(
          this.closeStartDiscPos.z,
          this.bookDiscRestPos.z,
          ease
        );
        this.setDiscAndShadowPosition(
          this.bookDiscRestPos.x,
          this.bookDiscRestPos.y,
          targetDiscZ
        );
      }

      // 柔和投影网格不透明度与缩放平滑复原
      if (this.bookDiscShadowMesh) {
        const shadowMat = this.bookDiscShadowMesh.material as THREE.MeshBasicMaterial;
        if (shadowMat) {
          shadowMat.opacity = THREE.MathUtils.lerp(this.closeStartShadowOpacity, 0.22, ease);
        }
        const s = THREE.MathUtils.lerp(this.closeStartShadowScale, 1.0, ease);
        this.bookDiscShadowMesh.scale.set(s, s, 1);
      }

      if (t >= 1) {
        if (this.bookCoverGroup) {
          this.bookCoverGroup.position.y = 0;
        }
        this.reset(selectedMesh, scene);
      }
      return;
    }

    // 4. 点击光盘或直接播放触发的 Phase 2：光盘旋转、放大飞向镜头，封面后撤渐隐
    if (this.transitionState === 'flying_out') {
      const flyoutZOffset = isNarrow ? narrow.discFlyoutZOffset : wide.discFlyoutZOffset;
      const targetWorldZ = this.bookStartPos.z + flyoutZOffset;
      const targetWorldCenter = new THREE.Vector3(0, camera.position.y, targetWorldZ);
      const targetLocal = this.bookAssembly.worldToLocal(targetWorldCenter.clone());

      const flyDuration = isNarrow
        ? narrow.duration * (1 - narrow.slideOutRatio)
        : wide.duration * (1 - wide.coverOpenRatio);
      const elapsed = now - this.flyoutStartTime;
      const p = clamp(elapsed / flyDuration, 0, 1);
      const easeFly = easeInOutCubic(p);

      if (this.bookDiscShadowMesh) {
        const shadowMat = this.bookDiscShadowMesh.material as THREE.MeshBasicMaterial;
        if (shadowMat) {
          shadowMat.opacity = THREE.MathUtils.lerp(0.22, 0, p);
        }
      }

      if (isNarrow) {
        this.bookFrontCoverPivot.rotation.y = 0;
        if (this.bookDiscMesh) {
          const targetDiscX = THREE.MathUtils.lerp(
            THREE.MathUtils.lerp(this.bookDiscRestPos.x, targetLocal.x, narrow.xAlignRatio),
            targetLocal.x,
            easeFly
          );
          const targetDiscY = THREE.MathUtils.lerp(exitY, targetLocal.y, easeFly);
          const targetDiscZ = THREE.MathUtils.lerp(this.bookDiscRestPos.z, targetLocal.z, easeFly);

          const flightTilt = Math.sin(p * Math.PI);
          const targetDiscRotX = flightTilt * narrow.flightTiltX;
          const targetDiscRotY = flightTilt * narrow.flightTiltY;

          const targetDiscScale = THREE.MathUtils.lerp(1.0, narrow.discFlyoutScale, easeFly);
          const targetDiscRotZ = this.flyoutStartRotZ - narrow.discSpinAngle * easeFly;

          this.bookDiscMesh.position.set(targetDiscX, targetDiscY, targetDiscZ);
          this.bookDiscMesh.rotation.set(targetDiscRotX, targetDiscRotY, targetDiscRotZ);
          this.bookDiscMesh.scale.set(targetDiscScale, targetDiscScale, targetDiscScale);
          if (this.bookDiscSheenMesh) {
            this.bookDiscSheenMesh.rotation.z = -targetDiscRotZ;
          }
        }
      } else {
        this.bookFrontCoverPivot.rotation.y = wide.coverOpenMaxAngle;
        if (this.bookDiscMesh) {
          const detachCurve = 28.935 * p * p * (1 - p) * (1 - p) * (1 - p);
          const detachRight =
            (detachCurve * wide.discDetachRightOffset) / this.bookAssembly.scale.x;
          const targetDiscX =
            THREE.MathUtils.lerp(this.bookDiscRestPos.x, targetLocal.x, easeFly) + detachRight;
          const targetDiscY = THREE.MathUtils.lerp(this.bookDiscRestPos.y, targetLocal.y, easeFly);

          const liftZ =
            Math.sin(Math.min(1, p * 2) * Math.PI * 0.5) *
            (wide.discDetachLiftZ / this.bookAssembly.scale.z);
          const targetDiscZ =
            THREE.MathUtils.lerp(this.bookDiscRestPos.z, targetLocal.z, easeFly) + liftZ;

          const targetDiscScale = THREE.MathUtils.lerp(1.0, wide.discFlyoutScale, easeFly);
          const targetDiscRotZ = this.flyoutStartRotZ - wide.discSpinAngle * easeFly;

          const flightTilt = Math.sin(p * Math.PI);
          const targetDiscRotX = flightTilt * wide.flightTiltX;
          const targetDiscRotY = flightTilt * wide.flightTiltY;

          this.bookDiscMesh.position.set(targetDiscX, targetDiscY, targetDiscZ);
          this.bookDiscMesh.rotation.set(targetDiscRotX, targetDiscRotY, targetDiscRotZ);
          this.bookDiscMesh.scale.set(targetDiscScale, targetDiscScale, targetDiscScale);
          if (this.bookDiscSheenMesh) {
            this.bookDiscSheenMesh.rotation.z = -targetDiscRotZ;
          }
        }
      }

      // 封面后撤与渐隐
      if (this.bookCoverGroup) {
        let retreatZ = 0;
        if (p > retreat.startRatio) {
          const pRetreat = clamp((p - retreat.startRatio) / (1 - retreat.startRatio), 0, 1);
          retreatZ = (retreat.distance / this.bookAssembly.scale.z) * easeInOutCubic(pRetreat);
        }
        this.bookCoverGroup.position.z = -retreatZ;

        let coverOpacity = 1.0;
        if (p > retreat.fadeStartRatio) {
          const pFade = clamp((p - retreat.fadeStartRatio) / (1 - retreat.fadeStartRatio), 0, 1);
          coverOpacity = THREE.MathUtils.lerp(1.0, retreat.minOpacity, easeInOutCubic(pFade));
        }
        this.bookCoverMaterials.forEach((mat) => {
          mat.opacity = coverOpacity;
        });
      }

      // 达到 98% 进度触发外部播放交接
      if (p >= 0.98 && this.bookOpenOnComplete) {
        const cb = this.bookOpenOnComplete;
        this.bookOpenOnComplete = undefined;
        cb();
      }
    }
  }

  /**
   * 逐帧更新播放前封面从背面翻转回正面的过渡动画
   * @param now 当前时间戳
   * @param cardLerpSpeed 插值速度
   * @param plasticEdgeMat 塑料材质
   * @param themeMode 主题模式
   * @param scene 场景
   * @param onHideOtherCards 隐藏背景卡片回调
   */
  private updatePreFlipTransition(
    now: number,
    cardLerpSpeed: number,
    plasticEdgeMat: THREE.Material,
    themeMode: ThemeMode,
    scene: THREE.Scene,
    onHideOtherCards: () => void
  ): void {
    const selectedMesh = this.preFlipSelectedMesh;
    if (!selectedMesh) {
      this.transitionState = 'idle';
      const opts = this.preFlipOptions;
      this.preFlipOptions = null;
      if (opts) {
        this.startAssemblyAndOpen(
          opts,
          selectedMesh!,
          plasticEdgeMat,
          themeMode,
          scene,
          onHideOtherCards
        );
      }
      return;
    }

    const elapsed = now - this.preFlipStartTime;
    const t = clamp(elapsed / BOOK_ANIM_CONFIG.retreat.preFlipDuration, 0, 1);
    const ease = easeInOutCubic(t);

    selectedMesh.rotation.y = THREE.MathUtils.lerp(this.preFlipStartRotY, 0, ease);
    selectedMesh.rotation.x = THREE.MathUtils.lerp(this.preFlipStartRotX, 0, ease);

    selectedMesh.position.x +=
      (selectedMesh.targetPosition.x - selectedMesh.position.x) * cardLerpSpeed;
    selectedMesh.position.y +=
      (selectedMesh.targetPosition.y - selectedMesh.position.y) * cardLerpSpeed;
    selectedMesh.position.z +=
      (selectedMesh.targetPosition.z - selectedMesh.position.z) * cardLerpSpeed;

    if (t >= 1) {
      selectedMesh.rotation.set(0, 0, 0);
      selectedMesh.targetRotationY = 0;
      selectedMesh.targetRotationX = 0;

      const opts = this.preFlipOptions;
      this.preFlipOptions = null;
      this.preFlipSelectedMesh = null;
      if (opts) {
        this.startAssemblyAndOpen(
          opts,
          selectedMesh,
          plasticEdgeMat,
          themeMode,
          scene,
          onHideOtherCards
        );
      }
    }
  }

  /**
   * 逐帧动画更新驱动
   * @param now 当前时间戳
   * @param camera 透视相机
   * @param isNarrow 是否为窄屏
   * @param cardLerpSpeed 卡片插值速度
   * @param plasticEdgeMat 塑料材质
   * @param themeMode 主题模式
   * @param scene 场景对象
   * @param selectedMesh 当前选中的卡片网格
   * @param onHideOtherCards 隐藏背景卡片回调
   */
  public update(
    now: number,
    camera: THREE.PerspectiveCamera,
    isNarrow: boolean,
    cardLerpSpeed: number,
    plasticEdgeMat: THREE.Material,
    themeMode: ThemeMode,
    scene: THREE.Scene,
    selectedMesh: CardMesh | undefined,
    onHideOtherCards: () => void
  ): void {
    if (this.transitionState === 'idle') return;

    if (this.transitionState === 'pre_flipping') {
      this.updatePreFlipTransition(
        now,
        cardLerpSpeed,
        plasticEdgeMat,
        themeMode,
        scene,
        onHideOtherCards
      );
    } else {
      this.updateBookTransition(now, camera, isNarrow, cardLerpSpeed, selectedMesh, scene);
    }
  }

  /**
   * 响应视口或容器尺寸变化，同步装配体位置、比例与对齐
   * @param selectedMesh 当前选中的卡片网格
   * @param isNarrow 是否为窄屏模式
   */
  public onResize(selectedMesh: CardMesh | undefined, isNarrow: boolean): void {
    if (!this.bookAssembly || !selectedMesh) return;

    this.bookAssembly.position.copy(selectedMesh.position);
    this.bookAssembly.scale.copy(selectedMesh.scale);
    if (this.bookCoverGroup) {
      this.bookCoverGroup.position.y = 0;
    }

    if (this.transitionState === 'opened') {
      const exitY = this.getNarrowExitY();
      if (isNarrow) {
        if (this.bookFrontCoverPivot) {
          this.bookFrontCoverPivot.rotation.y = 0;
        }
        this.setDiscAndShadowPosition(0, exitY, this.bookDiscRestPos.z);
      } else {
        if (this.bookFrontCoverPivot) {
          this.bookFrontCoverPivot.rotation.y = BOOK_ANIM_CONFIG.wide.coverOpenMaxAngle;
        }
        this.setDiscAndShadowPosition(
          this.bookDiscRestPos.x,
          this.bookDiscRestPos.y,
          this.bookDiscRestPos.z
        );
      }
    }
  }

  /**
   * 重置书本翻开展开状态，安全卸载 3D 装配体并深度释放动态资源
   * @param selectedMesh 当前选中的卡片
   * @param scene Three.js 场景对象
   */
  public reset(selectedMesh: CardMesh | undefined, scene: THREE.Scene): void {
    const wasActive = this.transitionState !== 'idle';
    this.transitionState = 'idle';
    this.isOpeningToPlay = false;
    this.flyoutStartRotZ = 0;
    this.narrowOpenInertiaStartTime = 0;
    this.narrowCloseInertiaStartTime = 0;
    this.closeStartCoverY = 0;
    this.preFlipOptions = null;
    this.preFlipSelectedMesh = null;
    this.bookOpenOnComplete = undefined;

    this.hoverEffect.reset(
      this.bookDiscMesh,
      this.bookDiscShadowMesh,
      this.bookDiscRestPos,
      this.bookDiscSheenMesh
    );

    if (this.bookAssembly) {
      scene.remove(this.bookAssembly);
      this.bookAssembly = null;
      this.bookFrontCoverPivot = null;
      this.bookCoverGroup = null;
      this.bookDiscMesh = null;
      this.bookDiscSheenMesh = null;
      this.bookDiscShadowMesh = null;
    }
    this.bookCoverMaterials = [];

    this.bookCreatedTextures.forEach((t) => t.dispose());
    this.bookCreatedTextures = [];

    this.bookCreatedMaterials.forEach((m) => m.dispose());
    this.bookCreatedMaterials = [];

    this.bookCreatedGeometries.forEach((g) => g.dispose());
    this.bookCreatedGeometries = [];

    if (selectedMesh) {
      selectedMesh.visible = true;
      if (selectedMesh.reflectionMesh) {
        selectedMesh.reflectionMesh.visible = true;
      }
    }

    if (wasActive) {
      this.onCoverStateChange?.(false);
    }
  }

  /**
   * 完全销毁管理器
   * @param scene Three.js 场景对象
   */
  public destroy(scene: THREE.Scene): void {
    this.reset(undefined, scene);
    this.onCoverStateChange = undefined;
  }
}
