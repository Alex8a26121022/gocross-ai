import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseEnvValue, readEnvValue } from '../env.mjs';
import { readPublicOrigins } from '../vision-access.mjs';

test('共用 .env 解析支持引号、注释和空赋值；不把下一项当作密钥', () => {
  const content = '\uFEFFDEEPSEEK_API_KEY=\r\nZHIPU_API_KEY=\r\nPUBLIC_ORIGIN="https://one.example,https://two.example:8443" # comment\r\nOTHER= plain # comment\nSINGLE=\' quoted \'\n';
  assert.equal(parseEnvValue(content, 'DEEPSEEK_API_KEY'), ''); assert.equal(parseEnvValue(content, 'ZHIPU_API_KEY'), '');
  assert.equal(parseEnvValue(content, 'PUBLIC_ORIGIN'), 'https://one.example,https://two.example:8443');
  assert.equal(parseEnvValue(content, 'OTHER'), 'plain'); assert.equal(parseEnvValue(content, 'SINGLE'), 'quoted');
  assert.equal(parseEnvValue(content, 'ABSENT'), '');
  assert.throws(() => parseEnvValue(content, '.*'), /INVALID_CONFIG_NAME/);
});

test('环境变量优先，缺省/空值读取 .env；无效显式来源不会回退放行', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gocross-env-test-'));
  t.after(async () => { assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir())); assert.ok(path.basename(directory).startsWith('gocross-env-test-')); await rm(directory, { recursive: true, force: true }); });
  const file = path.join(directory, '.env');
  await writeFile(file, 'PUBLIC_ORIGIN=\'https://file.example,https://second.example:8443\'\nDEEPSEEK_API_KEY=test-file-only\nZHIPU_API_KEY="test-vision-only"\n');
  assert.deepEqual(await readPublicOrigins({ env: {}, file }), ['https://file.example', 'https://second.example:8443']);
  assert.deepEqual(await readPublicOrigins({ env: { PUBLIC_ORIGIN: ' https://env.example ' }, file }), ['https://env.example']);
  assert.deepEqual(await readPublicOrigins({ env: { PUBLIC_ORIGIN: 'http://invalid.example' }, file }), []);
  assert.deepEqual(await readPublicOrigins({ env: { PUBLIC_ORIGIN: ' ' }, file }), ['https://file.example', 'https://second.example:8443']);
  assert.equal(await readEnvValue('DEEPSEEK_API_KEY', { env: {}, file }), 'test-file-only');
  assert.equal(await readEnvValue('ZHIPU_API_KEY', { env: {}, file }), 'test-vision-only');
  assert.equal(await readEnvValue('DEEPSEEK_API_KEY', { env: { DEEPSEEK_API_KEY: ' env-only ' }, file }), 'env-only');
  assert.deepEqual(await readPublicOrigins({ env: {}, file: path.join(directory, 'missing') }), []);
});
