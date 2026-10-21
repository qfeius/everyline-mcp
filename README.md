# EveryLine MCP 与 Skill

本工程采用 **宿主 Agent 调用 MCP 读取 EveryLine Skill → 按 Skill 调用 MCP 业务接口 → EveryLine API**。Skill 负责编排，MCP 提供技能及原 CLI 对应的业务接口。

## 工程组成

- `mcp/skills/`：合同审查与配置维护两项宿主 Skill。
- `mcp/skills-manifest.json`：Skill 发布版本和正文 SHA-256。
- `scripts/sync-mcp-skills.js`：维护者使用的版本、校验与打包脚本。
- `tests/release/`：Skill 发布制品回归测试。
- `docs/`：分层、接口映射与验证说明。

test MCP 的 2 项技能读取工具、23 项业务工具、OAuth 与部署配置维护在 `test-contract-charts/everyline-cli-mcp-test/` Chart。宿主直接调用该 MCP 入口；本工程已移除 CLI 命令、Go 运行时、本地授权和 Profile、安装器及二进制/npm 发布流程。`package.json` 仅用于运行维护脚本，并标记为私有。仓库目录及连接器沿用 `everyline-cli-mcp` 名称，名称不代表存在 CLI 运行层。

## 使用流程

1. 在宿主添加 EveryLine HTTP MCP 连接器并完成 OAuth 授权。
2. 刷新 MCP 工具清单；审查入口为 `read-review-skill`，配置维护入口为 `read-review-config-skill`。宿主 Skill ZIP 可辅助选路，完整流程由连接器返回。
3. 用户提出审查或配置维护需求，宿主先从 MCP 读取对应 Skill，再按流程调用同一连接器的业务接口。

审查流程由 Skill 安排：URL 上传 → 提取并选择主体 → 选择强度和规则来源 → 发起任务 → 查询状态 → 获取详情并展示结果。已有任务从原 `taskId` 继续。当前文件入口要求后端可访问的 HTTP/HTTPS URL。

Skill 2.2.1 以 [everyline-cli release v1.1.1](https://github.com/qfeius/everyline-cli/tree/617a2cc47aa208cbc651412003b763afe4c55c41/skills) 为业务基线，保留完整编号交互、平台风险统计口径、报告模板和配置维护流程。图表优先使用宿主原生可视化，其次用程序生成并嵌入 PNG，展示失败时降级为文字，不输出 HTML/SVG 源码。发布测试独立检查固定 release 原文，仅显式适配 MCP 调用与宿主图表展示方式，继续保护统计、布局和签名链接规则。

## 校验与打包

本地维护需要 Node.js 18+、Git、tar、zip、unzip 和 make。

```sh
make release-check
```

该命令执行测试、清单校验和打包，生成 `dist/everyline-mcp-skills-<版本>.tgz`、两份 `*-mcp-skill-<版本>.zip` 及 SHA-256。ZIP 根目录直接包含 `SKILL.md`，供宿主导入。开发脚本无需安装 npm 依赖。

修改 Skill 后更新独立版本及摘要：

```sh
node scripts/sync-mcp-skills.js --version 2.2.1
node scripts/sync-mcp-skills.js --export-chart ../test-contract-charts/everyline-cli-mcp-test
make release-check
```

将示例版本替换为本次新版本。显式导出把同一发布正文及摘要写入 Chart，Chart 部署前校验一致性；更新后部署完整 Chart 并刷新 MCP 工具。GitLab 校验并产出 Skill 制品；GitHub 仅对与清单一致的 `v<版本>` 标签发布 Skill 制品。发布过程不生成或安装业务命令。

详细说明：[架构](docs/architecture.md)、[接口映射](docs/api-mapping.md)、[宿主接入与迁移](mcp/README.md)、[测试计划](docs/test-plan.md)。历史 CLI 实现保留在 Git 历史，原 `everyline-cli` 工程独立维护。
