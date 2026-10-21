# EveryLine MCP

调用链：**用户目标 → 宿主加载 Skill → MCP 业务接口 → EveryLine API**。MCP 在接口层替代 CLI，上层仍由 Skill 负责编排。

| 层 | 职责 |
| --- | --- |
| 宿主 Skill | 用户交互、主体/强度/清单选择、调用顺序、分页、轮询、续办、写后回读与结果汇总 |
| MCP / Higress | 工具发现、参数校验、当前用户鉴权透传、单次业务请求映射及响应/错误转换 |
| EveryLine API | 业务执行、业务权限与数据持久化 |

`mcp/skills/` 是由宿主加载的 Skill 源文件。业务工具映射与授权配置维护在 `dev-contract-charts` 仓库 `20261016-zss-everyline-mcp` 分支的 `everyline-cli-mcp/` Chart。本工程已移除 CLI 实现及构建发布链路，只保留 Skill、接口说明与维护脚本。

MCP 只发布 23 项业务工具：5 项上传/审查、7 项清单、4 项分组、7 项规则接口。状态和详情每次查询一次，列表每次读取一页；下一次调用由 Skill 安排。工具描述仅说明接口参数、返回值和副作用。Skill 正文、流程提示、等待与汇总逻辑由宿主侧维护。

## 宿主加载与调用

1. 在宿主配置 EveryLine HTTP MCP 连接器并完成 OAuth。
2. 将下方发布流程生成的两份 MCP 版 Skill ZIP 导入宿主，或把 `mcp/skills/` 中的两个 Skill 目录安装到宿主指定的技能目录。
3. 宿主加载 `everyline-review` 后按流程调用业务工具；配置维护通过宿主技能加载能力读取 `everyline-review-config`。

从旧 CLI 版迁移时，替换宿主中原有同名 Skill，随后重新加载。仅添加连接器只会获得业务工具，完整流程还需要宿主安装 Skill。

业务工具参数统一使用 `input` 对象，无筛选条件传 `{"input":{}}`。文件、任务与资源 ID 按字符串传递。MCP 工具中没有 Skill 读取入口，也没有一键审查或等待结果入口。

## 连接器授权

连接器使用浏览器 Authorization Code + PKCE S256，复用现有 `contract-review` 授权服务器、`contract-review:full` scope、动态客户端注册和租户选择/授权确认页。回调地址使用当前 MCP 宿主登记的地址，state、PKCE challenge/verifier 和 client_id 由宿主为本次授权生成或获取。

浏览器授权 URL 包含 business_type、client_id、code_challenge、code_challenge_method、redirect_uri、response_type、scope、state；确认页仍提交既有的 tenant_id、client_id、redirect_uri、state、code_challenge、scope。MCP 使用现有 `contract-review` 授权端点和确认页，不要求 org-fe 增加字段。

Chart 使用现有 `/api/public/verify-access-token` 验真，失败关闭访问；当前用户 Bearer 逐请求转发，业务 API 沿用现有权限校验。资源元数据仍声明本入口 `https://mcp.qtech.cn/mcp-servers/everyline-cli-mcp`，宿主按其协议发送 resource；这一声明不代表现有后端已强制绑定 MCP audience/resource 或产品 scope。本方案没有引入专用令牌、额外白名单或组织授权请求存储。严格要求这些新增保障的接入需另行建设和验收，不能把通用验真等同于完整 MCP 资源隔离。

用户授权、刷新与撤销由连接器完成，本工程不提供本地 Token 存储或登录命令。部署后仍需验证实际宿主的登录、刷新、撤销和双账号权限范围；本地映射检查不代替真实授权验收。

## 版本与发布

`mcp/skills-manifest.json` 记录 MCP 版 Skill 的独立版本、名称与正文 SHA-256，两项 Skill 的 `metadata.version` 与清单一致。该清单是本工程唯一发布版本来源；宿主 Skill 和 Chart 各自维护版本，仅修改 Skill 流程时无需重发 Chart。`package.json` 为私有维护工具清单，不注册业务命令或安装钩子。

```sh
node scripts/sync-mcp-skills.js --version 1.4.0
make mcp-check
make mcp-package
```

上例版本替换为本次 Skill 版本。打包需要 Node.js、tar 和 zip。`make mcp-package` 生成以下文件及各自的 `.sha256`：

- `dist/everyline-mcp-skills-1.4.0.tgz`：两项 Skill、清单、说明和独立校验/打包脚本。
- `dist/everyline-review-mcp-skill-1.4.0.zip`：审查 Skill，ZIP 根目录为 `SKILL.md`。
- `dist/everyline-review-config-mcp-skill-1.4.0.zip`：配置 Skill，ZIP 根目录为 `SKILL.md`。

核对发布文件摘要后，ZIP 可直接交给宿主导入。使用源归档时，解压后执行 `node scripts/sync-mcp-skills.js --check` 验证正文；也可用自带脚本重新生成导入包。`make release-check`、GitHub 发布与 GitLab 打包均校验并交付这些独立制品。发布标签通过 `node scripts/sync-mcp-skills.js --check-tag v1.4.0` 核对，并须匹配清单版本。CI 只发布 Skill 制品。

## 从 Chart 内嵌 Skill 迁移

Skill 1.4.0 通过宿主加载；Chart 0.4.0 / MCP 接口 1.4.0 移除原两项 Skill 读取工具、`server.config` 中的 Skill 正文、发布副本和 Skill 摘要注解。安装宿主版 Skill 后更新 Chart，并刷新宿主工具清单与 Skill。`scripts/sync-mcp-skills.js` 保留本地版本、校验和打包命令，旧的 Chart 路径参数会明确报错。

两个仓库按接口契约配套迁移，此后分别发布。Chart 校验业务工具映射及鉴权，源工程校验宿主 Skill 正文和导入制品；两边都不依赖另一仓库的工作区或 Skill 副本。

## 当前接口范围

聊天附件需要宿主提供后端可访问的 HTTP/HTTPS URL；本地路径和正文文本不作为上传内容。后续需要接收附件字节时再设计上传接口。

配置工具使用现有 `/open-apis/review-rules/**` 既有入口，没有快照、原子移动工具及 `expectedRevision`、`impactToken`、`onlyIfEmpty` 参数。本次分层调整不引入后端新制品或数据库迁移。

分页可见列表不证明全部引用完整；当前接口没有原子移动、空组条件删除或事务版本保护，清单更新会写入服务默认元数据。这些接口事实在工具说明中保留；如何核对影响、处理异常、组合内置与自定义规则来源、检查明细并展示结果，由宿主 Skill 编排。授权和真实豆包联调状态记录在 `dev-contract-charts/docs/everyline-cli-mcp-verification.md`。
