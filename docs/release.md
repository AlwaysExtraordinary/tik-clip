# TikClip 发布流程与 GitHub Actions 配置指南

本文档介绍 TikClip 的自动化发布流程、正式版与 Beta 测试版的双轨版本递增规则，以及基于 AI 的更新日志生成配置。

---

## 1. 流程概览

TikClip 的自动化发布通过 GitHub Actions (`.github/workflows/release.yml`) 完成，包含两个核心阶段：

```
[触发发布] (手动触发或推送 Tag)
    ↓
[Job 1: Prepare] (在 ubuntu-latest 单次运行)
    ├─ 1. 双轨版本计算 (区分正式版与 Beta 预发布版，实现转正与多轮 Beta 迭代)
    ├─ 2. 提取自基准发布以来的有效 Git 提交记录
    ├─ 3. 调用 AI 生成精炼更新说明 (若无 Key 则自动按规范分类降级)
    └─ 4. 在 Actions 页面生成 Step Summary 实时预览
    ↓
[Job 2: Release 构建矩阵] (macOS + Windows 并发构建)
    ├─ 1. 同步纯数字版本号到 src-tauri/tauri.conf.json 与 package.json
    ├─ 2. 编译各平台二进制及安装包 (.dmg, .msi, .exe)
    └─ 3. 上传构建资产到对应的 GitHub Release (草稿或正式)
```

---

## 2. 触发发布方式

### 方式一：GitHub 页面手动一键发布（推荐）

1. 进入 GitHub 仓库页面，点击顶部 **Actions** 标签页。
2. 在左侧选择 **Release Desktop App** 工作流。
3. 点击右侧 **Run workflow** 下拉菜单，可按需调整发布参数：

| 参数名称          | 类型    | 默认值  | 说明                                                                                                                                                                                                                                                                          |
| :---------------- | :------ | :------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **version**       | string  | 空      | 发布版本号。**留空则根据下述双轨规则自动计算**。若手动输入（如 `v0.2.0`），系统会根据是否勾选 `is_prerelease` 智能补全 `-beta` 或移除 `-beta`。                                                                                                                               |
| **bump_type**     | choice  | `patch` | 自动递增模式（仅在 `version` 留空时生效）：<br>• `patch`：补丁/Beta 内部迭代（详见下方双轨矩阵）<br>• `minor`：小版本升级（例 `0.1.0` → `0.2.0`）<br>• `major`：主版本升级（例 `0.1.0` → `1.0.0`）<br>• `auto`：根据提交自动推断（含 `feat:` 升 minor，含破坏性改动升 major） |
| **release_title** | string  | 空      | Release 标题。**留空默认为 `TikClip <版本号>`**。                                                                                                                                                                                                                             |
| **release_notes** | string  | 空      | 手动更新说明。**留空则由 AI 根据 Git 提交记录自动生成**。                                                                                                                                                                                                                     |
| **is_prerelease** | boolean | `false` | **是否发布为 Pre-release**。<br>• **勾选**：发布为 Beta 测试版，自动附带 `-beta` 后缀，并在 Beta 轨道内安全迭代。<br>• **不勾选**：发布为正式版，若当前有未转正的 Beta 则直接毕业转正，不跳号。                                                                               |
| **is_draft**      | boolean | `true`  | **是否保存为 Draft 草稿**。推荐保持勾选，构建完成后可在 GitHub Release 页面核对预览内容，确认无误后点击 Publish 正式发布。                                                                                                                                                    |

4. 点击绿色的 **Run workflow** 按钮启动发布。

---

### 方式二：通过 Git Tag 触发

在本地为提交打上符合 `v*` 规范的 Tag 并推送到 GitHub，工作流将自动启动：

```bash
# 打 Tag 并推送 (如果 Tag 带有 -beta 则自动识别为 Pre-release)
git tag v0.1.1
git push origin v0.1.1
```

---

## 3. 正式版与 Beta 版双轨独立版本推算规则 (Dual-Track SemVer)

为了避免“发布正式版跳过版本号”或“多次 Beta 测试把正式版本号提前消耗”的问题，系统引入了**双轨版本推算机制**：

| 发布意图                                | 上一个最新 Tag 状态                                   | 推算结果                                                                                               | 核心设计意义                                       |
| :-------------------------------------- | :---------------------------------------------------- | :----------------------------------------------------------------------------------------------------- | :------------------------------------------------- |
| **正式发布**<br>（未勾选 Pre-release）  | 最新为未转正的 Beta<br>（如当前最新为 `v0.1.0-beta`） | **`v0.1.0`**<br>（移除 `-beta`，直接转正）                                                             | **测试版本毕业转正**，不跳过主版本号。             |
| **正式发布**<br>（未勾选 Pre-release）  | 最新已是正式版<br>（如 `v0.1.0`）                     | 依 `bump_type` 递增：<br>• patch 👉 **`v0.1.1`**<br>• minor 👉 **`v0.2.0`**<br>• major 👉 **`v1.0.0`** | 常规正式迭代。                                     |
| **Beta 预发布**<br>（勾选 Pre-release） | 最新为该版本的 Beta<br>（如当前最新为 `v0.1.0-beta`） | **`v0.1.0-beta.1`**<br>（再次发布为 `v0.1.0-beta.2`）                                                  | **同一测试期多次迭代**，基础版本稳定，自动带序号。 |
| **Beta 预发布**<br>（勾选 Pre-release） | 最新已是正式版<br>（如 `v0.1.0`）                     | 依 `bump_type` 开启下个 Beta：<br>• patch 👉 **`v0.1.1-beta`**<br>• minor 👉 **`v0.2.0-beta`**         | 开启下一阶段功能的预发布测试。                     |

### 手动输入的智能保护

- **勾选了 Pre-release**：若手动填入 `v0.2.0`（忘记写后缀），系统自动补全为 `v0.2.0-beta`。
- **未勾选 Pre-release**：若手动填入 `v0.2.0-beta`，系统自动剥离后缀为 `v0.2.0`，保证正式版纯净。
- **Windows MSI 纯数字规范**：无论 Release Tag 是 `v0.1.0-beta.1` 还是 `v0.1.0`，打包阶段一律自动转换为纯数字版本 `0.1.0`，避免 Tauri WiX 打包报错。

---

## 4. AI 更新说明生成与配置

### 4.1 支持的 AI 服务商

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

### 4.2 零配置与优雅降级机制

如果仓库**未配置任何 AI Key**，或者遭遇网络超时、API 额度超限等情况：

脚本会**自动降级**，基于项目的 [Conventional Commits 规范](../AGENTS.md) 对提交记录进行智能解析与分类，生成清晰分类的 Markdown 更新说明：

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

## 5. 本地测试与工具脚本

发布逻辑集中在 `scripts/release-helper.mjs` 中，您可以在本地直接执行和测试：

```bash
# 1. 模拟正式版发布 (当前最新为 v0.1.0-beta 时将自动转正为 v0.1.0)
node scripts/release-helper.mjs prepare

# 2. 模拟 Beta 预发布 (勾选状态，将自动生成 v0.1.0-beta.1)
INPUT_IS_PRERELEASE=true node scripts/release-helper.mjs prepare

# 3. 测试同步版本号
node scripts/release-helper.mjs sync 0.1.0
```
