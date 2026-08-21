/* 确认弹窗组件 */
import React from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, useOverlayState } from '@heroui/react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: React.ReactNode;
  content?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary' | 'secondary';
  iconName?: string;
  isPending?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  content,
  confirmText,
  cancelText,
  confirmVariant = 'danger',
  iconName,
  isPending = false,
}) => {
  const { t } = useTranslation();

  const modalState = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open && !isPending) {
        onClose();
      }
    },
  });

  return (
    <Modal state={modalState}>
      <Modal.Backdrop variant="blur">
        <Modal.Container placement="center">
          <Modal.Dialog className="w-full max-w-xs bg-surface border border-border rounded-3xl p-5 shadow-floating text-foreground text-center flex flex-col items-center">
            {confirmVariant === 'danger' ? (
              <div className="w-10 h-10 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-3">
                <Icon icon={iconName || 'lucide:trash-2'} className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto mb-3">
                <Icon icon={iconName || 'lucide:alert-circle'} className="w-5 h-5" />
              </div>
            )}

            {title && <Modal.Heading className="text-sm font-semibold mb-3">{title}</Modal.Heading>}

            {content && (
              <div className="text-xs text-foreground-muted mb-5 w-full">
                {typeof content === 'string' ? <p>{content}</p> : content}
              </div>
            )}

            <div className="flex gap-2 w-full">
              <Button
                variant="secondary"
                size="sm"
                isDisabled={isPending}
                onClick={onClose}
                className="flex-1 rounded-2xl text-xs font-semibold cursor-pointer"
              >
                {cancelText || t('common.cancel')}
              </Button>
              <Button
                variant={confirmVariant}
                size="sm"
                isPending={isPending}
                onClick={onConfirm}
                className="flex-1 rounded-2xl text-xs font-semibold shadow-subtle cursor-pointer"
              >
                {confirmText ||
                  (confirmVariant === 'danger' ? t('common.delete') : t('common.confirm'))}
              </Button>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
