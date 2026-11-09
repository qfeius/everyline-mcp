# 架构

当前调用链为 **用户 → 宿主 Agent 加载独立 EveryLine Skill → 调用 MCP → EveryLine API**。MCP 替代 CLI 的接口层，不承载技能正文，工程中已移除 CLI 实现及发布链路。

```text
用户目标
   ↓
宿主 Agent 加载 everyline-review 唯一 Skill 入口
（交互、选择、分页、轮询、续办、写后回读、结果展示）
   ↓ 调用
MCP / Higress
（工具发现、参数校验、鉴权透传、请求映射、结果与错误转换）
   ↓
EveryLine API
（业务执行、权限校验、持久化）
```

## 模块职责

`mcp/skills/everyline-review/` 是唯一 Skill 维护源：入口编排审查，`references/review-config.md` 按需编排清单、分组和规则维护。发布正文用于宿主 ZIP，宿主 Agent 执行规则并保存文件标识、任务 ID、用户选择和进度。

`test-contract-charts/everyline-cli-mcp-test/` 承载 25 项业务工具。业务工具每次映射一个开平接口，两个会话工具也指向 EveryLine 后端。调用顺序、等待间隔、结果完整性检查和汇总策略均由 Skill 安排。

宿主连接器负责用户 OAuth 登录、刷新及旧授权管理；退出使用宿主的断开连接或撤销授权能力，切换账号在旧授权处理后重新发起 OAuth。MCP 不提供退出接口，宿主断开连接不等于后端令牌已撤销。Higress 验真当前用户 Token 并逐请求透传。业务后端执行其权限和数据规则。Skill 由宿主独立加载，不通过 MCP 获取正文。

## 代码与发布

本工程仅维护宿主 Skill、接口说明及校验打包脚本。原 Go CLI、命令处理器、Profile、本地 Token 存储、安装器、自更新及 CLI 发布链路已移除；Node 脚本不参与业务请求。

三段上传由 EveryLine 后端以完整 `/open-apis/contract-review/v3/mcp/files/upload_sessions/**` 路径提供，开放平台对三条 POST 按原路径转发。prepare 生成绑定用户/租户的限时会话，content 复用既有文件上传服务，commit 仅核对归属并返回缓存结果。Redis 只保存会话元数据与结果，原文件沿用原对象存储和文件表。MCP 继续使用原开平上游，无额外上传适配服务；先发布后端、开放平台转发及环境配置，再发布 MCP/Skill。

Skill 的唯一发布版本位于 `mcp/skills-manifest.json`，入口 `SKILL.md` 的版本与清单一致；正文、参考流程、图标和豆包声明均登记摘要。校验后生成完整的单技能 ZIP 和豆包 Plugin ZIP；Chart 与 Skill 独立发布，不读取 Chart 内历史 Skill 副本。

宿主先加载匹配的 Skill，再发现和调用 MCP 业务工具。验收须确认宿主实际加载 Skill 并调用正确连接器；本地校验不代表集群已部署或宿主已选择该连接器。

## 接口约束

- MCP 2.0.0 将业务参数声明为顶层 `args`，Higress 逐项展示注释；ID 使用字符串保留精度。
- 入口按工具声明校验原始参数，再交给 MCP SDK 处理；防止未知字段被丢弃、小数页码被截断。对象和数组保留原业务结构。
- MCP 校验接口声明的类型、必填项和字段，业务成功码为 `200`，错误保留服务端原因。
- MCP 详情固定请求后端 `simplifyReviewResult=true`，在进入网关缓冲前生成报告视图：完整签名链接排在响应开头，全部风险卡片和报告所需说明保留，重复正文、定位和规则快照省略。链接状态与任务状态分别表达；Skill 先保存链接，核对卡片总数再统计，成功缺链接只补查同一任务一次。
- 聊天附件和本地文件使用 MCP prepare → multipart content → commit；用户直接提供的外部完整 URL 保留原上传接口。宿主必须能读取原文件并发送 multipart；Task ID 用于继续查询已有任务。
- 配置更新使用完整字段或集合，接口副作用由工具说明表达，Skill 在写入前核对。
- 当前后端的分页范围、并发保护与删除能力以实际接口为准，Skill 的核对步骤不改变后端语义。

详细方法与路径见 [接口映射](api-mapping.md)，宿主安装及版本迁移见 [MCP 说明](../mcp/README.md)。
