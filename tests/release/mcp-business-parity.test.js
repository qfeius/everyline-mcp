"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// 期望值摘自固定 release 提交，独立于 MCP 正文和 manifest；重新计算摘要不能掩盖业务规则丢失。
const baseline = require("./fixtures/release-business-baseline.json");
const review = readFileSync(join(__dirname, "../../mcp/skills/everyline-review/SKILL.md"), "utf8");
const configuration = readFileSync(join(__dirname, "../../mcp/skills/everyline-review/references/review-config.md"), "utf8");

/**
 * adapted 将冻结基线中的调用名称映射为 MCP 名称，并显式适配宿主图表执行与降级条件。
 * 入参：source string 为固定 release 的原文片段；返回值：string 为适配后的预期正文。
 * 保留独立基线和完整报告断言，只放行本次展示方式变更，统计、布局、链接与交互规则仍逐字核对。
 */
function adapted(source) {
  return source.replaceAll("CLI", "MCP")
    .replaceAll(
      "使用实时请求结构生成输入文件，调用已注册的 `checklist create --input ...`。",
      "按当前 Schema 生成完整 `data`，包含名称和最终 `reviewRuleIds`，调用已注册的 `create-review-checklist`。",
    )
    .replaceAll(
      "`checklist update --id ... --input ...` 一次提交最终状态",
      "`update-review-checklist`，传真实 `id` 与完整 `data`，一次提交最终状态",
    )
    .replaceAll(
      "只有实时帮助确认删除命令与显式确认参数可用时，执行单项 `checklist delete`。",
      "只有当前工具 Schema 与说明确认删除能力且本次用户确认已完成时，执行单项 `delete-review-checklist`，传真实 `id`。",
    )
    .replaceAll("实时帮助", "当前工具 Schema 与说明")
    .replaceAll("单项删除命令", "单项删除工具")
    .replaceAll("单项命令", "单项工具")
    .replaceAll("底层命令", "底层工具")
    .replaceAll("`rule create`", "`create-review-rule`")
    .replaceAll("`rule update`", "`update-review-rule`")
    .replaceAll("`rule group list`", "`list-review-rule-groups`")
    .replaceAll("`rule group create`", "`create-review-rule-group`")
    .replaceAll("`rule group update`", "`update-review-rule-group`")
    .replaceAll("`rule group delete`", "`delete-review-rule-group`")
    .replaceAll("`checklist list`", "`list-review-checklists`")
    .replaceAll(
      "`checklist list --profile <profile> --as <identity> --page-index 1 --page-size 100 --output json`",
      '`list-review-checklists`，参数 `{"pageIndex":1,"pageSize":100}`',
    )
    .replaceAll(
      "使用纯静态 HTML/SVG 渲染两个图表（不依赖脚本动态创建节点、不生成图片文件）",
      "按下述宿主能力实际展示两个图表",
    )
    .replaceAll(
      "  - 渲染方式：使用纯静态 HTML/SVG，所有图形元素（弧线、圆、矩形、文字）直接以静态标签写出，不依赖脚本动态创建 SVG 节点、不生成图片文件；避免部分宿主环境脚本执行失败导致图表缺失或布局错乱。",
      "  - 渲染方式：先发现当前宿主的工具与可视化技能（含可按需加载的能力，不只检查 EveryLine MCP 工具），再依次执行：①有可内嵌结果的原生图表能力时实际调用；②原生路径缺失或失败时，继续检查程序绘图与图片展示能力，使用确定性绘图库生成 PNG 并嵌入回复；③只有两条路径各自已确认缺少必要能力，或实际尝试并修复后仍失败时，才按下文降级。原生图表失败不跳过 PNG；没有专用图表工具、普通对话不执行 HTML/SVG，均不构成直接降级理由。统计图不使用 AI 生图。\n"
      + "  - 豆包执行：在“本地电脑”或代码执行环境中，已有 shell/Python/Node 能力（包括已用脚本统计风险）时，原生路径未完成展示就继续执行 PNG 路径。实际检查可用运行时、绘图库和中文字体；例如 Python 可检查 `matplotlib`，选择已安装的中文字体生成上下竖排图表，保存到本次任务产物目录。库缺失时优先复用宿主预置绘图环境；宿主允许安装依赖时，在任务目录的隔离环境补齐，不改全局运行时。根据真实报错修复依赖、字体、输出路径或图片引用后重试一次；同一路径仍失败时保留原因，不无限重试。仅看到 Python 可用不代表绘图库已安装，也不凭空假定某个库缺失。\n"
      + "  - 图片交付：按宿主实际支持的本地图片、附件或原生展示协议取得有效图片引用；豆包若需先登记或上传产物，使用当前已提供且支持 PNG 的宿主工具（如真实 Schema 支持时的 `FileBatchUpload`），核对返回类型和图片引用。宿主支持 Markdown 图片时，在模板图表位置使用 `![风险等级分布](<本次真实图片引用>)`、`![风险类别分布](<本次真实图片引用>)`，也可嵌入一张包含上下两图的 PNG；不使用普通下载链接替代图片，不将 Codex 路径或沙箱 URI 规则直接套给豆包。\n"
      + "  - 展示核对：绘图只传入已核对的等级/类别名称与汇总数量，不传合同正文、条款原文或详情签名链接，也不上传至额外图床。使用真实返回且当前宿主支持的图片引用，不编造 URL；Codex 本地图片使用绝对路径，其他宿主使用其实际支持的图片或附件引用。生成后检查文件有效、中文字体、数字和布局，并在最终回复中实际嵌入；仅生成文件、提供下载链接或工具返回成功不等于完成交付。可用预览工具时检查图像；缺少预览工具、尚未发送最终回复或尚未取得用户反馈，不等于宿主缺少图片展示能力，不因此提前降级。最终回复不输出 `<div>`/`<svg>` 源码、HTML/SVG 代码块或绘图脚本。",
    )
    .replaceAll(
      "- 图表数据与文字统计必须一致；宿主不支持纯静态 HTML/SVG 渲染时，降级为两段结构化文字（等级分布、类别分布），并在概览“说明”行标注“图表已降级为文字展示”，不生成图片代替。",
      "- 图表数据与文字统计必须一致；降级前分别核对原生图表和 PNG 路径的能力检查或实际失败记录，两条路径均未能完成时才输出等级分布、类别分布两段结构化文字，并在概览“说明”行标注“图表已降级为文字展示（<具体缺项或失败原因>）”。未检查或未尝试的可用路径不算失败；成功展示时省略降级说明，零风险或结果不完整按既有规则隐藏图表，不标记为图表降级。原始错误和执行记录留在工具轨迹中，不加入报告。",
    )
    .replaceAll(
      "<!-- 风险可视化：在此处直接渲染上下竖排两个图表（风险等级分布环形图在上、风险类别分布条形图在下），风险项总数为0时隐藏图表；此注释行不输出 -->",
      "<!-- 风险可视化：在此处嵌入宿主原生图表或 PNG 图片，上下竖排展示风险等级分布环形图和风险类别分布条形图；两条路径均经检查或尝试仍未完成时输出两段分布文字，风险项总数为0时隐藏图表；此注释行不输出 -->",
    );
}

/**
 * assertRetained 逐段核对上游业务要求，只显式适配单入口后的配置流程称谓和引用路径。
 * 入参：actual string 为 MCP 正文，sections object 为原版命名片段；返回值：void，缺段时断言失败。
 */
function assertRetained(actual, sections) {
  for (const [name, original] of Object.entries(sections)) {
    const source = sections === baseline.configuration
      ? original.replaceAll("本 Skill", "本配置流程").replaceAll("本配置流程 ", "本配置流程")
        .replaceAll("该步骤属于 `everyline-review`", "该步骤属于入口的[合同审查流程](../SKILL.md#review)")
        .replaceAll("转回 `everyline-review`", "转回入口的[合同审查流程](../SKILL.md#review)")
      : original;
    for (const paragraph of adapted(source).split("\n\n")) {
      assert.ok(actual.includes(paragraph), `release ${baseline.commit} 业务规则遗漏：${name}`);
    }
  }
}

/** 验证原版选择、主体映射和完整报告留存；无入参，返回 void，业务要求缩减时失败。 */
test("审查 Skill 保留 release 的交互、风险口径、完整模板和图表统计布局", () => {
  assertRetained(review, baseline.review);
});

/** 验证原版配置约束和影响核对留存；无入参，返回 void，业务要求缩减时失败。 */
test("配置参考流程保留 release 的字段约束、单项操作和级联核对流程", () => {
  assertRetained(configuration, baseline.configuration);
});

/** 验证完整报告整体连续保留；无入参，返回 void，模板、链接和图表任一段缺失或乱序时失败。 */
test("报告全文除 MCP 调用及宿主图表展示适配外与固定 release 基线一致", () => {
  assert.ok(review.includes(adapted(baseline.review.report)));
});

/** 验证新增原始文件会话遵循 prepare、HTTP 上传、commit 顺序；无入参，成功返回 void。 */
test("原始文件上传保持会话顺序、归属和最终文件标识，兼容 URL 上传", () => {
  const session = review.split("#### 上传会话：prepare → 二进制上传 → commit")[1].split("#### 完整 URL")[0];
  assert.ok(session.indexOf("`upload-file-session-prepare`") < session.indexOf("`multipart/form-data`"));
  assert.ok(session.indexOf("`multipart/form-data`") < session.indexOf("`upload-file-session-commit`"));
  for (const requirement of ["同一", "用户和租户", "businessId/fileId/fileHash", "不拿 `upload_id` 当 `fileId`", "OAuth Token", "上传结果不明", "后端保存会话元数据和上传结果", "不保存原文件字节和 OAuth Token", "`upload_headers` 为空对象", "`upload_headers` 为空，不添加任何授权头", "不自行添加 `Authorization`", "日志或聊天回复", "/open-apis/contract-review/v3/mcp/files/upload_sessions/**"]) {
    assert.ok(session.includes(requirement), `上传会话约束遗漏：${requirement}`);
  }
  assert.ok(review.includes("everyLine_100_openApi_mcp"));
  assert.ok(review.includes("调用 `upload-contract-file-by-url`"));
});

/** 验证附件选路与用户直接提供的外链分流；无入参，返回 void。 */
test("聊天附件与本地文件必须使用三段上传，附件 URL 不走 URL 工具", () => {
  const attachments = review.split("#### 聊天附件与宿主差异")[1].split("#### 本地文件")[0];
  assert.ok(attachments.includes("聊天附件和本地文件统一走下述上传会话"));
  assert.ok(attachments.includes("不为传输合同调用 `FileBatchUpload`"));
  assert.ok(attachments.includes("不自动退回 URL 上传"));
  assert.ok(attachments.includes("已存在的附件下载 URL"));
  const externalUrl = review.split("#### 完整 URL")[1].split("### 提取并匹配主体")[0];
  assert.ok(externalUrl.includes("仅当用户直接提供外部完整下载 URL"));
  assert.ok(externalUrl.includes("不是宿主为聊天附件提供的引用"));
});

/** 验证长结果先保存真实链接、核对全部卡片，链接缺失时保留任务成功事实；无入参，返回 void。 */
test("结果交付先保存签名链接，成功缺链接不误报任务未完成", () => {
  const linkRules = review.split("### 详情链接优先交付")[1]?.split('<a id="review-output">')[0];
  assert.ok(linkRules, "缺少链接优先交付约束");
  for (const requirement of ["reviewDetailUrl", "data.url", "先保存完整链接，再统计风险", "ruleResultCount", "相同任务和业务上下文", "最多补查一次", "审查已成功，详情链接获取异常", "待任务全部完成", "不重新上传或发起审查"]) {
    assert.ok(linkRules.includes(requirement), `链接交付约束遗漏：${requirement}`);
  }
  for (const requirement of ["simplifyReviewResult=true", "响应进入网关前精简", "保留全部", "主体风险标记", "response_payload_too_large", "停止重复获取", "不推断为点数不足"]) {
    assert.ok(linkRules.includes(requirement), `大结果处理约束遗漏：${requirement}`);
  }
});

/** 验证唯一入口按需加载配置参考且不依赖旧读取工具；无入参，返回 void。 */
test("唯一 Skill 入口直接调用业务工具并路由到包内配置流程", () => {
  for (const skill of [review, configuration]) {
    assert.doesNotMatch(skill, /read-review-(?:config-)?skill/);
    assert.match(skill, /everyline-cli-mcp-test/);
    assert.match(skill, /everyline-cli-mcp-blue/);
  }
  assert.match(review, /宿主直接加载本 Skill/);
  assert.match(review, /\[审查配置流程\]\(references\/review-config\.md\)/);
  assert.doesNotMatch(review, /everyline-review-config/);
  assert.match(configuration, /\.\.\/SKILL\.md#review/);
  assert.match(review, /blue 授权登录/);
});
