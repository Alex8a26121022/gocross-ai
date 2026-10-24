import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatSnapshot, chatSummary, validChat, searchChats, createChatStore } from '../public/chat-history.mjs';

const part = { answer: '面膜报价待核实', question: '', considerations: [], next_steps: [] };
const result = { zh: part, en: { ...part, answer: 'Check the face mask price.', question: 'Where will you start?' }, sources: [], trace: [], products: [{ name: '可复美面膜', specification: '25g*5', image: 'https://pic.cdfmembers.com/a.jpg', quote: null }] };
const at = '2026-10-19T01:00:00+08:00';
const input = { id: 'chat-1', turns: [{ role: 'user', text: '  买 ＡＢＣ\n面膜  ', image: 'data:image/png;base64,iVBORw0KGgo=' }, { role: 'assistant', result }], route: { mode: 'walking', stops: [{ id: 'cdf', items: ['面膜'] }], url: 'https://www.google.com/maps/dir/?api=1', legs: [] }, storeId: 'cdf' };

test('历史快照保留双语、图片和路线，且不会被后续状态修改污染', () => {
  const source = structuredClone(input), saved = chatSnapshot(source, at);
  assert.equal(saved.createdAt, at); assert.equal(saved.updatedAt, at); assert.ok(validChat(saved));
  source.turns[0].text = 'new'; source.route.stops[0].items.push('other');
  assert.equal(saved.turns[0].text, input.turns[0].text); assert.deepEqual(saved.route.stops[0].items, ['面膜']);
  assert.match(saved.turns[0].image, /^data:image/); assert.equal(saved.turns[1].result.en.question, 'Where will you start?');
  const continued = chatSnapshot({ ...saved, createdAt: saved.createdAt }, '2026-10-19T02:00:00+08:00');
  assert.equal(continued.createdAt, at); assert.notEqual(continued.updatedAt, at);
});
test('标题与搜索包含用户、AI和商品文字；列表不携带上传的图片数据', () => {
  const summary = chatSummary(chatSnapshot(input, at));
  assert.equal(summary.title, '买 ＡＢＣ 面膜');
  for (const query of ['abc', '报价', 'FACE MASK', '可复美', 'Where will you start']) assert.equal(searchChats([summary], query).length, 1);
  assert.equal(searchChats([summary], '不存在').length, 0);
  assert.ok(!JSON.stringify(summary).includes('base64'));
  const imageOnly = chatSnapshot({ ...input, turns: [{ role: 'user', text: '', image: input.turns[0].image }, input.turns[1]] }, at);
  assert.equal(chatSummary(imageOnly).title, ''); assert.equal(chatSummary(imageOnly).preview.en, result.en.answer);
  const newer = { ...summary, id: 'newer', updatedAt: '2026-10-19T03:00:00+08:00' };
  assert.deepEqual(searchChats([summary, newer], '').map((c) => c.id), ['newer', 'chat-1']);
});
test('损坏记录、临时blob图片和无效路线不会被恢复', () => {
  const good = chatSnapshot(input, at);
  for (const bad of [{ ...good, version: 2 }, { ...good, updatedAt: 'bad' }, { ...good, turns: [{ role: 'system', content: 'bad' }] }, { ...good, turns: [{ role: 'user', text: '', image: 'blob:old' }] }, { ...good, storeId: 'unknown' }, { ...good, route: { ...good.route, stops: [null] } }, { ...good, route: { ...good.route, url: 'javascript:alert(1)' } }, { ...good, turns: [{ role: 'assistant', result: { ...result, en: {} } }] }]) assert.equal(validChat(bad), false);
  assert.throws(() => chatSnapshot({ ...input, turns: [] }, at), /INVALID_SAVED_CHAT/);
});
test('浏览器存储不可用时返回失败，不伪装为已保存或空历史', async () => {
  const store = createChatStore(null);
  await assert.rejects(store.list(), /HISTORY_UNAVAILABLE/);
  await assert.rejects(store.save(chatSnapshot(input, at)), /HISTORY_UNAVAILABLE/);
  await assert.rejects(store.get('chat-1'), /HISTORY_UNAVAILABLE/);
});
test('浏览器拒绝访问存储属性时仍可初始化应用的历史模块', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  try {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, get() { throw new Error('Denied'); } });
    const store = createChatStore();
    await assert.rejects(store.list(), /HISTORY_UNAVAILABLE/);
  } finally { if (previous) Object.defineProperty(globalThis, 'indexedDB', previous); else delete globalThis.indexedDB; }
});
test('saved quantities and selections round-trip while old records remain valid', () => {
  const saved = chatSnapshot({ ...input, plan: { selected: ['p1'], quantities: { p1: 2 } } }, at);
  assert.deepEqual(saved.plan, { selected: ['p1'], quantities: { p1: 2 } });
  assert.ok(validChat(chatSnapshot(input, at)));
  assert.equal(validChat({ ...saved, plan: { selected: ['p1'], quantities: { p1: 100 } } }), false);
});
test('selected-history deletion rejects empty/invalid selections and storage errors', async () => {
  const store = createChatStore(null);
  await assert.rejects(store.remove([]), /INVALID_CHAT_SELECTION/);
  await assert.rejects(store.remove(['../wrong']), /INVALID_CHAT_SELECTION/);
  await assert.rejects(store.remove(['chat-1']), /HISTORY_UNAVAILABLE/);
});
