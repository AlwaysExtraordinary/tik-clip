import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getStoredDirectoryRef } from '@/db/settings';
import { verifyDirectoryPermission } from '@/services/fileSystem/index';

/**
 * 应用启动时恢复本地持久化视频目录及权限状态 Hook（仅在 App 根组件运行一次）
 */
export function useRestoreDirectory(): void {
  const setDirectoryRef = useAppStore((s) => s.setDirectoryRef);
  const setIsHandleRestoring = useAppStore((s) => s.setIsHandleRestoring);

  useEffect(() => {
    let mounted = true;

    async function restore() {
      setIsHandleRestoring(true);
      try {
        const storedRef = await getStoredDirectoryRef();

        if (storedRef && mounted) {
          const hasPerm = await verifyDirectoryPermission(storedRef, 'read');
          if (hasPerm && mounted) {
            setDirectoryRef(storedRef);
          } else if (mounted) {
            // 权限尚未激活（Web 模式下需重新交互授权），仅保存目录名以便界面提示
            setDirectoryRef({ name: storedRef.name });
          }
        }
      } catch (err) {
        console.warn('Error restoring directory:', err);
      } finally {
        if (mounted) {
          setIsHandleRestoring(false);
        }
      }
    }

    restore();
    return () => {
      mounted = false;
    };
  }, [setDirectoryRef, setIsHandleRestoring]);
}
