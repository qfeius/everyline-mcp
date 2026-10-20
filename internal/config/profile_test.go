package config

import (
	"strings"
	"testing"
)

// TestProfileRequiresHTTPSForRemoteHosts 验证远端 Profile 不允许明文传输 app secret 或 token。
// 入参：t *testing.T 为测试上下文。
// 返回值：无；失败通过 t.Fatal 报告。
func TestProfileRequiresHTTPSForRemoteHosts(t *testing.T) {
	profile := Profile{
		Name:          "prod",
		BaseURL:       "http://api.example.com",
		TokenURL:      "https://api.example.com/token",
		AppID:         "cli-prod",
		DefaultOutput: "json",
	}
	if err := profile.Validate(); err == nil || !strings.Contains(err.Error(), "https") {
		t.Fatalf("err=%v，期望拒绝远端 HTTP", err)
	}
}

// TestProfileAllowsLoopbackHTTP 验证 localhost 和回环 IP 可用于本地契约测试。
// 入参：t *testing.T 为测试上下文。
// 返回值：无；失败通过 t.Fatal 报告。
func TestProfileAllowsLoopbackHTTP(t *testing.T) {
	for _, host := range []string{"localhost", "127.0.0.1", "[::1]"} {
		profile := Profile{
			Name:          "local",
			BaseURL:       "http://" + host + ":8080",
			TokenURL:      "http://" + host + ":8080/token",
			AppID:         "cli-local",
			DefaultOutput: "json",
		}
		if err := profile.Validate(); err != nil {
			t.Fatalf("host=%s err=%v", host, err)
		}
	}
}

// TestProfileRejectsUnusableURLs 验证 Profile 在持久化前拒绝运行时无法安全拼接的 URL。
// 入参：t *testing.T 为测试上下文。
// 返回值：无；失败通过 t.Fatal 报告。
func TestProfileRejectsUnusableURLs(t *testing.T) {
	tests := []struct {
		name     string
		baseURL  string
		tokenURL string
	}{
		{name: "base URL 首尾空白", baseURL: " https://open.qfei.cn ", tokenURL: "https://open.qfei.cn/token"},
		{name: "token URL 首尾空白", baseURL: "https://open.qfei.cn", tokenURL: " https://open.qfei.cn/token "},
		{name: "base URL query", baseURL: "https://open.qfei.cn?tenant=test", tokenURL: "https://open.qfei.cn/token"},
		{name: "base URL fragment", baseURL: "https://open.qfei.cn#gateway", tokenURL: "https://open.qfei.cn/token"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			profile := Profile{Name: "prod", BaseURL: test.baseURL, TokenURL: test.tokenURL, AppID: "cli-prod", DefaultOutput: "json"}
			if err := profile.Validate(); err == nil {
				t.Fatalf("profile=%#v，期望拒绝不可用 URL", profile)
			}
		})
	}
}

/*
TestProfileUsesConfiguredDeviceClient 验证各环境旧 Profile 的 Device client 恢复和显式值优先级。
入参：t *testing.T 为测试上下文。
返回值：无；环境映射、浏览器隔离或显式值优先级失效时报告失败。
*/
func TestProfileUsesConfiguredDeviceClient(t *testing.T) {
	profile := Profile{
		OAuthMetadataURL: "https://test-myaccount.qtech.cn/.well-known/oauth-authorization-server/contract-review",
		OAuthClientID:    "browser-client",
	}
	profile.OAuthScopes = []string{"contract-review:full"}
	for _, env := range []string{"dev", "test", "blue", "prod"} {
		preset, err := ResolveEnvironment(env)
		if err != nil {
			t.Fatal(err)
		}
		profile.OAuthMetadataURL = preset.OAuthMetadataURL
		if got := profile.EffectiveOAuthDeviceClientID(); got != preset.OAuthDeviceClientID {
			t.Fatalf("environment=%s deviceClientID=%q", env, got)
		}
		if profile.HasDeviceOAuthConfiguration() != (env != "blue") || profile.OAuthClientID != "browser-client" {
			t.Fatalf("environment=%s Device 配置错误或复用了浏览器 client", env)
		}
	}
	profile.OAuthDeviceClientID = "explicit-device-client"
	if got := profile.EffectiveOAuthDeviceClientID(); got != "explicit-device-client" {
		t.Fatalf("显式 deviceClientID=%q", got)
	}
	profile.OAuthDeviceClientID = ""
	profile.OAuthMetadataURL = "https://account.example.com/.well-known/oauth-authorization-server/contract-review"
	if got := profile.EffectiveOAuthDeviceClientID(); got != "" {
		t.Fatalf("未知环境不得复用浏览器 client: %q", got)
	}
}
