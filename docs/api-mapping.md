# MCP 接口映射

MCP 业务工具由 `dev-contract-charts/everyline-cli-mcp/files/mcp-config.yaml` 定义，直接请求现有 EveryLine API。业务基址由 Chart 配置；每项工具只调用下表对应接口。OAuth 由连接器负责。

| MCP 工具 | 方法 | 路径 |
| --- | --- | --- |
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

所有参数放在 `input` 对象内，无筛选查询使用 `{"input":{}}`。文件、任务、清单、分组和规则 ID 按字符串传递。MCP 校验必填项、类型、已声明字段及组合约束，返回业务结果与错误原因。

上传接收 `fileUrl` 与 `name`，返回后续审查所需的 `businessId`、`fileId`、`fileHash`。发起任务使用这些标识与 `config`；`config` 包含主体名称、角色、`reviewStrength=0/1/2`，以及非空自定义清单 ID 或 `matchContractTypeRulePackage=true`，两种规则来源支持组合。用量字段沿用既有后端计量值 `everyLine_100_openApi_cli`，由请求映射固定注入；该字段名称是后端契约，不表示运行 CLI。

状态和详情查询使用 `taskId`；选择 `visibilityScope=contractResult` 时还需 `businessId`。状态每次查询一次，任务成功后是否调用详情由 Skill 安排。

配置单项创建/更新使用 `data`，批量创建/更新使用非空 `items`，批量更新每项带 `id`；批量删除使用无重复的非空 `ids`。清单创建/更新需要 `name` 和完整 `reviewRuleIds`，接口同时写入默认启用状态、阶段与分类。规则需要 `name`、`riskLevel`、`content`，可附 `riskTips`。详细约束以实际工具 Schema 为准。

业务成功码为 `200`。业务成功、任务完成、结果明细完整分别核对；MCP 返回单次接口数据，分页、轮询、续办与汇总由宿主 Skill 执行。
