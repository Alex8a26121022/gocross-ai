import { searchTerm, identificationQuery } from './shopping.mjs';
import { stores, validPoint, parseOrigin, nearbyStores, routeUrl, mapEmbedUrl } from './maps.mjs';
import { usableQuote } from './quotes.mjs';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = { lang: 'zh', products: [], sources: [], onlineFallback: null, insufficientIdentity: false, query: '', page: 1, hasMore: false, revision: 0, busy: false, image: null, imageFile: null, identification: null, visionBusy: false, visionController: null, origin: null, originText: '', storeId: 'cdf', locating: false, locationStatus: '', locationRevision: 0, selectedId: null, fx: null };
const t = (zh, en) => state.lang === 'zh' ? zh : en;
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const money = (value) => new Intl.NumberFormat(state.lang === 'zh' ? 'zh-CN' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const yuan = (value) => `¥${money(value)}`;
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6">${name === 'image' ? '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>' : '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0z"/><circle cx="12" cy="10" r="2"/>'}</svg>`;
const localDate = (value) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString(state.lang === 'zh' ? 'zh-CN' : 'en-GB', { timeZone: 'Asia/Shanghai', hour12: false }) : '—';
function showError(message) { $('#query-error').textContent = message; $('#query-error').hidden = false; }
function translate() {
  document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
  $$('[data-zh]').forEach((node) => { node.textContent = node.dataset[state.lang]; });
  $$('[data-placeholder-zh]').forEach((node) => { node.placeholder = node.dataset[state.lang === 'zh' ? 'placeholderZh' : 'placeholderEn']; });
  $('#language').textContent = t('EN', '中文'); $('#language').setAttribute('aria-label', t('Switch to English', '切换为中文'));
  $$('[data-icon]').forEach((node) => { node.innerHTML = icon(node.dataset.icon); });
  renderProducts(); renderStores();
  if ($('#comparison-dialog').open) renderComparison();
}
function validLink(url) { try { const parsed = new URL(url); return parsed.protocol === 'https:' ? parsed.href : '#'; } catch { return '#'; } }
function priceLabel(offer) { return !offer ? t('价格暂不可用', 'Price unavailable') : offer.cny !== null ? yuan(offer.cny) : `${offer.currency} ${money(offer.amount)}`; }
function renderProducts() {
  const fallback = state.onlineFallback;
  $('#online-fallback').hidden = !fallback || state.busy;
  $('#online-fallback').innerHTML = fallback ? `<p>${t('中免当前未找到匹配商品。您当前识别的商品，可能需要到这些线上第三方平台购买。', 'No matching product was found at CDF. The identified product may be available from these online platforms.')}</p><div>${fallback.platforms.map((platform) => `<a href="${escape(validLink(platform.searchUrl))}" target="_blank" rel="noreferrer">${escape(platform.name)} ↗</a>`).join('')}</div><small>${t('入口用于搜索，尚未确认在售或库存；仅显示已采集到的价格。', 'Search links do not confirm availability or stock. Only collected prices are displayed.')}</small>` : '';
  $('#results').setAttribute('aria-busy', String(state.busy));
  $('#search-button').disabled = state.busy || state.visionBusy;
  $('#refresh').disabled = state.busy || state.visionBusy;
  $('#search-status').textContent = state.busy ? t('正在查找商品与报价…', 'Finding products and prices…') : state.products.length ? t(`${state.products.length} 件商品`, `${state.products.length} products`) : '';
  if (!state.products.length) { $('#results').innerHTML = state.busy ? '' : `<div class="empty-state"><h2>${state.insufficientIdentity ? t('未识别到明确商品', 'No specific product identified') : fallback ? t('暂无可展示的商品报价', 'No collected prices available') : t(state.query ? '没有找到相关商品' : '暂时没有商品', state.query ? 'No matching products' : 'No products available')}</h2><p>${state.sources.find((source) => source.id === 'cdf')?.status === 'unavailable' ? t('中免暂时无法连接，请稍后重试。', 'CDF is temporarily unavailable. Please retry later.') : state.insufficientIdentity ? t('请上传商品包装图片，或直接输入品名搜索。', 'Upload product packaging or enter a product name.') : fallback ? t('可通过上方入口查看平台商品。', 'Use the links above to search the platforms.') : t('换一个商品名、品牌或型号再试试。', 'Try another product, brand or model.')}</p></div>`; }
  else $('#results').innerHTML = state.products.map((product, index) => {
    const validOffers = (product.offers || []).filter((offer) => usableQuote(offer));
    const offer = validOffers.find((offer) => offer.cny !== null) || validOffers[0];
    const fresh = offer && usableQuote(offer);
    const image = product.image?.startsWith('https://pic.cdfmembers.com/') ? `<img src="${escape(product.image)}" alt="${escape(product.name)}" loading="lazy">` : `<div class="product-image-empty">${escape(product.brand || product.name.slice(0, 2))}</div>`;
    return `<article class="product-card panel"><div class="product-image">${image}</div><div class="product-body"><h2>${escape(product.name)}</h2>${product.specification ? `<p class="product-spec">${escape(product.specification)}</p>` : ''}<div class="best-price"><strong>${fresh ? priceLabel(offer) : t('刷新查看价格', 'Refresh for price')}</strong><span>${t(validOffers.filter((item) => item.cny !== null).length > 1 ? '已采集报价中最低' : '最近采集价', validOffers.filter((item) => item.cny !== null).length > 1 ? 'Lowest collected' : 'Last collected price')}</span></div><p class="best-channel">${fresh ? `${escape(offer.channel)} · ${offer.method === 'offline' ? t('线下', 'In store') : t('线上', 'Online')}` : t('价格待更新', 'Price needs updating')}</p><p class="quote-time">${fresh ? `${t('采集于', 'Collected')} ${localDate(offer.capturedAt)}` : ''}</p><div class="card-actions">${fresh ? `<a class="buy-link" href="${escape(validLink(offer.url))}" target="_blank" rel="noreferrer">${t('去购买', 'Buy')} ↗</a>` : ''}<button class="text-button compare-entry" data-compare="${index}">${t('比价详情', 'Compare offers')} ›</button></div></div></article>`;
  }).join('');
  $$('[data-compare]').forEach((button) => button.addEventListener('click', () => openComparison(Number(button.dataset.compare))));
  $('#pagination').innerHTML = state.query && !state.identification && !state.busy ? `<button class="secondary-button" id="previous-page" ${state.page <= 1 ? 'disabled' : ''}>${t('上一页', 'Previous')}</button><span>${state.page}</span><button class="secondary-button" id="next-page" ${!state.hasMore ? 'disabled' : ''}>${t('下一页', 'Next')}</button>` : '';
  $('#previous-page')?.addEventListener('click', () => loadProducts(state.query, state.page - 1));
  $('#next-page')?.addEventListener('click', () => loadProducts(state.query, state.page + 1));
}
async function loadProducts(query = '', page = 1, fresh = false, identification = null) {
  const revision = ++state.revision;
  state.busy = true; state.onlineFallback = null; state.insufficientIdentity = false; state.query = query; state.page = page; $('#query-error').hidden = true;
  renderProducts();
  try {
    const url = identification ? `/api/products/match?${new URLSearchParams({ item: JSON.stringify(identification), fresh: fresh ? '1' : '0' })}` : query ? `/api/products/search?${new URLSearchParams({ q: query, page, fresh: fresh ? '1' : '0' })}` : '/api/products/home';
    const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
    const data = await response.json();
    if (revision !== state.revision) return;
    if (!response.ok || !Array.isArray(data.products)) throw Error('PRODUCTS_UNAVAILABLE');
    state.products = data.products; state.sources = data.sources || []; state.onlineFallback = data.onlineFallback || null; state.insufficientIdentity = Boolean(data.insufficientIdentity); state.hasMore = Boolean(data.hasMore);
  } catch {
    if (revision !== state.revision) return;
    state.products = []; state.sources = []; showError(t('暂时无法获取商品报价，请稍后重试。', 'Could not retrieve prices. Please retry.'));
  } finally {
    if (revision === state.revision) { state.busy = false; renderProducts(); if ($('#comparison-dialog').open) renderComparison(); }
  }
}
async function submitSearch(event) {
  event.preventDefault();
  if (state.busy || state.visionBusy) return;
  const query = searchTerm(state.imageFile ? $('#image-query').value || $('#query').value : $('#query').value);
  if (!query) { showError(t('请输入商品、品牌或型号。', 'Enter a product, brand or model.')); return; }
  await loadProducts(query, 1, true, state.imageFile && query === identificationQuery(state.identification || {}) ? state.identification : null);
}
const sourceStatus = (status) => ({ browser_restricted: t('请在平台网页查看当前价格', 'Check the platform website for current prices'), verification_required: t('平台要求登录或验证', 'Login or verification required'), browser_required: t('网页未公开返回商品价格', 'Price is not exposed in the response'), unavailable: t('暂时无法连接', 'Temporarily unavailable'), ok: t('已采集', 'Collected') })[status] || t('尚未查询', 'Not checked');
function renderComparison() {
  const product = state.products.find((item) => item.id === state.selectedId);
  if (!product) { $('#comparison-content').innerHTML = `<p>${t('当前商品已不在结果中，请关闭后重新搜索。', 'This product is no longer in the results. Close and search again.')}</p>`; return; }
  $('#comparison-title').textContent = product.name;
  const offers = (product.offers || []).filter((offer) => usableQuote(offer));
  const rows = offers.map((offer) => `<div class="offer-row"><div><h3>${escape(offer.channel)} · ${offer.method === 'offline' ? t('线下', 'In store') : t('线上', 'Online')}</h3><p>${escape(offer.specification || product.specification || '')}</p><small>${t('采集于', 'Collected')} ${localDate(offer.capturedAt)}</small></div><div><strong>${priceLabel(offer)}</strong>${offer.currency !== 'CNY' ? `<small>${offer.currency} ${money(offer.amount)}</small>` : ''}<a href="${escape(validLink(offer.url))}" target="_blank" rel="noreferrer">${t('查看商品', 'View product')} ↗</a></div></div>`).join('');
  const checked = (product.sources || state.sources).filter((source) => !offers.some((offer) => offer.platform === source.id));
  $('#comparison-content').innerHTML = `<p class="comparison-spec">${escape(product.specification || '')}</p><div class="offers">${rows || `<p>${t('暂未获得可比较的公开价格。', 'No comparable public prices are available.')}</p>`}</div>${checked.length ? `<section class="platform-checks"><h3>${t('其他平台', 'Other platforms')}</h3>${checked.map((source) => `<div class="platform-check"><div><b>${escape(source.name)}</b><p>${sourceStatus(source.status)}</p>${source.checkedAt ? `<small>${localDate(source.checkedAt)}</small>` : ''}</div>${source.searchUrl ? `<a href="${escape(validLink(source.searchUrl))}" target="_blank" rel="noreferrer">${t('平台搜索', 'Search platform')} ↗</a>` : ''}</div>`).join('')}</section>` : ''}<button id="refresh-comparison" class="secondary-button" ${state.busy ? 'disabled' : ''}>${t('刷新比价结果', 'Refresh comparison')}</button><div id="product-detail" class="product-detail">${product.description ? `<p>${escape(product.description)}</p>` : ''}${(product.sections || []).map((section) => `<h3>${escape(section.title)}</h3><p>${escape(section.text)}</p>${(section.properties || []).map((property) => `<p>${escape(property.name)}：${escape(property.value)}</p>`).join('')}`).join('')}${product.variants?.length ? `<p>${product.variants.map((variant) => `${escape(variant.sku || '')}${variant.barcode ? ` · ${escape(variant.barcode)}` : ''}`).join('<br>')}</p>` : ''}</div><details class="price-notes"><summary>${t('价格说明', 'Price details')}</summary><p>${t('国内平台对已搜索商品每 24 小时采集一次，展示最近采集价；刷新不会重复采集。只比较同款同规格的有效报价，运费、税费及实际支付价以平台结算为准。线下门店报价暂未获取。', 'Domestic prices for searched products are collected every 24 hours; refreshing does not repeat collection. Only valid quotes for matching variants are compared. Shipping, tax and final prices are determined at checkout. In-store quotes are unavailable.')}</p><div id="rate-reference"></div></details>`;
  $('#refresh-comparison').addEventListener('click', () => refreshComparison(product, true));
  renderRateReference();
}
async function openComparison(index) {
  const product = state.products[index]; state.selectedId = product.id;
  renderComparison(); $('#comparison-dialog').showModal();
  await refreshComparison(product);
}
async function refreshComparison(product, fresh = false) {
  if (!/^p\d+$/.test(product.id)) return;
  const revision = state.revision;
  $('#refresh-comparison').disabled = true;
  try {
    const response = await fetch(`/api/products/compare?${new URLSearchParams({ id: product.id, fresh: fresh ? '1' : '0' })}`, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw Error('COMPARISON_UNAVAILABLE');
    const data = await response.json();
    if (revision !== state.revision || !data.product) return;
    Object.assign(product, data.product, { sources: data.sources });
    renderProducts();
    if (state.selectedId === product.id && $('#comparison-dialog').open) renderComparison();
  } catch { if ($('#comparison-dialog').open && state.selectedId === product.id) { $('#refresh-comparison').disabled = false; $('#refresh-comparison').textContent = t('本次刷新失败，点击重试', 'Refresh failed. Retry'); } }
}

function renderRateReference() {
  const target = $('#rate-reference'); if (!target) return;
  const mop = state.fx?.rates?.MOP;
  target.innerHTML = mop ? `<p>1 MOP = ${mop.cnyPerUnit} CNY · ${localDate(mop.sourcePublishedAt)}</p><a href="https://www.boc.cn/sourcedb/whpj/" target="_blank" rel="noreferrer">${t('中国银行外汇牌价', 'Bank of China rates')} ↗</a>` : '';
}
async function loadRates() { try { const response = await fetch('/api/rates'); const data = await response.json(); if (response.ok) state.fx = data; renderRateReference(); } catch {} }
function clearImage() {
  state.revision++; state.visionController?.abort(); state.visionController = null; state.visionBusy = false; state.busy = false;
  if (state.image) URL.revokeObjectURL(state.image);
  state.image = null; state.imageFile = null; state.identification = null; state.onlineFallback = null; state.insufficientIdentity = false;
  $('#image-area').hidden = true; $('#image-preview').removeAttribute('src'); $('#image-query').value = ''; $('#file-input').value = '';
  renderProducts();
}
async function uploadImage(file) {
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) { showError(t('请选择 8 MB 以内的 JPG、PNG 或 WebP。', 'Choose a JPG, PNG or WebP under 8 MB.')); return; }
  clearImage(); $('#query-error').hidden = true;
  const revision = ++state.revision, controller = new AbortController();
  state.imageFile = file; state.image = URL.createObjectURL(file); state.visionController = controller; state.visionBusy = true;
  $('#image-preview').src = state.image; $('#image-area').hidden = false; $('#vision-status').textContent = t('正在识别商品…', 'Identifying product…'); renderProducts();
  const timer = setTimeout(() => controller.abort(), 55000);
  try {
    const image = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    const response = await fetch('/api/vision/recognise', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image }), signal: controller.signal });
    const data = await response.json(); if (revision !== state.revision) return;
    if (!response.ok) throw Error(data.error || 'VISION_FAILED');
    state.identification = data.identification;
    const query = identificationQuery(data.identification);
    $('#image-query').value = query; $('#vision-status').textContent = data.identification.product_name || t('已识别', 'Identified');
    state.visionBusy = false;
    if (data.identification.is_product === false) { state.products = []; state.sources = []; state.insufficientIdentity = true; }
    else if (query) await loadProducts(query, 1, true, data.identification);
    else showError(t('未识别到商品名称，可以直接输入商品名搜索。', 'No product name was identified. Enter a name to search.'));
  } catch (error) {
    if (state.imageFile !== file) return;
    const message = error.message === 'VISION_RATE_LIMIT' || error.message === 'VISION_BUSY' ? t('识图服务繁忙，请稍后重新上传。', 'Image recognition is busy. Retry shortly.') : error.message === 'NOT_CONFIGURED' ? t('识图服务尚未配置。', 'Image recognition is not configured.') : t('图片识别未完成，可直接输入商品名搜索。', 'Image identification failed. Enter a product name to search.');
    $('#vision-status').textContent = message; showError(message);
  } finally { clearTimeout(timer); if (state.imageFile === file) { state.visionBusy = false; state.visionController = null; renderProducts(); } }
}
function renderStores() {
  const listed = nearbyStores(state.origin);
  const selected = listed.find((store) => store.id === state.storeId) || listed[0];
  $('#locate-me').disabled = state.locating;
  $('#location-status').textContent = state.locating ? t('正在定位…', 'Getting your location…') : state.locationStatus || t('定位或输入经纬度后，自动按距离排序。地名可直接用于路线规划。', 'Use location or coordinates to sort by distance. Place names can be used for directions.');
  $('#nearby-stores').innerHTML = listed.map((store, index) => `<article class="nearby-store${store.id === selected.id ? ' selected' : ''}"><h3>${escape(state.lang === 'zh' ? store.name : store.en)}</h3><p>${escape(store.address)}</p>${store.distance !== null ? `<p class="store-distance">${index === 0 ? t('已收录地点中最近', 'Nearest listed location') + ' · ' : ''}${t('直线约', 'Approx. straight-line')} ${store.distance < 1 ? `${Math.round(store.distance * 1000)} m` : `${money(store.distance)} km`}</p>` : ''}<div><button type="button" class="text-button" data-show-store="${store.id}">${t('查看地图', 'Show map')}</button><a class="text-button" href="${escape(routeUrl(state.origin || state.originText, store, $('#route-mode').value))}" target="_blank" rel="noreferrer">${t('规划路线', 'Directions')} ↗</a><a class="store-source" href="${store.source}" target="_blank" rel="noreferrer">${t('门店来源', 'Source')}</a></div></article>`).join('');
  const embed = mapEmbedUrl(selected);
  if ($('#store-map').getAttribute('src') !== embed) $('#store-map').src = embed;
  $$('[data-show-store]').forEach((button) => button.addEventListener('click', () => { state.storeId = button.dataset.showStore; renderStores(); }));
}
function setOrigin(event) {
  event.preventDefault(); state.locationRevision++;
  state.originText = $('#origin').value.trim();
  state.origin = parseOrigin(state.originText);
  state.locating = false;
  state.storeId = nearbyStores(state.origin)[0].id;
  state.locationStatus = state.origin ? t('已按出发位置更新最近地点。', 'Nearest locations updated.') : state.originText ? t('地名已设为路线起点。定位或输入经纬度后可按距离排序。', 'Place name set for directions. Use location or coordinates for distance sorting.') : '';
  renderStores();
}
function locateUser() {
  const revision = ++state.locationRevision;
  if (!navigator.geolocation) { state.locationStatus = t('此浏览器不支持定位，可填写出发地。', 'Location is unavailable. Enter a starting point.'); renderStores(); return; }
  state.locating = true; renderStores();
  navigator.geolocation.getCurrentPosition((position) => {
    if (revision !== state.locationRevision) return;
    const point = { lat: position.coords.latitude, lon: position.coords.longitude };
    state.locating = false;
    if (!validPoint(point)) { state.locationStatus = t('定位结果无效，请填写出发地。', 'Invalid location. Enter your starting point.'); renderStores(); return; }
    state.origin = point; state.originText = ''; $('#origin').value = '';
    state.storeId = nearbyStores(point)[0].id;
    state.locationStatus = t('已定位，按直线距离排序。', 'Located. Sorted by straight-line distance.');
    renderStores();
  }, (error) => {
    if (revision !== state.locationRevision) return;
    state.locating = false;
    state.locationStatus = error.code === 1 ? t('定位未授权，可手动填写出发地。', 'Location permission denied. Enter your starting point.') : t('暂时无法定位，可手动填写出发地。', 'Could not get your location. Enter your starting point.');
    renderStores();
  }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
}

$('#query-form').addEventListener('submit', submitSearch);
$('#file-input').addEventListener('change', (event) => uploadImage(event.target.files[0]));
$('#remove-image').addEventListener('click', clearImage);
$('#query-form').addEventListener('dragover', (event) => event.preventDefault());
$('#query-form').addEventListener('drop', (event) => { event.preventDefault(); uploadImage(event.dataTransfer.files[0]); });
$('#refresh').addEventListener('click', () => loadProducts(state.query, state.page, true, state.imageFile ? state.identification : null));
$('#home').addEventListener('click', () => {
  clearImage(); $('#query').value = ''; $('#query-error').hidden = true;
  $('#comparison-dialog').close(); state.selectedId = null;
  loadProducts(); window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('#open-stores').addEventListener('click', () => $('#store-panel').scrollIntoView({ block: 'start', behavior: 'smooth' }));
$('#language').addEventListener('click', () => { state.lang = state.lang === 'zh' ? 'en' : 'zh'; translate(); });
$('#close-comparison').addEventListener('click', () => $('#comparison-dialog').close());
$('#comparison-dialog').addEventListener('click', (event) => { if (event.target === $('#comparison-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
$('#location-form').addEventListener('submit', setOrigin);
$('#locate-me').addEventListener('click', locateUser);
$('#route-mode').addEventListener('change', renderStores);
translate(); void loadProducts(); void loadRates();
setInterval(() => { void loadRates(); }, 30 * 60 * 1000);
setInterval(() => { renderProducts(); if ($('#comparison-dialog').open) renderComparison(); }, 60000);
