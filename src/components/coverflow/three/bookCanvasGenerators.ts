/**
 * @file bookCanvasGenerators.ts
 * @description 3D Coverflow 书本内页与实体光盘 2D Canvas 贴图生成器
 * 负责内页双层几何装饰衬纸、托盘塑料凹槽与手指缺口、影片典藏排版文字、
 * 以及具备真实聚碳酸酯透明外沿与各向异性激光彩虹反光的独立 3D 光盘贴图绘制。
 */

import { FONT_FAMILY } from '@/utils/constants';
import { CoverflowMovie } from '../types';
import { BOOK_ANIM_CONFIG } from './config';
import { ThemeMode } from './types';

/**
 * 绘制书本内页统一的双层几何装饰边框与底色
 * @param ctx 2D Canvas 上下文
 * @param width 画布宽度
 * @param height 画布高度
 * @param isDark 是否为暗色主题
 */
export function drawBookDecorativeBorder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isDark: boolean
): void {
  const bgColor = isDark ? '#1e293b' : '#e2e8f0';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)';
  const { borderOuterPadding, borderInnerPadding, borderLineWidth } = BOOK_ANIM_CONFIG.canvas;

  // 1. 书籍衬纸底色
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // 2. 双层浅灰/暗纹几何装饰边框
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderLineWidth;
  ctx.strokeRect(
    borderOuterPadding,
    borderOuterPadding,
    width - borderOuterPadding * 2,
    height - borderOuterPadding * 2
  );
  ctx.strokeRect(
    borderInnerPadding,
    borderInnerPadding,
    width - borderInnerPadding * 2,
    height - borderInnerPadding * 2
  );
}

/**
 * 生成书本翻开后左侧内衬纸艺术纹理 Canvas
 * @param themeMode 当前主题模式
 */
export function createLeftInsideCanvas(themeMode: ThemeMode): HTMLCanvasElement {
  const { width, height } = BOOK_ANIM_CONFIG.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  drawBookDecorativeBorder(ctx, width, height, themeMode === 'dark');
  return canvas;
}

/**
 * 生成书本翻开后右侧内衬纸与托盘模具 Canvas
 * 包含空置底托凹槽、取盘手指凹槽、中央固定卡齿及典藏影片信息（实体光盘由独立的 3D Mesh 承载）
 * @param movie 电影数据
 * @param themeMode 当前主题模式
 */
export function createRightInsideCanvas(
  movie: CoverflowMovie,
  themeMode: ThemeMode
): HTMLCanvasElement {
  const { width, height } = BOOK_ANIM_CONFIG.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const isDark = themeMode === 'dark';
  drawBookDecorativeBorder(ctx, width, height, isDark);

  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const subtextColor = isDark ? '#94a3b8' : '#64748b';

  const { disc, typography } = BOOK_ANIM_CONFIG;
  const cx = width / 2;
  const cy = disc.centerY;
  const R_outer = disc.outerRadius;
  const R_recess = R_outer + disc.recessOffset;
  const R_hole = disc.holeRadius;

  // 3. 托盘塑料凹槽底座 (Recessed Tray Socket)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R_recess, 0, Math.PI * 2);
  ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.18)' : 'rgba(0, 0, 0, 0.05)';
  ctx.fill();

  // 凹槽边缘微倒角立体内阴影与高光环
  ctx.strokeStyle = isDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R_recess + 1, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
  ctx.restore();

  // 4. 左右两侧半圆形取盘手指凹槽 (Finger Notch Cutouts)
  const notchRadius = 14;
  [-1, 1].forEach((dir) => {
    const nx = cx + dir * R_recess;
    const ny = cy;
    ctx.save();
    ctx.beginPath();
    ctx.arc(nx, ny, notchRadius, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.22)' : 'rgba(0, 0, 0, 0.06)';
    ctx.fill();
    ctx.strokeStyle = isDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  });

  // 5. 托盘中央空位圆孔与卡齿主轴 (Center Spindle Hub & Teeth)
  ctx.save();
  ctx.fillStyle = isDark ? '#0f172a' : '#cbd5e1';
  ctx.beginPath();
  ctx.arc(cx, cy, R_hole, 0, Math.PI * 2);
  ctx.fill();

  // 内孔壁立体阴影
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R_hole, 0, Math.PI * 2);
  ctx.stroke();

  // 托盘中心 4 枚弹力固定卡齿 (Hub Clamping Teeth)
  const teethCount = 4;
  const teethRadius = R_hole - 1;
  for (let i = 0; i < teethCount; i++) {
    const angle = (i * Math.PI * 2) / teethCount + Math.PI / 4;
    const tx = cx + Math.cos(angle) * (teethRadius - 4);
    const ty = cy + Math.sin(angle) * (teethRadius - 4);
    ctx.beginPath();
    ctx.arc(tx, ty, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? '#1e293b' : '#94a3b8';
    ctx.fill();
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.restore();

  // 6. 影片元数据典藏印刻
  ctx.fillStyle = textColor;
  ctx.font = `bold ${typography.titleFontSize}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.fillText(movie.title.toUpperCase().slice(0, 26), cx, typography.titleY);

  ctx.fillStyle = subtextColor;
  ctx.font = `${typography.subtitleFontSize}px ${FONT_FAMILY}`;
  ctx.fillText('COLLECTOR EDITION • CINEMA ARCHIVE', cx, typography.subtitleY);
  if (movie.actor) {
    ctx.font = `${typography.actorFontSize}px ${FONT_FAMILY}`;
    ctx.fillText(movie.actor.slice(0, 30), cx, typography.actorY);
  }

  return canvas;
}

/**
 * 生成独立的 3D 实体光盘专属高清 Canvas 贴图
 * 包含真实正面封面印刷、同心微细光轨、各向异性激光彩虹反光、外边缘高光倒角、亚克力夹持圈与中心镂空圆孔
 * @param themeMode 当前主题模式
 * @param frontImage 正面封面原始图像
 */
export function createDiscCanvas(
  themeMode: ThemeMode,
  frontImage?: HTMLCanvasElement | HTMLImageElement
): HTMLCanvasElement {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const cx = size / 2;
  const cy = size / 2;
  const isDark = themeMode === 'dark';
  const { disc } = BOOK_ANIM_CONFIG;

  // 缩放基准比例：根据 bookDiscOuterRadius 映射至 512 贴图空间
  const R_outer = size / 2 - 4;
  const scaleRatio = R_outer / disc.outerRadius;
  const R_hole = disc.holeRadius * scaleRatio;
  const R_hub = disc.hubRadius * scaleRatio;
  const R_mirror = disc.mirrorRadius * scaleRatio;

  // 单层透明塑料边框宽度 (约占盘片半径的 8%，对应真实光盘透明外沿)
  const rimWidth = 10 * scaleRatio;
  const R_artwork = R_outer - rimWidth;

  // 1. 聚碳酸酯单层透明塑料外边框 (Single-layer Clear Plastic Outer Rim)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R_outer, 0, Math.PI * 2);
  ctx.arc(cx, cy, R_artwork, 0, Math.PI * 2, true);
  ctx.closePath();
  const rimGrad = ctx.createRadialGradient(cx, cy, R_artwork, cx, cy, R_outer);
  rimGrad.addColorStop(0.0, isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.22)');
  rimGrad.addColorStop(1.0, isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.42)');
  ctx.fillStyle = rimGrad;
  ctx.fill();
  ctx.restore();

  // 2. 光盘封面印刷层 (Picture Disc Artwork)：精准限定在 R_artwork 以内
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R_artwork, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (frontImage) {
    const imgW = frontImage.width || 600;
    const imgH = frontImage.height || 850;
    const diameter = R_artwork * 2;
    const scale = Math.max(diameter / imgW, diameter / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const drawX = cx - drawW / 2;
    const drawY = cy - drawH / 2;
    ctx.drawImage(frontImage, drawX, drawY, drawW, drawH);
  } else {
    const fallbackGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, R_artwork);
    fallbackGrad.addColorStop(0, isDark ? '#334155' : '#cbd5e1');
    fallbackGrad.addColorStop(1, isDark ? '#0f172a' : '#94a3b8');
    ctx.fillStyle = fallbackGrad;
    ctx.fill();
  }

  // 真实光盘激光各向异性彩虹光泽 (Anisotropic Laser Specular Sheen)
  if (typeof ctx.createConicGradient === 'function') {
    const conic = ctx.createConicGradient(-Math.PI / 4, cx, cy);
    const op = disc.sheenOpacity;
    conic.addColorStop(0.0, 'rgba(255, 255, 255, 0)');
    conic.addColorStop(0.07, `rgba(255, 220, 180, ${op * 0.85})`);
    conic.addColorStop(0.12, `rgba(180, 240, 255, ${op})`);
    conic.addColorStop(0.18, 'rgba(255, 255, 255, 0)');
    conic.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    conic.addColorStop(0.57, `rgba(255, 220, 180, ${op * 0.85})`);
    conic.addColorStop(0.62, `rgba(180, 240, 255, ${op})`);
    conic.addColorStop(0.68, 'rgba(255, 255, 255, 0)');
    conic.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = conic;
    ctx.fill();
  }
  ctx.restore();

  // 3. 单层塑料边框边缘轮廓（印刷交界线与最外沿边线）
  ctx.save();
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.12)';
  ctx.lineWidth = 1 * scaleRatio;
  ctx.beginPath();
  ctx.arc(cx, cy, R_artwork, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, R_outer, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 7. 中心透明亚克力夹持圈与金属压合环 (Transparent Hub & Mirror Ring)
  ctx.save();
  ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.94)' : 'rgba(226, 232, 240, 0.94)';
  ctx.beginPath();
  ctx.arc(cx, cy, R_hub, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.15)';
  ctx.lineWidth = 1 * scaleRatio;
  ctx.beginPath();
  ctx.arc(cx, cy, R_hub, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 3.5 * scaleRatio;
  ctx.beginPath();
  ctx.arc(cx, cy, R_mirror, 0, Math.PI * 2);
  ctx.stroke();

  // 8. 中心透空圆孔（物理打穿，彻底透明）
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, R_hole, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 9. 内孔边缘立体反光微倒角
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1 * scaleRatio;
  ctx.beginPath();
  ctx.arc(cx, cy, R_hole + 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  return canvas;
}
