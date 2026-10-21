# 测试计划

## Skill 源工程

维护环境需要 Node.js 18+、Git、tar、zip、unzip 和 make，执行：

```sh
make release-check
```

自动化覆盖 Skill 身份、版本、摘要、Git 换行行为、无效变更阻止发布、显式 Chart 导出及旧命令拒绝、发布标签匹配、源归档离线校验/重建、宿主 ZIP 根目录及正文一致性、重复打包清理旧条目。

`package.json` 是私有维护工具清单；项目不构建或安装 CLI，也不发布 npm 业务命令。GitLab 使用已有 Node 22 镜像运行测试与打包；`default.before_script` 检查 `zip` 和 `unzip`，缺少任意一项时通过 apt 安装两项工具，并在安装后再次检查。`test` 与 `package` 在独立容器中执行，均继承该准备步骤；软件源更新或安装失败时立即结束作业。GitHub 使用 Node 24，发布标签必须与 Skill manifest 完全一致。

## MCP Chart

在 `test-contract-charts` 根目录执行：

```sh
helm lint ./everyline-cli-mcp-test
helm template everyline-cli-mcp-test ./everyline-cli-mcp-test
(cd scripts/mcp-validator && go test ./...)
MCP_CONFIG_FILES=everyline-cli-mcp-test/files/mcp-config.yaml sh scripts/validate-changed-mcp-configs.sh
```

Chart 从实际 Helm 输出编译入口参数 Schema，使用 request-validation 同版本校验引擎，再通过 Higress SDK 验证 2 项 Skill 读取工具和 23 项业务工具。读取测试验证正文逐字返回、拒绝额外参数、保留本地响应且请求头不覆盖发布内容；Helm 拒绝技能正文、身份与版本漂移。原 53 个业务顶层参数、请求路由、身份透传、长 ID、批量正文及错误响应继续回归。这里的 Go 是 Chart 测试依赖，与用户业务调用无关。

## 宿主联调

在测试环境验证宿主发现 25 项 MCP 工具并完成 OAuth；用户只提出“审查合同”时，应先调用 `read-review-skill`，再上传、选择主体/强度/清单，最后发起与查询任务。既有任务直接续办；配置操作先调用 `read-review-config-skill`。用户尚未选择强度或规则来源时，应停在该项选择步骤。记录真实工具调用、授权及附件可达性结果，本地静态和 SDK 验证不代替宿主联调。

豆包验收分别记录工具发现和任务选路：25 项工具可见仅通过前一项。检查个人 Skill 版本、同名本地 Skill 及内置“合同审查”的启用状态后，以新任务的真实调用记录确认 `read-review-skill` 已返回；读取 `doubao-contract-reviewer` 或运行其预检脚本仍判定选路失败。只有用户明确给齐三项选择后才允许出现 `start-review-task`。附件只有本地路径时应停在文件传输条件检查，不能以本地解析生成报告代替 MCP 流程。

2026-10-21 豆包现场验收：替换个人两项 Skill 为 2.1.0，停用内置合同审查、旧 CLI 和重复来源的审查技能后，新任务仅提交本地 DOCX 附件和“审查合同”。真实调用依次包含 `read-review-skill`、`upload-contract-file-by-url`、`extract-contract-subjects`、`list-review-checklists`；宿主使用 `FileBatchUpload` 为本地附件取得可访问 URL。界面展示 3 项确认卡片，分别选择立场、强度和清单；验收停在等待用户选择处，`start-review-task` 调用数为 0。本次通过默认选路、附件传输和三项选择展示验证，未执行正式审查及结果查询。
