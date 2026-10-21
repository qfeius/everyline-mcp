# 架构

当前唯一业务调用链为 **用户 → 宿主 Agent 按 Skill 编排 → MCP → EveryLine API**。MCP 替代 CLI 的接口层，工程中已移除 CLI 实现及发布链路。

```text
用户目标
   ↓
宿主 Agent 加载 Skill
（交互、选择、分页、轮询、续办、写后回读、结果展示）
   ↓ 调用
MCP / Higress
（工具发现、参数校验、鉴权透传、请求映射、结果与错误转换）
   ↓
EveryLine API
（业务执行、权限校验、持久化）
```

## 模块职责

`mcp/skills/` 定义两项宿主 Skill：`everyline-review` 编排审查，`everyline-review-config` 编排清单、分组和规则维护。宿主 Agent 执行这些规则并保存本次流程的文件标识、任务 ID、用户选择和进度。

`dev-contract-charts/everyline-cli-mcp/` 承载 23 项 MCP 业务工具。每个工具映射一个现有接口：列表读取一页，状态与详情查询一次，写入提交一次。调用顺序、等待间隔、结果完整性检查和汇总策略均由 Skill 安排。

连接器负责用户 OAuth；Higress 验真当前用户 Token 并逐请求透传。业务后端执行其权限和数据规则。MCP 配置不持有共用用户凭据，也不分发 Skill 正文。

## 代码与发布

本工程只保留宿主 Skill、接口说明及维护脚本。原 Go CLI、命令处理器、Workflow、Profile、本地 Token 存储、安装器、自更新和二进制/npm 发布链路均已移除。Node 脚本用于开发时校验与打包，不参与用户业务调用。

Skill 的唯一发布版本位于 `mcp/skills-manifest.json`，两份 `SKILL.md` 的版本与摘要须一致。Skill 以源归档和宿主导入 ZIP 独立发布，Chart 单独发布业务接口与鉴权配置。流程文案变更只更新 Skill；接口契约变更时协调两层版本并刷新宿主工具清单。

## 接口约束

- 业务参数使用 `input` 对象，ID 使用字符串保留精度。
- MCP 校验接口声明的类型、必填项和字段，业务成功码为 `200`，错误保留服务端原因。
- 文件上传当前使用可访问 URL；Task ID 用于继续查询已有任务。
- 配置更新使用完整字段或集合，接口副作用由工具说明表达，Skill 在写入前核对。
- 当前后端的分页范围、并发保护与删除能力以实际接口为准，Skill 的核对步骤不改变后端语义。

详细方法与路径见 [接口映射](api-mapping.md)，宿主安装及版本迁移见 [MCP 说明](../mcp/README.md)。
