/**
 * @file types.ts
 * @description 3D Coverflow 内部类型定义集合
 * 定义了附带平滑目标变换与倒影关联的 CardMesh 接口、书本翻开展开动画配置接口及相关主题与切卡状态类型。
 */

import * as THREE from 'three';
import { CoverflowMovie } from '../types';

/** 拓展带有平滑插值目标属性与倒影关联的卡片 Mesh */
export interface CardMesh extends THREE.Mesh {
  targetPosition: THREE.Vector3;
  targetRotationY: number;
  targetRotationX: number;
  targetScale: number;
  reflectionMesh?: THREE.Mesh;
  reflectionMaterials?: THREE.MeshBasicMaterial[];
  userData: {
    index: number;
    movie: CoverflowMovie;
    isReflection?: boolean;
  };
}

/** 3D 书本翻开过渡动画参数 */
export interface BookOpenTransitionOptions {
  movie: CoverflowMovie;
  onComplete?: () => void;
}

/** 主题模式 */
export type ThemeMode = 'dark' | 'light';

/** 详情模式切卡过渡方向 (用于驱动进入与退出切入动画) */
export type TransitionDirection = 'next' | 'prev' | null;
