# TikClip 发布流程与 GitHub Actions 配置指南

本文档介绍 TikClip 的自动化发布流程、版本递增规则以及基于 AI 的更新日志生成配置。

---

## 1. 流程概览

TikClip 的自动化发布通过 GitHub Actions (`.github/workflows/release.yml`) 完成，包含两个核心阶段：

```
[触发发布] (手动触发或推送 Tag)
    ↓
[Job 1: Prepare] (在 ubuntu-latest 单次运行)
    ├─ 1. 计算目标版本号与 Tag (自动递增或手动输入)
    ├─ 2. 提取自上次发布以来的有效 Git 提交记录
    ├─ 3. 调用 AI 生成精炼更新说明 (若无 Key 则自动按规范分类降级)
    └─ 4. 在 Actions 页面生成 Step Summary 实时预览
    ↓
[Job 2: Release 构建矩阵] (macOS + Windows 并发构建)
    ├─ 1. 同步版本号到 src-tauri/tauri.conf.json 与 package.json
    ├─ 2. 编译各平台二进制及安装包 (.dmg, .msi, .exe)
    └─ 3. 上传构建资产到对应的 GitHub Release (草稿或正式)
```

---

## 2. 触发发布方式

### 方式一：GitHub 页面手动一键发布（推荐）

1. 进入 GitHub 仓库页面，点击顶部 **Actions** 标签页。
2. 在左侧选择 **Release Desktop App** 工作流。
3. 点击右侧 **Run workflow** 下拉菜单，可按需调整发布参数：

| 参数名称          | 类型    | 默认值  | 说明                                                                                                                                                                                                                                                              |
| :---------------- | :------ | :------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **version**       | string  | 空      | 发布版本号。**留空则根据下方的递增类型自动计算**（例如 `v0.1.1`）。如需手动指定（如 `v0.2.0-beta.1`）可直接在此输入。                                                                                                                                             |
| **bump_type**     | choice  | `patch` | 自动递增模式（仅在 `version` 留空时生效）：<br>• `patch`：修正版本（例 `0.1.0` → `0.1.1`）<br>• `minor`：特性版本（例 `0.1.0` → `0.2.0`）<br>• `major`：主版本（例 `0.1.0` → `1.0.0`）<br>• `auto`：根据提交自动推断（含 `feat:` 升 minor，含破坏性变动升 major） |
| **release_title** | string  | 空      | Release 标题。**留空默认为 `TikClip <版本号>`**。                                                                                                                                                                                                                 |
| **release_notes** | string  | 空      | 手动更新说明。**留空则由 AI 根据 Git 提交记录自动生成**。                                                                                                                                                                                                         |
| **is_prerelease** | boolean | `false` | 是否标记为预发布（Pre-release）。                                                                                                                                                                                                                                 |
| **is_draft**      | boolean | `true`  | **是否保存为 Draft 草稿**。推荐保持勾选，构建完成后可在 GitHub Release 页面核对预览内容，确认无误后点击 Publish 正式发布。                                                                                                                                        |

4. 点击绿色的 **Run workflow** 按钮启动发布。

---

### 方式二：通过 Git Tag 触发

在本地为提交打上符合 `v*` 规范的 Tag 并推送到 GitHub，工作流将自动启动：

```bash
# 打 Tag 并推送
git tag v0.1.1
git push origin v0.1.1
```

> **注意**：Tag 触发模式下，系统会自动识别该 Tag 并由 AI 生成自上个 Tag 到该 Tag 之间的提交更新说明。

---

## 3. AI 更新说明生成与配置

TikClip 内置了多渠道 AI 支持与异常优雅降级保障。

### 3.1 支持的 AI 服务商

#### 推荐方案：Google Gemini（免费且响应快）

1. 前往 [Google AI Studio](https://aistudio.google.com/) 获取免费 API Key。
2. 打开 GitHub 仓库的 **Settings** -> **Secrets and variables** -> **Actions**。
3. 点击 **New repository secret**，添加：
   - **Name**: `GEMINI_API_KEY`
   - **Value**: 你的 Gemini API 密钥
4. （可选）如需更换模型，可添加 Secret 或环境变量 `AI_MODEL`（默认为 `gemini-2.5-flash`）。

#### 备选方案：OpenAI / DeepSeek / 通义千问等兼容模型

在 GitHub Secrets 中配置：

- `OPENAI_API_KEY` 或 `AI_API_KEY`：API 密钥
- `AI_BASE_URL`：API 基础地址（如 DeepSeek 为 `https://api.deepseek.com/v1`）
- `AI_MODEL`：模型名称（如 `deepseek-chat` 或 `gpt-4o-mini`）

---

### 3.2 零配置与优雅降级机制

如果仓库**未配置任何 AI Key**，或者遭遇网络超时、API 额度超限等情况：

脚本会**自动降级**，基于项目的 [Conventional Commits 规范](../AGENTS.md) 对提交记录进行智能解析与分类，生成如下结构清晰的 Markdown：

```markdown
### TikClip v0.1.1 更新内容

#### 🚀 新增功能

- [`c393934`] feat: 优化触控板的滑动体验

#### 🐛 缺陷修复

- [`75ff997`] fix: 修复文件夹权限丢失问题
- [`5b489b0`] fix: 样式调整
  ...
```

**发布流程绝不会因为 AI 调用失败而中断！**

---

## 4. 本地测试与工具脚本

发布逻辑集中在 `scripts/release-helper.mjs` 中，您可以在本地直接执行和测试：

```bash
# 1. 模拟 prepare 阶段 (查看版本推算与更新日志生成效果)
node scripts/release-helper.mjs prepare

# 2. 测试指定参数 (例如测试 minor 递增)
INPUT_BUMP_TYPE=minor node scripts/release-helper.mjs prepare

# 3. 测试同步版本号
node scripts/release-helper.mjs sync 0.1.1
```
