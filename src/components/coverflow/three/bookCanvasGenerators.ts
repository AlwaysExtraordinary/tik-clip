/**
 * @file bookCanvasGenerators.ts
 * @description 3D Coverflow 书本内页与实体光盘 2D Canvas 贴图生成器
 * 负责内页双层几何装饰衬纸、托盘塑料凹槽与手指缺口、影片典藏排版文字、
 * 以及具备真实聚碳酸酯透明外沿与各向异性激光彩虹反光的独立 3D 光盘贴图绘制。
 */

import { parseTagList } from '@/utils/common';
import { FONT_SERIF } from '@/utils/constants';
import i18n from '@/i18n';
import { CoverflowMovie } from '../types';
import { BOOK_ANIM_CONFIG } from './config';
import { ThemeMode } from './types';

/**
 * 绘制书本内页统一的双层几何装饰边框与底色
 * @param ctx 2D Canvas 上下文
 * @param width 画布宽度
 * @param height 画布高度
 * @param isDark 是否为暗色主题
 * @param withDiscShape 是否绘制与右侧光盘同位置的圆形光盘形状 (用于左侧封面)
 */
export function drawBookDecorativeBorder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isDark: boolean,
  withDiscShape: boolean = false
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

  // 3. 可选：在左侧封面处生成与右侧封面中光盘相同位置的圆形光盘圆形形状
  if (withDiscShape) {
    drawLeftDiscShape(ctx, width, isDark);
  }
}

/**
 * 绘制左侧内页与右侧光盘同位置的圆形光盘装饰轮廓与几何印记
 * 呈现光盘微凹槽衬底、双层同心外沿边框、同心音轨光轨线、中央夹持环及透空中孔
 * @param ctx 2D Canvas 上下文
 * @param width 画布宽度
 * @param isDark 是否为暗色主题
 */
export function drawLeftDiscShape(
  ctx: CanvasRenderingContext2D,
  width: number,
  isDark: boolean
): void {
  const { disc } = BOOK_ANIM_CONFIG;
  const cx = width / 2;
  const cy = disc.centerY;
  const R_outer = disc.outerRadius;
  const R_hole = disc.holeRadius;
  const R_hub = disc.hubRadius;
  const R_mirror = disc.mirrorRadius;

  const borderColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)';
  const accentColor = isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.15)';
  const faintColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
  const recessBg = isDark ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.04)';
  const holeBg = isDark ? '#0f172a' : '#cbd5e1';

  ctx.save();

  // 1. 光盘圆形微凹槽衬底
  ctx.beginPath();
  ctx.arc(cx, cy, R_outer, 0, Math.PI * 2);
  ctx.fillStyle = recessBg;
  ctx.fill();

  // 2. 双层圆形外沿装饰轮廓（与矩形双层边框风格呼应）
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = BOOK_ANIM_CONFIG.canvas.borderLineWidth;
  ctx.beginPath();
  ctx.arc(cx, cy, R_outer, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = faintColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R_outer - 8, 0, Math.PI * 2);
  ctx.stroke();

  // 3. 数据区同心光轨微装饰线
  const trackRadii = [
    R_hub + (R_outer - 8 - R_hub) * 0.35,
    R_hub + (R_outer - 8 - R_hub) * 0.65,
    R_hub + (R_outer - 8 - R_hub) * 0.85,
  ];
  ctx.strokeStyle = faintColor;
  ctx.lineWidth = 0.8;
  trackRadii.forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 4. 中央夹持透明环与金属压合圈
  ctx.beginPath();
  ctx.arc(cx, cy, R_hub, 0, Math.PI * 2);
  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, R_mirror, 0, Math.PI * 2);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 5. 托盘/光盘主轴透空中孔与微立体阴影
  ctx.beginPath();
  ctx.arc(cx, cy, R_hole, 0, Math.PI * 2);
  ctx.fillStyle = holeBg;
  ctx.fill();
  ctx.strokeStyle = isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, R_hole + 1.5, 0, Math.PI * 2);
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.restore();
}

/**
 * Canvas 文本自适应多行折行排版测量工具
 * 支持中文、日文单字切分与英文单词按词切分，超出最大行数时在末尾追加省略号
 * @param ctx 2D Canvas 上下文
 * @param text 待排版文本
 * @param maxWidth 单行最大可用宽度 (px)
 * @param maxLines 最大允许行数
 * @param fontSize 字体大小 (px)
 * @param fontFamily 字体栈 (默认为典藏衬线字体 FONT_SERIF)
 * @returns 折行后的文本行数组
 */
export function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  fontSize: number,
  fontFamily: string = FONT_SERIF
): string[] {
  ctx.save();
  ctx.font = `${fontSize}px ${fontFamily}`;
  const lines: string[] = [];
  const paragraphs = text.split(/\r?\n/);

  for (const para of paragraphs) {
    if (lines.length >= maxLines) break;
    const trimmed = para.trim();
    if (!trimmed) continue;

    // 分词：中日韩字符单字、英文/数字连续词组、其他符号或空白
    const tokens: string[] = [];
    const regex =
      /[\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf]|[\w-]+|[^\s\w\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf]+|\s+/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(trimmed)) !== null) {
      tokens.push(match[0]);
    }

    let currentLine = '';
    for (const token of tokens) {
      const testLine = currentLine + token;
      const testWidth = ctx.measureText(testLine.trim()).width;

      if (testWidth > maxWidth && currentLine.length > 0) {
        if (lines.length === maxLines - 1) {
          let truncated = currentLine.trim();
          while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
            truncated = truncated.slice(0, -1);
          }
          lines.push(truncated + '...');
          ctx.restore();
          return lines;
        }
        lines.push(currentLine.trim());
        currentLine = token.trimStart();
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine.trim().length > 0) {
      if (lines.length >= maxLines - 1 && ctx.measureText(currentLine.trim()).width > maxWidth) {
        let truncated = currentLine.trim();
        while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
          truncated = truncated.slice(0, -1);
        }
        lines.push(truncated + '...');
        ctx.restore();
        return lines;
      }
      lines.push(currentLine.trim());
    }
  }

  ctx.restore();
  return lines.slice(0, maxLines);
}

/**
 * 绘制居中对齐的上下布局元数据区块（标签居上、次要色；正文居下、主要色，居中对齐）
 * @param ctx 2D Canvas 上下文
 * @param label 字段标签文本（如 "演员"）
 * @param value 字段内容文本
 * @param cx 页面水平中心点 X 坐标
 * @param labelY 标签基线 Y 坐标
 * @param valueY 正文基线 Y 坐标
 * @param subtextColor 次要文本颜色
 * @param textColor 主要文本颜色
 * @param labelFontSize 标签字号
 * @param valueFontSize 正文字号
 * @param maxWidth 最大允许宽度
 * @param fontFamily 字体栈 (默认为典藏衬线字体 FONT_SERIF)
 */
export function drawVerticalMetaBlock(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  cx: number,
  labelY: number,
  valueY: number,
  subtextColor: string,
  textColor: string,
  labelFontSize: number = 12,
  valueFontSize: number = 13,
  maxWidth: number = 440,
  fontFamily: string = FONT_SERIF
): void {
  ctx.save();
  ctx.textAlign = 'center';

  // 1. 标签（上方居中）
  ctx.font = `bold ${labelFontSize}px ${fontFamily}`;
  ctx.fillStyle = subtextColor;
  ctx.fillText(label, cx, labelY);

  // 2. 正文（下方居中，超出宽度自动截断）
  ctx.font = `${valueFontSize}px ${fontFamily}`;
  let displayVal = value;
  if (ctx.measureText(displayVal).width > maxWidth) {
    while (displayVal.length > 0 && ctx.measureText(displayVal + '...').width > maxWidth) {
      displayVal = displayVal.slice(0, -1);
    }
    displayVal += '...';
  }

  ctx.fillStyle = textColor;
  ctx.fillText(displayVal, cx, valueY);
  ctx.restore();
}

/**
 * 生成书本翻开后左侧内衬纸艺术纹理 Canvas
 * 包含双层几何装饰衬纸、左侧光盘圆形轮廓底纹，以及影片简介典藏排版（若无数据则不显示）
 * @param movie 电影数据
 * @param themeMode 当前主题模式
 */
export function createLeftInsideCanvas(
  movie: CoverflowMovie,
  themeMode: ThemeMode
): HTMLCanvasElement {
  const { width, height, scale = 3 } = BOOK_ANIM_CONFIG.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);

  const isDark = themeMode === 'dark';
  drawBookDecorativeBorder(ctx, width, height, isDark, true);

  // 获取并规范化影片简介
  const description = (movie?.description ?? movie?.video?.description ?? '').trim();
  if (!description) {
    return canvas;
  }

  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const bodyColor = isDark ? 'rgba(255, 255, 255, 0.78)' : 'rgba(15, 23, 42, 0.78)';
  const cx = width / 2;
  const { typography } = BOOK_ANIM_CONFIG;

  // 1. 简介标题（文字居中呈现）
  const rawTitle = i18n.t('coverflow.synopsis', '简介');
  const synopsisTitle = rawTitle.length === 2 ? rawTitle.split('').join(' ') : rawTitle;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = textColor;
  ctx.font = `bold ${typography.descHeaderFontSize}px ${FONT_SERIF}`;
  ctx.fillText(synopsisTitle, cx, typography.descHeaderY);

  // 标题下方装饰细线
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 24, typography.descHeaderY + 14);
  ctx.lineTo(cx + 24, typography.descHeaderY + 14);
  ctx.stroke();

  // 2. 文字下方展示简介正文内容（自动测量折行与居中块排版）
  const maxWidth = 440;
  const maxLines = 7;
  const lines = wrapCanvasText(
    ctx,
    description,
    maxWidth,
    maxLines,
    typography.descContentFontSize,
    FONT_SERIF
  );

  if (lines.length > 0) {
    ctx.font = `${typography.descContentFontSize}px ${FONT_SERIF}`;
    ctx.fillStyle = bodyColor;
    ctx.textAlign = 'center';

    lines.forEach((line, index) => {
      ctx.fillText(line, cx, typography.descContentY + index * typography.descLineHeight);
    });
  }

  ctx.restore();
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
  const { width, height, scale = 3 } = BOOK_ANIM_CONFIG.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);

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
  if (movie.title) {
    ctx.fillStyle = textColor;
    ctx.font = `bold ${typography.titleFontSize}px ${FONT_SERIF}`;
    ctx.textAlign = 'center';
    ctx.fillText(movie.title.toUpperCase().slice(0, 26), cx, typography.titleY);
  }

  // 解析演员与类别元数据
  const actorList = parseTagList(movie.actor ?? movie.video?.actor);
  const categoryList = parseTagList(movie.category ?? movie.video?.category);
  const actorText = actorList.join(' / ');
  const categoryText = categoryList.join(' / ');
  const hasActor = actorText.length > 0;
  const hasCategory = categoryText.length > 0;

  const rawActor = i18n.t('coverflow.actors', '演员');
  const rawCategory = i18n.t('coverflow.category', '类别');
  const actorLabel = rawActor.length === 2 ? rawActor.split('').join(' ') : rawActor;
  const categoryLabel = rawCategory.length === 2 ? rawCategory.split('').join(' ') : rawCategory;

  const labelFontSize = typography.metaLabelFontSize ?? 12;
  const valueFontSize = typography.metaValueFontSize ?? 13;

  // 若无数据则不显示，有数据自适应采用上下布局排版
  if (hasActor && hasCategory) {
    drawVerticalMetaBlock(
      ctx,
      actorLabel,
      actorText,
      cx,
      typography.actorY,
      typography.actorValueY,
      subtextColor,
      textColor,
      labelFontSize,
      valueFontSize
    );
    drawVerticalMetaBlock(
      ctx,
      categoryLabel,
      categoryText,
      cx,
      typography.categoryY,
      typography.categoryValueY,
      subtextColor,
      textColor,
      labelFontSize,
      valueFontSize
    );
  } else if (hasActor) {
    drawVerticalMetaBlock(
      ctx,
      actorLabel,
      actorText,
      cx,
      typography.singleMetaY,
      typography.singleMetaValueY,
      subtextColor,
      textColor,
      labelFontSize,
      valueFontSize
    );
  } else if (hasCategory) {
    drawVerticalMetaBlock(
      ctx,
      categoryLabel,
      categoryText,
      cx,
      typography.singleMetaY,
      typography.singleMetaValueY,
      subtextColor,
      textColor,
      labelFontSize,
      valueFontSize
    );
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

// 创建光盘立体悬浮投影柔和阴影贴图 (Canvas 2D 径向渐变)
export function createDiscShadowCanvas(): HTMLCanvasElement {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.46;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(0.75, 'rgba(0, 0, 0, 0.1)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

// 创建光盘各向异性激光彩虹反射光泽独立贴图 (Canvas 2D 锥形渐变)
export function createDiscSheenCanvas(): HTMLCanvasElement {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const cx = size / 2;
  const cy = size / 2;
  const { disc } = BOOK_ANIM_CONFIG;

  const R_outer = size / 2 - 4;
  const scaleRatio = R_outer / disc.outerRadius;
  const R_hub = disc.hubRadius * scaleRatio;
  const rimWidth = 10 * scaleRatio;
  const R_artwork = R_outer - rimWidth;

  // 仅在光盘轨道有效反射区（中心透明亚克力夹持圈以外、单层塑料外沿以内）呈现彩虹激光
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R_artwork, 0, Math.PI * 2);
  ctx.arc(cx, cy, R_hub, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();

  if (typeof ctx.createConicGradient === 'function') {
    const conic = ctx.createConicGradient(-Math.PI / 4, cx, cy);
    const op = disc.sheenOpacity;
    const lobeStops: [number, string][] = [
      [0.0, 'rgba(255, 255, 255, 0)'],
      [0.06, `rgba(255, 215, 170, ${op * 0.7})`],
      [0.1, `rgba(255, 235, 190, ${op * 0.9})`],
      [0.13, `rgba(180, 240, 255, ${op})`],
      [0.16, `rgba(190, 200, 255, ${op * 0.8})`],
      [0.2, 'rgba(255, 255, 255, 0)'],
    ];

    [0, 0.5].forEach((baseOffset) => {
      lobeStops.forEach(([offset, color]) => {
        conic.addColorStop(baseOffset + offset, color);
      });
    });
    conic.addColorStop(1.0, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = conic;
    ctx.fill();
  }
  ctx.restore();

  return canvas;
}
