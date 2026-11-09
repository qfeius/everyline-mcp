# EveryLine MCP

调用链：**用户目标 → 宿主加载 EveryLine Skill → 调用 MCP 业务接口 → EveryLine API**。MCP 提供业务工具，宿主执行交互与编排。

| 层 | 职责 |
| --- | --- |
| 宿主 Skill | 用户交互、主体/强度/清单选择、调用顺序、分页、轮询、续办、写后回读与结果汇总 |
| MCP / Higress | 工具发现、参数校验、当前用户鉴权透传、业务请求映射及响应/错误转换 |
| EveryLine API | 业务执行、业务权限与数据持久化 |

`mcp/skills/` 是 Skill 唯一维护源。test 工具映射与授权配置维护在 `test-contract-charts` 仓库 `20261016-zss-everyline-mcp` 分支的 `everyline-cli-mcp-test/` Chart。本工程已移除 CLI 实现及发布链路，只维护 Skill、接口说明与维护脚本。

MCP 提供 25 项工具：7 项上传/审查、7 项清单、4 项分组、7 项规则接口。退出与切换账号由宿主授权管理完成。状态和详情每次查询一次，列表每次读取一页；后续调用由宿主按 Skill 安排。

## release 业务基线

Skill 3.2.1 对齐 [everyline-cli release v1.1.1](https://github.com/qfeius/everyline-cli/tree/617a2cc47aa208cbc651412003b763afe4c55c41/skills)，固定来源提交 `617a2cc47aa208cbc651412003b763afe4c55c41`。保留业务规则，CLI 安装、命令调用和本地身份管理转换为连接器工具发现、结构化 arguments 与 OAuth；图表按宿主展示能力适配。

| 原版业务要求 | MCP Skill 中的落实 |
| --- | --- |
| 主体 → 强度 → 清单，按宿主能力选择交互 | 保留顺序、已有选择复用、完整候选冻结、内置编号 0、多选去重和无效回复整次重选；清单始终完整文字展示 |
| 平台风险卡片与四级等级 | 排除主体风险，未知等级计入总数并单独说明，四级包含零值；结果缺失或截断不输出汇总 |
| 固定完整报告与图表 | 基础信息表、概览、问题归纳、环形图和横向条形图、完整签名链接及两小时提示；保留图形尺寸、标签间距和占比，原生图表缺失或失败后执行 PNG 路径，两条路径均有具体缺项或失败记录时才降级 |
| 单项配置维护 | 保留清单、规则、分组的查询、创建、编辑和删除步骤，完整集合、3000/1500 字限制、变更确认、影响复查和写后回读 |
| 调用与结果适配 | 参数位于顶层，长 ID 用字符串，强度和风险等级转换为工具枚举，状态查询与详情分别核对，缺少原子能力时按原版门槛停止相关写入 |

基线测试使用固定 release 的独立原文片段；仅显式适配 MCP 调用词与宿主图表展示方式，其余报告全文保持连续一致。源工程测试保护业务要求，Chart SDK 测试保护业务工具映射；两者均不替代宿主实际执行与图表渲染验收。

## 宿主加载与调用

1. 在宿主配置 EveryLine HTTP MCP 连接器并完成 OAuth。
2. 导入单个 Skill ZIP 或豆包 Plugin ZIP，并刷新 MCP 业务工具清单。升级时替换旧的两项 Skill，避免重复选路。
3. 宿主加载 `everyline-review` 唯一入口；查询和维护清单、规则、分组时按需读取 `references/review-config.md`，再调用同一连接器业务工具。

技能资源的唯一根目录是宿主实际加载 `SKILL.md` 的目录。入口、配置参考和图标分别使用 `./SKILL.md`、`./references/review-config.md`、`./assets/icon.png`；配置流程返回时复用已加载入口，不重新拼接技能名称或父目录路径。Plugin ZIP 中该目录为 `skills/everyline-review/`，单技能 ZIP 中为 ZIP 根目录。目录未知或文件缺失时停止依赖该资源的步骤，不扫描其他技能或下载替代说明。

迁移时先替换或停用宿主中的旧技能并安装新 Skill，再部署移除读取工具的 MCP Chart、刷新工具并新建任务；旧 Skill 仍依赖读取工具。完整流程由宿主独立 Skill 提供，宿主无需安装 CLI；原有本地文件上传方式与 URL 上传能力边界分别核对。

豆包任务应启用目标 MCP（test 为 `everyline-cli-mcp-test`）并向模型提供其工具清单。“审查合同”应命中审查 Skill，随后依次确认立场、强度、规则来源；缺少任一项时先等待用户选择。Skill 的加载和工具选择均由宿主执行，应通过真实调用记录验收，不能只凭报告样式或模型自述确认。

豆包默认选路还需核对宿主配置：

- 在“插件 · 技能 · 伙伴 → 管理 → 技能”中，将个人 EveryLine MCP 技能替换为当前发布版。发布 Chart 不更新个人 Skill；2.0.0 的说明仅匹配文件 URL，2.1.0 才覆盖附件和通用“审查合同”入口。
- 将 EveryLine 设为默认审查流程时，停用豆包推荐的“合同审查”（`doubao-contract-reviewer`），并停用旧 CLI 与重复来源的同名审查技能，保留当前 MCP 版。内置技能要求通用合同请求优先使用自身流程，只有 MCP 工具可见并不会改变这个选择。
- 连接器工具仍为旧清单时，按宿主支持的方式刷新，核对共 25 项业务工具，确认旧 `auth-logout` 已移除。用新任务检查是否加载审查 Skill 并调用相应业务工具；已有任务中加载的内置技能不作为新配置的验收依据。
- EveryLine 登录、授权和重新连接由 `everyline-review` 的选路描述接入。宿主同时安装通用 `auth` 时，将其范围限定为用户明确指定的 Contract CLI；已选定 `everyline-cli-mcp-test` 后的“test 授权登录”进入该连接器 OAuth。更新个人 Skill 后新建任务，旧任务中的已加载正文不用于验收新规则。

业务参数直接放在 arguments 顶层，例如上传传 `{"fileUrl":"https://example.com/contract.pdf","name":"contract.pdf"}`，无筛选条件传 `{}`。Higress 按参数逐项展示注释；`config`、`data` 和数组保留业务结构。文件、任务与资源 ID 按字符串传递。MCP 没有一键审查或等待结果工具。

## 连接器授权

连接器使用浏览器 Authorization Code + PKCE S256，复用现有 `contract-review` 授权服务器、`contract-review:full` scope、动态客户端注册和租户选择/授权确认页。回调地址使用当前 MCP 宿主登记的地址，state、PKCE challenge/verifier 和 client_id 由宿主为本次授权生成或获取。

浏览器授权 URL 包含 business_type、client_id、code_challenge、code_challenge_method、redirect_uri、response_type、scope、state；确认页仍提交既有的 tenant_id、client_id、redirect_uri、state、code_challenge、scope。MCP 使用现有 `contract-review` 授权端点和确认页，不要求 org-fe 增加字段。

Chart 使用现有 `/api/public/verify-access-token` 验真，失败关闭访问；当前用户 Bearer 逐请求转发，业务 API 沿用现有权限校验。资源元数据仍声明本入口 `https://mcp-test.qtech.cn/mcp-servers/everyline-cli-mcp-test`，宿主按其协议发送 resource；这一声明不代表现有后端已强制绑定 MCP audience/resource 或产品 scope。本方案没有引入专用令牌、额外白名单或组织授权请求存储。严格要求这些新增保障的接入需另行建设和验收，不能把通用验真等同于完整 MCP 资源隔离。

登录、刷新、退出与切换账号均由宿主连接器管理，与合同 MCP 保持相同职责划分。MCP 不提供退出工具或 logout HTTP 映射，不保存本地 Token，也不运行 CLI 登录命令。用户要求退出或切换账号时先停止业务调用和轮询，使用宿主实际提供的断开连接或撤销授权操作；宿主未暴露可调用能力时引导至目标连接器的授权管理界面。

按宿主真实结果报告“已断开连接”或“已撤销授权”。前者不证明后端访问与刷新令牌均已失效，也不证明浏览器登录已退出。操作取消、失败或结果未知时不报告退出完成；退出后不再读取 Skill 或业务数据来探测状态，避免宿主自动重新授权。

用户明确切换账号时，由宿主处理旧授权后，重新发起同一连接器的 OAuth，用户选择账号和租户。浏览器可能复用已有登录态，恢复业务前须核对真实身份、租户及受保护业务读取；原任务保留创建时租户归属，不在新租户下自动重建或续办。退出流程无需配套发布组织服务退出实现；部署后仍需验收目标宿主的授权管理、重新授权和双账号切换。

仅请求授权时使用宿主的连接器授权入口；宿主没有可调用的授权操作时，提示在目标连接器设置中授权或重新连接。已连接则复用；以宿主实际连接状态核对授权，不创建业务任务。授权入口缺失、工具未加载或 HTTP 401 都不触发 `contract-cli` 或旧 EveryLine CLI。仅修改 MCP 工具说明不足以修复授权前的选路，须同步宿主 Skill 的描述及旧 `auth` 的适用范围。

## 版本与发布

`mcp/skills-manifest.json` 记录唯一 Skill 的版本、名称、正文、参考流程、图标与豆包声明的 SHA-256，入口的 `metadata.version` 与清单一致。Skill 独立打包给宿主，Chart 不读取或校验 Skill 正文。`package.json` 为私有维护工具清单，不注册业务命令或安装钩子。

```sh
node scripts/sync-mcp-skills.js --version 3.2.1
make mcp-check
make mcp-package
```

上例版本替换为本次 Skill 版本。打包需要 Node.js、tar 和 zip。`make mcp-package` 生成以下文件及各自的 `.sha256`：

- `dist/everyline-mcp-skills-3.2.1.tgz`：唯一 Skill 的完整资源、豆包声明、清单、说明和独立校验/打包脚本。
- `dist/everyline-review-mcp-skill-3.2.1.zip`：合并后的 Skill，ZIP 根目录为 `SKILL.md`、`references/` 和 `assets/`。
- `dist/everyline-doubao-plugin-3.2.1.zip`：豆包插件，包含一个线上连接器和一个顶层 Skill；两者展示名均为“EveryLine | AI 合同审查助手”，技术名分别保留 `everyline-cli-mcp` 和 `everyline-review`。

核对发布文件摘要后，ZIP 可直接交给宿主导入。使用源归档时，解压后执行 `node scripts/sync-mcp-skills.js --check` 验证正文；也可用自带脚本重新生成导入包。`make release-check`、GitHub 发布与 GitLab 打包均校验并交付这些独立制品。发布标签通过 `node scripts/sync-mcp-skills.js --check-tag v3.2.1` 核对，并须匹配清单版本。CI 只发布 Skill 制品。

3.2.1 增加技能目录边界与资源引用校验：父目录跳转、错误入口路径和不存在的引用在升版与打包前失败；实际 Skill ZIP 和 Plugin ZIP 均验证技能说明引用在所属目录内。按[豆包接入指南](https://bytedance.larkoffice.com/docx/J5o2dZK8hoJItxxNQyocHgRzncb)，`mcp/doubao/plugin.json` 的 `extensions.com.doubao.privacyPolicyUrl` 已配置为服务提供方确认的[隐私政策](https://zhishuqifei.feishu.cn/wiki/UKmfw1POpiXb51kfSTrcLshLnPb)，实际 Plugin ZIP 测试同时核对该字段。本地校验和宿主导入不代表平台已审核通过。

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

MCP 3.1.0 支持本地原始文件的 prepare → multipart 上传 → commit 会话。会话由 EveryLine 后端管理，content 复用原上传服务完成保存，commit 校验同一用户/租户并返回同次 businessId/fileId/fileHash；Redis 只保存元数据和结果。用户直接提供的外部完整下载 URL 使用既有 URL 上传，本地路径、正文和 Base64 不作为 JSON 工具的文件内容。

此前豆包现场曾通过 `FileBatchUpload` 和 `upload-contract-file-by-url` 处理附件。Skill 3.1.1 改为对聊天附件与本地文件使用三段上传，优先直接读取原文件；只有附件已存在宿主下载 URL 时，才由宿主读取该 URL 的原始字节再走三段。该路径不代表绕过宿主存储；各宿主能否读取文件并发送 multipart 仍需实际验收。

配置工具使用现有 `/open-apis/review-rules/**` 既有入口，没有快照、原子移动工具及 `expectedRevision`、`impactToken`、`onlyIfEmpty` 参数。本次分层调整不引入后端新制品或数据库迁移。

分页可见列表不证明全部引用完整；当前接口没有原子移动、空组条件删除或事务版本保护，清单更新会写入服务默认元数据。这些接口事实在工具说明中保留；如何核对影响、处理异常、组合内置与自定义规则来源、检查明细并展示结果，由宿主 Skill 编排。授权和真实豆包联调状态记录在 `dev-contract-charts/docs/everyline-cli-mcp-verification.md`。

Skill / MCP 3.0.0 配套 Chart 0.9.0，移除 2.3.0 引入的 `auth-logout` 及 HTTP 映射，退出和切换账号统一交由宿主。工具数量从 26 项变为 25 项；需同步更新个人 Skill 并刷新宿主工具清单。全部原业务接口、OAuth 端点和现有鉴权透传保持原契约。


MCP 3.1.0 新增 `upload-file-session-prepare` 与 `upload-file-session-commit`，共 27 项工具。后端使用 30 分钟 Redis 会话并复用 EveryLine V3 原始文件上传；content 使用会话地址，`upload_headers` 返回空对象，prepare/commit 沿用用户授权。`start-review-task` 固定携带 `usageReportContext.reportBusinessCode=everyLine_100_openApi_mcp`，所有业务请求沿用 `X-Qfei-Channel-Type: mcp`。

三段接口统一使用 `/open-apis/contract-review/v3/mcp/files/upload_sessions/**`；后端直接注册完整开平路径，开放平台优先匹配三条 POST 并按原路径转发，旧 `/open-api/v3/mcp/files/upload_sessions/**` 端点移除。MCP 继续使用各环境原开平域名与上游；配套发布后端和开放平台路由后更新 MCP/Skill。原 URL 上传及审查继续使用既有调用链。

Skill 3.1.2 配套 test/blue Chart 0.10.1：聊天附件和本地文件统一走上传会话，不再通过附件 URL 调用 URL 上传；用户主动提供外部下载链接时沿用原工具。MCP 接口版本保持 3.1.0，部署后刷新宿主 Skill 与工具清单并用真实调用记录验收。

后端实例须先完成切换，再发布 MCP Chart 与宿主 Skill；旧、新实例混跑时，旧实例可能拒绝新会话的无头上传。回滚旧后端前完成或舍弃新会话并重新 prepare。


Skill 3.1.3 配套 test Chart 0.10.2 / MCP 3.1.1：详情固定请求后端 `simplifyReviewResult=true`，在进入网关缓冲前生成精简报告视图，完整签名链接位于响应开头；全部风险卡片、说明与建议保留，重复正文、坐标和规则快照省略。先保存链接再核对卡片数；任务成功但缺链接时以同一任务和业务上下文补查一次，仍缺失则报告链接获取异常。先发布后端，再发布 test Chart 并刷新宿主 Skill/工具，以既有任务验收，不重复创建审查。本地验证不代表已部署。
