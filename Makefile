# package.json 是当前版本的唯一来源；CI 仍可通过 VERSION 注入 tag 或提交构建版本。
VERSION ?= $(shell node -p 'require("./package.json").version')
COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || printf 'uncommitted')
BUILD_DATE ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
UPDATE_MANIFEST_URL ?=
# 可显式提供 Chart 工作区，发布校验会额外检查跨仓库副本；CI 无兄弟仓库时校验固定清单。
MCP_CHART_DIR ?=
PACKAGE_VERSION ?= $(shell node scripts/package-version.js "$(VERSION)")
LDFLAGS := -s -w -X git.qtech.cn/ai/everyline-cli-mcp/internal/build.Version=$(VERSION) -X git.qtech.cn/ai/everyline-cli-mcp/internal/build.Commit=$(COMMIT) -X git.qtech.cn/ai/everyline-cli-mcp/internal/build.Date=$(BUILD_DATE) -X git.qtech.cn/ai/everyline-cli-mcp/internal/build.UpdateManifestURL=$(UPDATE_MANIFEST_URL)

.PHONY: build test vet skill-assets mcp-check mcp-package release-assets release-check package-check package clean

build:
	go build -trimpath -ldflags "$(LDFLAGS)" -o bin/everyline-cli-mcp ./cmd/everyline-cli-mcp

test:
	go test -race ./...
	npm test

vet:
	go vet ./...
	go mod verify
	go mod tidy -diff

skill-assets:
	sh scripts/build-skill-bundles.sh
	sh tests/release/verify-skill-bundles.sh

mcp-check:
	node scripts/sync-mcp-skills.js $(if $(MCP_CHART_DIR),"$(MCP_CHART_DIR)") --check

mcp-package: mcp-check
	node scripts/sync-mcp-skills.js --package dist

release-assets: skill-assets mcp-package
	VERSION="$(PACKAGE_VERSION)" COMMIT="$(COMMIT)" BUILD_DATE="$(BUILD_DATE)" sh scripts/build-release-assets.sh

# 本地交付读取 npm 全部已发布版本，与本地版本取最高基础版本后递增 patch；各环境共享版本序列。
# CI 发布已有标签时仍使用 release-check/npm pack，不再次递增标签版本。
package:
	node scripts/package-version.js --bump
	$(MAKE) release-assets VERSION="$$(node -p 'require("./package.json").version')" PACKAGE_VERSION="$$(node -p 'require("./package.json").version')"
	node scripts/pack-release.js dist

package-check: skill-assets
	sh tests/release/verify-assets.sh
	EXPECTED_PACKAGE_VERSION="$(PACKAGE_VERSION)" sh tests/release/package-dry-run.sh
	EXPECTED_VERSION="$(PACKAGE_VERSION)" sh tests/release/local-install.sh

release-check: test vet release-assets package-check

clean:
	rm -rf bin dist coverage.out
