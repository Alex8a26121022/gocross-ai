import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codespaceVisionOrigin, canUseVision, parsePublicOrigins } from '../vision-access.mjs';

const env = { CODESPACES: 'true', CODESPACE_NAME: 'test-space-123', GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'app.github.dev' };
const origin = codespaceVisionOrigin(env, 5173);
const request = (headers, options = {}) => ({ headers, method: 'POST', url: '/api/vision/recognise', socket: { remoteAddress: '10.0.0.1' }, ...options });

test('云端识图仅由有效 Codespaces 环境启用，不接受任意域名', () => {
  assert.equal(origin, 'https://test-space-123-5173.app.github.dev');
  for (const patch of [{ CODESPACES: '' }, { CODESPACE_NAME: 'evil.example/path' }, { GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'evil.example' }]) assert.equal(codespaceVisionOrigin({ ...env, ...patch }, 5173), '');
  for (const port of [0, -1, 65536, NaN]) assert.equal(codespaceVisionOrigin(env, port), '');
});

test('云端允许本站上传和状态查询，拒绝其他网站、相似域名、缺失 Origin 的上传', () => {
  const host = new URL(origin).host;
  assert.equal(canUseVision(request({ host, origin }), origin), true);
  assert.equal(canUseVision(request({ host }, { method: 'GET', url: '/api/vision/status' }), origin), true);
  for (const badOrigin of [undefined, 'null', 'https://evil.example', origin + '.evil.example', origin + '/']) assert.equal(canUseVision(request({ host, origin: badOrigin }), origin), false);
  assert.equal(canUseVision(request({ host: 'internal-proxy:5173', origin }), origin), true);
  assert.equal(canUseVision(request({ host, origin }), ''), false);
});

test('保持本机保护，反向代理仅接受本站 Origin', () => {
  const socket = { remoteAddress: '127.0.0.1' };
  assert.equal(canUseVision(request({ host: 'localhost:5173' }, { socket }), ''), true);
  assert.equal(canUseVision(request({ host: 'localhost:5173' }, { socket }), origin), false);
  assert.equal(canUseVision(request({ host: 'localhost:5173', origin: 'https://evil.example' }, { socket }), origin), false);
  assert.equal(canUseVision(request({ host: 'localhost:5173', origin }, { socket }), origin), true);
  assert.equal(canUseVision(request({ host: 'localhost:5173' }), origin), false);
});

test('代理重写 HTTPS 来源时要求浏览器同源元数据，跨站和缺失元数据均拒绝', () => {
  const socket = { remoteAddress: '127.0.0.1' };
  const headers = { host: 'localhost:5173', origin: 'https://localhost:5173', 'sec-fetch-site': 'same-origin' };
  assert.equal(canUseVision(request(headers, { socket }), origin), true);
  assert.equal(canUseVision(request(headers, { socket }), ''), false);
  for (const site of [undefined, 'cross-site', 'same-site', 'none']) assert.equal(canUseVision(request({ ...headers, 'sec-fetch-site': site }, { socket }), origin), false);
  assert.equal(canUseVision(request({ ...headers, origin: 'http://localhost:5173', 'sec-fetch-site': 'cross-site' }, { socket }), origin), false);
});

const workbuddy = 'https://gocross-shopping-guide.app.workbuddy.host';
test('PUBLIC_ORIGIN 仅接受精确小写 HTTPS 来源；逗号列表去重并忽略无效条目', () => {
  assert.deepEqual(parsePublicOrigins(` ${workbuddy},https://preview.example:8443,${workbuddy},https://example.com:443,https://[::1]:8443 `), [workbuddy, 'https://preview.example:8443', 'https://example.com:443', 'https://[::1]:8443']);
  for (const invalid of ['', null, 'http://example.com', 'HTTPS://example.com', 'https://EXAMPLE.com', 'https://example.com/', 'https://example.com/path', 'https://example.com?x=1', 'https://example.com#x', 'https://*.example.com', 'https://user:pass@example.com', 'https://bad_host.example', 'https://-bad.example', 'https://bad-.example', 'https://example..com', 'https://example.com.', 'https://example.com:0', 'https://example.com:65536', 'https://example.com:abc', 'https://example.com:', 'https://example.com\\path']) assert.deepEqual(parsePublicOrigins(invalid), [], String(invalid));
  assert.deepEqual(parsePublicOrigins(`http://bad,${workbuddy},https://example.com/`), [workbuddy]);
});

test('公开部署按 Origin 而非代理 Host 授权，要求明确同源元数据', () => {
  const configured = [workbuddy, 'https://preview.example:8443'];
  for (const allowed of configured) for (const site of ['same-origin', 'none']) assert.equal(canUseVision(request({ host: 'rewritten-proxy:8080', origin: allowed, 'sec-fetch-site': site }), '', configured), true);
  for (const badOrigin of [undefined, 'null', 'https://foreign.example', workbuddy + '/', workbuddy + '.evil.example']) assert.equal(canUseVision(request({ host: new URL(workbuddy).host, origin: badOrigin, 'sec-fetch-site': 'same-origin' }), '', configured), false);
  for (const site of [undefined, '', 'cross-site', 'same-site']) assert.equal(canUseVision(request({ host: 'proxy:8080', origin: workbuddy, 'sec-fetch-site': site }), '', configured), false);
  assert.equal(canUseVision(request({ origin: workbuddy, 'sec-fetch-site': 'same-origin' }), '', []), false);
});

test('配置公开来源后仅状态 GET 可省略 Origin，跨站状态请求仍拒绝', () => {
  for (const url of ['/api/agent/status', '/api/vision/status']) {
    assert.equal(canUseVision(request({ host: 'proxy:8080' }, { method: 'GET', url }), '', [workbuddy]), true);
    assert.equal(canUseVision(request({ host: 'proxy:8080', 'sec-fetch-site': 'cross-site' }, { method: 'GET', url }), '', [workbuddy]), false);
    assert.equal(canUseVision(request({ host: 'proxy:8080', origin: 'https://foreign.example' }, { method: 'GET', url }), '', [workbuddy]), false);
    assert.equal(canUseVision(request({}, { method: 'GET', url }), '', []), false);
  }
  assert.equal(canUseVision(request({}, { method: 'GET', url: '/api/agent/message' }), '', [workbuddy]), false);
  assert.equal(canUseVision(request({}), '', [workbuddy]), false);
});

test('显式公开来源与 Codespaces 可同时使用，且本机和隧道规则不变', () => {
  const socket = { remoteAddress: '127.0.0.1' }, host = 'localhost:5173';
  assert.equal(canUseVision(request({ host }, { socket }), '', [workbuddy]), true);
  assert.equal(canUseVision(request({ host, origin: `http://${host}` }, { socket }), '', [workbuddy]), true);
  assert.equal(canUseVision(request({ host, origin: workbuddy, 'sec-fetch-site': 'same-origin' }, { socket }), origin, [workbuddy]), true);
  assert.equal(canUseVision(request({ host: 'proxy:8080', origin }), origin, [workbuddy]), true);
  assert.equal(canUseVision(request({ host, origin: `https://${host}`, 'sec-fetch-site': 'same-origin' }, { socket }), origin, [workbuddy]), true);
  assert.equal(canUseVision(request({ host, origin: `https://${host}`, 'sec-fetch-site': 'same-origin' }, { socket }), '', [workbuddy]), false);
  assert.equal(canUseVision(request({ host }, { socket }), origin, [workbuddy]), false);
});
