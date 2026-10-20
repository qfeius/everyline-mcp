"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } = require("node:fs");
const { join, basename } = require("node:path");
const { tmpdir } = require("node:os");
const { checkMCPRelease, updateMCPRelease, syncMCPSkills, packageMCPRelease } = require("../../scripts/sync-mcp-skills");

/**
 * fixture 在隔离目录复制 MCP 源文件与独立脚本，保证测试不会修改真实 Skill 或 Chart。
 * 入参：t TestContext 为清理上下文。
 * 返回值：string 为临时根目录，测试结束自动清理。
 */
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "everyline-mcp-release-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(__dirname, "../../.gitattributes"), join(root, ".gitattributes"));
  cpSync(join(__dirname, "../../mcp"), join(root, "mcp"), { recursive: true });
  mkdirSync(join(root, "scripts"));
  cpSync(join(__dirname, "../../scripts/sync-mcp-skills.js"), join(root, "scripts/sync-mcp-skills.js"));
  return root;
}

/** 校验真实源发布入口；无入参，返回 void，源清单失配时失败。 */
test("当前 MCP 发布清单与两项源 Skill 一致", () => {
  assert.equal(checkMCPRelease().manifest.skills.length, 2);
});

/**
 * 验证 Git 自动换行检出仍保留发布字节，避免 Windows 开发者无修改也触发摘要失败。
 * 入参：t TestContext 管理隔离 Git 目录；返回值：void，检出后正文或清单变化时失败。
 */
test("core.autocrlf=true 检出后 MCP 正文和清单保持 LF，仍可校验与同步", (t) => {
  const root = fixture(t);
  const release = checkMCPRelease(root);
  const paths = ["mcp/skills-manifest.json", ...release.manifest.skills.map(({ name }) => `mcp/skills/${name}/SKILL.md`)];
  const originals = paths.map((path) => readFileSync(join(root, path)));
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["-c", "core.autocrlf=false", "add", "-f", "."], { cwd: root });
  // 删除工作区副本后从索引真实检出，不靠字符串替换模拟 Git 的属性处理。
  for (const path of paths) rmSync(join(root, path));
  execFileSync("git", ["-c", "core.autocrlf=true", "checkout-index", "--all", "--force"], { cwd: root });
  paths.forEach((path, index) => assert.deepEqual(readFileSync(join(root, path)), originals[index]));
  assert.deepEqual(checkMCPRelease(root).manifest, release.manifest);
  const chart = join(root, "chart");
  mkdirSync(chart);
  writeFileSync(join(chart, "Chart.yaml"), "name: everyline-cli-mcp\n");
  syncMCPSkills(chart, false, root);
  syncMCPSkills(chart, true, root);
});

/** 验证独立升版及失败前置校验；入参 t TestContext 管理隔离目录，返回 void。 */
test("MCP 独立升版保留正文与 CLI 版本，错误输入不留下部分更新", (t) => {
  const root = fixture(t);
  const first = join(root, "mcp/skills/everyline-review/SKILL.md");
  const second = join(root, "mcp/skills/everyline-review-config/SKILL.md");
  const original = readFileSync(first, "utf8");
  writeFileSync(join(root, "package.json"), '{"version":"9.0.0"}\n');
  updateMCPRelease("1.2.3", root);
  assert.equal(checkMCPRelease(root).manifest.version, "1.2.3");
  assert.equal(readFileSync(join(root, "package.json"), "utf8"), '{"version":"9.0.0"}\n');
  assert.equal(readFileSync(first, "utf8").split("\n---\n")[1], original.split("\n---\n")[1]);
  const before = readFileSync(first, "utf8");
  const manifest = readFileSync(join(root, "mcp/skills-manifest.json"), "utf8");
  assert.throws(() => updateMCPRelease("../invalid", root), /无效 MCP/);
  writeFileSync(second, readFileSync(second, "utf8").replace("name: everyline-review-config", "name: another-skill"));
  assert.throws(() => updateMCPRelease("1.2.4", root), /frontmatter/);
  assert.equal(readFileSync(first, "utf8"), before);
  assert.equal(readFileSync(join(root, "mcp/skills-manifest.json"), "utf8"), manifest);
});

/** 验证未登记变更会阻止制品生成；入参 t TestContext 管理隔离目录，返回 void。 */
test("源正文或版本漂移时校验失败，阻止打包和覆盖 Chart", (t) => {
  const root = fixture(t);
  const source = join(root, "mcp/skills/everyline-review/SKILL.md");
  const original = readFileSync(source, "utf8");
  writeFileSync(source, `${original}\n未登记的修改\n`);
  assert.throws(() => checkMCPRelease(root), /摘要未同步/);
  assert.throws(() => packageMCPRelease(join(root, "dist"), root), /摘要未同步/);
  assert.throws(() => syncMCPSkills(join(root, "not-a-chart"), false, root), /摘要未同步/);
  writeFileSync(source, original.replace(/  version: "[^"]+"/, '  version: "9.9.9"'));
  assert.throws(() => checkMCPRelease(root), /版本未同步/);
});

/** 验证同步与只读检查边界；入参 t TestContext 管理隔离 Chart，返回 void。 */
test("Chart 同步携带来源清单，并检测正文和清单漂移", (t) => {
  const root = fixture(t);
  const chart = join(root, "chart");
  mkdirSync(chart);
  writeFileSync(join(chart, "Chart.yaml"), "name: everyline-cli-mcp\n");
  syncMCPSkills(chart, false, root);
  syncMCPSkills(chart, true, root);
  const published = join(chart, "files/skills/everyline-review.md");
  writeFileSync(published, "old skill");
  assert.throws(() => syncMCPSkills(chart, true, root), /发布副本未同步/);
  assert.equal(readFileSync(published, "utf8"), "old skill");
  syncMCPSkills(chart, false, root);
  writeFileSync(join(chart, "files/skills/manifest.json"), "{}\n");
  assert.throws(() => syncMCPSkills(chart, true, root), /发布副本未同步/);
  writeFileSync(join(chart, "Chart.yaml"), "name: another-chart\n");
  assert.throws(() => syncMCPSkills(chart, false, root), /目标目录/);
});

/** 验证用户实际解压和部署路径；入参 t TestContext 管理制品及 Chart 夹具，返回 void。 */
test("MCP 制品解压后可独立校验并同步 Chart，摘要匹配且不混入 CLI Skill", (t) => {
  const root = fixture(t);
  const archive = packageMCPRelease(join(root, "dist"), root);
  const digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
  assert.equal(readFileSync(`${archive}.sha256`, "utf8"), `${digest}  ${basename(archive)}\n`);
  const extracted = join(root, "extracted");
  mkdirSync(extracted);
  execFileSync("tar", ["-xzf", archive, "-C", extracted]);
  execFileSync(process.execPath, [join(extracted, "scripts/sync-mcp-skills.js"), "--check"]);
  assert.deepEqual(checkMCPRelease(extracted).manifest, checkMCPRelease(root).manifest);
  const members = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" }).trim().split("\n");
  assert.equal(members.length, 5);
  assert.ok(members.every((name) => name.startsWith("mcp/") || name === "scripts/sync-mcp-skills.js"));
  const chart = join(root, "chart");
  mkdirSync(chart);
  writeFileSync(join(chart, "Chart.yaml"), "name: everyline-cli-mcp\n");
  execFileSync(process.execPath, [join(extracted, "scripts/sync-mcp-skills.js"), chart]);
  syncMCPSkills(chart, true, root);
});
