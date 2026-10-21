# EveryLine MCP

调用链：**用户目标 → 从 MCP 读取 EveryLine Skill → 宿主按 Skill 调用 MCP 业务接口 → EveryLine API**。MCP 提供技能正文与业务工具，宿主执行交互与编排。

| 层 | 职责 |
| --- | --- |
| 宿主 Skill | 用户交互、主体/强度/清单选择、调用顺序、分页、轮询、续办、写后回读与结果汇总 |
| MCP / Higress | 技能正文读取、工具发现、参数校验、当前用户鉴权透传、业务请求映射及响应/错误转换 |
| EveryLine API | 业务执行、业务权限与数据持久化 |

`mcp/skills/` 是 Skill 唯一维护源。test 工具映射与授权配置维护在 `test-contract-charts` 仓库 `20261016-zss-everyline-mcp` 分支的 `everyline-cli-mcp-test/` Chart。本工程已移除 CLI 实现及构建发布链路，只保留 Skill、接口说明与维护脚本。

MCP 2.1.0 发布 25 项工具：2 项 Skill 读取、5 项上传/审查、7 项清单、4 项分组、7 项规则接口。业务工具说明指向对应的 Skill 读取入口，状态和详情每次查询一次，列表每次读取一页；后续调用由宿主按 Skill 安排。

## 宿主加载与调用

1. 在宿主配置 EveryLine HTTP MCP 连接器并完成 OAuth。
2. 刷新 MCP 工具清单，确认 `read-review-skill` 和 `read-review-config-skill` 可见。两份宿主 Skill ZIP 可辅助选路，MCP 自身提供完整部署正文。
3. 审查或续办先调用 `read-review-skill`（参数 `{}`），配置查询/维护先调用 `read-review-config-skill`，然后按返回技能调用同一连接器业务工具。

从旧 CLI 版迁移时替换或停用宿主中旧技能，刷新连接器工具并新建任务。完整流程由 MCP 技能读取工具返回，宿主无需安装 CLI；原有本地文件上传方式与 URL 上传能力边界分别核对。

豆包任务应启用目标 MCP（test 为 `everyline-cli-mcp-test`）并向模型提供其工具清单。“审查合同”应命中技能读取入口，随后依次确认立场、强度、规则来源；缺少任一项时先等待用户选择。MCP 提供加载入口，实际工具选择仍由宿主执行，应通过真实调用记录验收，不能只凭报告样式或模型自述确认。

业务参数直接放在 arguments 顶层，例如上传传 `{"fileUrl":"https://example.com/contract.pdf","name":"contract.pdf"}`，无筛选条件传 `{}`。Higress 按参数逐项展示注释；`config`、`data` 和数组保留业务结构。文件、任务与资源 ID 按字符串传递。Skill 读取工具不接受业务参数，也没有一键审查或等待结果工具。

## 连接器授权

连接器使用浏览器 Authorization Code + PKCE S256，复用现有 `contract-review` 授权服务器、`contract-review:full` scope、动态客户端注册和租户选择/授权确认页。回调地址使用当前 MCP 宿主登记的地址，state、PKCE challenge/verifier 和 client_id 由宿主为本次授权生成或获取。

浏览器授权 URL 包含 business_type、client_id、code_challenge、code_challenge_method、redirect_uri、response_type、scope、state；确认页仍提交既有的 tenant_id、client_id、redirect_uri、state、code_challenge、scope。MCP 使用现有 `contract-review` 授权端点和确认页，不要求 org-fe 增加字段。

Chart 使用现有 `/api/public/verify-access-token` 验真，失败关闭访问；当前用户 Bearer 逐请求转发，业务 API 沿用现有权限校验。资源元数据仍声明本入口 `https://mcp.qtech.cn/mcp-servers/everyline-cli-mcp`，宿主按其协议发送 resource；这一声明不代表现有后端已强制绑定 MCP audience/resource 或产品 scope。本方案没有引入专用令牌、额外白名单或组织授权请求存储。严格要求这些新增保障的接入需另行建设和验收，不能把通用验真等同于完整 MCP 资源隔离。

用户授权、刷新与撤销由连接器完成，本工程不提供本地 Token 存储或登录命令。部署后仍需验证实际宿主的登录、刷新、撤销和双账号权限范围；本地映射检查不代替真实授权验收。

## 版本与发布

`mcp/skills-manifest.json` 记录 Skill 版本、名称与正文 SHA-256，两项 Skill 的 `metadata.version` 与清单一致。显式导出后，Chart 内发布副本按身份、版本与摘要校验，再编码为固定工具响应；修改流程后需重新导出并部署完整 Chart。`package.json` 为私有维护工具清单，不注册业务命令或安装钩子。

```sh
node scripts/sync-mcp-skills.js --version 2.1.0
node scripts/sync-mcp-skills.js --export-chart ../test-contract-charts/everyline-cli-mcp-test
make mcp-check
make mcp-package
```

上例版本替换为本次 Skill 版本。打包需要 Node.js、tar 和 zip。`make mcp-package` 生成以下文件及各自的 `.sha256`：

- `dist/everyline-mcp-skills-2.1.0.tgz`：两项 Skill、清单、说明和独立校验/打包脚本。
- `dist/everyline-review-mcp-skill-2.1.0.zip`：审查 Skill，ZIP 根目录为 `SKILL.md`。
- `dist/everyline-review-config-mcp-skill-2.1.0.zip`：配置 Skill，ZIP 根目录为 `SKILL.md`。

核对发布文件摘要后，ZIP 可直接交给宿主导入。使用源归档时，解压后执行 `node scripts/sync-mcp-skills.js --check` 验证正文；也可用自带脚本重新生成导入包。`make release-check`、GitHub 发布与 GitLab 打包均校验并交付这些独立制品。发布标签通过 `node scripts/sync-mcp-skills.js --check-tag v2.1.0` 核对，并须匹配清单版本。CI 只发布 Skill 制品。

Skill / MCP 2.1.0 增加连接器技能读取，保留附件审查入口及立场/强度/规则来源的用户选择条件。业务参数继续兼容 MCP 2.0.0，既有后端 API 保持不变。

## 从 input 包装迁移到独立参数

Chart 0.5.0 / MCP 2.0.0 将 23 项工具的业务参数展开为 53 个顶层参数，使 Higress 工具页按字段显示名称和注释。旧的 `{"input":{...}}` 调用会被拒绝；新调用直接传 `{...}`。两份 Skill 同步升级为 2.0.0，需配套更新 Chart、导入 Skill 并刷新宿主工具清单，避免旧调用格式混用。

Chart 增加仅绑定本入口的 `request-validation:2.0.3`，在 SDK 类型转换和字段筛选前验证原始参数，保留未知字段拒绝与整数校验。业务路径、请求体和鉴权保持原有约定；新增插件需随完整 Chart 部署，不能只替换工具列表。本地配置及制品完成不代表已部署。

## Skill 分发历史与当前版本

Skill 1.4.0 通过宿主加载；Chart 0.4.0 / MCP 接口 1.4.0 移除原两项 Skill 读取工具、`server.config` 中的 Skill 正文、发布副本和 Skill 摘要注解。安装宿主版 Skill 后更新 Chart，并刷新宿主工具清单与 Skill。`scripts/sync-mcp-skills.js` 保留本地版本、校验和打包命令，旧的 Chart 路径参数会明确报错。

两个仓库按接口契约配套发布。2.1.0 恢复 MCP 技能读取工具；使用新的 `--export-chart` 显式导出发布副本，Chart 构建时仅依赖自身文件，不读取兄弟工作区。

## 当前接口范围

聊天附件需要宿主提供后端可访问的 HTTP/HTTPS URL；本地路径和正文文本不作为上传内容。后续需要接收附件字节时再设计上传接口。

配置工具使用现有 `/open-apis/review-rules/**` 既有入口，没有快照、原子移动工具及 `expectedRevision`、`impactToken`、`onlyIfEmpty` 参数。本次分层调整不引入后端新制品或数据库迁移。

分页可见列表不证明全部引用完整；当前接口没有原子移动、空组条件删除或事务版本保护，清单更新会写入服务默认元数据。这些接口事实在工具说明中保留；如何核对影响、处理异常、组合内置与自定义规则来源、检查明细并展示结果，由宿主 Skill 编排。授权和真实豆包联调状态记录在 `dev-contract-charts/docs/everyline-cli-mcp-verification.md`。
