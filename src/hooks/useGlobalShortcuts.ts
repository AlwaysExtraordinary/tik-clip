import { useEffect } from 'react';
import { isTauri } from '@/services/fileSystem/index';
import { useClipsFeedStore } from '@/stores/clipsFeedStore';

/**
 * 桌面端全局物理多媒体按键支持（MediaPlayPause, MediaTrackNext, MediaTrackPrevious）
 * 用户在后台工作时也可通过键盘快捷键切片或播放/暂停
 */
export function useGlobalShortcuts() {
  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let isRegistered = false;

    async function registerMediaKeys() {
      try {
        const { register, unregisterAll } = await import('@tauri-apps/plugin-global-shortcut');

        // 先清理旧注册
        await unregisterAll().catch(() => {});

        // 下一个片段
        await register('MediaTrackNext', (event) => {
          if (event.state === 'Pressed') {
            const store = useClipsFeedStore.getState();
            const nextItem = store.shuffleQueue.next();
            if (nextItem) {
              store.setCurrentShuffleItem(nextItem);
              store.setLastPlaybackTime(nextItem.clip.startTime);
            }
          }
        }).catch(() => {});

        // 上一个片段
        await register('MediaTrackPrevious', (event) => {
          if (event.state === 'Pressed') {
            const store = useClipsFeedStore.getState();
            const prevItem = store.shuffleQueue.previous();
            if (prevItem) {
              store.setCurrentShuffleItem(prevItem);
              store.setLastPlaybackTime(prevItem.clip.startTime);
            }
          }
        }).catch(() => {});

        // 播放/暂停
        await register('MediaPlayPause', (event) => {
          if (event.state === 'Pressed') {
            // 发送模拟空格键事件到当前活动视频
            const activeVideo = document.querySelector('video');
            if (activeVideo) {
              if (activeVideo.paused) {
                activeVideo.play().catch(() => {});
              } else {
                activeVideo.pause();
              }
            }
          }
        }).catch(() => {});

        isRegistered = true;
      } catch (err) {
        console.warn('[Shortcuts] Failed to register global media shortcuts:', err);
      }
    }

    registerMediaKeys();

    return () => {
      if (isTauri() && isRegistered) {
        import('@tauri-apps/plugin-global-shortcut')
          .then(({ unregisterAll }) => unregisterAll())
          .catch(() => {});
      }
    };
  }, []);
}
