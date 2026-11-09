"use strict";

const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { readFileSync, readdirSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { resolve, join, basename } = require("node:path");
const { tmpdir } = require("node:os");
const { isDeepStrictEqual } = require("node:util");

// 只有一个顶层 Skill；配置流程和图标作为同一技能的资源随包发布。
const skillNames = ["everyline-review"];
const doubaoFiles = ["mcp/doubao/plugin.json", "mcp/doubao/mcp.json"];
const repositoryRoot = resolve(__dirname, "..");
const manifestPath = "mcp/skills-manifest.json";

/**
 * readSkillFiles 递归读取技能资源，拒绝符号链接和特殊文件，避免归档依赖包外文件。
 * 入参：directory string 为当前目录，prefix string 为技能内相对路径。
 * 返回值：object，以相对路径索引原始 Buffer，供摘要和归档共同使用。
 */
function readSkillFiles(directory, prefix = "") {
  const files = {};
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(files, readSkillFiles(join(directory, entry.name), path));
    else if (entry.isFile()) files[path] = readFileSync(join(directory, entry.name));
    else throw new Error(`不支持的 Skill 资源: ${path}`);
  }
  return files;
}

/**
 * checkSkillReferences 校验技能说明和图标引用，统一限定在当前技能根目录内。
 * 入参：name string 为技能名，resources object 为技能内相对路径到原始 Buffer 的映射。
 * 返回值：void；引用包含父目录跳转、绝对路径或未随包提供的文件时抛出 Error。
 */
function checkSkillReferences(name, resources) {
  // 图标和说明使用相同的资源集合，避免摘要同步后仍发布失效引用。
  const icon = resources["SKILL.md"].toString("utf8").match(/^  icon: "([^"]+)"\r?$/m)?.[1];
  const references = [["SKILL.md metadata.icon", icon]];
  for (const [file, data] of Object.entries(resources)) {
    if (!file.endsWith(".md")) continue;
    for (const [, rawTarget] of data.toString("utf8").matchAll(/\[[^\]\n]*\]\(([^)\s]+)\)/g)) {
      const target = rawTarget.replace(/^<(.+)>$/, "$1");
      // 页内锚点、外部链接及授权/图片模板占位符不属于包内文件引用。
      if (target.startsWith("#") || /^(?:https?|mailto):/i.test(target) ||
          (rawTarget.startsWith("<") && !/[./]/.test(target))) continue;
      references.push([file, target]);
    }
  }
  for (const [file, target] of references) {
    const path = target?.split("#")[0].replace(/^\.\//, "");
    if (!path || path.startsWith("/") || path.includes("\\") || path.split("/").includes("..") ||
        !Object.hasOwn(resources, path)) {
      throw new Error(`技能引用越界或不存在: ${name}/${file} -> ${target}`);
    }
  }
}

/**
 * prepareMCPRelease 校验全部 Skill 身份、版本和引用范围，在写入前准备正文与摘要。
 * 入参：root string 为源码/制品根目录；version string 为 MCP Skill 发布版本；updateVersion boolean 表示同步正文版本。
 * 返回值：object，包含发布 manifest、入口 contents 和全部原始资源 files；格式错误时抛出 Error。
 */
function prepareMCPRelease(root, version, updateVersion = false) {
  if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(`无效 MCP Skill 发布版本: ${version}`);
  }
  const contents = {};
  const files = {};
  if (!isDeepStrictEqual(readdirSync(join(root, "mcp/skills")).sort(), skillNames)) {
    throw new Error("只允许发布 everyline-review 顶层 Skill；配置流程应放在 references 中");
  }
  const skills = skillNames.map((name) => {
    const resources = readSkillFiles(join(root, "mcp", "skills", name));
    if (!resources["references/review-config.md"] || !resources["assets/icon.png"]) {
      throw new Error(`MCP Skill 缺少配置流程或图标: ${name}`);
    }
    const source = resources["SKILL.md"]?.toString("utf8") || "";
    const header = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    const names = header?.[1].match(/^name: .+$/gm) || [];
    const versions = header?.[1].match(/^  version: .+$/gm) || [];
    if (names.length !== 1 || names[0].trimEnd() !== `name: ${name}` || versions.length !== 1 ||
        !/^metadata:\r?\n  version: "[^"]+"\r?$/m.test(header[1])) {
      throw new Error(`MCP Skill frontmatter 格式错误: ${name}`);
    }
    checkSkillReferences(name, resources);
    // 只改 frontmatter，正文中的版本示例和流程说明保持原样。
    const content = updateVersion
      ? source.replace(header[0], header[0].replace(/^  version: .+$/m, `  version: "${version}"`))
      : source;
    if (!updateVersion && versions[0].trimEnd() !== `  version: "${version}"`) {
      throw new Error(`MCP Skill 版本未同步: ${name}`);
    }
    contents[name] = content;
    resources["SKILL.md"] = Buffer.from(content);
    for (const [path, data] of Object.entries(resources)) files[`mcp/skills/${name}/${path}`] = data;
    return {
      name,
      sha256: createHash("sha256").update(content).digest("hex"),
      resources: Object.entries(resources).filter(([path]) => path !== "SKILL.md")
        .map(([path, data]) => ({ path, sha256: createHash("sha256").update(data).digest("hex") })),
    };
  });
  const doubao = doubaoFiles.map((path) => {
    files[path] = readFileSync(join(root, path));
    JSON.parse(files[path].toString("utf8"));
    return { path, sha256: createHash("sha256").update(files[path]).digest("hex") };
  });
  return { manifest: { schemaVersion: 2, name: "everyline-mcp-skills", version, skills, doubao }, contents, files };
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
 * packageMCPRelease 生成源归档、完整单技能 ZIP 和带线上连接器的豆包 Plugin ZIP。
 * 入参：outputDirectory string 为制品目录；root string 为源码根目录。
 * 返回值：string 为源归档绝对路径；清单校验、打包或摘要写入失败时抛出 Error。
 */
function packageMCPRelease(outputDirectory, root = repositoryRoot) {
  const { manifest, files } = checkMCPRelease(root);
  const output = resolve(outputDirectory);
  mkdirSync(output, { recursive: true });
  const archive = join(output, `everyline-mcp-skills-${manifest.version}.tgz`);
  execFileSync("tar", ["-czf", archive, "-C", root, manifestPath, "mcp/README.md", "scripts/sync-mcp-skills.js",
    ...Object.keys(files)]);
  const artifacts = [archive];
  for (const name of skillNames) {
    const bundle = join(output, `${name}-mcp-skill-${manifest.version}.zip`);
    // 入口与全部资源一起导入，避免配置流程或图标在宿主中缺失。
    rmSync(bundle, { force: true });
    const prefix = `mcp/skills/${name}/`;
    const members = Object.keys(files).filter((path) => path.startsWith(prefix)).map((path) => path.slice(prefix.length));
    execFileSync("zip", ["-q", bundle, ...members], { cwd: join(root, "mcp", "skills", name) });
    artifacts.push(bundle);
  }
  const staging = mkdtempSync(join(tmpdir(), "everyline-doubao-"));
  try {
    const members = {};
    for (const path of doubaoFiles) members[basename(path)] = files[path];
    for (const [path, data] of Object.entries(files)) {
      if (path.startsWith("mcp/skills/")) members[path.slice("mcp/".length)] = data;
    }
    // 同一份原版 512px Logo 用于插件、会话、连接器和技能，保持展示一致。
    for (const name of ["plugin-icon", "plugin-chat-icon", "mcp-icon"]) {
      members[`com.doubao/assets/${name}.png`] = files["mcp/skills/everyline-review/assets/icon.png"];
    }
    for (const [path, data] of Object.entries(members)) {
      mkdirSync(join(staging, path, ".."), { recursive: true });
      writeFileSync(join(staging, path), data);
    }
    const bundle = join(output, `everyline-doubao-plugin-${manifest.version}.zip`);
    rmSync(bundle, { force: true });
    execFileSync("zip", ["-q", bundle, ...Object.keys(members).sort()], { cwd: staging });
    artifacts.push(bundle);
  } finally {
    rmSync(staging, { recursive: true, force: true });
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
  else if (args[0] === "--check-tag" && args.length === 2) {
    // 标签只验证既有 Skill 发布，不在 CI 中重写版本或生成另一套版本来源。
    const { manifest } = checkMCPRelease();
    if (args[1] !== `v${manifest.version}`) throw new Error(`发布标签必须为 v${manifest.version}`);
  }
  else if (args.length === 0 || (args.length === 1 && args[0] === "--check")) checkMCPRelease();
  else throw new Error("用法: sync-mcp-skills.js [--check] | --check-tag <标签> | --version <版本> | --package <输出目录>；Skill 由宿主独立加载，不再导出至 Chart");
}
module.exports = { checkMCPRelease, updateMCPRelease, packageMCPRelease };
