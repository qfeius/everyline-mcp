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
 * adapted 将冻结基线中的调用名称映射为 MCP 名称，不改动业务要求、报告或交互规则。
 * 入参：source string 为固定 release 的原文片段；返回值：string 为只替换调用词的预期正文。
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
test("审查 Skill 保留 release 的交互、风险口径、完整模板和静态图表规范", () => {
  assertRetained(review, baseline.review);
});

/** 验证原版配置约束和影响核对留存；无入参，返回 void，业务要求缩减时失败。 */
test("配置 Skill 保留 release 的字段约束、单项操作和级联核对流程", () => {
  assertRetained(configuration, baseline.configuration);
});

/** 验证完整报告整体连续保留；无入参，返回 void，模板、链接和图表任一段缺失或乱序时失败。 */
test("报告全文除 CLI 名称外与固定 release 基线一致", () => {
  assert.ok(review.includes(adapted(baseline.review.report)));
});
