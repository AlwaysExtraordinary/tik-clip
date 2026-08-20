# 注意事项

1. 禁止使用tailwind css的font-mono类名
2. 使用HeroUI构建页面时，尽量只使用使用组件默认样式完成，功能需要时再添加tailwind类。

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
- 提交前检查 `git status` 和 `git diff`。
- 不要将与当前任务无关的修改一起提交。
- 没有实际修改时不要创建提交。
