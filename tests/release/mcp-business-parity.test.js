"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// 期望值摘自固定 release 提交，独立于 MCP 正文和 manifest；重新计算摘要不能掩盖业务规则丢失。
const baseline = require("./fixtures/release-business-baseline.json");
const review = readFileSync(join(__dirname, "../../mcp/skills/everyline-review/SKILL.md"), "utf8");
const configuration = readFileSync(join(__dirname, "../../mcp/skills/everyline-review-config/SKILL.md"), "utf8");

/**
 * adapted 将冻结基线中的调用名称映射为 MCP 名称，并显式适配宿主图表展示路径。
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
      "  - 渲染方式：先核对当前工具与宿主展示能力，再依次选择：①有原生图表或可视化工具且其结果可在回复中展示时，调用该工具；②否则，有程序绘图和图片展示能力时，使用确定性绘图库生成 PNG，并通过宿主支持的图片或附件展示方式嵌入回复；③两种路径均不可用或未成功展示时，按下文降级为文字。统计图不使用 AI 生图，不假定普通对话会执行 HTML/SVG。\n"
      + "  - 展示核对：绘图只传入已核对的等级/类别名称与汇总数量，不传合同正文、条款原文或详情签名链接，也不上传至额外图床。使用真实返回且当前宿主支持的图片引用，不编造 URL；Codex 本地图片使用绝对路径，其他宿主使用其实际支持的图片或附件引用。仅生成文件、提供下载链接或工具返回成功不等于完成图表展示；核对生成图表的中文、数字和布局，并在回复中实际嵌入。最终回复不输出 `<div>`/`<svg>` 源码、HTML/SVG 代码块或绘图脚本。",
    )
    .replaceAll(
      "- 图表数据与文字统计必须一致；宿主不支持纯静态 HTML/SVG 渲染时，降级为两段结构化文字（等级分布、类别分布），并在概览“说明”行标注“图表已降级为文字展示”，不生成图片代替。",
      "- 图表数据与文字统计必须一致；原生图表和 PNG 两条路径均缺少生成或展示能力，或渲染失败时，降级为两段结构化文字（等级分布、类别分布），并在概览“说明”行标注“图表已降级为文字展示”；不以源码或下载链接冒充图表。",
    )
    .replaceAll(
      "<!-- 风险可视化：在此处直接渲染上下竖排两个图表（风险等级分布环形图在上、风险类别分布条形图在下），风险项总数为0时隐藏图表；此注释行不输出 -->",
      "<!-- 风险可视化：在此处嵌入宿主原生图表或 PNG 图片，上下竖排展示风险等级分布环形图和风险类别分布条形图；展示能力缺失或渲染失败时输出两段分布文字，风险项总数为0时隐藏图表；此注释行不输出 -->",
    );
}

/**
 * assertRetained 逐段核对上游业务要求，新增 MCP 说明可以插入，原版规则不得遗漏。
 * 入参：actual string 为 MCP 正文，sections object 为原版命名片段；返回值：void，缺段时断言失败。
 */
function assertRetained(actual, sections) {
  for (const [name, original] of Object.entries(sections)) {
    for (const paragraph of adapted(original).split("\n\n")) {
      assert.ok(actual.includes(paragraph), `release ${baseline.commit} 业务规则遗漏：${name}`);
    }
  }
}

/** 验证原版选择、主体映射和完整报告留存；无入参，返回 void，业务要求缩减时失败。 */
test("审查 Skill 保留 release 的交互、风险口径、完整模板和图表统计布局", () => {
  assertRetained(review, baseline.review);
});

/** 验证原版配置约束和影响核对留存；无入参，返回 void，业务要求缩减时失败。 */
test("配置 Skill 保留 release 的字段约束、单项操作和级联核对流程", () => {
  assertRetained(configuration, baseline.configuration);
});

/** 验证完整报告整体连续保留；无入参，返回 void，模板、链接和图表任一段缺失或乱序时失败。 */
test("报告全文除 MCP 调用及宿主图表展示适配外与固定 release 基线一致", () => {
  assert.ok(review.includes(adapted(baseline.review.report)));
});
