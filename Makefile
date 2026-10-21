# 业务调用由宿主 Skill 经 MCP 执行；这里只保留本地校验和 Skill 制品打包。
.DEFAULT_GOAL := test
.PHONY: test mcp-check mcp-package release-check clean

test:
	npm test

mcp-check:
	node scripts/sync-mcp-skills.js --check

mcp-package: mcp-check
	node scripts/sync-mcp-skills.js --package dist

release-check: test mcp-package

clean:
	rm -rf dist
