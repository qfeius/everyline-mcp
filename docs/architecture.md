# 架构

当前调用链为 **用户 → 宿主 Agent 调用 MCP 读取 EveryLine Skill → 按 Skill 调用 MCP → EveryLine API**。MCP 替代 CLI 的接口层并提供部署版本的技能正文，工程中已移除 CLI 实现及发布链路。

```text
用户目标
   ↓
宿主 Agent 调用 MCP 的 read-review-skill / read-review-config-skill
（交互、选择、分页、轮询、续办、写后回读、结果展示）
   ↓ 调用
MCP / Higress
（工具发现、参数校验、鉴权透传、请求映射、结果与错误转换）
   ↓
EveryLine API
（业务执行、权限校验、持久化）
```

## 模块职责

`mcp/skills/` 是两项 Skill 的唯一维护源：`everyline-review` 编排审查，`everyline-review-config` 编排清单、分组和规则维护。相同发布正文用于宿主 ZIP 和 MCP 读取工具，宿主 Agent 执行规则并保存文件标识、任务 ID、用户选择和进度。

`test-contract-charts/everyline-cli-mcp-test/` 承载 2 项 Skill 读取工具及 23 项业务工具。读取工具从网关直接返回完整正文，不请求业务后端；业务工具每次映射一个现有接口。调用顺序、等待间隔、结果完整性检查和汇总策略均由 Skill 安排。

连接器负责用户 OAuth；Higress 验真当前用户 Token 并逐请求透传。业务后端执行其权限和数据规则。Skill 读取沿用同一入口鉴权，正文编码为固定字符串，不使用请求可覆盖的 `server.config`。

## 代码与发布

本工程只保留宿主 Skill、接口说明及维护脚本。原 Go CLI、命令处理器、Workflow、Profile、本地 Token 存储、安装器、自更新和二进制/npm 发布链路均已移除。Node 脚本用于开发时校验与打包，不参与用户业务调用。

Skill 的唯一发布版本位于 `mcp/skills-manifest.json`，两份 `SKILL.md` 的版本与摘要须一致。`--export-chart` 将校验后的正文及清单导出到独立 Chart；Helm 检查身份、版本和 SHA-256 后注入工具响应。修改流程后重新导出并部署 Chart，避免仅更新 ZIP 而连接器仍提供旧流程。

MCP 提供可发现的技能入口和使用说明，实际选路与调用由宿主 Agent 执行。当前 Higress SDK 的初始化响应没有 `instructions`，因此不能把仅修改 `server.description` 当作已向模型注入流程。验收须确认宿主确实发现并调用 Skill 读取工具及业务工具；本地校验不代表集群已部署或宿主已选择本连接器。

## 接口约束

- MCP 2.0.0 将业务参数声明为顶层 `args`，Higress 逐项展示注释；ID 使用字符串保留精度。
- 入口按工具声明校验原始参数，再交给 MCP SDK 处理；防止未知字段被丢弃、小数页码被截断。对象和数组保留原业务结构。
- MCP 校验接口声明的类型、必填项和字段，业务成功码为 `200`，错误保留服务端原因。
- 文件上传当前使用可访问 URL；Task ID 用于继续查询已有任务。
- 配置更新使用完整字段或集合，接口副作用由工具说明表达，Skill 在写入前核对。
- 当前后端的分页范围、并发保护与删除能力以实际接口为准，Skill 的核对步骤不改变后端语义。

详细方法与路径见 [接口映射](api-mapping.md)，宿主安装及版本迁移见 [MCP 说明](../mcp/README.md)。
