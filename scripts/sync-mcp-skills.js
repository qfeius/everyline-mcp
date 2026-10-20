"use strict";

const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { readFileSync, mkdirSync, writeFileSync } = require("node:fs");
const { resolve, join, basename } = require("node:path");
const { isDeepStrictEqual } = require("node:util");

// MCP Skill 使用独立版本；固定清单避免将 CLI Skill 或任意目录混入发布制品。
const skillNames = ["everyline-review", "everyline-review-config"];
const repositoryRoot = resolve(__dirname, "..");
const manifestPath = "mcp/skills-manifest.json";

/**
 * prepareMCPRelease 校验全部 Skill 身份和版本，在写入前准备正文与摘要。
 * 入参：root string 为源码/制品根目录；version string 为 MCP Skill 发布版本；updateVersion boolean 表示同步正文版本。
 * 返回值：object，包含发布 manifest 和按 Skill 名索引的 contents；格式错误时抛出 Error。
 */
function prepareMCPRelease(root, version, updateVersion = false) {
  if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(`无效 MCP Skill 发布版本: ${version}`);
  }
  const contents = {};
  const skills = skillNames.map((name) => {
    const source = readFileSync(join(root, "mcp", "skills", name, "SKILL.md"), "utf8");
    const header = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    const names = header?.[1].match(/^name: .+$/gm) || [];
    const versions = header?.[1].match(/^  version: .+$/gm) || [];
    if (names.length !== 1 || names[0].trimEnd() !== `name: ${name}` || versions.length !== 1 ||
        !/^metadata:\r?\n  version: "[^"]+"\r?$/m.test(header[1])) {
      throw new Error(`MCP Skill frontmatter 格式错误: ${name}`);
    }
    // 只改 frontmatter，正文中的版本示例和流程说明保持原样。
    const content = updateVersion
      ? source.replace(header[0], header[0].replace(/^  version: .+$/m, `  version: "${version}"`))
      : source;
    if (!updateVersion && versions[0].trimEnd() !== `  version: "${version}"`) {
      throw new Error(`MCP Skill 版本未同步: ${name}`);
    }
    contents[name] = content;
    return { name, sha256: createHash("sha256").update(content).digest("hex") };
  });
  return { manifest: { schemaVersion: 1, name: "everyline-mcp-skills", version, skills }, contents };
}

/**
 * checkMCPRelease 校验源文件与发布清单一致，不依赖兄弟仓库或网络。
 * 入参：root string 为源码/解压制品根目录，默认当前工程。
 * 返回值：object，包含已校验的 manifest、contents；缺文件、版本或摘要不一致时抛出 Error。
 */
function checkMCPRelease(root = repositoryRoot) {
  const recorded = JSON.parse(readFileSync(join(root, manifestPath), "utf8"));
  const release = prepareMCPRelease(root, recorded.version);
  if (!isDeepStrictEqual(recorded, release.manifest)) {
    throw new Error("MCP Skill 清单或摘要未同步，请显式运行 --version <MCP版本> 更新发布清单");
  }
  return release;
}

/**
 * updateMCPRelease 显式更新独立 MCP 版本及摘要，全部正文校验通过后才落盘。
 * 入参：version string 为 MCP Skill 发布版本；root string 为源码根目录。
 * 返回值：void；不修改 npm/CLI 版本，校验或文件写入失败时抛出 Error。
 */
function updateMCPRelease(version, root = repositoryRoot) {
  const { manifest, contents } = prepareMCPRelease(root, version, true);
  for (const name of skillNames) writeFileSync(join(root, "mcp", "skills", name, "SKILL.md"), contents[name]);
  writeFileSync(join(root, manifestPath), `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * syncMCPSkills 同步经清单验证的正文和来源摘要，检查模式逐字比较 Chart 发布副本。
 * 入参：chartDirectory string 为 Chart 路径；check boolean 为只读检查；root string 为源码/制品根目录。
 * 返回值：void；源数据无效、路径错误或副本漂移时抛出 Error。
 */
function syncMCPSkills(chartDirectory, check = false, root = repositoryRoot) {
  if (!chartDirectory) throw new Error("请提供 everyline-cli-mcp Chart 目录");
  const { manifest, contents } = checkMCPRelease(root);
  const chart = resolve(chartDirectory);
  if (!/^name: everyline-cli-mcp\s*$/m.test(readFileSync(join(chart, "Chart.yaml"), "utf8"))) {
    throw new Error("目标目录不是 everyline-cli-mcp Chart");
  }
  const destination = join(chart, "files", "skills");
  const files = { "manifest.json": `${JSON.stringify(manifest, null, 2)}\n` };
  for (const name of skillNames) files[`${name}.md`] = contents[name];
  if (!check) mkdirSync(destination, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const target = join(destination, name);
    if (check) {
      if (readFileSync(target, "utf8") !== content) throw new Error(`MCP Skill 发布副本未同步：${name}`);
    } else writeFileSync(target, content);
  }
}

/**
 * packageMCPRelease 生成独立且可离线验证、同步的 MCP Skill 制品，避免混入 CLI Skill。
 * 入参：outputDirectory string 为制品目录；root string 为源码根目录。
 * 返回值：string 为归档绝对路径；清单校验、归档或摘要写入失败时抛出 Error。
 */
function packageMCPRelease(outputDirectory, root = repositoryRoot) {
  const { manifest } = checkMCPRelease(root);
  const output = resolve(outputDirectory);
  mkdirSync(output, { recursive: true });
  const archive = join(output, `everyline-mcp-skills-${manifest.version}.tgz`);
  execFileSync("tar", ["-czf", archive, "-C", root, manifestPath, "mcp/README.md", "scripts/sync-mcp-skills.js",
    ...skillNames.map((name) => `mcp/skills/${name}/SKILL.md`)]);
  const digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
  writeFileSync(`${archive}.sha256`, `${digest}  ${basename(archive)}\n`);
  return archive;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "--version" && args.length === 2) updateMCPRelease(args[1]);
  else if (args[0] === "--package" && args.length === 2) console.log(packageMCPRelease(args[1]));
  else {
    const paths = args.filter((arg) => arg !== "--check");
    if (paths.length > 1 || paths.some((arg) => arg.startsWith("--")) || args.filter((arg) => arg === "--check").length > 1) {
      throw new Error("用法: sync-mcp-skills.js [Chart目录] [--check] | --version <版本> | --package <输出目录>");
    }
    if (paths.length) syncMCPSkills(paths[0], args.includes("--check"));
    else checkMCPRelease();
  }
}
module.exports = { checkMCPRelease, updateMCPRelease, syncMCPSkills, packageMCPRelease };
