import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readdir, copyFile, cp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const workbuddy = 'https://gocross-shopping-guide.app.workbuddy.host';
const alternate = 'https://team.example:8443';
const root = fileURLToPath(new URL('../', import.meta.url));

// Native HTTP preserves a rewritten Host header; fetch may replace it with the URL host.
function request(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      const chunks = []; res.on('data', (chunk) => chunks.push(chunk)); res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: { get: (name) => res.headers[name.toLowerCase()] ?? null }, json: async () => JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
    });
    req.on('error', reject); req.end(body);
  });
}

test('真实 HTTP 服务使用 PUBLIC_ORIGIN 的环境及文件配置，拒绝跨站，保持状态脱敏', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gocross-origin-test-'));
  t.after(async () => { assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir())); assert.ok(path.basename(directory).startsWith('gocross-origin-test-')); await rm(directory, { recursive: true, force: true }); });
  for (const name of await readdir(root)) if (name.endsWith('.mjs')) await copyFile(path.join(root, name), path.join(directory, name));
  await cp(path.join(root, 'public'), path.join(directory, 'public'), { recursive: true });
  async function withServer(fileOrigins, environmentOrigin, check) {
    await writeFile(path.join(directory, '.env'), `DEEPSEEK_API_KEY=test-agent-not-a-real-key\nZHIPU_API_KEY=test-vision-not-a-real-key\n${fileOrigins === undefined ? '' : `PUBLIC_ORIGIN=${fileOrigins}\n`}`);
    const env = { ...process.env, HOST: '127.0.0.1', PORT: '0', DISABLE_MARKET_FETCH: '1', DEEPSEEK_API_KEY: '', ZHIPU_API_KEY: '' };
    delete env.CODESPACES; delete env.PUBLIC_ORIGIN;
    if (environmentOrigin !== undefined) env.PUBLIC_ORIGIN = environmentOrigin;
    const child = spawn(process.execPath, ['server.mjs'], { cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      const port = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Origin test server did not start')), 10000);
        child.once('error', (error) => { clearTimeout(timer); reject(error); });
        child.once('exit', () => { clearTimeout(timer); reject(new Error('Origin test server exited')); });
        child.stdout.on('data', (chunk) => { const match = String(chunk).match(/127\.0\.0\.1:(\d+)/); if (match) { clearTimeout(timer); resolve(Number(match[1])); } });
      });
      await check(`http://127.0.0.1:${port}`);
    } finally { if (child.exitCode === null) { child.kill(); await once(child, 'exit'); } }
  }
  const proxy = { Host: 'rewritten-proxy.internal:8080' };
  async function post(url, endpoint, headers) {
    return request(url + endpoint, { method: 'POST', headers: { ...proxy, 'Content-Type': 'application/json', ...headers }, body: '{}' });
  }
  async function configured(url) {
    for (const [prefix, denied] of [['agent', 'AGENT_ORIGIN_DENIED'], ['vision', 'VISION_ORIGIN_DENIED']]) {
      const endpoint = prefix === 'agent' ? '/api/agent/message' : '/api/vision/recognise';
      for (const origin of [workbuddy, alternate]) for (const site of ['same-origin', 'none']) {
        const response = await post(url, endpoint, { Origin: origin, 'Sec-Fetch-Site': site });
        assert.equal(response.status, 400); // Invalid payload reached validation, without calling an external model.
        assert.equal(response.headers.get('access-control-allow-origin'), null);
      }
      for (const headers of [{}, { Origin: 'https://foreign.example', 'Sec-Fetch-Site': 'same-origin' }, { Origin: workbuddy, 'Sec-Fetch-Site': 'cross-site' }, { Origin: workbuddy, 'Sec-Fetch-Site': 'same-site' }, { Origin: workbuddy }, { Origin: workbuddy + '/', 'Sec-Fetch-Site': 'same-origin' }]) {
        const response = await post(url, endpoint, headers);
        assert.equal(response.status, 403); assert.deepEqual(await response.json(), { error: denied }); assert.equal(response.headers.get('access-control-allow-origin'), null);
      }
      const status = await request(url + `/api/${prefix}/status`, { headers: proxy });
      assert.equal(status.status, 200); const data = await status.json();
      assert.deepEqual(Object.keys(data).sort(), ['configured', 'model']); assert.equal(data.configured, true); assert.equal(typeof data.model, 'string'); assert.equal(status.headers.get('access-control-allow-origin'), null);
      const local = await request(url + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(local.status, 400);
      assert.equal((await request(url + `/api/${prefix}/status`, { headers: { ...proxy, 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    }
    for (const target of ['/.env', '/env.mjs']) assert.ok([403, 404].includes((await request(url + target)).status));
  }
  await t.test('CODESPACES 未设置时 .env 公共来源生效，且支持多个来源', () => withServer(`${workbuddy},${alternate},http://invalid.example`, undefined, configured));
  await t.test('环境来源优先于文件来源', () => withServer('https://file-only.example', `${workbuddy},${alternate}`, async (url) => {
    await configured(url);
    assert.equal((await post(url, '/api/agent/message', { Origin: 'https://file-only.example', 'Sec-Fetch-Site': 'same-origin' })).status, 403);
  }));
  for (const [name, fileOrigins, envOrigin] of [['未配置时远程仍拒绝', undefined, undefined], ['无效环境配置不回退到文件的有效来源', workbuddy, 'https://invalid.example/']]) await t.test(name, () => withServer(fileOrigins, envOrigin, async (url) => {
    for (const prefix of ['agent', 'vision']) {
      const endpoint = prefix === 'agent' ? '/api/agent/message' : '/api/vision/recognise';
      assert.equal((await post(url, endpoint, { Origin: workbuddy, 'Sec-Fetch-Site': 'same-origin' })).status, 403);
      assert.equal((await request(url + `/api/${prefix}/status`, { headers: proxy })).status, 403);
      assert.equal((await request(url + `/api/${prefix}/status`)).status, 200);
    }
  }));
});
