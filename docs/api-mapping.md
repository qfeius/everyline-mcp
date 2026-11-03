# MCP 接口映射

test MCP 工具由 `test-contract-charts/everyline-cli-mcp-test/files/mcp-config.yaml` 定义。宿主分别加载 `everyline-review` 或 `everyline-review-config` Skill，再调用下表的业务工具；OAuth 由连接器负责。

| MCP 工具 | 方法 | 路径 |
| --- | --- | --- |
| `upload-file-session-prepare` | `POST` | `/open-apis/contract-review/v3/mcp/files/upload_sessions/prepare` |
| 宿主 multipart 上传（普通 HTTP） | `POST` | `/open-apis/contract-review/v3/mcp/files/upload_sessions/{upload_id}/content` |
| `upload-file-session-commit` | `POST` | `/open-apis/contract-review/v3/mcp/files/upload_sessions/commit` |
| `upload-contract-file-by-url` | `POST` | `/open-apis/contract-review/v3/file/contract/uploadByUrl` |
| `extract-contract-subjects` | `POST` | `/open-apis/contract-review/v3/smartAudit/contract/subjects` |
| `start-review-task` | `POST` | `/open-apis/contract-review/v3/smartAudit/task/startReview` |
| `get-review-task-status` | `GET` | `/open-apis/contract-review/v3/smartAudit/task/status` |
| `get-review-task-info` | `GET` | `/open-apis/contract-review/v3/smartAudit/task/info` |
| `create-review-checklist` | `POST` | `/open-apis/review-rules/review-checklists` |
| `batch-create-review-checklists` | `POST` | `/open-apis/review-rules/review-checklists/batch` |
| `list-review-checklists` | `GET` | `/open-apis/review-rules/review-checklists` |
| `update-review-checklist` | `PUT` | `/open-apis/review-rules/review-checklists/{id}` |
| `batch-update-review-checklists` | `PUT` | `/open-apis/review-rules/review-checklists/batch` |
| `delete-review-checklist` | `DELETE` | `/open-apis/review-rules/review-checklists/{id}` |
| `batch-delete-review-checklists` | `DELETE` | `/open-apis/review-rules/review-checklists/batch` |
| `create-review-rule-group` | `POST` | `/open-apis/review-rules/review-rule-groups` |
| `list-review-rule-groups` | `GET` | `/open-apis/review-rules/review-rule-groups` |
| `update-review-rule-group` | `PUT` | `/open-apis/review-rules/review-rule-groups/{id}` |
| `delete-review-rule-group` | `DELETE` | `/open-apis/review-rules/review-rule-groups/{id}` |
| `create-review-rule` | `POST` | `/open-apis/review-rules/review-rule-groups/{groupId}/rules` |
| `batch-create-review-rules` | `POST` | `/open-apis/review-rules/review-rule-groups/{groupId}/rules/batch` |
| `list-review-rules` | `GET` | `/open-apis/review-rules/review-rule-groups/{groupId}/rules` |
| `update-review-rule` | `PUT` | `/open-apis/review-rules/review-rule-groups/{groupId}/rules/{ruleId}` |
| `batch-update-review-rules` | `PUT` | `/open-apis/review-rules/review-rule-groups/{groupId}/rules/batch` |
| `delete-review-rule` | `DELETE` | `/open-apis/review-rules/review-rule-groups/{groupId}/rules/{ruleId}` |
| `batch-delete-review-rules` | `DELETE` | `/open-apis/review-rules/review-rule-groups/{groupId}/rules/batch` |

## 参数与结果

MCP 3.1.0 新增本地原始文件上传会话。prepare 只接收 `file_name`，返回随机 `upload_id`、本环境开平下的 `upload_url`、POST 方法、空 `upload_headers`、固定 30 分钟有效期和环境大小上限。宿主向该地址以 multipart 字段 `file` 上传原始二进制，不自行添加 `Authorization`。上传地址本身具有凭据性质。content 使用表中完整开平路径，是普通 HTTP 端点，不作为 JSON MCP 工具，成功返回 `code=200`、`data=true`。

三条上传接口在 EveryLine 后端直接注册完整 `/open-apis/contract-review/v3/mcp/files/upload_sessions/**` 路径，开放平台优先匹配三条 POST 并按原路径转发；旧 `/open-api/v3/mcp/files/upload_sessions/**` 端点移除。MCP 继续使用 test/blue 各自的开平域名，公共上传基础地址不变。须配套发布后端和开放平台路由，再更新 MCP/Skill；其余 URL 上传及审查接口继续使用原有转发规则。

content 直接复用原 `SmartAuditFileUploadService` 完成文件保存，返回值暂存到会话；commit 以同一用户/租户接收 `upload_id`，核对归属并返回真实 `businessId/fileId/fileHash`。Redis 仅保存会话元数据及结果，不保存原文件字节或 OAuth Token。重复完成的 content/commit 复用原结果；未上传、过期、归属不符或前次结果未知时失败，停止自动重复创建文件。

Skill 3.1.1 对聊天附件和本地文件使用上述会话；若宿主仅暴露已经存在的附件下载 URL，由宿主读取原文件后再执行会话。只有用户主动提供外部下载 URL 时使用原 URL 上传工具。缺少文件读取或 multipart 发送能力时停止，不自动切换上传路径。

先完成后端实例切换，并设置 `contract_platform.mcp_upload_base_url` 为本环境开平 V3 公共地址；开放平台和 AI 后端仅对限时 content 路径放行，prepare/commit 继续认证。新旧实例混跑时，旧实例仍要求旧上传 Header，新实例创建的会话可能上传失败；回滚旧实例前须完成或舍弃新会话并重新 prepare。再部署 test/blue Chart 0.10.1、MCP 3.1.0 / Skill 3.1.2 并刷新工具清单，共 27 项。原 MCP 上游、URL 上传、审查和配置接口保持既有调用链，无新增业务数据库字段或独立上传适配服务。

MCP 2.0.0 的业务参数直接放在 arguments 顶层，例如上传传 `{"fileUrl":"https://example.com/contract.pdf","name":"contract.pdf"}`，无筛选查询使用 `{}`。Higress 按顶层 `args` 逐项展示参数名称与注释；`config`、`data` 和数组保留各自的业务结构及子字段说明。文件、任务、清单、分组和规则 ID 按字符串传递。入口在 SDK 转换和筛选前拒绝未声明字段、类型错误及旧 `input` 包装，模板继续校验必填项和业务组合约束。

上传接收 `fileUrl` 与 `name`，返回后续审查所需的 `businessId`、`fileId`、`fileHash`。发起任务使用这些标识与 `config`；`config` 包含主体名称、角色、`reviewStrength=0/1/2`，以及非空自定义清单 ID 或 `matchContractTypeRulePackage=true`，两种规则来源支持组合。MCP 请求映射固定注入 `usageReportContext.reportBusinessCode=everyLine_100_openApi_mcp`；全部 MCP 业务请求固定设置 `X-Qfei-Channel-Type: mcp`，来源由开放平台补齐，功能由审查后端确定；CLI 使用独立的 `everyLine_100_openApi_cli` 业务编码。

状态和详情查询使用 `taskId`；选择 `visibilityScope=contractResult` 时还需 `businessId`。状态每次查询一次，任务成功后是否调用详情由 Skill 安排。

配置单项创建/更新使用 `data`，批量创建/更新使用非空 `items`，批量更新每项带 `id`；批量删除使用无重复的非空 `ids`。清单创建/更新需要 `name` 和完整 `reviewRuleIds`，接口同时写入默认启用状态、阶段与分类。规则需要 `name`、`riskLevel`、`content`，可附 `riskTips`。详细约束以实际工具 Schema 为准。

业务成功码为 `200`。业务成功、任务完成、结果明细完整分别核对；MCP 返回单次接口数据，分页、轮询、续办与汇总由宿主 Skill 执行。

MCP 3.1.1 的 `get-review-task-info` 固定追加 `simplifyReviewResult=true`，由后端在响应进入 Higress 缓冲区前投影报告字段，不增加宿主工具参数。先发布支持该参数的后端，再发布 MCP Chart；未传该参数的 OpenAPI/CLI 保持原详情格式。报告视图：首字段 `reviewDetailUrl` 为后端完整 HTTP/HTTPS 签名链接，业务 `data.url` 保留相同原值；不重拼 query。`reviewDetailUrlStatus` 为 `available`（已有链接）、`missing`（详情明确成功但缺链接）、`pending`（详情明确仍在运行）或 `unknown`（详情没有可确认状态且缺链接），原因放在 `reviewDetailUrlMessage`；详情未返回状态时，Skill 沿用先前状态查询的结论。

视图保留全部风险卡片、主体风险标记、名称、等级、风险说明、修改理由、建议和审查选择；省略重复 `result`、合同原文、坐标与完整规则快照。`data.ruleResultCount` 为原数组长度（含主体风险卡片），供宿主核对完整性，不代替风险总数；缺失、null 或异常明细保留原状，不补为空数组。Skill 先保存链接再统计风险；已确认成功但缺链接时，仅以同一任务和业务上下文补查一次，仍缺失则明确报告链接获取异常，不解释为等待任务完成。

退出与切换账号不映射 MCP 工具或 HTTP 退出接口。宿主管理当前连接器的旧授权，切换账号再重新发起 OAuth；是否撤销后端令牌以宿主实际能力与返回结果为准。
