import React, { useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';

interface DeleteClipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  timeRangeText: string;
}

export const DeleteClipModal: React.FC<DeleteClipModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  timeRangeText,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs bg-surface border border-border rounded-3xl p-5 shadow-floating text-foreground text-center animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-10 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-3">
          <Icon icon="lucide:trash-2" className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-semibold mb-1">{t('deleteModal.title')}</h3>
        <p className="text-xs text-foreground-muted mb-5">{timeRangeText}</p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-3 rounded-2xl bg-surface-hover hover:bg-surface-active text-xs font-semibold text-foreground transition-colors cursor-pointer"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 px-3 rounded-2xl bg-danger hover:bg-danger-hover text-danger-foreground text-xs font-semibold shadow-subtle transition-colors cursor-pointer"
          >
            {t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
};
