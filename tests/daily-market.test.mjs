import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createDailyMarket } from '../daily-market.mjs';
import { DAILY_PRICE_AGE, usableQuote } from '../public/quotes.mjs';

test('每日快照合并并发请求，重启与页面刷新不重复采集，到期刷新保留真实采集时间', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'gocross-daily-'));
  try {
    let now = Date.parse('2026-10-16T04:00:00Z'), calls = 0;
    const cacheFile = path.join(dir, 'daily.json');
    const options = { cacheFile, now: () => now, collect: async (id) => { calls++; return { id, status: 'ok', checkedAt: new Date(now).toISOString(), offers: [{ platform: id, amount: 480, description: '原始详情', capturedAt: new Date(now).toISOString() }] }; } };
    const first = createDailyMarket(options);
    const [a, b] = await Promise.all([first.get('jd', 'SK-II'), first.get('jd', 'SK-II')]);
    assert.deepEqual(a, b); assert.equal(calls, 1);
    const second = createDailyMarket(options);
    now += DAILY_PRICE_AGE - 1;
    await second.refreshDue();
    const cached = await second.get('jd', 'SK-II');
    assert.equal(calls, 1); assert.equal(cached.offers[0].capturedAt, a.offers[0].capturedAt);
    now++;
    await second.refreshDue();
    const fresh = await second.get('jd', 'SK-II');
    assert.equal(calls, 2); assert.notEqual(fresh.offers[0].capturedAt, a.offers[0].capturedAt);
    const saved = JSON.parse(await readFile(cacheFile, 'utf8'));
    assert.equal(saved.records[0].data.offers[0].description, '原始详情');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('采集失败仍等待一天，不更新旧价格时间，过期价格不能参与最低价', async () => {
  let now = Date.parse('2026-10-16T04:00:00Z'), calls = 0;
  const daily = createDailyMarket({ now: () => now, collect: async (id) => { calls++; if (calls > 1) throw Error('login'); return { id, status: 'ok', offers: [{ platform: id, amount: 480, capturedAt: new Date(now).toISOString() }] }; } });
  const first = await daily.get('jd', '水');
  now += DAILY_PRICE_AGE;
  const failed = await daily.get('jd', '水');
  assert.equal(failed.status, 'unavailable');
  assert.equal(failed.lastSuccessAt, first.lastSuccessAt);
  assert.equal(failed.offers[0].capturedAt, first.offers[0].capturedAt);
  assert.equal(usableQuote(failed.offers[0], now), false);
  await daily.get('jd', '水'); assert.equal(calls, 2);
});

test('快照队列有容量上限，未成功采集不生成报价', async () => {
  const daily = createDailyMarket({ maximum: 2, collect: async (id) => ({ id, status: 'verification_required', offers: [] }) });
  for (const query of ['a', 'b', 'c']) await daily.get('jd', query);
  const snapshots = await daily.cached();
  assert.equal(snapshots.length, 2);
  assert.ok(snapshots.every((snapshot) => snapshot.offers.length === 0 && snapshot.lastSuccessAt === null));
});
