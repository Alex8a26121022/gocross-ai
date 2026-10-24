import { stores, mapEmbedUrl, mapStopsEmbedUrl, routeUrl, amapRouteUrl, distanceKm, parseOrigin, shoppingRoute } from './maps.mjs?v=20261020a';
import { createChatStore, chatSnapshot, searchChats } from './chat-history.mjs?v=20261020a';
import { planQuantity, planTotals, planSnapshot, planItemText } from './plans.mjs?v=20261020a';

const $ = (s) => document.querySelector(s);
let savedLanguage;
try { savedLanguage = localStorage.getItem('gocross-language'); } catch { /* Optional preference. */ }
const state = { lang: savedLanguage === 'en' ? 'en' : 'zh', turns: [], image: null, busy: false, controller: null, error: null, retry: null, stopped: false, planQty: Object.create(null), storeId: 'cdf', route: null, chatId: null, createdAt: null, restored: false, storageError: false };
const chatStore = createChatStore();
const savedChats = { items: [], loading: false, error: false, selected: new Set(), deleting: false, notice: '' };
let saving = Promise.resolve(), navigation = 0;
const t = (zh, en) => state.lang === 'zh' ? zh : en;
const errors = {
  AGENT_NOT_CONFIGURED: ['助手暂时无法连接，请稍后重试。', 'The assistant is temporarily unavailable. Please try again shortly.'],
  AGENT_AUTH_ERROR: ['助手暂时无法连接，请稍后重试。', 'The assistant is temporarily unavailable. Please try again shortly.'],
  AGENT_RATE_LIMIT: ['请求过于频繁，请稍后重试。', 'Too many requests. Please retry shortly.'],
  AGENT_BUSY: ['助手正在处理另一项任务，请稍后重试。', 'The assistant is handling another request. Please retry shortly.'],
  AGENT_TIMEOUT: ['本次分析超时，尚未获得完整结论。可缩短清单后重试。', 'Analysis timed out without a complete answer. Try a shorter shopping list.'],
  INVALID_AGENT_RESULT: ['这次未能完成回答，请重试。', 'I couldn’t complete that response. Please try again.'],
  INVALID_AGENT_TOOL: ['这次查询未能完成，请重试。', 'I couldn’t complete that lookup. Please try again.'],
  AGENT_ORIGIN_DENIED: ['无法从当前页面连接助手，请重新打开过关页面后重试。', 'Please reopen GoCross and try again.'],
  IMAGE_TOO_LARGE: ['请使用不超过 8 MB 的图片。', 'Use an image up to 8 MB.'],
  INVALID_IMAGE: ['请选择有效的 JPG、PNG 或 WebP 商品图片。', 'Choose a valid JPG, PNG or WebP product image.'],
  INVALID_AGENT_REQUEST: ['请输入需求或选择图片；需求最长 1800 字。', 'Enter a request or choose an image. Requests can be up to 1,800 characters.'],
  CANCELLED: ['已停止等待本次回答。', 'Stopped waiting for this response.'],
  NETWORK: ['暂时无法完成分析，请检查连接后重试。', 'Could not complete the analysis. Check the connection and retry.'],
};
function node(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
function link(label, url) { try { const parsed = new URL(url); if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return node('span', '', label); } catch { return node('span', '', label); } const el = node('a', '', label); el.href = url; el.target = '_blank'; el.rel = 'noreferrer'; return el; }
function timestamp(value) { return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat(state.lang === 'zh' ? 'zh-CN' : 'en-GB', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(new Date(value)) + t(' 北京时间', ' UTC+8') : ''; }
function translate() {
  document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
  document.title = t('过关 GoCross · 珠澳消费助手', 'GoCross · Zhuhai–Macau consumer assistant');
  document.querySelectorAll('[data-zh]').forEach((el) => { el.textContent = el.dataset[state.lang]; });
  document.querySelectorAll('[data-placeholder-zh]').forEach((el) => { el.placeholder = el.dataset[state.lang === 'zh' ? 'placeholderZh' : 'placeholderEn']; });
  $('#language').textContent = t('EN', '中文'); $('#language').setAttribute('aria-label', t('Switch to English', '切换为中文'));
  $('#history-toggle').setAttribute('aria-label', t('历史记录', 'History'));
  $('#plans-toggle').setAttribute('aria-label', t('我的购物方案', 'My plans'));
  $('#plans-close').setAttribute('aria-label', t('关闭购物方案', 'Close plans'));
  $('#history-close').setAttribute('aria-label', t('关闭历史记录', 'Close history'));
  $('#saved-chat-note').hidden = !state.restored;
  $('#conversation').setAttribute('aria-label', t('与消费助手的对话', 'Conversation with the consumer assistant'));
  $('#image-preview').alt = t('待分析商品', 'Product to analyse');
  $('#query-error').hidden = !state.error; $('#query-error').textContent = t(...(errors[state.error] || errors.NETWORK));
  $('#retry').hidden = !state.retry || !state.error || state.busy;
  $('#request-status').hidden = !state.stopped; $('#request-status').textContent = t('已停止', 'Stopped');
  $('#working').textContent = t('正在查询商品、价格与路线…', 'Checking products, prices and routes…');
  renderConversation(); renderMap(); renderHistory(); renderHistoryNotice(); renderPlans(); renderPlanTable();
  if (state.turns.at(-1)?.result?.[state.lang]?.question) $('#query').placeholder = t('补充一下，我会接着帮你查。', 'Your reply — I’ll continue from here.');
  $('#store-map').title = t('购物门店地图', 'Shopping store map');
  document.querySelectorAll('.location-photos img').forEach((img, i) => { img.alt = i === 0 ? t('澳门半岛', 'Macau Peninsula') : t('路氹城', 'Cotai'); });
}
function renderConversation() {
  $('#welcome').hidden = state.turns.length > 0;
  const container = $('#conversation'); container.replaceChildren();
  for (const turn of state.turns) {
    const article = node('article', `message ${turn.role}`);
    if (turn.role === 'user') {
      if (turn.image) { const img = node('img'); img.src = turn.image; img.alt = t('用户上传的商品图片', 'Uploaded product image'); article.append(img); }
      article.append(node('p', '', turn.text || t('请分析这张商品图片。', 'Please analyse this product image.')));
    } else {
      const part = turn.result[state.lang];
      const label = node('div', 'assistant-label'), mark = node('img'); mark.src = '/assets/mark.svg'; mark.alt = ''; label.append(mark, node('span', '', 'GoCross')); article.append(label);
      if (part.answer) article.append(node('p', 'answer', part.answer));
      const customsCaveat = turn.result.trace.some(entry => entry.tool === 'customs_allowance') ? part.considerations.find(value => value.includes('12360')) : null;
      if (customsCaveat) article.append(node('p', 'customs-caveat', customsCaveat));
      const products = turn.result.products || [];
      if (products.length) article.append(renderProductRail(products));
      if (part.question) article.append(node('p', 'question', part.question));
      if (turn.result.products?.length || turn.result.route) {
        const actions = node('div', 'answer-actions');
        const pickButton = node('button', 'text-button save-plan-button', t('勾选商品生成路线', 'Pick items & plan'));
        pickButton.type = 'button';
        pickButton.addEventListener('click', () => { void showPlans(); });
        const saveButton = node('button', 'text-button save-plan-button', t('保存到我的购物方案', 'Save to my plans'));
        saveButton.type = 'button';
        saveButton.addEventListener('click', async () => { if (await savePlan()) { saveButton.textContent = t('已保存', 'Saved'); saveButton.disabled = true; } });
        const count = node('span', 'pick-count', t('未选商品', 'Nothing selected'));
        pickButton.classList.add('pick-plan');
        actions.append(count, pickButton, saveButton);
        syncSelectionUI();
        article.append(actions);
      }
      const routeLinks = turn.result.sources.filter((source) => source.url.startsWith('https://www.google.com/maps/dir/'));
      if (routeLinks.length) {
        const routes = node('div', 'route-actions');
        const stopStores = (turn.result.route?.stops || []).map((stop) => stores.find((store) => store.id === stop.id)).filter(Boolean);
        stopStores.forEach((store, index) => routes.append(link(t(`高德·第${index + 1}站 ${store.name} ↗`, `Amap · stop ${index + 1} ${store.en} ↗`), amapRouteUrl(null, store))));
        const combined = routeLinks.find((source) => new URL(source.url).searchParams.has('waypoints'));
        (combined ? [combined] : routeLinks).forEach((source) => routes.append(link(t('全程（Google）↗', 'Full route (Google) ↗'), source.url)));
        article.append(routes);
      }
      if (turn.result.sources.length || turn.result.trace.length || part.considerations.length || part.next_steps.length) {
        const details = node('details'); details.append(node('summary', '', t('来源与补充说明', 'Sources & details')));
        for (const [key, heading] of [['considerations', t('需核实', 'To verify')], ['next_steps', t('下一步', 'Next step')]]) {
          if (!part[key].length) continue;
        const values = part[key].filter(value => value !== customsCaveat);
        if (!values.length) continue;
        const list = node('ul'); values.forEach((value) => list.append(node('li', '', value))); details.append(node('h3', '', heading), list);
        }
        const sources = node('ul', 'source-list');
        for (const source of turn.result.sources) { const item = node('li'); item.append(link(`${source.id} · ${state.lang === 'zh' ? source.label : source.en}`, source.url)); if (source.checkedAt) item.append(node('small', '', timestamp(source.checkedAt))); sources.append(item); }
        const tools = { search_products: t('查询商品与公开报价', 'Search products & public offers'), get_exchange_rates: t('读取银行汇率', 'Read bank exchange rates'), find_stores: t('查收录门店', 'Look up listed stores'), calculate_cost: t('计算参考成本', 'Calculate reference cost'), compare_purchase_channels: t('比较线上与门店报价', 'Compare online & in-store offers'), plan_shopping_route: t('规划到店采购路线', 'Plan in-store shopping route') };
      tools.search_web = t('搜索公开来源链接', 'Search public source links'); tools.fetch_web_page = t('读取官方页面', 'Read official page');
      tools.customs_allowance = t('核对海关携带限额', 'Check customs allowances');
        const log = node('div', 'tool-log'); turn.result.trace.forEach((entry) => log.append(node('p', '', `${tools[entry.tool] || entry.tool} · ${entry.status === 'ok' ? t('已执行', 'Executed') : t('未取得可用结果', 'No usable result')}${entry.count === null ? '' : t(` · ${entry.count} 件候选`, ` · ${entry.count} candidates`)}`)));
        details.append(sources, log); article.append(details);
      }
    }
    container.append(article);
  }
}
function productFamily(name) {
  return String(name || '').replace(/[（(][^）)]*[）)]/g, ' ').replace(/\b\d+(?:\.\d+)?\s*(?:ml|g|kg|oz|片|粒|支|瓶|盒|包)\b/gi, ' ').replace(/(双瓶装|两支装|三支装|单瓶装|套装|组合装|礼盒装|礼盒|装)/g, ' ').replace(/\s+/g, ' ').trim() || String(name || '');
}
function groupProducts(products) {
  const map = new Map();
  for (const product of products) {
    const key = productFamily(product.name).toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(product);
  }
  return [...map.values()];
}
function productPriceValue(product) {
  const quote = product.quote;
  if (!quote) return Infinity;
  const value = Number.isFinite(quote.cny) && quote.cny > 0 ? quote.cny : Number(quote.amount);
  return Number.isFinite(value) && value > 0 ? value : Infinity;
}
function productSpecLabel(product, family) {
  if (product.specification) return product.specification;
  return String(product.name || '').replace(family, '').replace(/^[\s·\-—/]+/, '').trim();
}
function productCover(product) {
  if (typeof product.image === 'string' && product.image.startsWith('https://pic.cdfmembers.com/')) {
    const img = node('img', 'product-photo'); img.src = product.image; img.alt = product.name; img.loading = 'lazy';
    img.addEventListener('error', () => { img.replaceWith(productPlaceholder(product)); });
    return img;
  }
  return productPlaceholder(product);
}
function productPlaceholder(product) {
  const placeholder = node('div', 'product-photo product-photo--empty');
  placeholder.append(node('img')); placeholder.firstChild.src = '/assets/mark.svg'; placeholder.firstChild.alt = '';
  return placeholder;
}
function renderVariant(product, family, isLowest) {
  const card = node('article', 'variant');
  const pick = node('label', 'variant-pick');
  const box = node('input'); box.type = 'checkbox'; box.checked = selectedProducts.has(product.id);
  box.dataset.productId = product.id;
  box.setAttribute('aria-label', `${product.name} ${product.specification || ''}`.trim());
  box.addEventListener('change', () => { if (box.checked) selectedProducts.add(product.id); else selectedProducts.delete(product.id); syncSelectionUI(); void saveCurrentChat(); });
  pick.append(box, node('span', 'variant-spec', productSpecLabel(product, family) || product.name));
  if (isLowest && Number.isFinite(productPriceValue(product))) pick.append(node('em', 'variant-badge', t('最低价', 'Lowest')));
  card.append(pick);
  if (product.quote) {
    const quote = product.quote, price = node('p', 'product-price');
    price.append(node('strong', '', `${quote.currency} ${Number(quote.amount).toLocaleString(state.lang === 'zh' ? 'zh-CN' : 'en-GB')}`));
    if (quote.cny && quote.currency !== 'CNY') price.append(node('span', '', ` ≈ ¥${quote.cny.toFixed(2)}`));
    card.append(price, node('small', 'product-channel', quote.reference ? t('参考价 · 以门店当日标价为准', 'Typical price · in-store price applies') : quote.channel));
  } else card.append(node('small', 'variant-noprice', t('暂无有效报价', 'No current quote')));
  const purchaseUrl = product.quote?.url || product.sourceUrl;
  if (purchaseUrl) card.append(link(t('查看官网', 'View official'), purchaseUrl));
  const add = node('button', 'variant-add', selectedProducts.has(product.id) ? t('已加入方案', 'Added') : t('加入方案', 'Add to plan'));
  add.type = 'button'; add.dataset.id = product.id;
  if (selectedProducts.has(product.id)) add.classList.add('is-added');
  add.addEventListener('click', () => {
    if (selectedProducts.has(product.id)) selectedProducts.delete(product.id); else selectedProducts.add(product.id);
    syncSelectionUI();
    void saveCurrentChat();
  });
  card.append(add);
  return card;
}
function renderProductGroup(group) {
  const family = productFamily(group[0].name);
  const card = node('article', 'product-card product-group');
  card.append(productCover(group[0]));
  const body = node('div', 'product-card-body');
  const head = node('div', 'product-head');
  if (group[0].brand) head.append(node('small', 'product-brand', group[0].brand));
  head.append(node('b', 'product-title', family));
  body.append(head);
  if (group.length > 1) body.append(node('small', 'product-spec', t(`${group.length} 个规格可选`, `${group.length} options`)));
  const strip = node('div', 'variant-strip');
  const lowest = Math.min(...group.map(productPriceValue));
  for (const product of group) strip.append(renderVariant(product, family, productPriceValue(product) === lowest));
  body.append(strip);
  card.append(body); return card;
}
function renderProductRail(products) {
  const block = node('div', 'product-block');
  const head = node('div', 'product-block-head');
  head.append(node('span', 'product-count', t(`${products.length} 个可选`, `${products.length} options`)));
  const sort = node('select', 'card-sort');
  sort.setAttribute('aria-label', t('排序方式', 'Sort'));
  for (const [value, label] of [['default', t('推荐排序', 'Recommended')], ['asc', t('价格从低到高', 'Price low to high')], ['desc', t('价格从高到低', 'Price high to low')]]) { const option = node('option', '', label); option.value = value; sort.append(option); }
  head.append(sort);
  const rail = node('div', 'product-rail');
  const paint = () => {
    rail.replaceChildren();
    const list = [...products];
    if (sort.value !== 'default') list.sort((a, b) => sort.value === 'asc' ? productPriceValue(a) - productPriceValue(b) : productPriceValue(b) - productPriceValue(a));
    const groups = groupProducts(list);
    if (sort.value !== 'default') groups.sort((a, b) => {
      const left = Math.min(...a.map(productPriceValue)), right = Math.min(...b.map(productPriceValue));
      return sort.value === 'asc' ? left - right : right - left;
    });
    for (const group of groups) rail.append(renderProductGroup(group));
    syncSelectionUI();
  };
  sort.addEventListener('change', paint);
  paint();
  block.append(head, rail); return block;
}
function syncSelectionUI() {
  const count = selectedProducts.size;
  document.querySelectorAll('.pick-count').forEach((el) => { el.textContent = count ? t(`已选 ${count} 件`, `${count} selected`) : t('未选商品', 'Nothing selected'); });
  document.querySelectorAll('.variant-add').forEach((el) => {
    const on = selectedProducts.has(el.dataset.id);
    el.textContent = on ? t('已加入方案', 'Added') : t('加入方案', 'Add to plan');
    el.classList.toggle('is-added', on);
  });
  document.querySelectorAll('.variant-pick input').forEach(el => { el.checked = selectedProducts.has(el.dataset.productId); });
  if ($('#plans-dialog').open) renderPlanTable();
  updatePlanSelection();
}
function renderMap() {
  const selected = stores.find((s) => s.id === state.storeId) || stores[0];
  const selector = $('#map-store'); selector.replaceChildren();
  for (const store of stores) { const option = node('option', '', state.lang === 'zh' ? store.name : store.en); option.value = store.id; selector.append(option); }
  selector.value = selected.id;
  const stops = state.route?.stops || [], ids = stops.map((s) => s.id);
  const embed = ids.length ? mapStopsEmbedUrl(ids) : mapEmbedUrl(selected);
  if ($('#store-map').getAttribute('src') !== embed) $('#store-map').src = embed;
  $('#map-context').textContent = ids.length ? t('本次到店顺序', 'Your in-store stops') : t('在对话中告诉我清单和出发地。', 'Tell me your list and starting point in chat.');
  $('#map-address').textContent = state.lang === 'zh' ? selected.address : selected.addressEn;
  $('#map-source').href = selected.source;
  $('#map-directions').href = routeUrl('', selected, state.route?.mode || 'walking');
  $('#map-directions').hidden = stops.length > 0;
  $('#map-full-route').hidden = !state.route?.url;
  if (state.route?.url) $('#map-full-route').href = state.route.url;
  else $('#map-full-route').removeAttribute('href');
  const list = $('#map-stops'); list.replaceChildren(); list.hidden = !stops.length;
  const modes = { walking: t('步行', 'Walking'), driving: t('驾车', 'Driving'), transit: t('公共交通', 'Public transport') };
  for (const [index, stop] of stops.entries()) {
    const store = stores.find(s => s.id === stop.id);
    if (!store) continue;
    const item = node('li'), head = node('div', 'route-stop-head');
    head.append(node('strong', '', state.lang === 'zh' ? store.name : store.en), node('small', '', storeArea(store)));
    item.append(head);
    if (stop.items?.length) item.append(node('p', 'route-stop-items', stop.items.join(state.lang === 'zh' ? '、' : ', ')));
    const origin = index ? stores.find(s => s.id === stops[index - 1].id) : parseOrigin(state.route.origin || '');
    if (origin) item.append(node('p', 'route-leg-distance', `${modes[state.route.mode]} ${distanceKm(origin, store).toFixed(1)} km ${t('（直线距离）', '(straight line)')}`));
    item.append(link(t('导航', 'Navigate'), routeUrl(origin || state.route.origin || '', store, state.route.mode)));
    list.append(item);
  }
}
function busy(value) { state.busy = value; $('#send').disabled = value; $('#send').hidden = value; $('#stop').hidden = !value; $('#working').hidden = !value; $('#query').disabled = value; $('#file-input').disabled = value; $('#remove-image').disabled = value; $('#history-toggle').disabled = value; $('#plans-toggle').disabled = value; $('#plans-save').disabled = value; $('#retry').disabled = value; $('#conversation').setAttribute('aria-busy', String(value)); }
function clearImage(revoke = true) { if (revoke && state.image) URL.revokeObjectURL(state.image.url); state.image = null; $('#image-area').hidden = true; $('#image-preview').removeAttribute('src'); $('#file-input').value = ''; }
function history() { return state.turns.slice(-8).map((turn) => ({ role: turn.role, content: turn.role === 'user' ? (turn.text || t('已上传商品图片。', 'A product image was uploaded.')).slice(0, 2000) : [turn.result[state.lang].answer, ...(turn.result.products || []).map((product) => `${product.name} ${product.specification}`), turn.result[state.lang].question].join('\n').slice(0, 2000) })); }
async function send(retry = null) {
  if (state.busy || savedChats.deleting) return;
  const message = retry ? retry.message : $('#query').value.trim(), image = retry ? retry.image : state.image;
  if (!message && !image) { state.error = 'INVALID_AGENT_REQUEST'; translate(); $('#query').focus(); return; }
  navigation++;
  if (state.turns.at(-1)?.stopped && state.turns.at(-1).text === message) state.turns.pop();
  const body = retry?.body || JSON.stringify({ message, language: state.lang, history: history(), ...(image ? { image: image.data } : {}) });
  const payload = { message, image, body, draft: retry?.draft ?? $('#query').value };
  const controller = new AbortController(); state.controller = controller;
  const turn = { role: 'user', text: message, ...(image ? { image: image.data } : {}) }; state.turns.push(turn);
  state.error = null; state.retry = null; state.stopped = false; busy(true); translate(); $('#working').scrollIntoView({ block: 'nearest' });
  try {
    const response = await fetch('/api/agent/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(155000)]), body });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'NETWORK'); if (controller.signal.aborted) throw new DOMException('Stopped', 'AbortError');
    state.turns.push({ role: 'assistant', result });
    if (result.route) { state.route = result.route; state.storeId = result.route.stops[0]?.id || state.storeId; }
    else if (result.trace.some((entry) => entry.tool === 'plan_shopping_route' && entry.status === 'ok')) state.route = null;
    $('#query').value = ''; clearImage(); void saveCurrentChat();
  } catch (error) {
    if (state.controller !== controller) return;
    $('#query').value = payload.draft;
    if (controller.signal.aborted) { turn.stopped = true; state.stopped = true; state.error = null; }
    else { state.turns = state.turns.filter(entry => entry !== turn); state.retry = payload; state.error = error.name === 'TimeoutError' ? 'AGENT_TIMEOUT' : error.message; }
  } finally { if (state.controller === controller) { state.controller = null; busy(false); translate(); $('#query').focus(); } }
}
async function upload(file) {
  if (!file || state.busy) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { state.error = 'INVALID_IMAGE'; translate(); return; }
  if (file.size > 8 * 1024 * 1024) { state.error = 'IMAGE_TOO_LARGE'; translate(); return; }
  const reader = new FileReader();
  reader.onload = () => { if (state.busy) return; clearImage(); state.image = { url: URL.createObjectURL(file), data: reader.result }; $('#image-preview').src = state.image.url; $('#image-name').textContent = file.name; $('#image-area').hidden = false; void send(); };
  reader.onerror = () => { state.error = 'INVALID_IMAGE'; translate(); }; reader.readAsDataURL(file);
}
function rememberActive(id) { try { if (id) localStorage.setItem('gocross-active-chat', id); else localStorage.removeItem('gocross-active-chat'); } catch { /* The history drawer still works without an active-chat preference. */ } }
function renderHistoryNotice() { $('#history-notice').hidden = !state.storageError; $('#history-notice').textContent = state.storageError === 'read' ? t('暂时无法恢复上次对话，可在历史记录中重试。', 'Your last chat couldn’t be restored. Open History to try again.') : t('此浏览器暂时无法保存对话，请保留本页，稍后重试。', 'This browser couldn’t save your chat. Keep this page open and try again later.'); }
function saveCurrentChat() {
  if (!state.turns.some((turn) => turn.role === 'assistant')) return saving;
  try {
    state.chatId ||= crypto.randomUUID();
    const chat = chatSnapshot({ id: state.chatId, createdAt: state.createdAt, turns: state.turns, route: state.route, storeId: state.storeId, plan: planSnapshot(latestProducts(), selectedProducts, state.planQty) }); state.createdAt = chat.createdAt;
    saving = saving.then(async () => {
      try { await chatStore.save(chat); state.storageError = false; if (state.chatId === chat.id) rememberActive(chat.id); }
      catch { state.storageError = 'write'; }
      renderHistoryNotice();
    });
  } catch { state.storageError = 'write'; renderHistoryNotice(); }
  return saving;
}
const plansKey = 'gocross.plans.v2';
const selectedProducts = new Set();
function readPlanIds() { try { const value = JSON.parse(localStorage.getItem(plansKey) || '[]'); return Array.isArray(value) ? value.filter((id) => typeof id === 'string').slice(0, 50) : []; } catch { return []; } }
let planIds = readPlanIds();
function writePlanIds(next) { try { localStorage.setItem(plansKey, JSON.stringify(next)); planIds = next; return true; } catch { return false; } }
function renderPlans() {
  const list = $('#plans-list'); list.replaceChildren(); $('#plans-count').textContent = String(planIds.length);
  const plans = planIds.map((id) => savedChats.items.find((chat) => chat.id === id)).filter(Boolean);
  $('#plans-status').textContent = savedChats.loading ? t('正在读取…', 'Loading…') : !planIds.length ? t('还没有保存的方案。完成一次查询后点「保存当前方案」。', 'No saved plans yet. Finish a query, then choose Save current plan.') : !plans.length ? t('方案暂时无法读取，请稍后重试。', 'Plans are unavailable. Please try again later.') : '';
  for (const chat of plans) {
    const item = node('article', 'plan-item');
    const head = node('div', 'plan-item-head');
    head.append(node('strong', '', chat.title || t('购物方案', 'Shopping plan')), node('small', '', timestamp(chat.updatedAt)));
    const actions = node('div', 'plan-item-actions');
    const open = node('button', 'secondary-button', t('打开', 'Open')); open.type = 'button';
    open.addEventListener('click', () => { if ($('#plans-dialog').open) $('#plans-dialog').close(); void openSavedChat(chat.id); });
    const exportButton = node('button', 'secondary-button', t('导出', 'Export')); exportButton.type = 'button';
    exportButton.addEventListener('click', () => { void exportPlan(chat); });
    const remove = node('button', 'secondary-button plan-remove', t('移除', 'Remove')); remove.type = 'button';
    remove.addEventListener('click', () => { if (writePlanIds(planIds.filter((id) => id !== chat.id))) renderPlans(); });
    actions.append(open, exportButton, remove); item.append(head, actions); list.append(item);
  }
}
function latestProducts() {
  const products = new Map();
  for (const turn of state.turns) if (turn.role === 'assistant') for (const product of turn.result?.products || []) products.set(product.id, product);
  return [...products.values()];
}
const storeAliases = { cdf: ['中免', 'cdf'], yaohan: ['新八佰伴', '八佰伴'], 'four-seasons': ['四季'], venetian: ['威尼斯人'], senado: ['新马路'], 'taipa-village': ['官也街', '氹仔'] };
function productStore(product) {
  if (product.storeId) { const fixed = stores.find((store) => store.id === product.storeId); if (fixed) return fixed; }
  const channel = product.quote?.channel || '';
  if (!channel) return null;
  return stores.find((item) => channel.includes(item.name) || channel.includes(item.en) || item.name.includes(channel)) || stores.find((item) => (storeAliases[item.id] || []).some((word) => channel.includes(word))) || null;
}
function productPlace(product) {
  const store = productStore(product);
  return store ? `${store.region} · ${store.district} · ${store.name}` : (product.quote?.channel || '');
}
function storeArea(store) {
  const names = { '澳门半岛': 'Macau Peninsula', '路氹': 'Cotai', '氹仔': 'Taipa', '路环': 'Coloane', '大堂区': 'Sé', '路氹城': 'Cotai', '嘉模堂区': 'Our Lady of Carmel' };
  return [store.region, store.district].map(value => state.lang === 'zh' ? value : names[value] || value).join(' · ');
}
function renderPlanTable() {
  const rows = $('#plan-rows'); rows.replaceChildren();
  const products = latestProducts();
  $('#plan-table-empty').textContent = products.length ? '' : t('当前对话还没有可选商品。先在上方提问，例如「兰蔻面霜多少钱」。', 'No products in this chat yet. Ask something like “How much is a Lancôme cream?” first.');
  const region = $('#plan-region').value;
  const shown = products.filter((product) => !region || productStore(product)?.region === region);
  $('#plan-table-empty').textContent = products.length && !shown.length ? t('该区域暂无可选商品，可切换区域查看。', 'No items in this area. Try another area.') : products.length ? '' : $('#plan-table-empty').textContent;
  const groups = new Map();
  for (const product of shown) { const id = productStore(product)?.id || ''; if (!groups.has(id)) groups.set(id, []); groups.get(id).push(product); }
  for (const [id, products] of groups) {
    const store = stores.find(store => store.id === id), group = node('tr', 'plan-group');
    const heading = node('th'); heading.colSpan = 5; heading.scope = 'rowgroup';
    heading.append(node('strong', '', store ? state.lang === 'zh' ? store.name : store.en : t('其他', 'Other')));
    if (store) heading.append(node('small', '', storeArea(store)));
    group.append(heading); rows.append(group);
    for (const product of products) {
    const tr = node('tr');
    tr.dataset.productId = product.id;
    const cell = node('td', 'plan-check'), box = node('input'); box.type = 'checkbox'; box.checked = selectedProducts.has(product.id); box.setAttribute('aria-label', product.name);
    box.addEventListener('change', () => { if (box.checked) selectedProducts.add(product.id); else selectedProducts.delete(product.id); syncSelectionUI(); [...$('#plan-rows').querySelectorAll('tr')].find(row => row.dataset.productId === product.id)?.querySelector('input')?.focus({ preventScroll: true }); void saveCurrentChat(); });
    const pick = node('label', 'plan-pick'); pick.append(box); cell.append(pick);
    const nameCell = node('td');
    nameCell.append(node('strong', '', product.name));
    if (product.specification) nameCell.append(node('small', '', product.specification));
    if (product.matchKind === 'category') nameCell.append(node('small', 'plan-tag', t('同类候选', 'Similar item')));
    const priceCell = node('td', 'plan-price');
    priceCell.textContent = product.quote ? `${product.quote.currency} ${Number(product.quote.amount).toLocaleString(state.lang === 'zh' ? 'zh-CN' : 'en-GB')}` : '—';
    const quantityCell = node('td', 'plan-quantity'), stepper = node('div', 'quantity-stepper');
    const value = planQuantity(state.planQty, product.id);
    const output = node('output', '', String(value)); output.setAttribute('aria-label', t(`${product.name} 数量`, `${product.name} quantity`));
    for (const [label, change] of [['−', -1], ['+', 1]]) {
      const button = node('button', '', label); button.type = 'button';
      button.setAttribute('aria-label', change < 0 ? t(`减少 ${product.name} 数量`, `Decrease ${product.name} quantity`) : t(`增加 ${product.name} 数量`, `Increase ${product.name} quantity`));
      button.disabled = change < 0 ? value === 1 : value === 99;
      button.addEventListener('click', () => {
        state.planQty[product.id] = Math.max(1, Math.min(99, value + change));
        renderPlanTable();
        const buttons = [...$('#plan-rows').querySelectorAll('tr')].find(row => row.dataset.productId === product.id)?.querySelectorAll('.quantity-stepper button');
        const target = buttons?.[change < 0 ? 0 : 1];
        (target?.disabled ? buttons[change < 0 ? 1 : 0] : target)?.focus({ preventScroll: true });
        void saveCurrentChat();
      });
      if (change < 0) stepper.append(button, output); else stepper.append(button);
    }
    quantityCell.append(stepper);
    const removeCell = node('td', 'plan-remove'), remove = node('button', 'text-button', t('移除', 'Remove')); remove.type = 'button'; remove.disabled = !selectedProducts.has(product.id);
    remove.setAttribute('aria-label', t(`移除 ${product.name}`, `Remove ${product.name}`));
    remove.addEventListener('click', () => { selectedProducts.delete(product.id); syncSelectionUI(); $('#plan-rows input')?.focus({ preventScroll: true }); void saveCurrentChat(); });
    removeCell.append(remove);
    tr.append(cell, nameCell, priceCell, quantityCell, removeCell); rows.append(tr);
    }
  }
  updatePlanSelection();
}
function updatePlanSelection() {
  const total = planTotals(latestProducts(), selectedProducts, state.planQty);
  const number = value => value.toLocaleString(state.lang === 'zh' ? 'zh-CN' : 'en-GB', { maximumFractionDigits: 2 });
  const amount = total.amounts.map(value => `${value.currency} ${number(value.amount)}`).join(' + ') || '—';
  $('#plan-selected').textContent = total.count ? t(`已选 ${total.count} 款 · ${total.units} 件`, `${total.count} items · ${total.units} units`) : t('勾选后生成路线', 'Select items to plan');
  $('#plan-total').textContent = t('合计（参考）', 'Estimated total') + `: ${amount}${total.cny ? ` ≈ ¥${number(total.cny)}` : ''}${total.unpriced ? t(`；${total.unpriced} 件无报价，未计入`, `; ${total.unpriced} unpriced units excluded`) : ''}${total.unconverted && total.cny ? t('；人民币仅含已换算部分', '; CNY includes converted items only') : ''}`;
  $('#plan-route').disabled = !total.count || state.busy;
}
function planRouteFromSelection() {
  const products = latestProducts().filter((product) => selectedProducts.has(product.id));
  const section = $('#plan-route-result');
  section.hidden = false; section.replaceChildren();
  if (!products.length) { section.append(node('p', 'plan-route-empty', t('先勾选要买的商品。', 'Select the items first.'))); return; }
  const originText = $('#plan-origin').value.trim();
  const origin = originText ? parseOrigin(originText) : null;
  const buckets = new Map(), unmatched = [];
  for (const product of products) {
    const store = productStore(product);
    if (!store) { unmatched.push(product); continue; }
    if (!buckets.has(store.id)) buckets.set(store.id, { store, items: [] });
    buckets.get(store.id).items.push(product);
  }
  let groups = [...buckets.values()];
  if (!groups.length) { section.append(node('p', 'plan-route-empty', t('所选商品还没有匹配到门店，换个商品或告诉我购买地点。', 'No destination matched these items yet.'))); return; }
  if (groups.length > 3) groups = origin ? [...groups].sort((a, b) => distanceKm(origin, a.store) - distanceKm(origin, b.store)) : groups;
  groups = groups.slice(0, 3);
  let route;
  try { route = shoppingRoute(origin || originText, groups.map((group) => group.store.id), 'walking'); }
  catch { section.append(node('p', 'plan-route-empty', t('这条路线暂时无法生成，请检查出发地。', 'This route could not be generated. Check the starting point.'))); return; }
  const head = node('div', 'plan-route-head');
  head.append(node('h4', '', t('推荐采购路线', 'Suggested shopping route')));
  if (route.url) { const all = link(t('全程（Google）↗', 'Full route (Google) ↗'), route.url); all.className = 'plan-route-all'; head.append(all); }
  section.append(head);
  section.append(node('p', 'plan-route-summary', route.stops.map((stop, index) => `${index + 1}. ${stop.name}`).join(' → ')));
  if (route.stops.length === 1) section.append(node('p', 'plan-route-note', t('所选商品都指向同一家门店，所以只有一站。','All selected items point to the same destination, so there is one stop only.')));
  const list = node('ol', 'plan-stop-list');
  let previous = origin;
  route.stops.forEach((stop, index) => {
    const group = groups.find((item) => item.store.id === stop.id);
    const item = node('li', 'plan-stop');
    const badge = node('span', 'plan-stop-index', String(index + 1));
    const body = node('div', 'plan-stop-body');
    body.append(node('strong', '', stop.name));
    body.append(node('small', 'plan-stop-meta', [group?.store.region, group?.store.district, group?.store.address].filter(Boolean).join(' · ')));
    body.append(node('small', 'plan-stop-items', (group?.items || []).map((product) => planItemText(product, state.planQty)).join('、')));
    if (previous) { const km = distanceKm(previous, stop); body.append(node('small', 'plan-stop-leg', t(`距上一站约 ${km.toFixed(1)} km（直线）`, `≈ ${km.toFixed(1)} km from previous stop (straight line)`))); }
    const nav = link(t('高德导航 ↗', 'Amap ↗'), amapRouteUrl(index ? route.stops[index - 1] : origin, stop, 'walking')); nav.className = 'plan-stop-nav';
    item.append(badge, body, nav); list.append(item);
    previous = stop;
  });
  section.append(list);
  if (unmatched.length) section.append(node('p', 'plan-route-note', t(`未匹配门店：${unmatched.map((product) => product.name).join('、')}`, `No destination yet: ${unmatched.map((product) => product.name).join(', ')}`)));
}
async function showPlans() {
  renderPlans(); renderPlanTable(); openDialog('#plans-dialog');
  try { savedChats.items = await chatStore.list(); savedChats.error = false; } catch { savedChats.error = true; }
  savedChats.loading = false; renderPlans();
  try { renderPlanTable(); } catch (error) { $('#plan-table-empty').textContent = `${t('清单加载失败', 'Could not load items')}：${error.message}`; }
}
async function savePlan() {
  if (!state.turns.some((turn) => turn.role === 'assistant')) { $('#plans-status').textContent = t('先完成一次查询，再保存方案。', 'Finish a query before saving a plan.'); return; }
  await saveCurrentChat();
  if (!state.chatId || state.storageError) { $('#plans-status').textContent = t('此浏览器暂时无法保存方案。', 'This browser could not save the plan.'); return false; }
  try { savedChats.items = await chatStore.list(); } catch { /* keep local list */ }
  if (!planIds.includes(state.chatId) && !writePlanIds([state.chatId, ...planIds].slice(0, 50))) { $('#plans-status').textContent = t('此浏览器暂时无法保存方案。', 'This browser could not save the plan.'); return; }
  renderPlans(); $('#plans-status').textContent = t('已保存到「我的购物方案」。', 'Saved to My plans.');
  return true;
}
async function exportPlan(chat) {
  try {
    const full = await chatStore.get(chat.id);
    const blob = new Blob([JSON.stringify({ app: 'GoCross', exportedAt: new Date().toISOString(), plan: full }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), anchor = node('a'); anchor.href = url; anchor.download = `gocross-plan-${new Date().toISOString().slice(0, 10)}.json`; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch { $('#plans-status').textContent = t('导出失败，请稍后重试。', 'Export failed. Please try again later.'); }
}
function renderHistory() {
  const list = $('#history-list'); list.replaceChildren();
  const matches = searchChats(savedChats.items, $('#history-search').value);
  $('#history-status').textContent = savedChats.notice === 'delete_error' ? t('删除失败，记录仍然保留，请重试。', 'Could not delete. Your conversations are still saved. Retry.') : savedChats.notice === 'deleted' ? t(`已删除 ${savedChats.deletedCount} 条对话。`, `Deleted ${savedChats.deletedCount} conversations.`) : savedChats.loading ? t('正在读取…', 'Loading…') : savedChats.error ? t('暂时无法读取历史记录，请稍后重试。', 'History is unavailable. Please try again later.') : !savedChats.items.length ? t('与助手聊一聊，对话会自动保存在这里。', 'Start a chat. Your conversations will appear here automatically.') : !matches.length ? t('没有找到相关对话。', 'No matching conversations.') : '';
  for (const chat of matches) {
    const row = node('div', 'history-row'), pick = node('label', 'history-pick'), checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.checked = savedChats.selected.has(chat.id); checkbox.disabled = savedChats.deleting;
    checkbox.setAttribute('aria-label', t(`选择 ${chat.title || '图片购物咨询'}`, `Select ${chat.title || 'Image shopping request'}`));
    checkbox.addEventListener('change', () => { if (checkbox.checked) savedChats.selected.add(chat.id); else savedChats.selected.delete(chat.id); renderHistorySelection(); });
    pick.append(checkbox);
    const button = node('button', `history-item${chat.id === state.chatId ? ' is-current' : ''}`); button.type = 'button';
    button.disabled = savedChats.deleting;
    const title = node('span', 'history-item-title'); title.append(node('strong', '', chat.title || t('图片购物咨询', 'Image shopping request')));
    if (chat.id === state.chatId) { title.append(node('small', 'history-current', t('当前', 'Current'))); button.setAttribute('aria-current', 'true'); }
    button.append(title, node('small', 'history-date', timestamp(chat.updatedAt)), node('span', 'history-preview', chat.preview[state.lang]));
    button.addEventListener('click', () => { void openSavedChat(chat.id); }); row.append(pick, button); list.append(row);
  }
  renderHistorySelection();
}
function renderHistorySelection() {
  const matches = searchChats(savedChats.items, $('#history-search').value), count = savedChats.selected.size;
  const visibleCount = matches.filter(chat => savedChats.selected.has(chat.id)).length;
  $('#history-select-all').disabled = !matches.length || savedChats.loading || savedChats.deleting;
  $('#history-select-all').checked = Boolean(matches.length && visibleCount === matches.length);
  $('#history-select-all').indeterminate = visibleCount > 0 && visibleCount < matches.length;
  $('#history-delete').disabled = !count || savedChats.deleting;
  $('#history-delete').textContent = savedChats.deleting ? t('正在删除…', 'Deleting…') : t(`删除所选${count ? `（${count}）` : ''}`, `Delete selected${count ? ` (${count})` : ''}`);
  $('#history-selected').textContent = t(`已选 ${count} 条`, `${count} selected`);
  $('#history-close').disabled = savedChats.deleting;
}
async function deleteSelectedHistory() {
  if (!savedChats.selected.size || savedChats.deleting) return;
  const ids = [...savedChats.selected]; savedChats.deleting = true; savedChats.notice = ''; navigation++; renderHistory();
  try {
    await saving;
    await chatStore.remove(ids);
    const remainingPlans = planIds.filter(id => !ids.includes(id));
    if (!writePlanIds(remainingPlans)) planIds = remainingPlans;
    savedChats.items = savedChats.items.filter(chat => !ids.includes(chat.id));
    savedChats.selected.clear();
    if (ids.includes(state.chatId)) reset();
    savedChats.notice = 'deleted'; savedChats.deletedCount = ids.length; renderPlans();
  } catch { savedChats.notice = 'delete_error'; }
  finally { savedChats.deleting = false; renderHistory(); $('#history-search').focus(); }
}
async function showHistory() {
  if (state.busy) return;
  $('#history-search').value = ''; savedChats.loading = true; savedChats.error = false; savedChats.notice = ''; savedChats.selected.clear(); savedChats.items = []; renderHistory(); openDialog('#history-dialog');
  await saving;
  try { savedChats.items = await chatStore.list(); } catch { savedChats.error = true; }
  savedChats.loading = false; renderHistory();
}
async function openSavedChat(id, startup = false) {
  const ticket = ++navigation;
  try {
    await saving;
    const chat = await chatStore.get(id);
    if (ticket !== navigation || state.busy || startup && ($('#query').value || state.turns.length)) return;
    if (state.storageError === 'write' && state.turns.length && state.chatId !== id) { await saveCurrentChat(); if (state.storageError) { savedChats.error = true; renderHistory(); return; } }
    if (ticket !== navigation || state.busy) return;
    clearImage(); state.chatId = chat.id; state.createdAt = chat.createdAt; state.turns = chat.turns; state.route = chat.route; state.storeId = chat.storeId; state.restored = true; state.error = null; state.retry = null; state.stopped = false; state.planQty = Object.assign(Object.create(null), chat.plan?.quantities || {}); selectedProducts.clear();
    for (const id of chat.plan?.selected || []) if (latestProducts().some(product => product.id === id)) selectedProducts.add(id);
    $('#query').value = ''; rememberActive(chat.id); translate();
    if (state.storageError === 'read') { state.storageError = false; renderHistoryNotice(); }
    if ($('#history-dialog').open) $('#history-dialog').close();
    if (!startup) { $('.chat-workspace').scrollIntoView({ block: 'start' }); $('#query').focus({ preventScroll: true }); }
  } catch { if (ticket === navigation) { savedChats.error = true; renderHistory(); if (startup) { rememberActive(null); state.storageError = 'read'; renderHistoryNotice(); } } }
}
function reset() { navigation++; state.controller?.abort(); state.controller = null; busy(false); state.turns = []; state.route = null; state.storeId = 'cdf'; state.chatId = null; state.createdAt = null; state.restored = false; state.retry = null; state.stopped = false; state.planQty = Object.create(null); selectedProducts.clear(); rememberActive(null); clearImage(); state.error = null; $('#query').value = ''; translate(); $('#query').focus(); window.scrollTo(0, 0); }
function dialogFocusables(dialog) {
  return [...dialog.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')].filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
}
function openDialog(selector) {
  const dialog = $(selector); dialog.showModal(); dialogFocusables(dialog)[0]?.focus();
}
for (const [dialogId, triggerId] of [['#plans-dialog', '#plans-toggle'], ['#history-dialog', '#history-toggle']]) {
  const dialog = $(dialogId);
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); if (!savedChats.deleting) dialog.close(); }
    if (event.key === 'Tab') {
      const elements = dialogFocusables(dialog), first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  dialog.addEventListener('cancel', event => { if (savedChats.deleting) event.preventDefault(); });
  dialog.addEventListener('close', () => { if (!$(triggerId).disabled) $(triggerId).focus({ preventScroll: true }); });
}
$('#query-form').addEventListener('submit', (event) => { event.preventDefault(); void send(); });
$('#query').addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void send(); } });
$('#file-input').addEventListener('change', (event) => upload(event.target.files[0])); $('#remove-image').addEventListener('click', () => clearImage());
$('#query-form').addEventListener('dragover', (event) => event.preventDefault()); $('#query-form').addEventListener('drop', (event) => { event.preventDefault(); void upload(event.dataTransfer.files[0]); });
$('#stop').addEventListener('click', () => state.controller?.abort()); $('#home').addEventListener('click', reset);
$('#retry').addEventListener('click', () => { if (state.retry) void send(state.retry); });
$('#language').addEventListener('click', () => { state.lang = state.lang === 'zh' ? 'en' : 'zh'; try { localStorage.setItem('gocross-language', state.lang); } catch { /* Optional preference. */ } translate(); });
$('#map-store').addEventListener('change', (event) => { state.storeId = event.target.value; state.route = null; renderMap(); if (!state.busy) void saveCurrentChat(); });
$('#history-toggle').addEventListener('click', () => { void showHistory(); });
$('#plans-toggle').addEventListener('click', () => { void showPlans(); });
$('#plans-close').addEventListener('click', () => $('#plans-dialog').close());
$('#plans-save').addEventListener('click', () => { void savePlan(); });
$('#plan-route').addEventListener('click', planRouteFromSelection);
$('#plan-region').addEventListener('change', renderPlanTable);
$('#history-close').addEventListener('click', () => $('#history-dialog').close());
$('#history-search').addEventListener('input', renderHistory);
$('#history-delete').addEventListener('click', () => { void deleteSelectedHistory(); });
$('#history-select-all').addEventListener('change', event => { for (const chat of searchChats(savedChats.items, $('#history-search').value)) { if (event.target.checked) savedChats.selected.add(chat.id); else savedChats.selected.delete(chat.id); } renderHistory(); });
renderPlans();
translate();
try { const active = localStorage.getItem('gocross-active-chat'); if (active) void openSavedChat(active, true); } catch { /* Start a new chat when optional browser preferences are unavailable. */ }

const backgroundMotion = $('#background-motion');
function syncBackgroundMotion() {
  document.documentElement.dataset.backgroundPaused = String(document.hidden || backgroundMotion.getAttribute('aria-pressed') === 'true');
}
backgroundMotion.addEventListener('click', () => {
  backgroundMotion.setAttribute('aria-pressed', String(backgroundMotion.getAttribute('aria-pressed') !== 'true'));
  syncBackgroundMotion();
});
document.addEventListener('visibilitychange', syncBackgroundMotion);
syncBackgroundMotion();
