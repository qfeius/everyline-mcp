# everyline-mcp

本项目维护 EveryLine MCP 与 Skill，源码仓库为 [shuai326-zss/everyline-mcp](https://github.com/shuai326-zss/everyline-mcp)。本工程采用 **宿主 Agent 加载独立 EveryLine Skill → 调用 MCP 业务接口 → EveryLine API**。Skill 负责编排，MCP 提供原 CLI 对应的业务接口。

迁移至 GitHub 后，Skill 从 `0.0.1` 重新计版；业务逻辑与 [GitLab 源分支提交 `7406bab`](https://git.qtech.cn/ai/everyline-cli-mcp/-/commit/7406bab4eeddca8787f1e7f4a66dcb881990efff) 保持一致。

## 工程组成

- `mcp/skills/`：一个宿主 Skill，合同审查为入口，配置维护按需读取 `references/review-config.md`。
- `mcp/skills-manifest.json`：Skill 发布版本、正文、参考流程、图标和豆包声明的 SHA-256。
- `mcp/doubao/`：豆包 Plugin 展示信息和线上 MCP 声明。
- `scripts/sync-mcp-skills.js`：维护者使用的版本、校验与打包脚本。
- `tests/release/`：Skill 发布制品回归测试。
- `docs/`：分层、接口映射与验证说明。

test MCP 的 25 项业务工具、OAuth 与部署配置维护在 `test-contract-charts/everyline-cli-mcp-test/` Chart，共 25 项工具。宿主直接调用该 MCP 入口；本工程已移除 CLI 命令、Go 运行时、本地授权和 Profile、安装器及二进制/npm 发布流程。`package.json` 仅用于运行维护脚本，并标记为私有。项目名称统一为 `everyline-mcp`；已部署的连接器及外部 Chart 沿用 `everyline-cli-mcp` 系列标识，名称不代表存在 CLI 运行层。

## 使用流程

1. 在宿主添加 EveryLine HTTP MCP 连接器并完成 OAuth 授权。
2. 导入单个 Skill ZIP，或在豆包导入包含线上连接器的 Plugin ZIP，并刷新业务工具清单。
3. 宿主加载唯一入口 `everyline-review`，配置任务按需读取包内参考流程，再调用同一连接器的业务接口。升级时替换旧的两项 Skill，避免重复选路。

退出与切换账号沿用合同 MCP 的宿主管理方式：用户要求退出时先停止业务请求、轮询和自动重连，由宿主断开连接或撤销旧授权；切换账号再由同一连接器重新发起 OAuth。按宿主真实结果报告状态，断开连接不等于后端令牌已撤销。MCP 不提供退出接口，也不依赖新增组织服务退出实现。

审查流程由 Skill 安排：上传会话或 URL 上传 → 提取并选择主体 → 选择强度和规则来源 → 发起任务 → 查询状态 → 获取详情并展示结果。已有任务从原 `taskId` 继续。聊天附件和本地原始文件使用 prepare → multipart 上传 → commit；用户直接提供的外部下载 URL 继续使用既有 URL 上传。

Skill 0.0.1 以 [everyline-cli release v1.1.1](https://github.com/qfeius/everyline-cli/tree/617a2cc47aa208cbc651412003b763afe4c55c41/skills) 为业务基线，保留完整编号交互、平台风险统计口径、报告模板和配置维护流程。图表优先使用宿主原生可视化，缺失或失败后实际尝试生成并嵌入 PNG；豆包补齐运行时检查与图片交付步骤，两条路径均有具体缺项或失败记录时才降级为文字，不输出 HTML/SVG 源码。发布测试独立检查固定 release 原文，仅显式适配 MCP 调用与宿主图表展示方式，继续保护统计、布局和签名链接规则。

技能资源统一相对于宿主实际加载的技能根目录解析，配置参考返回时复用已加载入口。发布前校验说明和图标引用，阻止父目录跳转、错误拼接技能目录名及缺失文件进入包体。

## 校验与打包

本地维护需要 Node.js 18+、Git、tar、zip、unzip 和 make。

```sh
make release-check
```

该命令执行测试、清单校验和打包，生成 `dist/everyline-mcp-skills-<版本>.tgz`、`dist/everyline-review-mcp-skill-<版本>.zip`、`dist/everyline-doubao-plugin-<版本>.zip` 及 SHA-256。Skill ZIP 根目录包含 `SKILL.md`、配置参考和图标；Plugin ZIP 根目录包含正式 Manifest、线上 MCP 声明及唯一 Skill。连接器与 Skill 的展示名均为“EveryLine | AI 合同审查助手”，使用原版 512×512 Logo。开发脚本无需安装 npm 依赖。

修改 Skill 后更新独立版本及摘要：

```sh
node scripts/sync-mcp-skills.js --version 0.0.1
make release-check
```

先发布后端三段会话及 test/blue 公共上传地址、精确 content 放行配置。升级时先在宿主安装新的独立 Skill，再部署移除读取工具的 MCP Chart 并刷新工具清单；旧 Skill 仍依赖读取工具，不能先移除该入口。content 复用原上传服务，commit 仅返回同次结果；Redis 只保存会话元数据及结果，无新增 MCP 上传适配服务或业务数据库字段。

将示例版本替换为本次新版本。Skill ZIP 独立交付给宿主；MCP Chart 独立部署并刷新工具清单。GitLab 校验并产出 Skill 制品；GitHub 仅对与清单一致的 `v<版本>` 标签发布 Skill 制品。发布过程不生成或安装业务命令。

详细说明：[架构](docs/architecture.md)、[接口映射](docs/api-mapping.md)、[宿主接入与迁移](mcp/README.md)、[测试计划](docs/test-plan.md)。历史 CLI 实现保留在 Git 历史，原 `everyline-cli` 工程独立维护。
