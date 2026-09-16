/**
 * @file cardManager.ts
 * @description 3D Coverflow 卡片实体模型与磨砂倒影生命周期管理器
 * 负责卡片立方体构建、6 面材质映射、倒影反转镜像几何体、Alpha 渐变透明贴图、
 * 降采样高斯模糊纹理缓存、并发批处理异步加载与 WebGL 显存深度安全释放。
 */

import * as THREE from 'three';
import { Video } from '@/types/video';
import { CoverflowMovie, VIEW_STATES, ViewState } from '../types';
import { CARD_CONFIG, REFLECTION_CONFIG, THEME_CONFIG } from './config';
import { processCoverSpreadTexture } from './textureProcessor';
import { CardMesh, ThemeMode } from './types';

/**
 * 3D Coverflow 卡片与倒影网格管理器
 * 负责立方体模型生成、双面/书脊纹理裁切、磨砂倒影构建、主题同步与资源深度释放
 */
export class CardManager {
  private cardMeshes: CardMesh[] = [];
  private movies: CoverflowMovie[] = [];

  // Three.js 核心几何体与共享材质
  private boxGeometry!: THREE.BoxGeometry;
  private reflectionGeometry!: THREE.BoxGeometry;
  private reflectionAlphaMap!: THREE.CanvasTexture;
  private plasticEdgeMat!: THREE.MeshBasicMaterial;
  private reflectionPlasticEdgeMat!: THREE.MeshBasicMaterial;

  private reflectionBaseOpacity: number = REFLECTION_CONFIG.opacityDark;

  constructor() {
    this.initGeometryAndMaterials();
  }

  // 初始化立方体与镜像几何体、Alpha渐变贴图及塑料材质
  private initGeometryAndMaterials(): void {
    const { width, height, depth } = CARD_CONFIG;
    this.boxGeometry = new THREE.BoxGeometry(width, height, depth);

    // 1. 创建镜像反转的 BoxGeometry，顶点 Y 坐标取负
    this.reflectionGeometry = this.boxGeometry.clone();
    const pos = this.reflectionGeometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, -pos.getY(i));
    }
    pos.needsUpdate = true;

    // 翻转三角形索引环绕方向，确保法线指向模型外部，适配标准 FrontSide 面剔除
    const index = this.reflectionGeometry.index;
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const b = index.getX(i + 1);
        const c = index.getX(i + 2);
        index.setX(i + 1, c);
        index.setX(i + 2, b);
      }
      index.needsUpdate = true;
    }
    this.reflectionGeometry.computeVertexNormals();

    // 2. 构造倒影渐隐 Alpha 渐变贴图
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0.0, 'rgb(0, 0, 0)');
      grad.addColorStop(0.45, 'rgb(0, 0, 0)');
      grad.addColorStop(0.7, 'rgb(35, 35, 35)');
      grad.addColorStop(0.88, 'rgb(120, 120, 120)');
      grad.addColorStop(1.0, 'rgb(200, 200, 200)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1, 256);
    }

    this.reflectionAlphaMap = new THREE.CanvasTexture(canvas);
    this.reflectionAlphaMap.wrapS = THREE.ClampToEdgeWrapping;
    this.reflectionAlphaMap.wrapT = THREE.ClampToEdgeWrapping;
    this.reflectionAlphaMap.minFilter = THREE.LinearFilter;
    this.reflectionAlphaMap.magFilter = THREE.LinearFilter;

    // 3. 塑料边框材质
    this.plasticEdgeMat = new THREE.MeshBasicMaterial({
      color: THEME_CONFIG.plasticEdgeDark,
    });

    this.reflectionPlasticEdgeMat = new THREE.MeshBasicMaterial({
      color: THEME_CONFIG.plasticEdgeDark,
      alphaMap: this.reflectionAlphaMap,
      transparent: true,
      opacity: this.reflectionBaseOpacity,
      depthWrite: true,
      alphaTest: 0.001,
    });
  }

  // 为倒影生成带有微磨砂高斯模糊的降采样纹理 Canvas
  private createBlurredCanvas(source: HTMLCanvasElement, blurRadius: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(32, Math.round(source.width * 0.5));
    canvas.height = Math.max(32, Math.round(source.height * 0.5));
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (blurRadius > 0) {
        ctx.filter = `blur(${blurRadius}px)`;
      }
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    }
    return canvas;
  }

  /**
   * 为单个电影构建 3D 卡片实体模型与倒影模型
   * @param movie 电影数据
   * @param index 卡片索引
   */
  public async createCardMesh(movie: CoverflowMovie, index: number): Promise<CardMesh | null> {
    try {
      const { frontCanvas, spineCanvas, backCanvas } = await processCoverSpreadTexture(
        movie.textureUrl,
        movie.title
      );

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
      mesh.userData = { index, movie };

      // 为倒影生成带有微磨砂高斯模糊的材质纹理
      const spineBlurRadius = Math.max(1, Math.round(REFLECTION_CONFIG.blurRadius * 0.5));
      const refFrontCanvas = this.createBlurredCanvas(frontCanvas, REFLECTION_CONFIG.blurRadius);
      const refSpineCanvas = this.createBlurredCanvas(spineCanvas, spineBlurRadius);
      const refBackCanvas = this.createBlurredCanvas(backCanvas, REFLECTION_CONFIG.blurRadius);

      const refFrontTex = new THREE.CanvasTexture(refFrontCanvas);
      const refSpineTex = new THREE.CanvasTexture(refSpineCanvas);
      const refBackTex = new THREE.CanvasTexture(refBackCanvas);

      [refFrontTex, refSpineTex, refBackTex].forEach((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.magFilter = THREE.LinearFilter;
      });

      // 倒影 6 面材质映射
      const reflectionMaterials: THREE.MeshBasicMaterial[] = [
        this.reflectionPlasticEdgeMat,
        new THREE.MeshBasicMaterial({
          map: refSpineTex,
          alphaMap: this.reflectionAlphaMap,
          transparent: true,
          opacity: this.reflectionBaseOpacity,
          depthWrite: true,
          alphaTest: 0.001,
        }),
        this.reflectionPlasticEdgeMat,
        this.reflectionPlasticEdgeMat,
        new THREE.MeshBasicMaterial({
          map: refFrontTex,
          alphaMap: this.reflectionAlphaMap,
          transparent: true,
          opacity: this.reflectionBaseOpacity,
          depthWrite: true,
          alphaTest: 0.001,
        }),
        new THREE.MeshBasicMaterial({
          map: refBackTex,
          alphaMap: this.reflectionAlphaMap,
          transparent: true,
          opacity: this.reflectionBaseOpacity,
          depthWrite: true,
          alphaTest: 0.001,
        }),
      ];

      const reflectionMesh = new THREE.Mesh(this.reflectionGeometry, reflectionMaterials);
      reflectionMesh.position.set(0, -CARD_CONFIG.height - REFLECTION_CONFIG.gap, 0);
      reflectionMesh.userData = { index, movie, isReflection: true };
      reflectionMesh.raycast = () => {};
      mesh.add(reflectionMesh);

      mesh.reflectionMesh = reflectionMesh;
      mesh.reflectionMaterials = reflectionMaterials;

      mesh.targetPosition = new THREE.Vector3();
      mesh.targetRotationY = 0;
      mesh.targetRotationX = 0;
      mesh.targetScale = 1.0;

      return mesh;
    } catch (err) {
      console.warn(`Failed to process cover texture for movie "${movie.title}":`, err);
      return null;
    }
  }

  /**
   * 切换亮色/暗色主题，同步材质颜色与倒影透明度
   * @param themeMode 主题模式
   */
  public setTheme(themeMode: ThemeMode): void {
    const isDark = themeMode === 'dark';
    const plasticColor = isDark ? THEME_CONFIG.plasticEdgeDark : THEME_CONFIG.plasticEdgeLight;

    if (this.plasticEdgeMat) {
      this.plasticEdgeMat.color.set(plasticColor);
    }

    this.reflectionBaseOpacity = isDark
      ? REFLECTION_CONFIG.opacityDark
      : REFLECTION_CONFIG.opacityLight;

    if (this.reflectionPlasticEdgeMat) {
      this.reflectionPlasticEdgeMat.color.set(plasticColor);
      this.reflectionPlasticEdgeMat.opacity = this.reflectionBaseOpacity;
    }

    this.cardMeshes.forEach((mesh) => {
      if (mesh.reflectionMaterials) {
        mesh.reflectionMaterials.forEach((mat) => {
          mat.opacity = this.reflectionBaseOpacity;
        });
      }
    });
  }

  /**
   * 更新指定视频元数据并同步至网格 userData
   * @param updatedVideo 更新后的视频对象
   */
  public updateMovie(updatedVideo: Video): void {
    const movie = this.movies.find((m) => m.id === updatedVideo.id);
    if (movie) {
      movie.title = updatedVideo.name || updatedVideo.folderName;
      movie.category = updatedVideo.category;
      movie.actor = updatedVideo.actor;
      movie.description = updatedVideo.description;
      movie.links = updatedVideo.links;
      movie.video = updatedVideo;
    }
    for (const mesh of this.cardMeshes) {
      if (mesh.userData?.movie?.id === updatedVideo.id) {
        mesh.userData.movie = movie ? { ...movie } : mesh.userData.movie;
      }
    }
  }

  /**
   * 逐帧更新倒影动态透明度与渲染层级排序
   * @param selectedIndex 当前选中索引
   * @param viewState 当前视图状态
   */
  public updateReflectionDynamics(selectedIndex: number, viewState: ViewState): void {
    this.cardMeshes.forEach((mesh) => {
      if (!mesh.visible) return;

      // 倒影倾斜与悬空动态淡出
      if (mesh.reflectionMesh && mesh.reflectionMaterials) {
        const tiltFactor = Math.max(0, 1 - Math.abs(mesh.rotation.x) / 0.35);
        const heightFactor = Math.max(0, 1 - Math.max(0, mesh.position.y - 0.25) / 0.8);
        const factor = tiltFactor * heightFactor;
        if (factor <= 0.01) {
          mesh.reflectionMesh.visible = false;
        } else {
          mesh.reflectionMesh.visible = true;
          const targetOpacity = this.reflectionBaseOpacity * factor;
          mesh.reflectionMaterials.forEach((mat) => {
            mat.opacity = targetOpacity;
          });
        }
      }

      // 倒影前后遮挡层级排序 (Front-to-Back 逆序渲染)
      if (mesh.reflectionMesh && mesh.reflectionMesh.visible) {
        if (
          (viewState === VIEW_STATES.EXPANDED || viewState === VIEW_STATES.DETAIL) &&
          mesh.userData.index === selectedIndex
        ) {
          mesh.reflectionMesh.renderOrder = 1;
        } else {
          const effectiveZ = mesh.position.z + mesh.position.x * Math.sin(mesh.rotation.y);
          mesh.reflectionMesh.renderOrder = Math.max(10, Math.round(1000 - effectiveZ * 50));
        }
      }
    });
  }

  /**
   * 释放指定网格模型数组及其绑定的倒影、材质与纹理
   * @param meshes 要释放的网格列表
   */
  public disposeMeshList(meshes: CardMesh[]): void {
    meshes.forEach((mesh) => {
      if (mesh.reflectionMesh) {
        mesh.remove(mesh.reflectionMesh);
        if (Array.isArray(mesh.reflectionMesh.material)) {
          mesh.reflectionMesh.material.forEach((mat) => {
            if (mat !== this.reflectionPlasticEdgeMat) {
              if ('map' in mat && mat.map) {
                (mat.map as THREE.Texture).dispose();
              }
              mat.dispose();
            }
          });
        }
      }
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
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
  }

  // 释放所有卡片的网格、材质与纹理
  public disposeCards(): void {
    this.disposeMeshList(this.cardMeshes);
    this.cardMeshes = [];
  }

  /**
   * 设置并挂载新的卡片模型数组
   * @param movies 电影数据列表
   * @param meshes 生成的网格模型列表
   * @param scene Three.js 场景对象
   */
  public mountCards(movies: CoverflowMovie[], meshes: CardMesh[], scene: THREE.Scene): void {
    this.disposeCards();
    this.movies = movies;
    this.cardMeshes = meshes;

    meshes.forEach((mesh, idx) => {
      mesh.userData.index = idx;
      if (mesh.reflectionMesh) {
        mesh.reflectionMesh.userData.index = idx;
      }
      scene.add(mesh);
    });
  }

  // 获取卡片网格列表
  public getCardMeshes(): CardMesh[] {
    return this.cardMeshes;
  }

  // 获取当前电影列表
  public getMovies(): CoverflowMovie[] {
    return this.movies;
  }

  // 设置电影数据列表引用
  public setMoviesList(movies: CoverflowMovie[]): void {
    this.movies = movies;
  }

  // 获取塑料边框材质
  public getPlasticEdgeMat(): THREE.MeshBasicMaterial {
    return this.plasticEdgeMat;
  }

  // 完全销毁卡片管理器与几何体
  public destroy(): void {
    this.disposeCards();
    if (this.boxGeometry) this.boxGeometry.dispose();
    if (this.reflectionGeometry) this.reflectionGeometry.dispose();
    if (this.reflectionAlphaMap) this.reflectionAlphaMap.dispose();
    if (this.reflectionPlasticEdgeMat) this.reflectionPlasticEdgeMat.dispose();
    if (this.plasticEdgeMat) this.plasticEdgeMat.dispose();
  }
}
