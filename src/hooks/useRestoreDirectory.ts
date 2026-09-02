import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getStoredDirectoryRef } from '@/db/settings';
import { queryDirectoryPermission } from '@/services/fileSystem/index';

/**
 * 应用启动时恢复本地持久化视频目录及权限状态 Hook（仅在 App 根组件运行一次）
 */
export function useRestoreDirectory(): void {
  const setDirectoryRef = useAppStore((s) => s.setDirectoryRef);
  const setIsHandleRestoring = useAppStore((s) => s.setIsHandleRestoring);
  const setHasDirectoryPermission = useAppStore((s) => s.setHasDirectoryPermission);

  useEffect(() => {
    let mounted = true;

    async function restore() {
      setIsHandleRestoring(true);
      try {
        const storedRef = await getStoredDirectoryRef();

        if (storedRef && mounted) {
          // 静默查询权限，避免在无用户手势时调用 requestPermission 触发 DOMException
          const hasPerm = await queryDirectoryPermission(storedRef, 'read');
          // 完整保留 storedRef（包含 handle），以便后续一键唤起重新授权
          setDirectoryRef(storedRef);
          setHasDirectoryPermission(hasPerm);
        } else if (mounted) {
          setDirectoryRef(null);
          setHasDirectoryPermission(false);
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
  }, [setDirectoryRef, setIsHandleRestoring, setHasDirectoryPermission]);
}
