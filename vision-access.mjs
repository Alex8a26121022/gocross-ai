import { readEnvValue } from './env.mjs';

export function parsePublicOrigins(value) {
  if (typeof value !== 'string') return [];
  return [...new Set(value.split(',').map((entry) => entry.trim()).filter((entry) => {
    const match = /^https:\/\/(\[[a-f0-9:]+\]|[a-z0-9.-]+)(?::([1-9]\d{0,4}))?$/.exec(entry);
    if (!match || match[2] && Number(match[2]) > 65535) return false;
    const host = match[1];
    if (!host.startsWith('[') && (host.length > 253 || !host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))) return false;
    try { return new URL(entry).hostname === host; } catch { return false; }
  }))];
}

export async function readPublicOrigins(options) {
  return parsePublicOrigins(await readEnvValue('PUBLIC_ORIGIN', options));
}

export function codespaceVisionOrigin(env, port) {
  if (env.CODESPACES !== 'true') return '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(env.CODESPACE_NAME || '') ||
      env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN !== 'app.github.dev' ||
      !Number.isInteger(port) || port < 1 || port > 65535) return '';
  return `https://${env.CODESPACE_NAME}-${port}.app.github.dev`;
}

export function canUseVision(req, codespaceOrigin = '', publicOrigins = []) {
  const { host = '', origin } = req.headers;
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') return false;
  if (codespaceOrigin && req.method === 'POST' && !origin) return false;
  const localHost = /^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host);
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  if (local && localHost && (!origin || origin === `http://${host}`)) return true;
  // The Codespaces tunnel rewrites public HTTPS Origin to https://localhost:port.
  if (codespaceOrigin && local && localHost && origin === `https://${host}` && site === 'same-origin') return true;
  // Origin checks prevent cross-site browser use; this public endpoint is not authenticated.
  // Codespaces can rewrite Host to an internal address; compare the browser's exact Origin.
  if (origin) return Boolean(codespaceOrigin && origin === codespaceOrigin) || publicOrigins.includes(origin) && (site === 'same-origin' || site === 'none');
  return Boolean(codespaceOrigin || publicOrigins.length) && req.method === 'GET' && ['/api/vision/status', '/api/agent/status'].includes(req.url);
}
