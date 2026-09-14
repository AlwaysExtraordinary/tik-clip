import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Input,
  TextArea,
  Button,
  useOverlayState,
  ComboBox,
  ListBox,
} from '@heroui/react';
import { Video } from '@/types/video';
import { db } from '@/db/database';
import { updateVideoMetadataInDataJson } from '@/services/fileSystem/index';
import { DirectoryRef } from '@/services/fileSystem/types';

interface VideoDetailsModalProps {
  isOpen: boolean;
  video: Video | null;
  activeDirectory: DirectoryRef | null;
  onClose: () => void;
  onSaved: (updatedVideo: Video) => void;
}

/**
 * 视频详细信息编辑弹窗组件
 * 原生使用 HeroUI 组件实现，支持编辑名称、类别、演员与描述并持久化至 data.json 与 IndexedDB
 */
export const VideoDetailsModal: React.FC<VideoDetailsModalProps> = ({
  isOpen,
  video,
  activeDirectory,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [actor, setActor] = useState('');
  const [actorOptions, setActorOptions] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 当选中的视频改变或弹窗打开时初始化表单字段
  useEffect(() => {
    if (video) {
      setName(video.name || '');
      setCategory(video.category || '');
      setActor(video.actor || '');
      setDescription(video.description || '');
      setErrorMessage(null);
    }
  }, [video, isOpen]);

  // 当弹窗打开时，从 IndexedDB 异步提取所有视频的已有演员列表并初始化选项
  useEffect(() => {
    if (!isOpen) return;

    const loadActors = async () => {
      try {
        const allVideos = await db.videos.toArray();
        const set = new Set<string>();
        for (const v of allVideos) {
          if (v.actor && v.actor.trim()) {
            const parts = v.actor.split(/[,，/、;\s]+/);
            for (const p of parts) {
              const trimmed = p.trim();
              if (trimmed) {
                set.add(trimmed);
              }
            }
          }
        }
        if (video?.actor?.trim()) {
          const parts = video.actor.split(/[,，/、;\s]+/);
          for (const p of parts) {
            const trimmed = p.trim();
            if (trimmed) {
              set.add(trimmed);
            }
          }
        }
        setActorOptions(
          Array.from(set).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
          )
        );
      } catch (err) {
        console.error('Failed to load actors for ComboBox:', err);
      }
    };

    loadActors();
  }, [isOpen, video]);

  /**
   * 向候选演员列表中追加新演员（若列表中不存在则更新到选项中）
   * @param newActor 待添加的新演员名称字符串（支持包含分隔符的多演员输入）
   */
  const addActorOption = (newActor: string) => {
    const trimmed = newActor.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/[,，/、;\s]+/);
    setActorOptions((prev) => {
      const nextSet = new Set(prev);
      let changed = false;
      for (const part of parts) {
        const p = part.trim();
        if (p && !Array.from(nextSet).some((item) => item.toLowerCase() === p.toLowerCase())) {
          nextSet.add(p);
          changed = true;
        }
      }
      if (!changed) return prev;
      return Array.from(nextSet).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      );
    });
  };

  const modalState = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open && !isSaving) {
        onClose();
      }
    },
  });

  /**
   * 保存视频元数据修改并同步持久化
   * @param e 表单提交事件对象（可选）
   */
  const handleSave = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (!video) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage(t('videos.nameRequired'));
      return;
    }

    const trimmedCategory = category.trim();
    const trimmedActor = actor.trim();
    const trimmedDescription = description.trim();

    setIsSaving(true);
    setErrorMessage(null);

    const now = Date.now();
    const updatedVideo: Video = {
      ...video,
      name: trimmedName,
      category: trimmedCategory || undefined,
      actor: trimmedActor || undefined,
      description: trimmedDescription || undefined,
      updatedAt: now,
    };

    try {
      // 1. 同步保存至子目录下的 data.json 文件
      if (activeDirectory) {
        try {
          await updateVideoMetadataInDataJson(activeDirectory, video.folderName, {
            name: trimmedName,
            category: trimmedCategory,
            actor: trimmedActor,
            description: trimmedDescription,
          });
        } catch (err) {
          console.warn('Failed to update data.json on metadata edit:', err);
        }
      }

      // 2. 更新 IndexedDB 本地数据库记录
      await db.videos.update(video.id, {
        name: trimmedName,
        category: trimmedCategory || undefined,
        actor: trimmedActor || undefined,
        description: trimmedDescription || undefined,
        updatedAt: now,
      });

      // 3. 点击保存成功后，将新演员追加至候选列表中
      if (trimmedActor) {
        addActorOption(trimmedActor);
      }

      // 4. 通知父组件刷新列表状态
      onSaved(updatedVideo);
      onClose();
    } catch (err) {
      console.error('Failed to save video details:', err);
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal state={modalState}>
      <Modal.Backdrop variant="blur">
        <Modal.Container placement="center" size="md">
          <Modal.Dialog className="w-full bg-surface border border-border rounded-3xl p-6 sm:p-7 shadow-floating text-foreground relative max-h-[90vh] flex flex-col">
            <div
              className="contents"
              onKeyDown={(e: React.KeyboardEvent) => {
                // 阻止弹窗内键盘事件向外冒泡，避免触发底层封面流快捷键
                e.stopPropagation();
                if (e.key === 'Escape' && !isSaving) {
                  onClose();
                }
              }}
            >
              <Modal.CloseTrigger className="absolute top-5 right-5" />

              <Modal.Header className="pb-4 border-b border-border">
                <Modal.Heading className="text-md">{t('videos.detailsTitle')}</Modal.Heading>
              </Modal.Header>

              <Modal.Body className="py-5 overflow-y-auto">
                <form
                  id="video-details-form"
                  onSubmit={handleSave}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    // 阻止表单内按键事件冒泡
                    e.stopPropagation();
                  }}
                  className="space-y-4"
                >
                  {/* 1. 名称 */}
                  <div className="space-y-1.5">
                    <div className="text-sm text-foreground mb-2">
                      {t('videos.name')} <span className="text-danger">*</span>
                    </div>
                    <Input
                      autoFocus
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder={t('videos.name')}
                      className="w-full"
                      required
                    />
                  </div>

                  {/* 2. 类别 */}
                  <div className="space-y-1.5">
                    <div className="text-sm text-foreground mb-2">{t('videos.category')}</div>
                    <Input
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder={t('videos.category')}
                      className="w-full"
                    />
                  </div>

                  {/* 3. 演员 */}
                  <div className="space-y-1.5">
                    <div className="text-sm text-foreground mb-2">{t('videos.actor')}</div>
                    <ComboBox
                      fullWidth
                      allowsCustomValue
                      inputValue={actor}
                      onInputChange={(val) => {
                        setActor(val);
                      }}
                      onChange={(key) => {
                        if (key !== null) {
                          setActor(String(key));
                        }
                      }}
                    >
                      <ComboBox.InputGroup>
                        <Input placeholder={t('videos.actor')} />
                        <ComboBox.Trigger />
                      </ComboBox.InputGroup>
                      <ComboBox.Popover>
                        <div
                          onKeyDown={(e: React.KeyboardEvent) => {
                            // 阻止候选列表内按键事件冒泡
                            e.stopPropagation();
                          }}
                        >
                          <ListBox>
                            {actorOptions.map((opt) => (
                              <ListBox.Item key={opt} id={opt} textValue={opt}>
                                {opt}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </div>
                      </ComboBox.Popover>
                    </ComboBox>
                  </div>

                  {/* 4. 描述 */}
                  <div className="space-y-1.5">
                    <div className="text-sm text-foreground mb-2">{t('videos.description')}</div>
                    <TextArea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t('videos.description')}
                      rows={3}
                      className="w-full"
                    />
                  </div>

                  {errorMessage && <p className="text-xs text-danger font-medium">{errorMessage}</p>}
                </form>
              </Modal.Body>

              <Modal.Footer className="pt-4 border-t border-border flex justify-end gap-2">
                <Button variant="secondary" size="sm" isDisabled={isSaving} onClick={onClose}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  isDisabled={isSaving || !name.trim()}
                  type="submit"
                  form="video-details-form"
                >
                  {t('common.save')}
                </Button>
              </Modal.Footer>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
