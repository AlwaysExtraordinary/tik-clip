/**
 * 封面展开图材质处理结果接口
 */
export interface ProcessedCoverTextures {
  frontCanvas: HTMLCanvasElement;
  spineCanvas: HTMLCanvasElement;
  backCanvas: HTMLCanvasElement;
  fullCanvas: HTMLCanvasElement;
}

/**
 * 加载图片 URL 并将其裁剪/处理为 3 个独立的 Canvas 纹理：
 * { frontCanvas, spineCanvas, backCanvas }
 * @param imageSrc 图片地址（支持 Blob URL 与标准 URL）
 * @param title 封面标题（用于绘制在书脊与封底背面）
 */
export function processCoverSpreadTexture(
  imageSrc: string,
  title = 'MOVIE TITLE'
): Promise<ProcessedCoverTextures> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const aspect = iw / ih;

      const fullSpreadCanvas = document.createElement('canvas');
      const ctx = fullSpreadCanvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context is not supported'));
        return;
      }

      // 检查图片是否为 800x537 展开图（宽高比 > 1.25）
      if (aspect > 1.25) {
        fullSpreadCanvas.width = iw;
        fullSpreadCanvas.height = ih;
        ctx.drawImage(img, 0, 0);
      } else {
        // 单张封面图片 -> 自动生成完整的 800x537 3D 碟盒展开图布局
        fullSpreadCanvas.width = 800;
        fullSpreadCanvas.height = 537;

        // 背景深色渐变底色
        ctx.fillStyle = '#0a0d14';
        ctx.fillRect(0, 0, 800, 537);

        // 绘制封底（高斯模糊背景版本）
        ctx.save();
        ctx.filter = 'blur(10px) brightness(0.4)';
        ctx.drawImage(img, 0, 0, 379.5, 537);
        ctx.restore();

        // 绘制封底文字覆盖层
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(title.toUpperCase().slice(0, 24), 30, 80);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText('SPECIAL 3D COLLECTOR EDITION', 30, 110);
        ctx.fillText('DOLBY ATMOS • 4K ULTRA HD • BLU-RAY', 30, 480);

        // 绘制封底装饰条形码
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(30, 400, 140, 50);
        ctx.fillStyle = '#000000';
        for (let i = 35; i < 165; i += 4) {
          if (Math.random() > 0.3) ctx.fillRect(i, 405, 2, 40);
        }

        // 绘制书脊（X: 379.5 到 420.5，宽度 41）
        ctx.fillStyle = '#111827';
        ctx.fillRect(379.5, 0, 41, 537);
        ctx.save();
        ctx.translate(400, 268);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title.toUpperCase().slice(0, 30), 0, 6);
        ctx.restore();

        // 绘制封面正面（X: 420.5 到 800，宽度 379.5）
        ctx.drawImage(img, 420.5, 0, 379.5, 537);
      }

      // 将 fullSpreadCanvas 裁剪切片为 3 个独立目标 Canvas
      const W = fullSpreadCanvas.width;
      const H = fullSpreadCanvas.height;

      // 800px 展开图中书脊宽约 41px
      const spineWidthRatio = 41 / 800;
      const spineWidthPx = W * spineWidthRatio;
      const sideWidthPx = (W - spineWidthPx) / 2;

      // 1. 封面正面（右侧）
      const frontCanvas = document.createElement('canvas');
      frontCanvas.width = Math.round(sideWidthPx);
      frontCanvas.height = H;
      const fCtx = frontCanvas.getContext('2d');
      if (fCtx) {
        fCtx.drawImage(
          fullSpreadCanvas,
          W - sideWidthPx, 0, sideWidthPx, H,
          0, 0, frontCanvas.width, H
        );
      }

      // 2. 书脊（中间）
      const spineCanvas = document.createElement('canvas');
      spineCanvas.width = Math.round(spineWidthPx);
      spineCanvas.height = H;
      const sCtx = spineCanvas.getContext('2d');
      if (sCtx) {
        sCtx.drawImage(
          fullSpreadCanvas,
          sideWidthPx, 0, spineWidthPx, H,
          0, 0, spineCanvas.width, H
        );
      }

      // 3. 封底背面（左侧）
      const backCanvas = document.createElement('canvas');
      backCanvas.width = Math.round(sideWidthPx);
      backCanvas.height = H;
      const bCtx = backCanvas.getContext('2d');
      if (bCtx) {
        bCtx.drawImage(
          fullSpreadCanvas,
          0, 0, sideWidthPx, H,
          0, 0, backCanvas.width, H
        );
      }

      resolve({
        frontCanvas,
        spineCanvas,
        backCanvas,
        fullCanvas: fullSpreadCanvas,
      });
    };

    img.onerror = (err) => {
      reject(err);
    };

    img.src = imageSrc;
  });
}
