# 测试计划

## Skill 源工程

维护环境需要 Node.js 18+、Git、tar、zip、unzip 和 make，执行：

```sh
make release-check
```

自动化覆盖 Skill 身份、版本、摘要、Git 换行行为、无效变更阻止发布、旧 Chart 同步入口退役、发布标签匹配、源归档离线校验/重建、宿主 ZIP 根目录及正文一致性、重复打包清理旧条目。

`package.json` 是私有维护工具清单；项目不构建或安装 CLI，也不发布 npm 业务命令。GitLab 使用已有 Node 22 镜像运行测试与打包；GitHub 使用 Node 24，发布标签必须与 Skill manifest 完全一致。

## MCP Chart

在 `dev-contract-charts` 根目录执行：

```sh
helm lint ./everyline-cli-mcp
helm template everyline-cli-mcp ./everyline-cli-mcp
(cd scripts/mcp-validator && go test ./...)
MCP_CONFIG_FILES=everyline-cli-mcp/files/mcp-config.yaml sh scripts/validate-changed-mcp-configs.sh
```

Chart 通过 Higress SDK 验证 23 项业务工具的实际注册、请求路由、参数、身份透传、长 ID、批量正文及错误响应，并检查 Skill 读取工具和正文注入已移除。这里的 Go 是 Chart 测试依赖，与用户业务调用无关。

## 宿主联调

在测试环境验证宿主导入两项 Skill、发现 MCP 工具、完成 OAuth，使用测试合同 URL 跑通审查并继续已有任务；验证配置查询、授权范围内写入及回读。记录实际授权、权限及附件可达性结果。本地静态和 SDK 验证分别按其覆盖范围记录。
