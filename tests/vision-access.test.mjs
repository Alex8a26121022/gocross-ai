import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codespaceVisionOrigin, canUseVision } from '../vision-access.mjs';

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
