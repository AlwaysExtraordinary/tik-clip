/**
 * 使用 HTMLVideoElement + Canvas API 的缩略图生成器
 */

export async function generateVideoThumbnail(
  file: File
): Promise<{ blob: Blob; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.src = url;
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    // 超时安全保护
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Thumbnail generation timed out'));
    }, 15000);

    const cleanup = () => {
      clearTimeout(timeoutId);
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };

    video.onloadedmetadata = () => {
      const duration = video.duration || 0;
      // 选取目标帧：视频 > 5秒时取 25% 处，否则取中间位置
      let targetTime = 1;
      if (duration > 5) {
        targetTime = duration * 0.25;
      } else if (duration > 0) {
        targetTime = duration / 2;
      }
      video.currentTime = targetTime;
    };

    video.onseeked = () => {
      try {
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 360;

        // 缩略图最大宽度限制为 640px，以节省存储并保证高性能
        const maxWidth = 640;
        const scale = width > maxWidth ? maxWidth / width : 1;
        const targetWidth = Math.round(width * scale);
        const targetHeight = Math.round(height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('Could not get canvas 2d context'));
          return;
        }

        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        canvas.toBlob(
          (blob) => {
            const duration = video.duration || 0;
            cleanup();
            if (blob) {
              resolve({ blob, duration });
            } else {
              reject(new Error('Canvas toBlob returned null'));
            }
          },
          'image/jpeg',
          0.85
        );
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load video for thumbnail: ${video.error?.message || 'unknown'}`));
    };
  });
}

/**
 * 仅读取视频时长而不生成缩略图（用于已有封面图的情况）
 */
export async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.src = url;
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };

    video.onloadedmetadata = () => {
      const dur = video.duration || 0;
      cleanup();
      resolve(dur);
    };

    video.onerror = () => {
      cleanup();
      resolve(0);
    };
  });
}
