# 项目介绍

**TikClip** 是一个现代化的本地视频片段管理与播放器，提供类似 TikTok / 抖音的沉浸式短视频流播放体验，支持视频片段（Clip）打点标记、标签管理与随机无限流播放。支持 Web 端与 Tauri 桌面端双端运行。

## 技术栈

- **前端核心**：React 19 + TypeScript + Vite 8
- **UI 体系**：HeroUI v3 (`@heroui/react`) + Tailwind CSS v4 + Iconify 图标
- **路由与状态**：React Router v7 + Zustand v4
- **本地存储**：Dexie 4 (IndexedDB 本地持久化)
- **桌面端 (Tauri)**：Tauri v2 + Rust 后端（自定义 `stream://` 协议流式播放、目录变动监听 notify + 防抖通知）
- **国际化**：i18next + react-i18next

## 核心架构与模块划分

```
src/
├── app/                  # 应用入口与路由配置 (App.tsx, router.tsx)
├── pages/                # 核心页面 (ClipsPage 沉浸式流, VideosPage 视频库, VideoDetailPage 播放与切片)
├── components/           # UI 组件
│   ├── video/            # 视频播放器 (VideoPlayer)、控制器、进度条及悬停缩略图预览
│   ├── clip/             # 片段 Feed 流容器 (ClipFeedContainer)、表单、列表与标签面板
│   ├── layout/           # 布局框架 (MainLayout, Sidebar)
│   └── settings/         # 设置弹窗
├── services/             # 核心服务层
│   ├── fileSystem/       # 跨端文件系统适配器 (Web API / Tauri Plugin 双端抽象)
│   ├── videoScanner.ts   # 本地视频/缩略图扫描
│   ├── thumbnail.ts      # 视频抽帧与缩略图生成/缓存
│   └── shuffle.ts        # 智能随机流算法
├── stores/               # Zustand 状态 (playerStore, clipsFeedStore, appStore, settingsStore)
├── db/                   # Dexie 数据库定义与 CRUD (videos, clips, settings)
├── hooks/                # 业务 Hooks (useDirectory, useDirectoryWatcher, useKeyboardShortcuts 等)
└── utils/                # 通用工具函数

src-tauri/                # Tauri 桌面端后端 (Rust)
├── src/stream.rs         # 自定义 stream:// HTTP Range 视频流处理协议
└── src/lib.rs            # 本地文件系统变动监听 (notify) 与 Tauri 插件/命令注册
```

## 关键业务机制与约定

1. **视频目录规范**：每个视频需存放在独立的子文件夹中，同目录下可选图片文件作为视频封面。
2. **跨端文件与流播放**：
   - Web 端通过 File System Access API 读取本地文件并生成 ObjectURL。
   - Tauri 端通过 Rust 自定义 `stream://` 协议支持 HTTP Range 请求流式播放，解决大视频内存占用与加载瓶颈。
3. **数据流与协同**：
   - Dexie (IndexedDB) 负责视频元数据、片段数据和配置的持久化存储。
   - Zustand 负责运行时的播放状态、当前播放流、设置与界面交互状态。
   - 桌面端通过 `app://fs-changed` 事件实时通知前端目录变更并防抖刷新。

# 注意事项

1. 禁止使用tailwind css的font-mono类名
2. 使用HeroUI构建页面前，仔细阅读相关组件的api，尽量只使用使用组件默认样式完成，功能需要时再添加tailwind类。
3. 使用tailwind构建界面样式时，精简使用css类名实现功能。
4. 类似w-3, h-3的类名，可以使用size-3替换。
5. 实现功能或优化过程中，删除无用代码，保持代码精简。
6. 为方法添加注释。

# Git 提交规范

使用 Conventional Commits 规范：

`<type>: <description>`

## 类型

- `feat`：新增功能
- `fix`：修复 Bug
- `refactor`：代码重构，不改变功能
- `style`：代码格式或样式调整
- `perf`：性能优化
- `docs`：文档修改
- `test`：新增或修改测试
- `chore`：构建、工具或其他杂项修改
- `deps`：依赖相关修改
- `revert`：撤销之前的提交

## 规则

- 根据修改的主要目的选择最合适的类型。
- 提交描述保持简短、清晰。
- 使用中文描述，并以动词开头。
- 不要将与当前任务无关的修改一起提交。
- 没有实际修改时不要创建提交。
