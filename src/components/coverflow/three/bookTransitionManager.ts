/**
 * @file bookTransitionManager.ts
 * @description 3D Coverflow 书本翻开展开与实体光盘飞行动画子系统
 * 负责装配体构建、封面铰链对折展开、宽屏/窄屏自适应光盘飞行轨迹动力学模拟、
 * 播放前背面翻转归正、封面远景后撤渐隐及全套动态资源生命周期安全卸载。
 */

import * as THREE from 'three';
import { CoverflowMovie } from '../types';
import {
  createDiscCanvas,
  createLeftInsideCanvas,
  createRightInsideCanvas,
} from './bookCanvasGenerators';
import { BOOK_ANIM_CONFIG, CARD_CONFIG } from './config';
import { easeInOutCubic } from './mathUtils';
import { BookOpenTransitionOptions, CardMesh, ThemeMode } from './types';

/**
 * 3D 书本翻开展开、实体光盘飞出与播放视频过渡管理器
 * 负责宽屏/窄屏自适应装配体构建、封面铰链展开、光盘飞行动力学模拟及材质平滑渐隐
 */
export class BookTransitionManager {
  private isOpeningBook = false;
  private isPreFlippingToFront = false;
  private preFlipStartTime = 0;
  private preFlipStartRotY = 0;
  private preFlipStartRotX = 0;
  private preFlipOptions: BookOpenTransitionOptions | null = null;
  private preFlipSelectedMesh: CardMesh | null = null;

  private bookAssembly: THREE.Group | null = null;
  private bookCoverGroup: THREE.Group | null = null;
  private bookCoverMaterials: THREE.Material[] = [];
  private bookFrontCoverPivot: THREE.Group | null = null;
  private bookDiscMesh: THREE.Mesh | null = null;
  private bookDiscRestPos = new THREE.Vector3();
  private bookStartPos = new THREE.Vector3();
  private bookOpenStartTime = 0;
  private bookOpenOnComplete?: () => void;

  // 动态创建的资源集合，用于统一精准释放
  private bookCreatedTextures: THREE.Texture[] = [];
  private bookCreatedMaterials: THREE.Material[] = [];
  private bookCreatedGeometries: THREE.BufferGeometry[] = [];

  // 获取当前过渡是否处于进行中
  public get isTransitioning(): boolean {
    return this.isOpeningBook;
  }

  // 获取当前是否处于播放前背面翻转回正面状态
  public get isPreFlipping(): boolean {
    return this.isPreFlippingToFront;
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
    });
    this.bookCreatedMaterials.push(discMat);

    return new THREE.Mesh(discGeo, discMat);
  }

  /**
   * 为指定视频构建 3D 书本展开装配体模型（底盒内页 + 独立光盘 + 封面铰链）
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

    // 1. 书本封面与托盘底盒总成 (Book Cover & Tray Assembly Group)
    const coverGroup = new THREE.Group();

    const baseDepth = D - coverThickness;
    const trayGeo = new THREE.BoxGeometry(W, H, baseDepth);
    this.bookCreatedGeometries.push(trayGeo);

    const frontImage =
      frontMat instanceof THREE.MeshBasicMaterial && frontMat.map?.image
        ? (frontMat.map.image as HTMLCanvasElement | HTMLImageElement)
        : undefined;

    // 右侧内页艺术衬纸与空置模具托盘
    const rightInsideCanvas = createRightInsideCanvas(movie, themeMode);
    const rightInsideTex = new THREE.CanvasTexture(rightInsideCanvas);
    rightInsideTex.colorSpace = THREE.SRGBColorSpace;
    this.bookCreatedTextures.push(rightInsideTex);

    const rightInsideMat = new THREE.MeshBasicMaterial({
      map: rightInsideTex,
      transparent: true,
      opacity: 1.0,
    });
    this.bookCreatedMaterials.push(rightInsideMat);
    this.bookCoverMaterials.push(rightInsideMat);

    // 克隆塑料边框、书脊与封底材质，赋予透明渐隐支持，杜绝污染全局材质
    const edgeMat = plasticEdgeMat.clone();
    edgeMat.transparent = true;
    edgeMat.opacity = 1.0;
    this.bookCreatedMaterials.push(edgeMat);
    this.bookCoverMaterials.push(edgeMat);

    const spineMatClone = spineMat.clone();
    spineMatClone.transparent = true;
    spineMatClone.opacity = 1.0;
    this.bookCreatedMaterials.push(spineMatClone);
    this.bookCoverMaterials.push(spineMatClone);

    const backMatClone = backMat.clone();
    backMatClone.transparent = true;
    backMatClone.opacity = 1.0;
    this.bookCreatedMaterials.push(backMatClone);
    this.bookCoverMaterials.push(backMatClone);

    const trayMesh = new THREE.Mesh(trayGeo, [
      edgeMat, // +X 右侧边
      spineMatClone, // -X 左侧书脊（由底盒侧面直接呈现，彻底杜绝任何多余重叠网格与 Z-fighting）
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
    const leftInsideCanvas = createLeftInsideCanvas(themeMode);
    const leftInsideTex = new THREE.CanvasTexture(leftInsideCanvas);
    leftInsideTex.colorSpace = THREE.SRGBColorSpace;
    this.bookCreatedTextures.push(leftInsideTex);

    const insideLeftMat = new THREE.MeshBasicMaterial({
      map: leftInsideTex,
      side: THREE.FrontSide,
      transparent: true,
      opacity: 1.0,
    });
    this.bookCreatedMaterials.push(insideLeftMat);
    this.bookCoverMaterials.push(insideLeftMat);

    // 正面封面单板 (+Z 闭合时朝向相机，厚度向外偏移 coverThickness)
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
    if (frontPlateMat !== frontMat) {
      this.bookCreatedMaterials.push(frontPlateMat);
    }
    this.bookCoverMaterials.push(frontPlateMat);

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

    // 3. 独立 3D 实体光盘网格，初始精准安放于托盘凹槽卡齿上
    const discMesh = this.createDiscMesh(themeMode, frontImage);
    discMesh.renderOrder = 10;
    const restY = (0.5 - BOOK_ANIM_CONFIG.disc.centerY / BOOK_ANIM_CONFIG.canvas.height) * H;
    const restZ = D / 2 - coverThickness + 0.006;
    this.bookDiscRestPos.set(0, restY, restZ);
    discMesh.position.copy(this.bookDiscRestPos);
    group.add(discMesh);
    this.bookDiscMesh = discMesh;

    return group;
  }

  /**
   * 启动装配体就地展开动画
   * @param options 过渡参数
   * @param selectedMesh 当前选中的卡片网格
   * @param plasticEdgeMat 默认塑料边框材质
   * @param themeMode 主题模式
   * @param scene Three.js 场景对象
   * @param onHideOtherCards 隐藏其余背景卡片回调
   */
  public startBookOpenAssembly(
    options: BookOpenTransitionOptions,
    selectedMesh: CardMesh,
    plasticEdgeMat: THREE.Material,
    themeMode: ThemeMode,
    scene: THREE.Scene,
    onHideOtherCards: () => void
  ): void {
    this.isOpeningBook = true;
    this.bookOpenStartTime = performance.now();
    this.bookOpenOnComplete = options.onComplete;

    selectedMesh.rotation.set(0, 0, 0);
    selectedMesh.targetRotationY = 0;
    selectedMesh.targetRotationX = 0;

    this.bookStartPos.copy(selectedMesh.position);

    onHideOtherCards();

    this.bookAssembly = this.createBookAssembly(options.movie, selectedMesh, plasticEdgeMat, themeMode);
    this.bookAssembly.position.copy(selectedMesh.position);
    this.bookAssembly.rotation.set(0, 0, 0);
    this.bookAssembly.scale.copy(selectedMesh.scale);
    scene.add(this.bookAssembly);
  }

  /**
   * 执行书本翻开展开动画并平滑过渡到视频播放
   * 若封面处于翻转到背面的状态，则先平滑翻转回正面再正常执行展开动画
   * @param options 过渡参数
   * @param selectedMesh 当前选中的卡片网格
   * @param plasticEdgeMat 塑料边框材质
   * @param themeMode 当前主题模式
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
    if (this.isOpeningBook || !selectedMesh) {
      options.onComplete?.();
      return;
    }

    // 规范化当前 Y 轴旋转弧度至 (-π, π]
    let currentRotY = selectedMesh.rotation.y % (Math.PI * 2);
    if (currentRotY > Math.PI) currentRotY -= Math.PI * 2;
    if (currentRotY < -Math.PI) currentRotY += Math.PI * 2;

    const isBackFacing = Math.abs(currentRotY) > 0.05;

    if (isBackFacing) {
      this.isOpeningBook = true;
      this.isPreFlippingToFront = true;
      this.preFlipStartTime = performance.now();
      this.preFlipStartRotY = currentRotY;
      this.preFlipStartRotX = selectedMesh.rotation.x;
      this.preFlipOptions = options;
      this.preFlipSelectedMesh = selectedMesh;
      selectedMesh.targetRotationY = 0;
      selectedMesh.targetRotationX = 0;
      return;
    }

    this.startBookOpenAssembly(options, selectedMesh, plasticEdgeMat, themeMode, scene, onHideOtherCards);
  }

  /**
   * 逐帧更新 3D 书本翻开与飞碟飞行动画
   * @param now 当前时间戳
   * @param camera 相机对象
   * @param isNarrow 是否为窄屏模式
   */
  private updateBookOpenTransition(
    now: number,
    camera: THREE.PerspectiveCamera,
    isNarrow: boolean
  ): void {
    if (!this.bookAssembly || !this.bookFrontCoverPivot) return;

    const { wide, narrow, retreat, disc: discCfg, canvas: canvasCfg } = BOOK_ANIM_CONFIG;
    const duration = isNarrow ? narrow.duration : wide.duration;
    const elapsed = now - this.bookOpenStartTime;
    const t = THREE.MathUtils.clamp(elapsed / duration, 0, 1);

    const flyoutZOffset = isNarrow ? narrow.discFlyoutZOffset : wide.discFlyoutZOffset;
    const targetWorldZ = this.bookStartPos.z + flyoutZOffset;
    const targetWorldCenter = new THREE.Vector3(0, camera.position.y, targetWorldZ);
    const targetLocal = this.bookAssembly.worldToLocal(targetWorldCenter.clone());

    if (isNarrow) {
      // 窄屏上下布局模式：封面保持平整闭合
      this.bookFrontCoverPivot.rotation.y = 0;

      if (this.bookDiscMesh) {
        const pGlobal = t;
        const easeGlobal = easeInOutCubic(pGlobal);

        const discRadius = (discCfg.outerRadius / canvasCfg.width) * CARD_CONFIG.width;
        const exitY = -CARD_CONFIG.height / 2 - discRadius - narrow.exitMargin;

        let targetDiscX: number;
        let targetDiscY: number;
        let targetDiscZ: number;
        let targetDiscRotX = 0;
        let targetDiscRotY = 0;

        if (t <= narrow.slideOutRatio) {
          // 阶段 A：沿 Y 轴向下滑出封面遮盖，Z 轴锁定在背侧
          const pSlide = t / narrow.slideOutRatio;
          const easeSlide = easeInOutCubic(pSlide);

          targetDiscX = THREE.MathUtils.lerp(
            this.bookDiscRestPos.x,
            targetLocal.x,
            easeSlide * narrow.xAlignRatio
          );
          targetDiscY = THREE.MathUtils.lerp(this.bookDiscRestPos.y, exitY, easeSlide);
          targetDiscZ = this.bookDiscRestPos.z;
        } else {
          // 阶段 B：滑出后向镜头推进并升入视野中心
          const pFly = (t - narrow.slideOutRatio) / (1 - narrow.slideOutRatio);
          const easeFly = easeInOutCubic(pFly);

          targetDiscX = THREE.MathUtils.lerp(
            THREE.MathUtils.lerp(this.bookDiscRestPos.x, targetLocal.x, narrow.xAlignRatio),
            targetLocal.x,
            easeFly
          );
          targetDiscY = THREE.MathUtils.lerp(exitY, targetLocal.y, easeFly);
          targetDiscZ = THREE.MathUtils.lerp(this.bookDiscRestPos.z, targetLocal.z, easeFly);

          const flightTilt = Math.sin(pFly * Math.PI);
          targetDiscRotX = flightTilt * narrow.flightTiltX;
          targetDiscRotY = flightTilt * narrow.flightTiltY;
        }

        const targetDiscScale = THREE.MathUtils.lerp(1.0, narrow.discFlyoutScale, easeGlobal);
        const targetDiscRotZ = -narrow.discSpinAngle * easeGlobal;

        this.bookDiscMesh.position.set(targetDiscX, targetDiscY, targetDiscZ);
        this.bookDiscMesh.rotation.set(targetDiscRotX, targetDiscRotY, targetDiscRotZ);
        this.bookDiscMesh.scale.set(targetDiscScale, targetDiscScale, targetDiscScale);
      }
    } else {
      // 宽屏模式：阶段 1 封面就地展开至 180°
      const pCover = THREE.MathUtils.clamp(t / wide.coverOpenRatio, 0, 1);
      const easeCover = easeInOutCubic(pCover);
      this.bookFrontCoverPivot.rotation.y = wide.coverOpenMaxAngle * easeCover;

      // 阶段 2：封面静止不动，实体光盘脱离向右滑出并以 Ease-in-out 旋转 360° 飞向视野中心放大
      if (this.bookDiscMesh) {
        if (t < wide.coverOpenRatio) {
          this.bookDiscMesh.position.copy(this.bookDiscRestPos);
          this.bookDiscMesh.rotation.set(0, 0, 0);
          this.bookDiscMesh.scale.set(1, 1, 1);
        } else {
          const pDisc = THREE.MathUtils.clamp(
            (t - wide.coverOpenRatio) / (1 - wide.coverOpenRatio),
            0,
            1
          );
          const easeDisc = easeInOutCubic(pDisc);

          const detachCurve = 28.935 * pDisc * pDisc * (1 - pDisc) * (1 - pDisc) * (1 - pDisc);
          const detachRight =
            (detachCurve * wide.discDetachRightOffset) / this.bookAssembly.scale.x;
          const targetDiscX =
            THREE.MathUtils.lerp(this.bookDiscRestPos.x, targetLocal.x, easeDisc) + detachRight;

          const targetDiscY = THREE.MathUtils.lerp(this.bookDiscRestPos.y, targetLocal.y, easeDisc);

          const liftZ =
            Math.sin(Math.min(1, pDisc * 2) * Math.PI * 0.5) *
            (wide.discDetachLiftZ / this.bookAssembly.scale.z);
          const targetDiscZ =
            THREE.MathUtils.lerp(this.bookDiscRestPos.z, targetLocal.z, easeDisc) + liftZ;

          const targetDiscScale = THREE.MathUtils.lerp(1.0, wide.discFlyoutScale, easeDisc);
          const targetDiscRotZ = -wide.discSpinAngle * easeDisc;

          const flightTilt = Math.sin(pDisc * Math.PI);
          const targetDiscRotX = flightTilt * wide.flightTiltX;
          const targetDiscRotY = flightTilt * wide.flightTiltY;

          this.bookDiscMesh.position.set(targetDiscX, targetDiscY, targetDiscZ);
          this.bookDiscMesh.rotation.set(targetDiscRotX, targetDiscRotY, targetDiscRotZ);
          this.bookDiscMesh.scale.set(targetDiscScale, targetDiscScale, targetDiscScale);
        }
      }
    }

    // 封面后撤与渐隐效果（在光盘飞出快结束时触发）
    if (this.bookCoverGroup) {
      let retreatZ = 0;
      if (t > retreat.startRatio) {
        const pRetreat = THREE.MathUtils.clamp(
          (t - retreat.startRatio) / (1 - retreat.startRatio),
          0,
          1
        );
        retreatZ = (retreat.distance / this.bookAssembly.scale.z) * easeInOutCubic(pRetreat);
      }
      this.bookCoverGroup.position.z = -retreatZ;

      let coverOpacity = 1.0;
      if (t > retreat.fadeStartRatio) {
        const pFade = THREE.MathUtils.clamp(
          (t - retreat.fadeStartRatio) / (1 - retreat.fadeStartRatio),
          0,
          1
        );
        coverOpacity = THREE.MathUtils.lerp(1.0, retreat.minOpacity, easeInOutCubic(pFade));
      }
      this.bookCoverMaterials.forEach((mat) => {
        mat.opacity = coverOpacity;
      });
    }

    // 达到 98% 进度时触发完成回调，平滑交接给外部播放器
    if (t >= 0.98 && this.bookOpenOnComplete) {
      const cb = this.bookOpenOnComplete;
      this.bookOpenOnComplete = undefined;
      cb();
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
      this.isPreFlippingToFront = false;
      const opts = this.preFlipOptions;
      this.preFlipOptions = null;
      if (opts) {
        this.startBookOpenAssembly(opts, selectedMesh!, plasticEdgeMat, themeMode, scene, onHideOtherCards);
      }
      return;
    }

    const elapsed = now - this.preFlipStartTime;
    const t = THREE.MathUtils.clamp(elapsed / BOOK_ANIM_CONFIG.retreat.preFlipDuration, 0, 1);
    const ease = easeInOutCubic(t);

    selectedMesh.rotation.y = THREE.MathUtils.lerp(this.preFlipStartRotY, 0, ease);
    selectedMesh.rotation.x = THREE.MathUtils.lerp(this.preFlipStartRotX, 0, ease);

    // 顺滑跟进位置
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
      this.isPreFlippingToFront = false;

      const opts = this.preFlipOptions;
      this.preFlipOptions = null;
      this.preFlipSelectedMesh = null;
      if (opts) {
        this.startBookOpenAssembly(opts, selectedMesh, plasticEdgeMat, themeMode, scene, onHideOtherCards);
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
    onHideOtherCards: () => void
  ): void {
    if (!this.isOpeningBook) return;

    if (this.isPreFlippingToFront) {
      this.updatePreFlipTransition(
        now,
        cardLerpSpeed,
        plasticEdgeMat,
        themeMode,
        scene,
        onHideOtherCards
      );
    } else {
      this.updateBookOpenTransition(now, camera, isNarrow);
    }
  }

  /**
   * 重置书本翻开展开状态，安全卸载 3D 装配体并深度释放动态资源
   * @param selectedMesh 当前选中的卡片
   * @param scene Three.js 场景对象
   */
  public reset(selectedMesh: CardMesh | undefined, scene: THREE.Scene): void {
    this.isOpeningBook = false;
    this.isPreFlippingToFront = false;
    this.preFlipOptions = null;
    this.preFlipSelectedMesh = null;
    this.bookOpenOnComplete = undefined;

    if (this.bookAssembly) {
      scene.remove(this.bookAssembly);
      this.bookAssembly = null;
      this.bookFrontCoverPivot = null;
      this.bookCoverGroup = null;
      this.bookDiscMesh = null;
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
  }

  /**
   * 完全销毁管理器
   * @param scene Three.js 场景对象
   */
  public destroy(scene: THREE.Scene): void {
    this.reset(undefined, scene);
  }
}
