# EveryLine MCP

调用链：**用户目标 → 从 MCP 读取 EveryLine Skill → 宿主按 Skill 调用 MCP 业务接口 → EveryLine API**。MCP 提供技能正文与业务工具，宿主执行交互与编排。

| 层 | 职责 |
| --- | --- |
| 宿主 Skill | 用户交互、主体/强度/清单选择、调用顺序、分页、轮询、续办、写后回读与结果汇总 |
| MCP / Higress | 技能正文读取、工具发现、参数校验、当前用户鉴权透传、业务请求映射及响应/错误转换 |
| EveryLine API | 业务执行、业务权限与数据持久化 |

`mcp/skills/` 是 Skill 唯一维护源。test 工具映射与授权配置维护在 `test-contract-charts` 仓库 `20261016-zss-everyline-mcp` 分支的 `everyline-cli-mcp-test/` Chart。本工程已移除 CLI 实现及构建发布链路，只保留 Skill、接口说明与维护脚本。

MCP 2.3.0 提供 26 项工具：2 项 Skill 读取、5 项上传/审查、7 项清单、4 项分组、7 项规则接口及 `auth-logout`。业务工具说明指向对应的 Skill 读取入口，状态和详情每次查询一次，列表每次读取一页；后续调用由宿主按 Skill 安排。

## release 业务基线

Skill 2.3.0 对齐 [everyline-cli release v1.1.1](https://github.com/qfeius/everyline-cli/tree/617a2cc47aa208cbc651412003b763afe4c55c41/skills)，固定来源提交 `617a2cc47aa208cbc651412003b763afe4c55c41`。保留业务规则，CLI 安装、命令调用和本地身份管理转换为连接器工具发现、结构化 arguments 与 OAuth；图表按宿主展示能力适配。

| 原版业务要求 | MCP Skill 中的落实 |
| --- | --- |
| 主体 → 强度 → 清单，按宿主能力选择交互 | 保留顺序、已有选择复用、完整候选冻结、内置编号 0、多选去重和无效回复整次重选；清单始终完整文字展示 |
| 平台风险卡片与四级等级 | 排除主体风险，未知等级计入总数并单独说明，四级包含零值；结果缺失或截断不输出汇总 |
| 固定完整报告与图表 | 基础信息表、概览、问题归纳、环形图和横向条形图、完整签名链接及两小时提示；保留图形尺寸、标签间距和占比，原生图表缺失或失败后执行 PNG 路径，两条路径均有具体缺项或失败记录时才降级 |
| 单项配置维护 | 保留清单、规则、分组的查询、创建、编辑和删除步骤，完整集合、3000/1500 字限制、变更确认、影响复查和写后回读 |
| 调用与结果适配 | 参数位于顶层，长 ID 用字符串，强度和风险等级转换为工具枚举，状态查询与详情分别核对，缺少原子能力时按原版门槛停止相关写入 |

基线测试使用固定 release 的独立原文片段；仅显式适配 MCP 调用词与宿主图表展示方式，其余报告全文保持连续一致。源工程测试保护业务要求，Chart SDK 测试保护完整正文分发；两者均不替代宿主实际执行与图表渲染验收。

## 宿主加载与调用

1. 在宿主配置 EveryLine HTTP MCP 连接器并完成 OAuth。
2. 刷新 MCP 工具清单，确认 `read-review-skill` 和 `read-review-config-skill` 可见。两份宿主 Skill ZIP 可辅助选路，MCP 自身提供完整部署正文。
3. 审查或续办先调用 `read-review-skill`（参数 `{}`），配置查询/维护先调用 `read-review-config-skill`，然后按返回技能调用同一连接器业务工具。

从旧 CLI 版迁移时替换或停用宿主中旧技能，刷新连接器工具并新建任务。完整流程由 MCP 技能读取工具返回，宿主无需安装 CLI；原有本地文件上传方式与 URL 上传能力边界分别核对。

豆包任务应启用目标 MCP（test 为 `everyline-cli-mcp-test`）并向模型提供其工具清单。“审查合同”应命中技能读取入口，随后依次确认立场、强度、规则来源；缺少任一项时先等待用户选择。MCP 提供加载入口，实际工具选择仍由宿主执行，应通过真实调用记录验收，不能只凭报告样式或模型自述确认。

豆包默认选路还需核对宿主配置：

- 在“插件 · 技能 · 伙伴 → 管理 → 技能”中，将个人 EveryLine MCP 技能替换为当前发布版。发布 Chart 只更新连接器返回的正文，已有个人 Skill 不会自动升级；2.0.0 的说明仅匹配文件 URL，2.1.0 才覆盖附件和通用“审查合同”入口。
- 将 EveryLine 设为默认审查流程时，停用豆包推荐的“合同审查”（`doubao-contract-reviewer`），并停用旧 CLI 与重复来源的同名审查技能，保留当前 MCP 版。内置技能要求通用合同请求优先使用自身流程，只有 MCP 工具可见并不会改变这个选择。
- 连接器工具仍为旧清单时，关闭再启用该连接器，核对两个读取入口、`auth-logout` 和 26 项工具。用新任务检查首个审查步骤是否实际调用 `read-review-skill`；已有任务中加载的内置技能不作为新配置的验收依据。
- EveryLine 登录、授权和重新连接由 `everyline-review` 的选路描述接入。宿主同时安装通用 `auth` 时，将其范围限定为用户明确指定的 Contract CLI；已选定 `everyline-cli-mcp-test` 后的“test 授权登录”进入该连接器 OAuth。更新个人 Skill 后新建任务，旧任务中的已加载正文不用于验收新规则。

业务参数直接放在 arguments 顶层，例如上传传 `{"fileUrl":"https://example.com/contract.pdf","name":"contract.pdf"}`，无筛选条件传 `{}`。Higress 按参数逐项展示注释；`config`、`data` 和数组保留业务结构。文件、任务与资源 ID 按字符串传递。Skill 读取工具不接受业务参数，也没有一键审查或等待结果工具。

## 连接器授权

连接器使用浏览器 Authorization Code + PKCE S256，复用现有 `contract-review` 授权服务器、`contract-review:full` scope、动态客户端注册和租户选择/授权确认页。回调地址使用当前 MCP 宿主登记的地址，state、PKCE challenge/verifier 和 client_id 由宿主为本次授权生成或获取。

浏览器授权 URL 包含 business_type、client_id、code_challenge、code_challenge_method、redirect_uri、response_type、scope、state；确认页仍提交既有的 tenant_id、client_id、redirect_uri、state、code_challenge、scope。MCP 使用现有 `contract-review` 授权端点和确认页，不要求 org-fe 增加字段。

Chart 使用现有 `/api/public/verify-access-token` 验真，失败关闭访问；当前用户 Bearer 逐请求转发，业务 API 沿用现有权限校验。资源元数据仍声明本入口 `https://mcp.qtech.cn/mcp-servers/everyline-cli-mcp`，宿主按其协议发送 resource；这一声明不代表现有后端已强制绑定 MCP audience/resource 或产品 scope。本方案没有引入专用令牌、额外白名单或组织授权请求存储。严格要求这些新增保障的接入需另行建设和验收，不能把通用验真等同于完整 MCP 资源隔离。

登录和刷新由宿主连接器管理，直接退出由 `auth-logout` 完成。本工程不保存本地 Token，也不运行 CLI 登录命令。退出工具以 `{}` 调用，通过既有开放网关转发到组织服务 `POST /api/public/oauth/logout/contract-review`；后端从当前 Bearer 的签名授权关联撤销对应 refresh family，后续 access token 验真与刷新均拒绝该授权。其他独立授权保持有效。

退出成功需同时满足业务 `code=200` 和 `data.authenticated=false`，随后停止轮询、业务调用及自动重新授权。此操作不清除浏览器登录或宿主缓存；用户再次登录或切换账号时走宿主 OAuth。旧令牌缺少授权关联时返回 `409 reauthorization_required`，须重新连接一次后使用新能力。

升级期间暂停 OAuth 令牌签发与刷新，等全部组织服务副本升级后恢复，再启用新 Chart。若新旧版本混跑期间已签发或刷新过连接，这些连接须在升级完成后重新授权，避免同一授权混有未关联的旧令牌。回滚可先停用退出工具并保留 family 验真；回退共享验真逻辑前须清理全部关联授权的访问令牌，否则先前已撤销的令牌可能恢复有效。部署后仍需验证真实宿主退出、刷新失败和双账号隔离，本地测试不代替联调。

仅请求授权时使用宿主的连接器授权入口；宿主没有可调用的授权操作时，提示在目标连接器设置中授权或重新连接。已连接则复用；可通过 `read-review-skill` 验证访问，不创建业务任务。授权入口缺失、工具未加载或 HTTP 401 都不触发 `contract-cli` 或旧 EveryLine CLI。仅修改 MCP 返回的正文不足以修复授权前的选路，须同步宿主 Skill 的描述及旧 `auth` 的适用范围。

## 版本与发布

`mcp/skills-manifest.json` 记录 Skill 版本、名称与正文 SHA-256，两项 Skill 的 `metadata.version` 与清单一致。显式导出后，Chart 内发布副本按身份、版本与摘要校验，再编码为固定工具响应；修改流程后需重新导出并部署完整 Chart。`package.json` 为私有维护工具清单，不注册业务命令或安装钩子。

```sh
node scripts/sync-mcp-skills.js --version 2.3.0
node scripts/sync-mcp-skills.js --export-chart ../test-contract-charts/everyline-cli-mcp-test
make mcp-check
make mcp-package
```

上例版本替换为本次 Skill 版本。打包需要 Node.js、tar 和 zip。`make mcp-package` 生成以下文件及各自的 `.sha256`：

- `dist/everyline-mcp-skills-2.3.0.tgz`：两项 Skill、清单、说明和独立校验/打包脚本。
- `dist/everyline-review-mcp-skill-2.3.0.zip`：审查 Skill，ZIP 根目录为 `SKILL.md`。
- `dist/everyline-review-config-mcp-skill-2.3.0.zip`：配置 Skill，ZIP 根目录为 `SKILL.md`。

核对发布文件摘要后，ZIP 可直接交给宿主导入。使用源归档时，解压后执行 `node scripts/sync-mcp-skills.js --check` 验证正文；也可用自带脚本重新生成导入包。`make release-check`、GitHub 发布与 GitLab 打包均校验并交付这些独立制品。发布标签通过 `node scripts/sync-mcp-skills.js --check-tag v2.3.0` 核对，并须匹配清单版本。CI 只发布 Skill 制品。

Skill / MCP 2.1.0 增加连接器技能读取，保留附件审查入口及立场/强度/规则来源的用户选择条件。业务参数继续兼容 MCP 2.0.0，既有后端 API 保持不变。

Skill / MCP 2.2.0 恢复 release 原版业务流程，配套 Chart 0.7.0。导出的两项 Skill 与源文件逐字一致，23 项业务工具的接口与参数保持兼容。批量工具仍注册，配置 Skill 沿用 release 的单项流程，不调用批量创建、更新或删除。

Skill 2.2.1 修正图表展示，配套 Chart 0.7.1；MCP 接口仍为 2.2.0。移除直接输出 HTML/SVG 和禁止图片的要求，优先调用宿主可视化工具，其次生成并嵌入 PNG；两条路径均缺少能力或展示失败时输出两段分布文字。仅生成文件或下载链接不算完成展示。

Skill 2.2.2 修正豆包未绘图就直接降级的问题，配套 Chart 0.7.2；MCP 接口仍为 2.2.0。原生路径缺失或失败后继续检查并执行 PNG 路径，补齐绘图环境、中文字体与宿主图片引用；缺少预览工具或尚未发送最终回复不视为展示失败。两条路径均有缺项或失败记录才降级，并显示具体原因。更新 Chart 与个人 Skill 后，重新读取 2.2.2 正文；使用已完成任务的结果复测展示，不重复创建审查任务。

## 从 input 包装迁移到独立参数

Chart 0.5.0 / MCP 2.0.0 将 23 项工具的业务参数展开为 53 个顶层参数，使 Higress 工具页按字段显示名称和注释。旧的 `{"input":{...}}` 调用会被拒绝；新调用直接传 `{...}`。两份 Skill 同步升级为 2.0.0，需配套更新 Chart、导入 Skill 并刷新宿主工具清单，避免旧调用格式混用。

Chart 增加仅绑定本入口的 `request-validation:2.0.3`，在 SDK 类型转换和字段筛选前验证原始参数，保留未知字段拒绝与整数校验。业务路径、请求体和鉴权保持原有约定；新增插件需随完整 Chart 部署，不能只替换工具列表。本地配置及制品完成不代表已部署。

## Skill 分发历史与当前版本

Skill 1.4.0 通过宿主加载；Chart 0.4.0 / MCP 接口 1.4.0 移除原两项 Skill 读取工具、`server.config` 中的 Skill 正文、发布副本和 Skill 摘要注解。安装宿主版 Skill 后更新 Chart，并刷新宿主工具清单与 Skill。`scripts/sync-mcp-skills.js` 保留本地版本、校验和打包命令，旧的 Chart 路径参数会明确报错。

两个仓库按接口契约配套发布。2.1.0 恢复 MCP 技能读取工具；使用新的 `--export-chart` 显式导出发布副本，Chart 构建时仅依赖自身文件，不读取兄弟工作区。

## 当前接口范围

聊天附件需要宿主提供后端可访问的 HTTP/HTTPS URL；本地路径和正文文本不作为上传内容。后续需要接收附件字节时再设计上传接口。

豆包工作现场验收已确认可通过宿主 `FileBatchUpload` 将本地附件转换为可访问 URL，再调用 MCP 的 `upload-contract-file-by-url`；这一步无需安装 CLI。其他宿主仍需核对各自的附件传输能力。

配置工具使用现有 `/open-apis/review-rules/**` 既有入口，没有快照、原子移动工具及 `expectedRevision`、`impactToken`、`onlyIfEmpty` 参数。本次分层调整不引入后端新制品或数据库迁移。

分页可见列表不证明全部引用完整；当前接口没有原子移动、空组条件删除或事务版本保护，清单更新会写入服务默认元数据。这些接口事实在工具说明中保留；如何核对影响、处理异常、组合内置与自定义规则来源、检查明细并展示结果，由宿主 Skill 编排。授权和真实豆包联调状态记录在 `dev-contract-charts/docs/everyline-cli-mcp-verification.md`。

Skill / MCP 2.3.0 新增直接退出工具，配套 Chart 0.8.0 与组织服务 OAuth 授权撤销实现。保留 2.2.2 的图表执行要求及全部原业务接口；不把旧版单独清 access token 的 account logout 视为完整连接器退出。
