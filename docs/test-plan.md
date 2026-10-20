# 测试计划

## 自动化门禁

运行环境需要 Go 1.24+ 和 Node.js 18+，且 `go`、`node` 均在 `PATH` 中。`internal/config` 的授权状态并发测试会构建真实 CLI，并通过 Node 安装器验证跨进程文件锁及授权状态保留。

GitLab 复用 `release/cicd-base` 已有的内网镜像：`matrix-cn-beijing.cr.volces.com/cicd/ubuntu24:go-1.25` 和 `matrix-cn-beijing.cr.volces.com/cicd/ubuntu24:npm-22`，满足本项目 Go 1.24+、Node 18+ 的要求，Node 镜像也包含发布测试所需的 Git。

`prepare-node` 与 `package` 使用同一 Node 镜像，前者将 Node 可执行文件保存为临时制品；`test` 使用内网 Go 镜像，下载该制品并加入 `PATH`，不在测试前运行 apt 或下载 Debian 软件包。这两种共享镜像的构建定义均为 Linux amd64，Runner 应使用相同架构。`build` 不下载 Node 制品，`package` 仍只接收构建制品。修改 CI 配置后需用新提交创建流水线，重试旧流水线中的作业仍会使用旧配置。

### 2026-10-20 Runner 故障与上游对照

上游 `release` 为 `617a2cc47aa208cbc651412003b763afe4c55c41`，对应 [v1.1.1 发布运行](https://github.com/qfeius/everyline-cli/actions/runs/35189415126) 已成功。其 [GitHub 发布工作流](https://github.com/qfeius/everyline-cli/blob/617a2cc47aa208cbc651412003b763afe4c55c41/.github/workflows/npm-publish.yml) 使用 `ubuntu-latest`，先通过 `setup-go` 和 `setup-node` 配置 Go 与 Node 24，再执行 `make release-check`。这份成功记录对应 GitHub Actions，不代表当前 GitLab Kubernetes Runner 已具备相同环境。

上游 `.gitlab-ci.yml` 的测试作业仅声明 `golang:1.24`，而 `TestInstallerWaitsForAuthorizationState` 仍调用 Node。该测试与 `scripts/build-release-assets.sh` 在替换项目名后都与本项目逐字一致。迁移后的测试失败暴露了 Node 运行时缺失；增加 `prepare-node` 解决该依赖的传递后，仍遇到当前 Runner 到 Docker Hub 的冷启动问题。

已用 `git archive` 导出上述上游原始提交，在仅包含 Go 和系统工具的 `PATH` 下执行 `go test ./internal/config -run '^TestInstallerWaitsForAuthorizationState$' -count=1`，1.25 秒后在原文件第 116 行复现 `exec: "node": executable file not found in $PATH`。相同原始提交恢复 Node `v22.12.0` 后，同一测试在 1.075 秒通过。未修改上游工作区；临时检出及镜像探针均已清理。

本次 Pod 故障尚未执行脚本：事件记录 `node:22` 镜像约 410 MB，首次拉取耗时 5 分 54.624 秒，helper 镜像已缓存；Runner `config.template.toml` 的 `poll_timeout` 实际为 300 秒。临时 Pod 改用 `node:22-bookworm-slim` 后，首次拉取仍超过 5 分钟，因此已撤回本轮精简镜像尝试，未将其作为通过验证的修复。Runner 默认内网镜像 `matrix-cn-beijing.cr.volces.com/cicd/ubuntu24:npm-14` 实测 Node `v14.17.5`，低于本项目 Node 18 的最低要求。

随后一轮重试调度到另一节点 `10.26.42.11`，仍在 `node:22` 拉取阶段超时。继续核对共享仓库 `release/cicd-base` 的 `1039be637b3101b38efa0dab31cb38b5153d504a`：`jobs/build.yml` 的 `.go-1.25` 和 `.npm-22` 已使用上述内网镜像，故将本项目三个镜像引用同步到这些已有制品，不再把默认 Node 14 镜像当作唯一可用镜像。

同节点临时 Pod 验证：两种内网镜像均已缓存，调度后约 2 秒启动。实际运行版本为 Go `1.25.0`、Node `22.19.0`、npm `10.9.3`、Git `2.43.0`；复制出的 Node 可在 Go 容器正常执行。共享仓库当前 Dockerfile 中的 Go 下载版本为 `1.25.7`，与该节点缓存镜像不同，因此本次结果以实际运行版本为准。

以提交 `54724c12a3c5479280b8429c9e46d2803d933466` 的干净源码和本次 CI 配置，在该 Pod 内逐项执行 YAML 中的 `test`、`build`、`package` 脚本，结果如下：

- `go test -race ./...`、`go vet ./...`、`go mod verify`、`go mod tidy -diff` 全部通过，包含安装器与授权状态并发测试。
- macOS、Linux、Windows 的 amd64/arm64 六个平台构建及 SHA-256 校验全部通过。
- `npm test` 111 项通过，失败和跳过均为 0；版本同步、MCP Skill 制品、打包检查、本地安装及最终 npm 打包全部通过。
- CI 语义比较确认仅三个镜像引用变更，其余测试门禁与制品依赖保持原样。

此次验证覆盖实际镜像内的脚本执行，GitLab 作业调度及制品上传下载仍需新提交流水线验收。

共享 Runner 的启动等待由 `poll_timeout` 控制，延长作业 `timeout` 或跳过安装器测试不会解决镜像拉取问题。本次修复不调整共享 Runner 配置；相关原理见 [GitLab 官方排查说明](https://docs.gitlab.com/runner/executors/kubernetes/troubleshooting/#job-failed-system-failure-timed-out-waiting-for-pod-to-start)。

```bash
go test ./...
go vet ./...
go build ./cmd/everyline-cli-mcp
```

覆盖范围：

- Profile 原子落盘、默认选择和权限。
- Node 安装器等待 CLI 授权状态文件锁，更新版本时保留刚完成的授权结果和安装事件。
- user 默认身份的 Profile 可不配置 app-id；app 默认身份和 app 登录仍拒绝缺失 app-id。
- token 请求字段、`code=0`、过期时间与缓存脱敏。
- app 登录的 flag/env/Profile 凭证优先级、app-id 更新、secret 脱敏和失败不污染配置。
- app secret 的显式保存、本地复用、授权失败不落盘、Profile 隔离、Keychain 优先与文件回退、secret 不进入命令参数、并发写入和 `0700/0600` 权限。
- user OAuth metadata 读取、PKCE authorization URL、loopback callback、state/error 拒绝、token form exchange、浏览器打开失败降级、user token 缓存和 raw token 入口删除。
- token 生命周期：服务端 `expire`/`expires_in`、`issued_at`、未知过期 token、status 的 `expiresKnown` 和旧缓存兼容；在服务端契约未支持前不发送 refresh grant。
- HTTP method/path/query/header/body、普通接口 `code=200` 和结构化 APIError。
- `startReview` 请求固定携带 `usageReportContext.reportBusinessCode=everyLine_100_openApi_cli`，且 CLI 输入不能覆盖该值。
- 本地上传业务文件名扩展名、无扩展名路径、2 MiB 边界与 multipart 字段。
- 普通 V3 工作流的统一 deadline、上传、发起、多次轮询、详情顺序和失败阶段结果输出。
- CLI 严格 JSON 输入、dry-run、stdout/stderr 与退出码。
- 来源 hook：app/user 身份、三个业务模块、文件上传、JSON、GET 重试及多次轮询均重新探测；token 请求与纯本地命令不探测。
- 来源字段未知/非法降级、原业务取消、5 秒超时回收辅助进程及 Unix 签名子进程。
- 真实构建二进制到本机 HTTP 接收端的 Header 验证；不访问真实审查/计费接口。
- Trace：`traceparent` 格式、非零随机 ID、与 `X-Log-Id` 同值、覆盖旧值且不修改调用方 Header；GET 重试同 Trace/新 Span，独立请求及工作流轮询各用新 Trace。
- Trace 错误保留 `errors.Is/As`、API request ID 和原退出码；网络失败、退避取消可定位，写请求不因 Trace 自动重试；token 和本地校验不产生业务 Trace，verbose 不污染 stdout 或泄露凭据。

- 帮助输出中各命令业务 flags 的连续顺序、help flag 位置及 Global Flags 分区。

## 真实环境冒烟

只有提供测试 Profile 与凭证时才运行：

1. `auth login` 后确认输出不含 token。
2. 对小于等于 2 MiB 的 `.doc/.docx/.pdf` 各上传一次。
3. 使用测试清单发起审查，并以 2 秒间隔等待终态。
4. 确认 JSON stdout 可直接由 `jq` 解析，result 轮询 status 和 verbose 进度均只出现在 stderr。
