/**
 * @file discHoverEffect.ts
 * @description 3D 实体光盘鼠标悬浮立体动力学与拖拽旋转控制器
 * 负责鼠标光标在光盘上的射线交互检测、Z 轴立体抬升、基于交点相对方位的 3D 微倾斜动力学模拟、
 * 鼠标按下拖拽光盘围绕中心轴旋转与松手物理惯性自旋、以及托盘柔和投影网格的自适应响应。
 */

import * as THREE from 'three';
import { clamp, normalizeAngle } from './mathUtils';

export class DiscHoverEffect {
  private isHovered = false;
  private currentLiftZ = 0;
  private targetLiftZ = 0;

  private currentTiltX = 0;
  private targetTiltX = 0;
  private currentTiltY = 0;
  private targetTiltY = 0;

  // 拖拽旋转状态
  private isDragging = false;
  private hasMovedSignificantly = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private lastDragAngle = 0;
  private lastDragTime = 0;
  private currentRotationZ = 0;
  private angularVelocity = 0;

  private currentShadowOpacity = 0.22;
  private targetShadowOpacity = 0.22;
  private currentShadowScale = 1.0;
  private targetShadowScale = 1.0;

  // 物理调节参数
  private readonly baseLiftZ = 0.045; // 悬浮基础抬升高度
  private readonly maxTiltAngle = 0.075; // 约 4.3° 微倾斜
  private readonly defaultLerpSpeed = 0.14;

  // 零垃圾回收复用三维数学对象缓存
  private readonly tempCenterWorld = new THREE.Vector3();
  private readonly tempNdc = new THREE.Vector3();
  private readonly tempWorldNormal = new THREE.Vector3();
  private readonly tempQuat = new THREE.Quaternion();
  private readonly tempPlane = new THREE.Plane();
  private readonly tempHitPoint = new THREE.Vector3();

  // 获取当前是否正处于悬停状态
  public get hovered(): boolean {
    return this.isHovered;
  }

  // 获取当前是否正处于拖拽旋转状态
  public get isDraggingDisc(): boolean {
    return this.isDragging;
  }

  // 获取当前光盘自旋角度
  public get discRotation(): number {
    return this.currentRotationZ;
  }

  // 消耗拖拽事件标志（若发生过有效拖拽则返回 true，用于阻止触发点击播放）
  public consumeDrag(): boolean {
    if (this.hasMovedSignificantly) {
      this.hasMovedSignificantly = false;
      return true;
    }
    return false;
  }

  /**
   * 根据击中点与光盘世界中心的相对位置，解算目标微倾角与抬升高度
   * @param hitPoint 击中点世界坐标
   * @param centerWorld 光盘世界中心坐标
   * @param radius 光盘世界半径
   */
  private updateTiltAndLiftFromPoint(
    hitPoint: THREE.Vector3,
    centerWorld: THREE.Vector3,
    radius: number
  ): void {
    const relX = hitPoint.x - centerWorld.x;
    const relY = hitPoint.y - centerWorld.y;
    const nx = clamp(relX / radius, -1, 1);
    const ny = clamp(relY / radius, -1, 1);

    this.targetTiltX = -ny * this.maxTiltAngle;
    this.targetTiltY = nx * this.maxTiltAngle;

    const targetTiltMagnitude = Math.hypot(this.targetTiltX, this.targetTiltY);
    const targetDip = radius * Math.sin(targetTiltMagnitude);
    this.targetLiftZ = this.baseLiftZ + targetDip + 0.004;
  }

  /**
   * 计算鼠标视口坐标相对于光盘中心投影的像素差值 (dx, dy)
   * @param camera 相机对象
   * @param discMesh 光盘网格对象
   * @param clientX 屏幕 X 坐标
   * @param clientY 屏幕 Y 坐标
   * @param canvasRect 画布视口边界矩形
   */
  private getPointerOffsetFromDiscCenter(
    camera: THREE.Camera,
    discMesh: THREE.Mesh,
    clientX: number,
    clientY: number,
    canvasRect: DOMRect
  ): { dx: number; dy: number } {
    discMesh.getWorldPosition(this.tempCenterWorld);
    this.tempNdc.copy(this.tempCenterWorld).project(camera);

    const centerPixelX = canvasRect.left + (this.tempNdc.x + 1) * 0.5 * canvasRect.width;
    const centerPixelY = canvasRect.top + (1 - this.tempNdc.y) * 0.5 * canvasRect.height;
    return {
      dx: clientX - centerPixelX,
      dy: clientY - centerPixelY,
    };
  }

  /**
   * 射线检测与目标微倾斜及浮起状态解算（无拖拽时的纯悬停状态）
   * @param raycaster Three.js 射线对象
   * @param discMesh 光盘网格对象
   */
  public handlePointer(raycaster: THREE.Raycaster, discMesh: THREE.Mesh | null): boolean {
    if (!discMesh || !discMesh.visible) {
      this.setHoverState(false);
      return false;
    }

    if (this.isDragging) {
      return true;
    }

    const intersects = raycaster.intersectObject(discMesh, false);
    if (intersects.length > 0) {
      this.isHovered = true;
      this.targetShadowOpacity = 0.48;
      this.targetShadowScale = 1.12;

      discMesh.getWorldPosition(this.tempCenterWorld);
      const geometry = discMesh.geometry as THREE.PlaneGeometry;
      const radius = (geometry.parameters.width || 1) / 2;

      this.updateTiltAndLiftFromPoint(intersects[0].point, this.tempCenterWorld, radius);
      return true;
    }

    this.setHoverState(false);
    return false;
  }

  /**
   * 拖拽按下处理：检测是否击中光盘并初始化基于屏幕像素正交空间的极坐标基准角
   * @param raycaster Three.js 射线对象
   * @param camera 相机对象
   * @param discMesh 光盘网格对象
   * @param clientX 屏幕 X 坐标
   * @param clientY 屏幕 Y 坐标
   * @param canvasRect 画布视口边界矩形
   */
  public handlePointerDown(
    raycaster: THREE.Raycaster,
    camera: THREE.Camera,
    discMesh: THREE.Mesh | null,
    clientX: number,
    clientY: number,
    canvasRect: DOMRect
  ): boolean {
    if (!discMesh || !discMesh.visible) return false;

    const intersects = raycaster.intersectObject(discMesh, false);
    if (intersects.length > 0) {
      this.isDragging = true;
      this.hasMovedSignificantly = false;
      this.dragStartX = clientX;
      this.dragStartY = clientY;
      this.lastDragTime = performance.now();
      this.angularVelocity = 0;

      const { dx, dy } = this.getPointerOffsetFromDiscCenter(
        camera,
        discMesh,
        clientX,
        clientY,
        canvasRect
      );
      this.lastDragAngle = Math.atan2(dy, dx);
      return true;
    }

    return false;
  }

  /**
   * 拖拽移动处理：在屏幕像素投影空间解算极坐标转角增量，杜绝自身旋转引发反向跳变
   * @param raycaster Three.js 射线对象
   * @param camera 相机对象
   * @param discMesh 光盘网格对象
   * @param clientX 屏幕 X 坐标
   * @param clientY 屏幕 Y 坐标
   * @param canvasRect 画布视口边界矩形
   */
  public handlePointerMoveDrag(
    raycaster: THREE.Raycaster,
    camera: THREE.Camera,
    discMesh: THREE.Mesh | null,
    clientX: number,
    clientY: number,
    canvasRect: DOMRect
  ): void {
    if (!this.isDragging || !discMesh) return;

    const totalDist = Math.hypot(clientX - this.dragStartX, clientY - this.dragStartY);
    if (totalDist > 5) {
      this.hasMovedSignificantly = true;
    }

    const { dx, dy } = this.getPointerOffsetFromDiscCenter(
      camera,
      discMesh,
      clientX,
      clientY,
      canvasRect
    );
    const distFromCenter = Math.hypot(dx, dy);

    // 避开中心死区（< 8px），在屏幕像素空间严密追踪手势旋转方向
    if (distFromCenter > 8) {
      const currentAngle = Math.atan2(dy, dx);
      const deltaAngle = normalizeAngle(currentAngle - this.lastDragAngle);

      // 屏幕像素坐标顺时针角增大 (deltaAngle > 0)，Three.js 中 +Z 朝向观众，顺时针自旋角为负 (deltaRotationZ < 0)
      this.currentRotationZ -= deltaAngle;
      discMesh.rotation.z = this.currentRotationZ;

      const now = performance.now();
      const dt = Math.max(now - this.lastDragTime, 1);
      const instVel = (-deltaAngle / dt) * 16.67;
      this.angularVelocity = this.angularVelocity * 0.3 + instVel * 0.7;
      this.angularVelocity = clamp(this.angularVelocity, -0.35, 0.35);

      this.lastDragAngle = currentAngle;
      this.lastDragTime = now;
    }

    // 拖拽过程中同步更新跟手微倾角与浮起深度
    this.tempWorldNormal
      .set(0, 0, 1)
      .applyQuaternion(discMesh.getWorldQuaternion(this.tempQuat));
    this.tempPlane.setFromNormalAndCoplanarPoint(this.tempWorldNormal, this.tempCenterWorld);

    if (raycaster.ray.intersectPlane(this.tempPlane, this.tempHitPoint)) {
      const geometry = discMesh.geometry as THREE.PlaneGeometry;
      const radius = (geometry.parameters.width || 1) / 2;
      this.updateTiltAndLiftFromPoint(this.tempHitPoint, this.tempCenterWorld, radius);
    }
  }

  // 释放拖拽处理
  public handlePointerUp(): void {
    this.isDragging = false;
  }

  // 停止悬停与拖拽，为闭合过渡做准备（保留当前自旋角度供闭合动画平滑插值）
  public stopHover(): void {
    this.isHovered = false;
    this.isDragging = false;
    this.hasMovedSignificantly = false;
    this.angularVelocity = 0;
    this.targetLiftZ = 0;
    this.targetTiltX = 0;
    this.targetTiltY = 0;
  }

  // 设置离开或进入悬浮状态的基准值
  private setHoverState(hovered: boolean): void {
    this.isHovered = hovered;
    if (!hovered && !this.isDragging) {
      this.targetLiftZ = 0;
      this.targetTiltX = 0;
      this.targetTiltY = 0;
      this.targetShadowOpacity = 0.22;
      this.targetShadowScale = 1.0;
    }
  }

  /**
   * 逐帧更新光盘与阴影的物理位置、倾角、自旋惯性与不透明度
   * @param discMesh 实体光盘网格
   * @param shadowMesh 柔和阴影网格
   * @param restPos 光盘在装配体中的静止参考位置
   * @param lerpSpeed 插值平滑速度
   * @param sheenMesh 光盘独立彩虹激光高光网格
   */
  public update(
    discMesh: THREE.Mesh | null,
    shadowMesh: THREE.Mesh | null,
    restPos: THREE.Vector3,
    lerpSpeed = this.defaultLerpSpeed,
    sheenMesh: THREE.Mesh | null = null
  ): void {
    if (!discMesh) return;

    // 1. 自旋惯性衰减物理模拟
    if (!this.isDragging) {
      if (Math.abs(this.angularVelocity) > 0.0002) {
        this.currentRotationZ += this.angularVelocity;
        this.angularVelocity *= 0.94;
        discMesh.rotation.z = this.currentRotationZ;
      } else {
        this.angularVelocity = 0;
        discMesh.rotation.z = this.currentRotationZ;
      }
    } else {
      discMesh.rotation.z = this.currentRotationZ;
    }

    // 2. Z 轴浮起平滑插值
    this.currentLiftZ += (this.targetLiftZ - this.currentLiftZ) * lerpSpeed;

    // 3. 3D 微倾角平滑插值
    this.currentTiltX += (this.targetTiltX - this.currentTiltX) * lerpSpeed;
    this.currentTiltY += (this.targetTiltY - this.currentTiltY) * lerpSpeed;
    discMesh.rotation.x = this.currentTiltX;
    discMesh.rotation.y = this.currentTiltY;

    // 4. 动态几何安全保护：计算当前即时倾角下的边缘最大下潜量
    const geometry = discMesh.geometry as THREE.PlaneGeometry;
    const width = geometry.parameters.width || 1;
    const radius = width / 2;
    const currentTiltMagnitude = Math.hypot(this.currentTiltX, this.currentTiltY);
    const currentDip = radius * Math.sin(currentTiltMagnitude);

    const safeLiftZ =
      this.isHovered || this.isDragging
        ? Math.max(this.currentLiftZ, currentDip + 0.003)
        : Math.max(this.currentLiftZ, currentDip);

    discMesh.position.z = restPos.z + safeLiftZ;

    // 5. 阴影网格动态响应
    if (shadowMesh) {
      this.currentShadowOpacity +=
        (this.targetShadowOpacity - this.currentShadowOpacity) * lerpSpeed;
      this.currentShadowScale += (this.targetShadowScale - this.currentShadowScale) * lerpSpeed;

      const mat = shadowMesh.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = this.currentShadowOpacity;
      }

      shadowMesh.scale.set(this.currentShadowScale, this.currentShadowScale, 1);
      shadowMesh.position.x = restPos.x - this.currentTiltY * 0.12;
      shadowMesh.position.y = restPos.y + this.currentTiltX * 0.12 - safeLiftZ * 0.15;
      shadowMesh.position.z = restPos.z - 0.0015;
    }

    // 6. 光盘彩虹激光高光各向异性流光与自旋反向解耦
    if (sheenMesh) {
      const tiltSheenOffset = this.currentTiltX * 1.6 + this.currentTiltY * 2.2;
      sheenMesh.rotation.z = -this.currentRotationZ + tiltSheenOffset;

      const tiltMag = Math.hypot(this.currentTiltX, this.currentTiltY);
      const tiltRatio = Math.min(1.0, tiltMag / this.maxTiltAngle);
      const mat = sheenMesh.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = 0.85 + tiltRatio * 0.35;
      }
    }
  }

  /**
   * 重置光盘、阴影与光斑至绝对静止初始状态
   * @param discMesh 实体光盘网格
   * @param shadowMesh 柔和阴影网格
   * @param restPos 静止参考位置
   * @param sheenMesh 光盘独立彩虹激光高光网格
   */
  public reset(
    discMesh: THREE.Mesh | null,
    shadowMesh: THREE.Mesh | null,
    restPos: THREE.Vector3,
    sheenMesh: THREE.Mesh | null = null
  ): void {
    this.isHovered = false;
    this.isDragging = false;
    this.hasMovedSignificantly = false;
    this.currentLiftZ = 0;
    this.targetLiftZ = 0;
    this.currentTiltX = 0;
    this.targetTiltX = 0;
    this.currentTiltY = 0;
    this.targetTiltY = 0;
    this.currentRotationZ = 0;
    this.angularVelocity = 0;
    this.currentShadowOpacity = 0.22;
    this.targetShadowOpacity = 0.22;
    this.currentShadowScale = 1.0;
    this.targetShadowScale = 1.0;

    if (discMesh) {
      discMesh.position.copy(restPos);
      discMesh.rotation.set(0, 0, 0);
    }
    if (shadowMesh) {
      shadowMesh.position.set(restPos.x, restPos.y, restPos.z - 0.0015);
      shadowMesh.rotation.set(0, 0, 0);
      shadowMesh.scale.set(1, 1, 1);
      const mat = shadowMesh.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = 0.22;
      }
    }
    if (sheenMesh) {
      sheenMesh.rotation.set(0, 0, 0);
      const mat = sheenMesh.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = 0.85;
      }
    }
  }
}
