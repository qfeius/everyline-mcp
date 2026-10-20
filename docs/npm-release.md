# everyline-cli-mcp npm 发布

npm 包名为 `@qfeius/everyline-cli-mcp`，终端命令为 `everyline-cli-mcp`，两项 Skill 名称为 `everyline-review` 和 `everyline-review-config`。公共源固定为 `https://registry.npmjs.org/`。生成 `.tgz`、推送源码与发布 npm 是三个独立步骤，只有发布成功后才能通过包名安装。

当前源码仓库为 `git@git.qtech.cn:ai/everyline-cli-mcp.git`，GitLab 流水线负责测试和构建制品。npm 的 `repository.url` 指向发布镜像 `https://github.com/qfeius/everyline-cli-mcp`，以匹配 GitHub OIDC/provenance 的来源；homepage 和 issues 继续指向 GitLab。下述发布流程需要先配置对应的 GitHub 镜像仓库、远端和 npm Trusted Publisher；仓库迁入本身不执行 npm 发布。

## 一次性配置

1. 确认 npm 账号有 `@qfeius` 下此包的发布权限。首次发布前先检查组织权限和包名归属。
2. 在 npm 包 `@qfeius/everyline-cli-mcp` 的 Trusted Publisher 中绑定 GitHub 仓库 `qfeius/everyline-cli-mcp` 和工作流文件 `npm-publish.yml`。不配置长期 `NPM_TOKEN`。
3. 将相同源码和 `.github/workflows/npm-publish.yml` 同步到 GitHub 发布镜像。工作流先核对 `repository.url` 与实际 `GITHUB_REPOSITORY`，不匹配时在创建 Release 前停止；随后创建 Release 并通过 GitHub OIDC 发布 npm。使用 provenance 时发布镜像需为公开仓库。

Trusted Publishing 说明：[npm Trusted Publishers 文档](https://docs.npmjs.com/trusted-publishers/)。

## 发布步骤

1. 确定尚未发布的新版本。blue 和 release 共用 npm 包的全局递增版本序列，版本统一为纯 `x.y.z`，不添加 `-blue`、`-release`、`-beta` 等后缀或构建元数据；已发布版本不重复使用。
2. 执行 `make release-check`，确认当前源码可以构建和安装。
3. 创建并推送新版本标签，例如：

```bash
git tag v0.1.12
git push github HEAD
git push github v0.1.12
```

上例中的版本须替换为本次版本。`github` 为本仓库指向 GitHub 的远端名称。

标签只触发 `npm-publish.yml` 一条工作流和一个 `release` job：以 Tag 为版本来源，运行一次测试和安装校验，依次发布 GitHub 原生二进制制品、上传 npm 安装包和两项 Skill ZIP，并通过 OIDC 将同一个 `.tgz` 发布到 npm。blue 和 release 分支的 `publishConfig.tag` 均固定为 `latest`，环境由对应分支的包内容决定；后发布的版本更新同一个 `latest`。发布前置校验拒绝预发布后缀和构建元数据。

GitLab 流水线负责测试、构建和保存 `.tgz`。Node 打包作业通过 `EVERYLINE_TEST_BINARY` 使用 build 作业产出的本平台二进制运行安装回归；制品缺失直接失败。开发者直接运行 `npm test` 时，未指定该变量则仍由 Go 编译测试二进制。

两个流水线同时保存独立的 `everyline-mcp-skills-<MCP版本>.tgz` 及 `.sha256`。MCP Skill 版本由 `mcp/skills-manifest.json` 管理，CLI/npm 升版不会改变它；具体校验、打包和 Chart 升级步骤见 [MCP 说明](../mcp/README.md)。

## 安装与验证

发布完成后安装正式版：

```bash
npm install -g --foreground-scripts --allow-scripts=@qfeius/everyline-cli-mcp @qfeius/everyline-cli-mcp@latest --registry https://registry.npmjs.org
everyline-cli-mcp version --output json
```

`@latest` 指向两个分支中最后发布的版本；需要固定某次构建时，将它替换为明确的 `@<x.y.z>`。安装包内含六个平台的二进制，不需要再次从 GitHub 下载。

新包首次发布前，npm 尚无版本记录，按 `package.json` 中的当前版本生成本地包：

```bash
make release-assets
node scripts/pack-release.js dist
npm install -g --foreground-scripts --allow-scripts=@qfeius/everyline-cli-mcp "./dist/everyline-cli-mcp-<版本>.tgz"
```

npm 已有发布记录后，`make package` 比较 npm 全量已发布版本与本地版本，取最高基础版本后将补丁版本递增一位。例如 blue 已发布 `0.1.11`，即使 release 本地仍是 `0.1.8`，下一次打包也使用 `0.1.12`。历史预发布版本按其 `x.y.z` 基础版本参与比较，产物始终不带环境后缀。查询失败时停止选号，不退回分支各自累加。随后同步两项 Skill、重新构建六个平台的二进制并生成 `.tgz`；不会提交代码、创建 Git 标签或发布到 npm。文件名中的版本以实际产物为准。后续日常交付使用 `make package`；`npm pack` 用于首发、CI 已固定版本的发布和内部校验，不自动升版。两个 `*-skill.zip` 是 Skill 导入包，不替代 CLI 安装包。

`make package` 查询版本并不预留 npm 版本号；两个分支应依次打包发布。若并发工作选择了同一版本，后发布的一方重新执行 `make package` 选号，再提交对应版本和标签。

## 从旧包名迁移

从线上 `@qfeius/everyline-cli` 或历史 `everyline-cli` 迁移时，直接安装新包即可。安装器核对旧包名与 `everyline-cli → scripts/run.js` 入口后，将 Codex/WorkBuddy 的两项 Skill 链接切到新包，并迁出已确认来源的旧公共入口；迁移失败时恢复原链接。新旧终端命令名不同，这种迁移无需 `--force`，旧 CLI 配置目录也保留。新 CLI 默认使用独立的 `~/.everyline-cli-mcp`，使用前按新 Profile 完成授权；安装器不复制旧 Token。

仅当 `npm ls -g --depth=0` 确认已安装旧 npm 包 `everyline-cli-mcp` 时使用以下步骤。新用户直接安装 scoped 包，无需 `--force`。所有命令使用同一个 npm 全局目录；旧包使用自定义 prefix 时，每条命令均追加相同的 `--prefix`。

```bash
npm install -g --force --foreground-scripts --allow-scripts=@qfeius/everyline-cli-mcp @qfeius/everyline-cli-mcp@latest --registry https://registry.npmjs.org
everyline-cli-mcp --help
npm uninstall -g everyline-cli-mcp
npm rebuild -g --foreground-scripts --allow-scripts=@qfeius/everyline-cli-mcp @qfeius/everyline-cli-mcp
everyline-cli-mcp version --output json
```

第一步的 `--force` 仅用于接替旧包占用的同名命令。先确认新包安装和 Skill 迁移成功，再卸载旧包；卸载会移除同名命令入口，因此必须随后 rebuild 新包以恢复入口。保留原配置目录和凭据。任一步失败先处理该错误，不继续卸载或报告成功。尚未发布时，第一步的包名可替换为实际 `.tgz` 路径。

## 发布失败

- npm OIDC 认证失败：核对 Trusted Publisher 中的 GitHub 组织、仓库和工作流文件名是否分别为 `qfeius`、`everyline-cli-mcp` 和 `npm-publish.yml`。
- npm 403：核对 npm 组织权限、包发布权限及 Trusted Publisher 配置。
- 版本已存在：不要覆盖；核对已发布结果，需要变更时提升版本并创建新标签。
- GitHub Release 已生成但 npm 发布失败：npm 包尚未发布成功；解决错误后可安装 Release 中的 `.tgz`，再处理 npm 发布。不要仅凭 Release 存在宣称 npm 已可安装。

交付文件名统一为 `everyline-cli-mcp-<版本>.tgz`，包内名称仍为 `@qfeius/everyline-cli-mcp`。固定版本打包使用 `node scripts/pack-release.js dist`；该脚本将 npm 自动生成的 scoped 文件名重命名，GitHub、GitLab 与本地打包均使用同一入口。
