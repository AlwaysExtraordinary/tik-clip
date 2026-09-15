import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Input, TextArea, Button, useOverlayState, ComboBox, ListBox } from '@heroui/react';
import { Icon } from '@iconify/react';
import { Video, VideoLink } from '@/types/video';
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
  const [linkTitleOptions, setLinkTitleOptions] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [links, setLinks] = useState<VideoLink[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 当选中的视频改变或弹窗打开时初始化表单字段
  useEffect(() => {
    if (video) {
      setName(video.name || '');
      setCategory(video.category || '');
      setActor(video.actor || '');
      setDescription(video.description || '');
      setLinks(
        Array.isArray(video.links)
          ? video.links.map((l) => ({ title: l.title || '', url: l.url || '' }))
          : []
      );
      setErrorMessage(null);
    }
  }, [video, isOpen]);

  // 当弹窗打开时，从 IndexedDB 异步提取所有视频的已有演员与链接名称列表并初始化选项
  useEffect(() => {
    if (!isOpen) return;

    const loadOptions = async () => {
      try {
        const allVideos = await db.videos.toArray();
        const actorSet = new Set<string>();
        const linkTitleSet = new Set<string>();

        for (const v of allVideos) {
          if (v.actor && v.actor.trim()) {
            const parts = v.actor.split(/[,，/、;\s]+/);
            for (const p of parts) {
              const trimmed = p.trim();
              if (trimmed) {
                actorSet.add(trimmed);
              }
            }
          }
          if (Array.isArray(v.links)) {
            for (const l of v.links) {
              const trimmed = l?.title?.trim();
              if (trimmed) {
                linkTitleSet.add(trimmed);
              }
            }
          }
        }
        if (video?.actor?.trim()) {
          const parts = video.actor.split(/[,，/、;\s]+/);
          for (const p of parts) {
            const trimmed = p.trim();
            if (trimmed) {
              actorSet.add(trimmed);
            }
          }
        }
        if (Array.isArray(video?.links)) {
          for (const l of video.links) {
            const trimmed = l?.title?.trim();
            if (trimmed) {
              linkTitleSet.add(trimmed);
            }
          }
        }
        setActorOptions(
          Array.from(actorSet).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
          )
        );
        setLinkTitleOptions(
          Array.from(linkTitleSet).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
          )
        );
      } catch (err) {
        console.error('Failed to load options for ComboBox:', err);
      }
    };

    loadOptions();
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

  /**
   * 向候选链接名称列表中追加新链接名称（若列表中不存在则更新到选项中）
   * @param newTitle 待添加的新链接名称
   */
  const addLinkTitleOption = (newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setLinkTitleOptions((prev) => {
      const nextSet = new Set(prev);
      if (Array.from(nextSet).some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      nextSet.add(trimmed);
      return Array.from(nextSet).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      );
    });
  };

  // 添加新链接项输入行
  const handleAddLink = () => {
    setLinks((prev) => [...prev, { title: '', url: '' }]);
  };

  /**
   * 更新指定索引位置链接的字段值
   * @param index 待更新的链接项索引
   * @param field 待更新的字段（title 或 url）
   * @param value 输入的文本内容
   */
  const handleLinkChange = (index: number, field: 'title' | 'url', value: string) => {
    setLinks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  /**
   * 移除指定索引位置的链接项
   * @param index 待删除的链接项索引
   */
  const handleRemoveLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
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
    const validLinks: VideoLink[] = links
      .map((l) => ({
        title: l.title.trim() || l.url.trim(),
        url: l.url.trim(),
      }))
      .filter((l) => l.url.length > 0);

    setIsSaving(true);
    setErrorMessage(null);

    const now = Date.now();
    const updatedVideo: Video = {
      ...video,
      name: trimmedName,
      category: trimmedCategory || undefined,
      actor: trimmedActor || undefined,
      description: trimmedDescription || undefined,
      links: validLinks.length > 0 ? validLinks : undefined,
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
            links: validLinks,
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
        links: validLinks.length > 0 ? validLinks : undefined,
        updatedAt: now,
      });

      // 3. 点击保存成功后，将新演员与新链接名称追加至候选列表中
      if (trimmedActor) {
        addActorOption(trimmedActor);
      }
      validLinks.forEach((l) => {
        if (l.title) {
          addLinkTitleOption(l.title);
        }
      });

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
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="bg-surface rounded-3xl text-foreground max-h-[90vh] pr-3">
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

              <Modal.Header className="pb-4 border-b border-border mr-3">
                <Modal.Heading className="text-md">{t('videos.detailsTitle')}</Modal.Heading>
              </Modal.Header>

              <Modal.Body className="py-5 overflow-y-auto pr-3">
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
                      rows={4}
                      className="w-full no-scrollbar"
                    />
                  </div>

                  {/* 5. 相关链接 */}
                  <div className="space-y-2">
                    <div className="text-sm text-foreground">{t('videos.links')}</div>

                    {links.length > 0 && (
                      <div className="space-y-2">
                        {links.map((linkItem, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="w-1/3 shrink-0">
                              <ComboBox
                                fullWidth
                                allowsCustomValue
                                inputValue={linkItem.title}
                                onInputChange={(val) => {
                                  handleLinkChange(idx, 'title', val);
                                }}
                                onChange={(key) => {
                                  if (key !== null) {
                                    handleLinkChange(idx, 'title', String(key));
                                  }
                                }}
                              >
                                <ComboBox.InputGroup>
                                  <Input placeholder={t('videos.linkName')} />
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
                                      {linkTitleOptions.map((opt) => (
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
                            <Input
                              value={linkItem.url}
                              onChange={(e) => handleLinkChange(idx, 'url', e.target.value)}
                              placeholder={t('videos.linkUrl')}
                              className="flex-1 min-w-0"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              isIconOnly
                              size="sm"
                              aria-label={t('common.delete')}
                              className="size-8 text-foreground-muted hover:text-danger hover:bg-danger/10 shrink-0 cursor-pointer"
                              onClick={() => handleRemoveLink(idx)}
                            >
                              <Icon icon="lucide:trash-2" className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full h-9 border border-dashed border-border hover:border-foreground/40 text-foreground-muted
                       hover:text-foreground rounded-xl text-xs gap-1.5 cursor-pointer"
                      onClick={handleAddLink}
                    >
                      <Icon icon="lucide:plus" className="size-3.5" />
                      <span>{t('videos.addLink')}</span>
                    </Button>
                  </div>

                  {errorMessage && (
                    <p className="text-xs text-danger font-medium">{errorMessage}</p>
                  )}
                </form>
              </Modal.Body>

              <Modal.Footer className="pt-4 border-t border-border flex justify-end gap-2 mr-3">
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
