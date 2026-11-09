"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } = require("node:fs");
const { join, basename } = require("node:path");
const { tmpdir } = require("node:os");
const { checkMCPRelease, updateMCPRelease, packageMCPRelease } = require("../../scripts/sync-mcp-skills");

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
test("当前 MCP 发布清单只注册合并后的唯一 Skill", () => {
  assert.deepEqual(checkMCPRelease().manifest.skills.map(({ name }) => name), ["everyline-review"]);
});

/**
 * 验证 Git 自动换行检出仍保留发布字节，避免 Windows 开发者无修改也触发摘要失败。
 * 入参：t TestContext 管理隔离 Git 目录；返回值：void，检出后正文或清单变化时失败。
 */
test("core.autocrlf=true 检出后 MCP 正文和清单保持 LF，仍可独立校验", (t) => {
  const root = fixture(t);
  const release = checkMCPRelease(root);
  const paths = ["mcp/skills-manifest.json", ...Object.keys(release.files)];
  const originals = paths.map((path) => readFileSync(join(root, path)));
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["-c", "core.autocrlf=false", "add", "-f", "."], { cwd: root });
  // 删除工作区副本后从索引真实检出，不靠字符串替换模拟 Git 的属性处理。
  for (const path of paths) rmSync(join(root, path));
  execFileSync("git", ["-c", "core.autocrlf=true", "checkout-index", "--all", "--force"], { cwd: root });
  paths.forEach((path, index) => assert.deepEqual(readFileSync(join(root, path)), originals[index]));
  assert.deepEqual(checkMCPRelease(root).manifest, release.manifest);
});

/** 验证独立升版及失败前置校验；入参 t TestContext 管理隔离目录，返回 void。 */
test("Skill 升版保留正文与维护工具清单，错误输入不留下部分更新", (t) => {
  const root = fixture(t);
  const first = join(root, "mcp/skills/everyline-review/SKILL.md");
  const reference = join(root, "mcp/skills/everyline-review/references/review-config.md");
  const original = readFileSync(first, "utf8");
  const originalReference = readFileSync(reference);
  writeFileSync(join(root, "package.json"), '{"private":true}\n');
  updateMCPRelease("1.2.3", root);
  assert.equal(checkMCPRelease(root).manifest.version, "1.2.3");
  assert.equal(readFileSync(join(root, "package.json"), "utf8"), '{"private":true}\n');
  assert.equal(readFileSync(first, "utf8").split("\n---\n")[1], original.split("\n---\n")[1]);
  assert.deepEqual(readFileSync(reference), originalReference);
  const before = readFileSync(first, "utf8");
  const manifest = readFileSync(join(root, "mcp/skills-manifest.json"), "utf8");
  assert.throws(() => updateMCPRelease("../invalid", root), /无效 MCP/);
  rmSync(reference);
  assert.throws(() => updateMCPRelease("1.2.4", root), /缺少配置流程/);
  assert.equal(readFileSync(first, "utf8"), before);
  assert.equal(readFileSync(join(root, "mcp/skills-manifest.json"), "utf8"), manifest);
});

/** 验证配置参考、图标及连接器配置全部受摘要保护；入参 t 管理隔离目录，返回 void。 */
test("配置流程、图标或豆包声明漂移时阻止打包", (t) => {
  const root = fixture(t);
  for (const path of ["mcp/skills/everyline-review/references/review-config.md", "mcp/skills/everyline-review/assets/icon.png", "mcp/doubao/mcp.json"]) {
    const file = join(root, path);
    const original = readFileSync(file);
    writeFileSync(file, Buffer.concat([original, Buffer.from("\n")]));
    assert.throws(() => packageMCPRelease(join(root, "dist"), root), /摘要未同步/);
    assert.ok(!readdirSync(root).includes("dist"));
    writeFileSync(file, original);
  }
});

/** 验证未登记变更会阻止制品生成；入参 t TestContext 管理隔离目录，返回 void。 */
test("源正文或版本漂移时校验失败，阻止发布宿主 Skill", (t) => {
  const root = fixture(t);
  const source = join(root, "mcp/skills/everyline-review/SKILL.md");
  const original = readFileSync(source, "utf8");
  writeFileSync(source, `${original}\n未登记的修改\n`);
  assert.throws(() => checkMCPRelease(root), /摘要未同步/);
  assert.throws(() => packageMCPRelease(join(root, "dist"), root), /摘要未同步/);
  assert.ok(!readdirSync(root).includes("dist"));
  writeFileSync(source, original.replace(/  version: "[^"]+"/, '  version: "9.9.9"'));
  assert.throws(() => checkMCPRelease(root), /版本未同步/);
});

/** 验证用户实际解压路径；入参 t TestContext 管理制品，返回 void，源文件或摘要失配时失败。 */
test("MCP Skill 制品解压后可独立校验，摘要匹配且不混入 CLI Skill", (t) => {
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
  assert.deepEqual(members.sort(), ["mcp/skills-manifest.json", "mcp/README.md", "scripts/sync-mcp-skills.js", ...Object.keys(checkMCPRelease(root).files)].sort());
  assert.ok(members.every((name) => name.startsWith("mcp/") || name === "scripts/sync-mcp-skills.js"));
  // 解压制品可独立重建宿主导入包，发布过程不需要 Chart checkout 或 CLI。
  execFileSync(process.execPath, [join(extracted, "scripts/sync-mcp-skills.js"), "--package", join(extracted, "dist")]);
  const { manifest, contents } = checkMCPRelease(root);
  for (const { name } of manifest.skills) {
    const bundleName = `${name}-mcp-skill-${manifest.version}.zip`;
    for (const base of [root, extracted]) {
      const bundle = join(base, "dist", bundleName);
      const paths = ["SKILL.md", ...manifest.skills.find((skill) => skill.name === name).resources.map(({ path }) => path)];
      assert.deepEqual(execFileSync("unzip", ["-Z1", bundle], { encoding: "utf8" }).trim().split("\n").sort(), paths.sort());
      assert.equal(execFileSync("unzip", ["-p", bundle, "SKILL.md"], { encoding: "utf8" }), contents[name]);
      for (const { path } of manifest.skills.find((skill) => skill.name === name).resources) {
        assert.deepEqual(execFileSync("unzip", ["-p", bundle, path]), readFileSync(join(root, "mcp/skills", name, path)));
      }
      const digest = createHash("sha256").update(readFileSync(bundle)).digest("hex");
      assert.equal(readFileSync(`${bundle}.sha256`, "utf8"), `${digest}  ${bundleName}\n`);
    }
  }
});

/** 验证重复打包不会遗留旧宿主文件；入参 t TestContext 管理制品和注入文件，返回 void。 */
test("重新打包清除 ZIP 中的旧条目并保持 Skill 正文", (t) => {
  const root = fixture(t);
  const output = join(root, "dist");
  packageMCPRelease(output, root);
  const { manifest, contents } = checkMCPRelease(root);
  const bundle = join(output, `everyline-review-mcp-skill-${manifest.version}.zip`);
  writeFileSync(join(root, "stale.txt"), "old content");
  execFileSync("zip", ["-q", bundle, "stale.txt"], { cwd: root });
  packageMCPRelease(output, root);
  assert.deepEqual(execFileSync("unzip", ["-Z1", bundle], { encoding: "utf8" }).trim().split("\n").sort(), ["SKILL.md", "assets/icon.png", "references/review-config.md"]);
  assert.equal(execFileSync("unzip", ["-p", bundle, "SKILL.md"], { encoding: "utf8" }), contents["everyline-review"]);
});

/** 验证实际 Plugin ZIP 中唯一 Skill、正式展示字段、线上地址及资源解析；入参 t 管理制品，返回 void。 */
test("豆包 Plugin 只包含一个 Skill，技能与连接器使用相同展示名和原版 Logo", (t) => {
  const root = fixture(t);
  packageMCPRelease(join(root, "dist"), root);
  const { manifest } = checkMCPRelease(root);
  const bundle = join(root, "dist", `everyline-doubao-plugin-${manifest.version}.zip`);
  const read = (path) => execFileSync("unzip", ["-p", bundle, path]);
  const members = execFileSync("unzip", ["-Z1", bundle], { encoding: "utf8" }).trim().split("\n");
  assert.deepEqual(members.filter((path) => /^skills\/[^/]+\/SKILL.md$/.test(path)), ["skills/everyline-review/SKILL.md"]);
  const plugin = JSON.parse(read("plugin.json"));
  const mcp = JSON.parse(read("mcp.json"));
  const display = plugin.extensions["com.doubao"];
  const expectedName = "EveryLine | AI 合同审查助手";
  assert.deepEqual(display.displayName, { zh: expectedName });
  assert.deepEqual(Object.keys(display).sort(), ["displayName", "displayDescription", "icon", "chatIcon", "mcpServers"].sort());
  assert.deepEqual(Object.keys(display.mcpServers), Object.keys(mcp.mcpServers));
  assert.deepEqual(display.mcpServers["everyline-cli-mcp"].displayName, display.displayName);
  assert.deepEqual(mcp.mcpServers["everyline-cli-mcp"], { type: "streamable-http", url: "https://mcp.qfei.cn/mcp-servers/everyline-cli-mcp" });
  const entry = read("skills/everyline-review/SKILL.md").toString("utf8");
  assert.ok(entry.includes(`  display_name: "${expectedName}"`));
  assert.ok(entry.includes("[审查配置流程](references/review-config.md)"));
  assert.ok(read("skills/everyline-review/references/review-config.md").length > 0);
  const logo = readFileSync(join(root, "mcp/skills/everyline-review/assets/icon.png"));
  assert.equal(logo.readUInt32BE(16), 512);
  assert.equal(logo.readUInt32BE(20), 512);
  for (const path of [display.icon, display.chatIcon, display.mcpServers["everyline-cli-mcp"].icon, "./skills/everyline-review/assets/icon.png"]) {
    assert.match(path, /^\.\//);
    assert.ok(!path.includes(".."));
    assert.deepEqual(read(path.slice(2)), logo);
  }
});

/** 验证发布标签只匹配现有清单；入参 t TestContext 管理隔离目录，返回 void，拒绝标签时保持正文不变。 */
test("发布标签与 Skill 清单一致，旧标签和预发布标签在发布前失败", (t) => {
  const root = fixture(t);
  const { manifest } = checkMCPRelease(root);
  const script = join(root, "scripts/sync-mcp-skills.js");
  execFileSync(process.execPath, [script, "--check-tag", `v${manifest.version}`]);
  for (const tag of ["v0.0.0", manifest.version, `v${manifest.version}-beta.1`]) {
    assert.throws(() => execFileSync(process.execPath, [script, "--check-tag", tag], { stdio: "pipe" }), /发布标签必须为/);
  }
  assert.deepEqual(checkMCPRelease(root).manifest, manifest);
});

/** 验证维护工作区不再暴露可安装业务入口；无入参，返回 void，误加可执行入口或安装钩子时失败。 */
test("维护工具清单为私有且没有业务命令入口或安装钩子", () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf8"));
  assert.equal(pkg.private, true);
  assert.equal(pkg.bin, undefined);
  assert.equal(pkg.publishConfig, undefined);
  for (const hook of ["preinstall", "install", "postinstall", "prepare", "prepack", "prepublishOnly"]) {
    assert.equal(pkg.scripts[hook], undefined);
  }
});
