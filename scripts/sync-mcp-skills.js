"use strict";

const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { readFileSync, mkdirSync, writeFileSync, rmSync } = require("node:fs");
const { resolve, join, basename } = require("node:path");
const { isDeepStrictEqual } = require("node:util");

// Skill 源清单统一发布到宿主 ZIP 与 MCP Chart，避免两条入口使用不同的流程。
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
 * updateMCPRelease 显式更新 Skill 版本及摘要，全部正文校验通过后才落盘。
 * 入参：version string 为 MCP Skill 发布版本；root string 为源码根目录。
 * 返回值：void；只更新 Skill 正文与发布清单，校验或文件写入失败时抛出 Error。
 */
function updateMCPRelease(version, root = repositoryRoot) {
  const { manifest, contents } = prepareMCPRelease(root, version, true);
  for (const name of skillNames) writeFileSync(join(root, "mcp", "skills", name, "SKILL.md"), contents[name]);
  writeFileSync(join(root, manifestPath), `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * exportChartSkills 将已校验的 Skill 发布副本导出到现有 EveryLine Chart，供 MCP 直接读取。
 * 入参：chartDirectory string 为目标 Chart 目录；root string 为 Skill 源码或解压制品根目录。
 * 返回值：string 为导出目录；源摘要或 Chart 身份无效时在写入前抛出 Error。
 */
function exportChartSkills(chartDirectory, root = repositoryRoot) {
  const { manifest, contents } = checkMCPRelease(root);
  const chart = resolve(chartDirectory);
  // 只向明确的 EveryLine Chart 导出正文，不改业务接口、路由或鉴权配置。
  const chartSource = readFileSync(join(chart, "Chart.yaml"), "utf8");
  if (!/^name: everyline-cli-mcp(?:-test)?\s*$/m.test(chartSource)) {
    throw new Error("Skill 导出目标必须是 EveryLine MCP Chart");
  }
  const destination = join(chart, "files", "skills");
  mkdirSync(destination, { recursive: true });
  for (const name of skillNames) writeFileSync(join(destination, `${name}.md`), contents[name]);
  writeFileSync(join(destination, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return destination;
}

/**
 * packageMCPRelease 生成独立源归档和宿主可直接导入的 Skill ZIP，Chart 导出使用显式维护命令。
 * 入参：outputDirectory string 为制品目录；root string 为源码根目录。
 * 返回值：string 为源归档绝对路径；清单校验、打包或摘要写入失败时抛出 Error。
 */
function packageMCPRelease(outputDirectory, root = repositoryRoot) {
  const { manifest } = checkMCPRelease(root);
  const output = resolve(outputDirectory);
  mkdirSync(output, { recursive: true });
  const archive = join(output, `everyline-mcp-skills-${manifest.version}.tgz`);
  execFileSync("tar", ["-czf", archive, "-C", root, manifestPath, "mcp/README.md", "scripts/sync-mcp-skills.js",
    ...skillNames.map((name) => `mcp/skills/${name}/SKILL.md`)]);
  const artifacts = [archive];
  for (const name of skillNames) {
    const bundle = join(output, `${name}-mcp-skill-${manifest.version}.zip`);
    // ZIP 根目录直接放 SKILL.md，匹配宿主导入格式；重建归档避免旧条目残留。
    rmSync(bundle, { force: true });
    execFileSync("zip", ["-q", bundle, "SKILL.md"], { cwd: join(root, "mcp", "skills", name) });
    artifacts.push(bundle);
  }
  for (const artifact of artifacts) {
    const digest = createHash("sha256").update(readFileSync(artifact)).digest("hex");
    writeFileSync(`${artifact}.sha256`, `${digest}  ${basename(artifact)}\n`);
  }
  return archive;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "--version" && args.length === 2) updateMCPRelease(args[1]);
  else if (args[0] === "--package" && args.length === 2) console.log(packageMCPRelease(args[1]));
  else if (args[0] === "--export-chart" && args.length === 2) console.log(exportChartSkills(args[1]));
  else if (args[0] === "--check-tag" && args.length === 2) {
    // 标签只验证既有 Skill 发布，不在 CI 中重写版本或生成另一套版本来源。
    const { manifest } = checkMCPRelease();
    if (args[1] !== `v${manifest.version}`) throw new Error(`发布标签必须为 v${manifest.version}`);
  }
  else if (args.length === 0 || (args.length === 1 && args[0] === "--check")) checkMCPRelease();
  else throw new Error("用法: sync-mcp-skills.js [--check] | --check-tag <标签> | --version <版本> | --package <输出目录> | --export-chart <Chart目录>；已移除 Chart 同步入口 --chart/--check-chart，请使用显式导出命令");
}
module.exports = { checkMCPRelease, updateMCPRelease, packageMCPRelease, exportChartSkills };
