import { execSync } from 'node:child_process';
import fs from 'node:fs';

/**
 * 执行 Shell 命令并返回去除首尾空白的输出字符串
 * @param {string} cmd
 * @returns {string}
 */
function runCommand(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

/**
 * 解析单个 Tag 的版本元信息
 * @param {string} tag
 * @returns {{ raw: string, major: number, minor: number, patch: number, baseVer: string, isBeta: boolean, betaNum: number } | null}
 */
function parseTagInfo(tag) {
  if (!tag) return null;
  const match = tag.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-beta(?:\.(\d+))?)?$/i);
  if (!match) return null;

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const patch = parseInt(match[3], 10);
  const isBeta = tag.toLowerCase().includes('-beta');
  const betaNum = match[4] !== undefined ? parseInt(match[4], 10) : isBeta ? 0 : -1;

  return {
    raw: tag,
    major,
    minor,
    patch,
    baseVer: `${major}.${minor}.${patch}`,
    isBeta,
    betaNum,
  };
}

/**
 * 解析所有合规的 Git Tags，并分别归类为正式版轨道与 Beta 预发布版轨道
 * @returns {{ formalTags: string[], betaTags: string[], allTags: string[] }}
 */
function parseAllTags() {
  const rawList = runCommand('git tag --sort=-v:refname');
  if (!rawList) return { formalTags: [], betaTags: [], allTags: [] };

  const lines = rawList
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);
  const formalTags = [];
  const betaTags = [];
  const allTags = [];

  for (const tag of lines) {
    const info = parseTagInfo(tag);
    if (!info) continue;

    allTags.push(tag);
    if (info.isBeta) {
      betaTags.push(tag);
    } else {
      formalTags.push(tag);
    }
  }

  return { formalTags, betaTags, allTags };
}

/**
 * 提取两个版本引用之间的提交记录
 * @param {string} fromTag 起始 Tag
 * @param {string} toRef 终止 Ref (Tag 或 HEAD)
 * @returns {Array<{hash: string, message: string}>}
 */
function getCommitsBetween(fromTag, toRef = 'HEAD') {
  const range = fromTag ? `${fromTag}..${toRef}` : `-n 30 ${toRef}`;
  const rawLog = runCommand(`git log ${range} --pretty=format:"%h%x09%s"`);
  if (!rawLog) return [];

  return rawLog
    .split('\n')
    .map((line) => {
      const [hash, ...rest] = line.split('\t');
      const message = rest.join('\t').trim();
      return { hash: hash?.trim(), message };
    })
    .filter((item) => item.hash && item.message && !item.message.startsWith('Merge '));
}

/**
 * 将版本字符串规范化为纯数字格式 (如 0.1.0)，适配 Windows MSI 构建规范
 * @param {string} v
 * @returns {string}
 */
function toNumericVersion(v) {
  const match = (v || '').match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (match) {
    const major = match[1];
    const minor = match[2];
    const patch = match[3] !== undefined ? match[3] : '0';
    return `${major}.${minor}.${patch}`;
  }
  return '0.1.0';
}

/**
 * 获取 package.json 中的默认初始基础版本
 * @returns {{ major: number, minor: number, patch: number, baseVer: string }}
 */
function getFallbackBaseVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    const match = (pkg.version || '').match(/(\d+)\.(\d+)(?:\.(\d+))?/);
    if (match) {
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      const patch = match[3] !== undefined ? parseInt(match[3], 10) : 0;
      return { major, minor, patch, baseVer: `${major}.${minor}.${patch}` };
    }
  } catch {
    // 忽略错误
  }
  return { major: 0, minor: 1, patch: 0, baseVer: '0.1.0' };
}

/**
 * 双轨版本计算器：支持正式版与 Beta 版分开独立计算，实现 Beta 毕业转正与 Beta 间多轮迭代
 * @param {object} params
 * @param {string} [params.manualVersion] 手动指定的版本号
 * @param {string} [params.bumpType] 递增方式: patch | minor | major | auto
 * @param {boolean} params.isPrerelease 是否为 Beta 预发布版本
 * @param {Array<{message: string}>} [params.commits] 提交列表
 * @returns {{ tagName: string, pureVer: string, baseTag: string }}
 */
function determineVersion({
  manualVersion,
  bumpType = 'patch',
  isPrerelease = false,
  commits = [],
}) {
  const { formalTags, allTags } = parseAllTags();
  const latestAnyTag = allTags[0] || '';
  const latestFormalTag = formalTags[0] || '';

  // === 1. 手动指定版本号场景 ===
  if (manualVersion && manualVersion.trim()) {
    let raw = manualVersion.trim();
    if (!raw.startsWith('v')) {
      raw = `v${raw}`;
    }

    if (isPrerelease) {
      // 勾选 Pre-release 时，确保具备 -beta 后缀
      if (!/-beta(\.\d+)?$/i.test(raw)) {
        raw = `${raw}-beta`;
      }
    } else {
      // 发布正式版时，确保剥离 -beta 等预发布标识
      raw = raw.replace(/-beta(\.\d+)?$/i, '');
    }

    const tagName = raw;
    const pureVer = toNumericVersion(tagName);
    const baseTag = isPrerelease ? latestAnyTag : latestFormalTag;
    return { tagName, pureVer, baseTag };
  }

  // === 2. 自动推算版本号场景 (双轨推算) ===
  const latestAnyInfo = parseTagInfo(latestAnyTag);
  const latestFormalInfo =
    parseTagInfo(latestFormalTag) ||
    (latestAnyInfo
      ? {
          major: latestAnyInfo.major,
          minor: latestAnyInfo.minor,
          patch: latestAnyInfo.patch,
          baseVer: latestAnyInfo.baseVer,
        }
      : getFallbackBaseVersion());

  // 推算递增级别 (auto 模式下分析 commit 特征)
  let effectiveBump = bumpType;
  if (bumpType === 'auto') {
    const hasBreaking = commits.some(
      (c) => c.message.includes('BREAKING CHANGE') || /^[a-z]+(\([^\)]+\))?!:/.test(c.message)
    );
    const hasFeat = commits.some((c) => /^feat(\([^\)]+\))?:/.test(c.message));

    if (hasBreaking) {
      effectiveBump = 'major';
    } else if (hasFeat) {
      effectiveBump = 'minor';
    } else {
      effectiveBump = 'patch';
    }
  }

  // --- 轨道一：发布【正式版】 (isPrerelease === false) ---
  if (!isPrerelease) {
    // 检查最新 Tag 是否为未转正的 Beta 版
    if (latestAnyInfo && latestAnyInfo.isBeta) {
      const formalExists = formalTags.some((t) => {
        const info = parseTagInfo(t);
        return info && info.baseVer === latestAnyInfo.baseVer;
      });

      // 若当前 Beta 对应的基础正式版本尚未发布，则直接毕业转正 (例如 v0.1.0-beta -> v0.1.0)
      if (!formalExists) {
        const tagName = `v${latestAnyInfo.baseVer}`;
        const pureVer = latestAnyInfo.baseVer;
        return { tagName, pureVer, baseTag: latestFormalTag };
      }
    }

    // 否则基于上一个正式版递增
    let major = latestFormalInfo.major;
    let minor = latestFormalInfo.minor;
    let patch = latestFormalInfo.patch;

    switch (effectiveBump) {
      case 'major':
        major += 1;
        minor = 0;
        patch = 0;
        break;
      case 'minor':
        minor += 1;
        patch = 0;
        break;
      case 'patch':
      default:
        patch += 1;
        break;
    }

    const pureVer = `${major}.${minor}.${patch}`;
    const tagName = `v${pureVer}`;
    return { tagName, pureVer, baseTag: latestFormalTag };
  }

  // --- 轨道二：发布【Beta 预发布版】 (isPrerelease === true) ---
  // 情况 2.1: 最新 Tag 本身就是 Beta 版，且未跨大/小版本
  if (latestAnyInfo && latestAnyInfo.isBeta) {
    const formalExists = formalTags.some((t) => {
      const info = parseTagInfo(t);
      return info && info.baseVer === latestAnyInfo.baseVer;
    });

    // 如果未被正式版消费，且只是常规 patch 迭代或 auto，则推进 Beta 内部序号
    if (!formalExists && (effectiveBump === 'patch' || effectiveBump === 'auto')) {
      const nextBetaNum = latestAnyInfo.betaNum >= 0 ? latestAnyInfo.betaNum + 1 : 1;
      const tagName = `v${latestAnyInfo.baseVer}-beta.${nextBetaNum}`;
      const pureVer = latestAnyInfo.baseVer;
      return { tagName, pureVer, baseTag: latestAnyTag };
    }
  }

  // 情况 2.2: 开启全新特性的 Beta 测试版本 (基于最新正式版递增并附带 -beta)
  let major = latestFormalInfo.major;
  let minor = latestFormalInfo.minor;
  let patch = latestFormalInfo.patch;

  switch (effectiveBump) {
    case 'major':
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case 'minor':
      minor += 1;
      patch = 0;
      break;
    case 'patch':
    default:
      patch += 1;
      break;
  }

  const pureVer = `${major}.${minor}.${patch}`;
  const tagName = `v${pureVer}-beta`;
  return { tagName, pureVer, baseTag: latestAnyTag || latestFormalTag };
}

/**
 * 确定 Release 标题
 * @param {string} [manualTitle]
 * @param {string} tagName
 * @returns {string}
 */
function determineTitle(manualTitle, tagName) {
  if (manualTitle && manualTitle.trim()) {
    return manualTitle.trim();
  }
  return `TikClip ${tagName}`;
}

/**
 * Conventional Commits 分类降级生成器 (当无 AI Key 或 AI 请求失败时执行)
 * @param {Array<{hash: string, message: string}>} commits
 * @param {string} tagName
 * @returns {string}
 */
function generateFallbackNotes(commits, tagName) {
  if (!commits || commits.length === 0) {
    return `### TikClip ${tagName}\n\n详见下方发布资产下载并安装。`;
  }

  const groups = {
    features: { title: '🚀 新增功能', items: [] },
    fixes: { title: '🐛 缺陷修复', items: [] },
    ui: { title: '🎨 界面与体验', items: [] },
    perf: { title: '⚡ 性能优化', items: [] },
    refactor: { title: '♻️ 代码重构', items: [] },
    others: { title: '🔧 其他变动', items: [] },
  };

  for (const { hash, message } of commits) {
    const itemText = `[\`${hash}\`] ${message}`;
    if (/^feat(\([^\)]+\))?:/i.test(message)) {
      groups.features.items.push(itemText);
    } else if (/^fix(\([^\)]+\))?:/i.test(message)) {
      groups.fixes.items.push(itemText);
    } else if (/^(style|ui)(\([^\)]+\))?:/i.test(message)) {
      groups.ui.items.push(itemText);
    } else if (/^perf(\([^\)]+\))?:/i.test(message)) {
      groups.perf.items.push(itemText);
    } else if (/^refactor(\([^\)]+\))?:/i.test(message)) {
      groups.refactor.items.push(itemText);
    } else {
      groups.others.items.push(itemText);
    }
  }

  const sections = [];
  sections.push(`### TikClip ${tagName} 更新内容\n`);

  for (const group of Object.values(groups)) {
    if (group.items.length > 0) {
      sections.push(`#### ${group.title}`);
      sections.push(group.items.map((i) => `- ${i}`).join('\n'));
      sections.push('');
    }
  }

  return sections.join('\n').trim();
}

/**
 * 调用 Google Gemini API 生成 Release Notes
 * @param {string} apiKey
 * @param {string} commitSummary
 * @param {string} tagName
 * @returns {Promise<string>}
 */
async function callGemini(apiKey, commitSummary, tagName) {
  const model = process.env.AI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `你是一个专业的开源软件发布助手。
请根据以下 Git 提交记录，为短视频片段管理播放器 "TikClip" 的 ${tagName} 版本生成一份简要、专业的更新日志（Markdown 格式）。

要求：
1. 语言：简体中文。
2. 结构：
   - 顶部提供 1~2 句话的版本核心亮点概览。
   - 分类列出关键变动（例如：🚀 新增功能、🐛 体验与缺陷修复、🎨 界面与样式优化），精炼概括用户能感知的改进，避免死板罗列代码细节或无意义日志。
3. 纯净输出：直接输出 Markdown 正文，严禁包裹在外部代码块（不要出现开头的 \`\`\`markdown 和结尾的 \`\`\`）。

提交记录：
${commitSummary}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API 未返回有效文本内容');
  }

  return text
    .replace(/^```markdown\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * 调用 OpenAI 兼容 API 生成 Release Notes
 * @param {string} apiKey
 * @param {string} commitSummary
 * @param {string} tagName
 * @returns {Promise<string>}
 */
async function callOpenAI(apiKey, commitSummary, tagName) {
  const baseUrl = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  const url = `${baseUrl}/chat/completions`;

  const prompt = `你是一个专业的开源软件发布助手。
请根据以下 Git 提交记录，为短视频片段管理播放器 "TikClip" 的 ${tagName} 版本生成一份简要、专业的更新日志（Markdown 格式）。

要求：
1. 语言：简体中文。
2. 结构：
   - 顶部提供 1~2 句话的版本核心亮点概览。
   - 分类列出关键变动（例如：🚀 新增功能、🐛 体验与缺陷修复、🎨 界面与样式优化），精炼概括用户能感知的改进，避免死板罗列代码细节或无意义日志。
3. 纯净输出：直接输出 Markdown 正文，严禁包裹在外部代码块（不要出现开头的 \`\`\`markdown 和结尾的 \`\`\`）。

提交记录：
${commitSummary}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('OpenAI API 未返回有效文本内容');
  }

  return text
    .replace(/^```markdown\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * 生成完整的 Release 说明 (优先手动输入 -> AI 分析 -> Conventional Commits 降级)
 * @param {object} params
 * @param {string} [params.manualNotes] 手动填写的更新说明
 * @param {Array<{hash: string, message: string}>} params.commits 提交列表
 * @param {string} params.tagName 版本 Tag
 * @returns {Promise<string>}
 */
async function generateReleaseNotes({ manualNotes, commits, tagName }) {
  if (manualNotes && manualNotes.trim()) {
    console.log('ℹ️ 使用手动指定的更新说明。');
    return manualNotes.trim();
  }

  if (!commits || commits.length === 0) {
    console.log('ℹ️ 未检测到新提交记录，生成默认说明。');
    return `### TikClip ${tagName}\n\n常规发布更新。请查看下方安装包资源进行下载。`;
  }

  const commitSummary = commits.map((c) => `- ${c.hash}: ${c.message}`).join('\n');
  const geminiKey =
    process.env.GEMINI_API_KEY ||
    (process.env.AI_API_KEY && !process.env.AI_BASE_URL ? process.env.AI_API_KEY : '');
  const openAIKey =
    process.env.OPENAI_API_KEY || (process.env.AI_BASE_URL ? process.env.AI_API_KEY : '');

  if (geminiKey) {
    try {
      console.log('🤖 正在调用 Google Gemini 生成更新说明...');
      const notes = await callGemini(geminiKey, commitSummary, tagName);
      console.log('✅ Gemini 生成成功！');
      return notes;
    } catch (err) {
      console.warn('⚠️ Gemini 调用失败，尝试降级处理:', err.message);
    }
  }

  if (openAIKey) {
    try {
      console.log('🤖 正在调用 OpenAI 兼容模型生成更新说明...');
      const notes = await callOpenAI(openAIKey, commitSummary, tagName);
      console.log('✅ OpenAI 兼容模型生成成功！');
      return notes;
    } catch (err) {
      console.warn('⚠️ OpenAI 兼容模型调用失败，尝试降级处理:', err.message);
    }
  }

  console.log('ℹ️ 未配置可用 AI Key 或调用失败，使用常规提交记录分类生成更新说明。');
  return generateFallbackNotes(commits, tagName);
}

/**
 * 同步版本号到 package.json 与 src-tauri/tauri.conf.json
 * @param {string} pureVer 纯数字版本号 (如 0.1.1)
 */
function syncVersion(pureVer) {
  const version = toNumericVersion(pureVer);
  console.log(`🔄 同步版本号到应用配置文件: ${version}`);

  const tauriPath = './src-tauri/tauri.conf.json';
  if (fs.existsSync(tauriPath)) {
    const conf = JSON.parse(fs.readFileSync(tauriPath, 'utf8'));
    conf.version = version;
    fs.writeFileSync(tauriPath, JSON.stringify(conf, null, 2));
    console.log(`  ✓ 已更新 ${tauriPath} -> version: ${version}`);
  }

  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.version = version;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log(`  ✓ 已更新 ${pkgPath} -> version: ${version}`);
  }
}

/**
 * 向 GitHub Actions 环境输出变量
 * @param {string} name
 * @param {string} value
 */
function setGithubOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;

  if (value.includes('\n')) {
    const delimiter = `DELIMITER_${Math.random().toString(36).substring(2, 10)}`;
    fs.appendFileSync(outputPath, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
  } else {
    fs.appendFileSync(outputPath, `${name}=${value}\n`);
  }
}

/**
 * 向 GitHub Actions 写入 Step Summary 预览
 * @param {string} markdown
 */
function addStepSummary(markdown) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  fs.appendFileSync(summaryPath, `${markdown}\n`);
}

/**
 * Prepare 阶段主函数：推导版本、提取提交、生成说明并导出到 CI 环境
 */
async function handlePrepare() {
  const isTagTrigger =
    process.env.GITHUB_EVENT_NAME === 'push' && (process.env.GITHUB_REF_NAME || '').startsWith('v');
  const pushedTag = isTagTrigger ? process.env.GITHUB_REF_NAME : '';
  const isPrerelease = isTagTrigger
    ? pushedTag.toLowerCase().includes('-beta')
    : process.env.INPUT_IS_PRERELEASE === 'true';

  const manualVersion = isTagTrigger ? pushedTag : process.env.INPUT_VERSION || '';
  const bumpType = process.env.INPUT_BUMP_TYPE || 'patch';
  const manualTitle = process.env.INPUT_RELEASE_TITLE || '';
  const manualNotes = process.env.INPUT_RELEASE_NOTES || '';
  const isDraft = process.env.INPUT_IS_DRAFT !== 'false'; // 默认 true

  console.log('=== TikClip Release Prepare ===');
  console.log(
    `🎯 发布类型: ${isPrerelease ? 'Beta 预发布版本 (Pre-release)' : '正式发布版本 (Formal/Stable)'}`
  );

  const { formalTags, betaTags, allTags } = parseAllTags();
  console.log(`📌 最新正式 Tag: ${formalTags[0] || '(无)'}`);
  console.log(`📌 最新 Beta Tag: ${betaTags[0] || '(无)'}`);
  console.log(`📌 最新任何 Tag: ${allTags[0] || '(无)'}`);

  // 预先拉取最近提交用于 auto 推导
  const recentCommits = getCommitsBetween(allTags[0] || '', 'HEAD');

  // 计算版本号及对应的对齐基准 Tag
  const { tagName, pureVer, baseTag } = determineVersion({
    manualVersion,
    bumpType,
    isPrerelease,
    commits: recentCommits,
  });

  console.log(`🏷️ 本次发布目标 Tag: ${tagName} (构建纯数字版本: ${pureVer})`);
  console.log(`🔍 更新日志基准 Tag: ${baseTag || '(初始发布)'}`);

  // 提取待分析的 commits
  const toRef = isTagTrigger ? pushedTag : 'HEAD';
  const commits = getCommitsBetween(baseTag, toRef);
  console.log(`📦 检测到自基准 Tag 以来的有效提交数: ${commits.length}`);

  const title = determineTitle(manualTitle, tagName);
  console.log(`📝 Release 标题: ${title}`);

  // 生成更新说明
  const body = await generateReleaseNotes({
    manualNotes,
    commits,
    tagName,
  });

  console.log('\n--- Release Notes 预览 ---\n' + body + '\n-------------------------\n');

  // 输出到 GitHub Actions 步骤
  setGithubOutput('tag_name', tagName);
  setGithubOutput('pure_ver', pureVer);
  setGithubOutput('title', title);
  setGithubOutput('body', body);
  setGithubOutput('prerelease', String(isPrerelease));
  setGithubOutput('draft', String(isDraft));

  // 输出 Step Summary 概览
  addStepSummary(`## 🚀 准备发布: ${title}

| 参数 | 值 |
| :--- | :--- |
| **发布类型** | ${isPrerelease ? '🧪 Beta 预发布版本' : '⭐ 正式发布版本'} |
| **目标 Tag** | \`${tagName}\` |
| **纯数字版本** | \`${pureVer}\` |
| **更新基准 Tag** | \`${baseTag || '初始发布'}\` |
| **变动提交数** | ${commits.length} |
| **Pre-release** | ${isPrerelease ? '是' : '否'} |
| **Draft 草稿** | ${isDraft ? '是' : '否'} |

### 📋 Release Notes 预览
${body}
`);

  console.log('=== Prepare 完成 ===');
}

/**
 * 命令行入口
 */
async function main() {
  const [, , command, ...args] = process.argv;

  if (command === 'prepare') {
    await handlePrepare();
  } else if (command === 'sync') {
    const version = args[0] || process.env.TARGET_VER || '0.1.0';
    syncVersion(version);
  } else {
    console.log(`TikClip Release Helper
使用方法:
  node scripts/release-helper.mjs prepare       计算版本、提取提交并生成 Release 说明
  node scripts/release-helper.mjs sync <ver>    同步版本号到 package.json 与 tauri.conf.json
`);
  }
}

main().catch((err) => {
  console.error('❌ 执行发生错误:', err);
  process.exit(1);
});
