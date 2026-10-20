# EveryLine MCP

第一阶段通过 Higress 直接调用已有 EveryLine API：豆包工作 → Higress MCP → EveryLine API。连接器负责用户 OAuth；当前工程提供 MCP 专用 Skill 和作为接口核对依据的 CLI 实现，不增加 Go HTTP 中转服务。

`mcp/skills/` 是 MCP Skill 的源文件；根目录 `skills/` 继续服务 npm/CLI 安装方式。MCP 工具映射与授权配置维护在 `dev-contract-charts` 仓库 `20261016-zss-everyline-mcp` 分支的 `everyline-cli-mcp/` Chart。

## 与 EveryLine CLI 的授权约定

MCP 复用 `everyline-cli` 的浏览器 Authorization Code + PKCE S256 流程：同一环境的 `contract-review` 授权服务器、`contract-review:full` scope、动态客户端注册和既有租户选择/授权确认页。CLI 的实现依据是 `internal/auth/oauth.go`；迁入本工程的该文件仅 Go 模块路径不同。回调地址使用当前 MCP 宿主登记的地址，state、PKCE challenge/verifier 和 client_id 由宿主为本次授权生成或获取。

CLI 浏览器授权 URL 包含 business_type、client_id、code_challenge、code_challenge_method、redirect_uri、response_type、scope、state；确认页仍提交既有的 tenant_id、client_id、redirect_uri、state、code_challenge、scope。MCP 使用现有 `contract-review` 授权端点和确认页，不要求 org-fe 增加字段。

Chart 使用现有 `/api/public/verify-access-token` 验真，失败关闭访问；当前用户 Bearer 逐请求转发，业务 API 沿用现有权限校验。资源元数据仍声明本入口 `https://mcp.qtech.cn/mcp-servers/everyline-cli-mcp`，宿主按其协议发送 resource；这一声明不代表现有后端已强制绑定 MCP audience/resource 或产品 scope。本方案没有引入专用令牌、额外白名单或组织授权请求存储。严格要求这些新增保障的接入需另行建设和验收，不能把通用验真等同于完整 MCP 资源隔离。

CLI 的 Device Grant 使用 `internal/auth/device.go`，resource 默认为业务 API 基址；这一资源值及 Device client ID 不用于 HTTP MCP 连接器。部署后仍需验证实际宿主的登录、刷新、撤销和双账号权限范围；本地映射检查不代替真实授权验收。

## 版本与发布清单

`mcp/skills-manifest.json` 是 MCP Skill 的独立发布清单，记录版本、两项 Skill 名称及正文 SHA-256。两项 Skill 的 `metadata.version` 必须与清单一致。CLI/npm 版本、Chart 包版本和 API 工具映射版本各自维护，不因 CLI 升版自动改变 Skill。修改 MCP Skill 后显式更新版本和摘要；已经发布的版本使用新版本号。

```sh
node scripts/sync-mcp-skills.js --version 1.3.0
make mcp-check
make mcp-package
```

上例版本替换为本次 MCP Skill 版本。`make mcp-package` 生成 `dist/everyline-mcp-skills-<版本>.tgz` 与 `.tgz.sha256`，内容包含 MCP Skill、发布清单、说明和独立校验/同步脚本。根目录 CLI Skill ZIP 继续用于 CLI 安装方式。

`make release-check`、GitHub 发布流程及 GitLab 打包作业都会验证 MCP 清单并生成独立制品；正文、身份或版本与清单不符时失败。CI 校验不要求另一仓库存在于相邻目录。

## 同步 Chart

在本工程根目录执行：

```sh
node scripts/sync-mcp-skills.js ../dev-contract-charts/everyline-cli-mcp
make mcp-check MCP_CHART_DIR=../dev-contract-charts/everyline-cli-mcp
```

脚本校验源清单后，将两份正文与 `manifest.json` 一起复制到 Chart 的 `files/skills/`。Chart 固定引用该版本的摘要；Helm 在渲染时核对清单、正文版本和 SHA-256，并在 WasmPlugin 注解记录 Skill 版本与清单摘要，然后将正文作为普通字符串注入 `server.config`。两个仓库分别检测各自的内容漂移；指定 `MCP_CHART_DIR` 还会确认 Chart 与当前源发布完全一致。源仓库的新版本通过明确同步升级 Chart，旧 Chart 仍可按原清单回滚。

使用发布包时，先核对 `.sha256` 并解压到独立目录，在解压目录执行 `node scripts/sync-mcp-skills.js --check`，再用同一脚本同步目标 Chart；无需 CLI 二进制、Go 或源仓库 checkout。Chart 的 API 工具映射仍在 `dev-contract-charts` 单独维护和验证。

## 当前范围

共 25 项工具：2 项 Skill 读取工具，以及 23 项上传 URL、主体提取、审查任务和清单/规则/分组工具。业务工具参数统一使用 `input` 对象；Skill 读取使用空参数。文件和任务 ID 按字符串传递，状态和详情工具每次仅查询一次，由宿主按 Skill 继续流程。宿主无需运行 CLI 命令。

聊天附件需要宿主提供后端可访问的 HTTP/HTTPS URL；本地路径和正文文本不作为上传内容。后续需要接收附件字节时再设计上传服务。新 Chart 的本地校验与真实豆包联调状态分别记录在 `dev-contract-charts/docs/everyline-cli-mcp-verification.md`。

MCP 1.3.0 配置工具恢复使用 CLI 对应的 `/open-apis/review-rules/**` 既有入口；移除 1.2.0 中的快照、原子移动工具及 `expectedRevision`、`impactToken`、`onlyIfEmpty` 参数，不要求数据库迁移或三个后端项目的新制品。已发布的旧 Skill 与 Chart 应成套升级，避免继续调用旧工具或传旧字段。

现有 API 的能力边界保留：分页可见列表不证明全部引用完整；没有原子移动、空组条件删除或事务版本保护；清单更新会写入服务默认元数据。Skill 对类型不明、影响不完整或超出能力的写入明确停止，并保留内置规则包与自定义清单组合选择、风险明细完整后才汇总的流程。新增服务端强制保障不在此版本范围内。
