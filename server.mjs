import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readVisionKey, recogniseProduct, visionModel, VisionError } from './vision.mjs';
import { codespaceVisionOrigin, readPublicOrigins, canUseVision } from './vision-access.mjs';
import { createRateService } from './rates.mjs';
import { createCatalogueService, createProductSearch } from './catalogue.mjs';
import { validateIdentification } from './matching.mjs';
import { createCommerceService } from './commerce.mjs';
import { readAgentConfig, runAgent, primaryAgentModel, AgentError } from './agent.mjs';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '0.0.0.0';
const visionOrigin = codespaceVisionOrigin(process.env, port);
const publicOrigins = await readPublicOrigins();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
let visionBusy = false;
const visionRequests = [];
let agentBusy = false;
const agentRequests = [];
const rates = createRateService();
const catalogue = createCatalogueService();
const productSearch = createProductSearch();
const commerce = createCommerceService({ catalogue, productSearch, rates, cacheFile: fileURLToPath(new URL('./.runtime/daily-prices.json', import.meta.url)), disabledPlatforms: new Set((process.env.DISABLED_MARKET_PLATFORMS || '').split(',').filter(Boolean)) });
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}
async function visionRoute(req, res) {
  if (!canUseVision(req, visionOrigin, publicOrigins)) { json(res, 403, { error: 'VISION_ORIGIN_DENIED' }); return; }
  if (req.url === '/api/vision/status' && req.method === 'GET') {
    json(res, 200, { configured: Boolean(await readVisionKey()), model: visionModel }); return;
  }
  if (req.url !== '/api/vision/recognise' || req.method !== 'POST') { json(res, 405, { error: 'METHOD_NOT_ALLOWED' }); return; }
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new VisionError('INVALID_REQUEST', 415);
  if (Number(req.headers['content-length']) > 12 * 1024 * 1024) throw new VisionError('IMAGE_TOO_LARGE', 413);
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 12 * 1024 * 1024) throw new VisionError('IMAGE_TOO_LARGE', 413);
    chunks.push(chunk);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new VisionError('INVALID_REQUEST'); }
  if (!body || typeof body !== 'object') throw new VisionError('INVALID_REQUEST');
  if (visionBusy) throw new VisionError('VISION_BUSY', 429);
  const now = Date.now();
  while (visionRequests.length && now - visionRequests[0] > 60000) visionRequests.shift();
  if (visionRequests.length >= 10) throw new VisionError('VISION_RATE_LIMIT', 429);
  visionBusy = true;
  try {
    visionRequests.push(now);
    json(res, 200, await recogniseProduct(body.image, { key: await readVisionKey() }));
  } finally { visionBusy = false; }
}
const server = http.createServer(async (req, res) => {
  if (req.url?.startsWith('/api/agent/')) {
    try {
      if (!canUseVision(req, visionOrigin, publicOrigins)) { json(res, 403, { error: 'AGENT_ORIGIN_DENIED' }); return; }
      if (req.url === '/api/agent/status' && req.method === 'GET') { const config = await readAgentConfig().catch(() => ({ zhipu: '', deepseek: '' })); json(res, 200, { configured: Boolean(config.zhipu), model: primaryAgentModel }); return; }
      if (req.url !== '/api/agent/message' || req.method !== 'POST') { json(res, 405, { error: 'METHOD_NOT_ALLOWED' }); return; }
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new AgentError('INVALID_AGENT_REQUEST', 415);
      if (Number(req.headers['content-length']) > 12 * 1024 * 1024) throw new AgentError('IMAGE_TOO_LARGE', 413);
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 12 * 1024 * 1024) throw new AgentError('IMAGE_TOO_LARGE', 413);
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AgentError('INVALID_AGENT_REQUEST'); }
      if (agentBusy) throw new AgentError('AGENT_BUSY', 429);
      const now = Date.now();
      while (agentRequests.length && now - agentRequests[0] > 60000) agentRequests.shift();
      if (agentRequests.length >= 10) throw new AgentError('AGENT_RATE_LIMIT', 429);
      const controller = new AbortController();
      res.on('close', () => { if (!res.writableEnded) controller.abort(); });
      agentBusy = true;
      try {
        agentRequests.push(now);
        const config = await readAgentConfig();
        const result = await runAgent(body, { key: config.deepseek, zhipuKey: config.zhipu, commerce, rates, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(150000)]) });
        if (!res.destroyed) json(res, 200, result);
      } finally { agentBusy = false; }
    } catch (error) {
      if (!res.destroyed) json(res, error instanceof AgentError || error instanceof VisionError ? error.status : 500, { error: error instanceof AgentError || error instanceof VisionError ? error.code : 'INTERNAL_ERROR' });
    }
    return;
  }
  if (req.url?.startsWith('/api/products/')) {
    if (req.method !== 'GET') { json(res, 405, { error: 'METHOD_NOT_ALLOWED' }); return; }
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/products/match') {
        const raw = url.searchParams.get('item');
        if (!raw || raw.length > 6000) throw new Error('INVALID_SEARCH');
        let item;
        try { item = JSON.parse(raw); } catch { throw new Error('INVALID_SEARCH'); }
        validateIdentification(item);
        const query = item.search_keywords?.[0] || item.product_name || item.brand || item.category;
        json(res, 200, query ? await commerce.search(query, 1, item, url.searchParams.get('fresh') === '1') : { products: [], query: '', sources: [] });
      }
      else if (url.pathname === '/api/products/search') json(res, 200, await commerce.search(url.searchParams.get('q'), Number(url.searchParams.get('page') || 1), null, url.searchParams.get('fresh') === '1'));
      else if (url.pathname === '/api/products/home') json(res, 200, await commerce.home());
      else if (url.pathname === '/api/products/compare') json(res, 200, await commerce.compare(url.searchParams.get('id'), url.searchParams.get('fresh') === '1'));
      else if (url.pathname === '/api/products/detail') json(res, 200, await productSearch.detail(url.searchParams.get('id')));
      else json(res, 404, { error: 'NOT_FOUND' });
    } catch (error) { json(res, error.message === 'INVALID_SEARCH' ? 400 : 503, { error: error.message === 'INVALID_SEARCH' ? 'INVALID_SEARCH' : 'OFFICIAL_SEARCH_UNAVAILABLE' }); }
    return;
  }
  if (req.url === '/api/rates' || req.url === '/api/catalogue') {
    if (!['GET', 'HEAD'].includes(req.method)) { json(res, 405, { error: 'METHOD_NOT_ALLOWED' }); return; }
    try {
      const data = await (req.url === '/api/rates' ? rates.get() : catalogue.get());
      json(res, data.status === 'unavailable' ? 503 : 200, data);
    } catch { json(res, 503, { status: 'unavailable', error: 'OFFICIAL_SOURCE_UNAVAILABLE' }); }
    return;
  }
  if (req.url?.startsWith('/api/vision/')) {
    try { await visionRoute(req, res); }
    catch (error) { json(res, error instanceof VisionError ? error.status : 500, { error: error instanceof VisionError ? error.code : 'INTERNAL_ERROR' }); }
    return;
  }
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }
  try {
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = requested === '/' ? 'index.html' : requested.slice(1);
    const file = path.resolve(root, relative);
    if (!file.startsWith(root) || requested.includes('\\')) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    const content = await readFile(file);
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; frame-src https://www.openstreetmap.org; img-src 'self' https://pic.cdfmembers.com blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    const status = error instanceof URIError ? 400 : error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 500;
    res.writeHead(status); res.end(http.STATUS_CODES[status]);
  }
});
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Choose another PORT.` : error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => {
  console.log(`GoCross listening on ${host}:${server.address().port}`);
  if (process.env.DISABLE_MARKET_FETCH !== '1') { void rates.start(); void catalogue.start(); commerce.start(); }
});
server.on('close', () => commerce.stop());
