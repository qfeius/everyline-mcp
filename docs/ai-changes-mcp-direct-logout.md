# MCP 直接退出登录

## 2026-10-22

- 变更摘要：增加 `auth-logout`，用户明确要求退出时以 `{}` 调用，退出当前连接的访问和刷新授权。
- 涉及工程：本仓库 Skill 2.3.0；`test-contract-charts/everyline-cli-mcp-test` Chart 0.8.0 / MCP 2.3.0；组织服务工作区 `../common-organization-v2-mcp-logout`，分支 `codex/everyline-mcp-logout`，基于测试配置中的 `9fc4724b301a6f67f37ffd944ad0ca49ef437ce1`。
- 请求链路：MCP → `https://test-open.qtech.cn/api/oauth/public/oauth/logout/contract-review` → 既有 `org-public` 路由 → 组织服务 `POST /api/public/oauth/logout/contract-review`。
- 凭证与范围：只透传当前 Bearer，无账号、租户或 Token 参数；新授权的访问令牌和刷新记录绑定同一 family，撤销后验真与刷新均拒绝该授权，其他独立授权保持有效。
- 兼容策略：旧授权返回 `409 reauthorization_required`，需重新连接一次；不以单独清除 access token 代替完整退出。
- Skill 行为：仅明确退出或切换账号时调用；只在 `code=200` 且 `data.authenticated=false` 后报告成功，退出后停止业务调用、轮询与自动重连。
- 共享路径影响：新签发的公共客户端授权码及 Device 授权使用同族验真，覆盖该 OAuth 栈的业务；旧授权、普通网页登录、PAT 和机密客户端维持原行为。现有 refresh revoke 与重放撤销也会使新授权的同族访问令牌失效。
- 发布顺序：升级期间暂停 OAuth 令牌签发和刷新，等全部组织服务副本升级后恢复，再部署完整 Chart 并刷新宿主工具；无数据库迁移。混跑期间已签发或刷新过的连接须在升级后重新授权。
- 回滚限制：可以停用退出工具并保留 family 验真；回退共享验真逻辑前须清理全部关联授权的访问令牌，否则先前已撤销的令牌可能恢复有效。单独暂停 MCP 入口不足以覆盖其他业务访问路径。
- 本地验证：Skill 发布与业务基线 13 项测试通过并生成 2.3.0 制品；Chart lint、官方配置校验及 `scripts/mcp-validator` 全量测试通过。后端 OAuth/JWT/授权族测试、race 与相关包 vet 通过；stateful_login 整包测试初始化依赖 Nacos，本次以生产文件加新本地测试验证共享验真路径。后端验证记录见其 `docs/ai-changes-mcp-direct-logout.md`。
- 状态：本地实现，未提交、未部署，未对真实用户执行退出；真实宿主退出、刷新拒绝和双账号隔离按 `docs/test-plan.md` 的 2.3.0 场景在部署后验收。
