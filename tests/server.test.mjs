import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';

test('静态服务与本机视觉接口边界', async (t) => {
  const child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('../', import.meta.url), env: { ...process.env, HOST: '127.0.0.1', PORT: '0', DISABLE_MARKET_FETCH: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, 'exit'); } });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server did not start')), 10000);
    child.stdout.on('data', (chunk) => { const match = String(chunk).match(/127\.0\.0\.1:(\d+)/); if (match) { clearTimeout(timer); resolve(Number(match[1])); } });
    child.once('error', reject);
  });
  const url = `http://127.0.0.1:${port}`;
  await t.test('页面正常响应，服务端配置和模块不对外提供', async () => {
    assert.equal((await fetch(url)).status, 200);
    for (const file of ['/.env', '/vision.mjs', '/%2e%2e%2f.env']) assert.ok([403, 404].includes((await fetch(url + file)).status));
  });
  await t.test('状态只返回是否配置和模型名', async () => {
    const body = await (await fetch(url + '/api/vision/status')).json();
    assert.deepEqual(Object.keys(body).sort(), ['configured', 'model']); assert.equal(typeof body.configured, 'boolean');
  });
  await t.test('其他网站 Origin 和异常 Host 不能借用本机密钥', async () => {
    assert.equal((await fetch(url + '/api/vision/status', { headers: { Origin: 'https://untrusted.example' } })).status, 403);
    const hostStatus = await new Promise((resolve, reject) => { const request = http.get(url + '/api/vision/status', { headers: { Host: 'untrusted.example' } }, (response) => { response.resume(); resolve(response.statusCode); }); request.on('error', reject); });
    assert.equal(hostStatus, 403);
  });
  await t.test('无效 JSON 和图片在调用模型前被拒绝', async () => {
    for (const body of ['{', 'null', '{}', '{"image":"https://example.com/x.png"}']) {
      const response = await fetch(url + '/api/vision/recognise', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      assert.equal(response.status, 400);
    }
  });
  await t.test('不支持的请求方法和内容类型被拒绝', async () => {
    assert.equal((await fetch(url + '/api/vision/recognise')).status, 405);
    assert.equal((await fetch(url + '/api/vision/recognise', { method: 'POST', body: 'x' })).status, 415);
  });
  await t.test('商品检索参数在访问官网前校验，详情不接受任意 URL', async () => {
    for (const route of ['/api/products/search?q=', '/api/products/search?q=x&page=-1', '/api/products/detail?id=https://private.example/', '/api/products/compare?id=https://private.example/', '/api/products/match?item=null', '/api/products/match?item=%7B']) assert.equal((await fetch(url + route)).status, 400);
    assert.equal((await fetch(url + '/api/products/search?q=x', { method: 'POST' })).status, 405);
  });
});
