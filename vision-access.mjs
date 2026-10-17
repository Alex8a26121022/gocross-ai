export function codespaceVisionOrigin(env, port) {
  if (env.CODESPACES !== 'true') return '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(env.CODESPACE_NAME || '') ||
      env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN !== 'app.github.dev' ||
      !Number.isInteger(port) || port < 1 || port > 65535) return '';
  return `https://${env.CODESPACE_NAME}-${port}.app.github.dev`;
}

export function canUseVision(req, publicOrigin) {
  const { host = '', origin } = req.headers;
  const localHost = /^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host);
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  if (local && localHost && (!origin || origin === `http://${host}`)) return true;
  if (!publicOrigin) return false;
  // Origin checks prevent cross-site browser use; this public endpoint is not authenticated.
  // Codespaces can rewrite Host to an internal address; compare the browser's exact Origin.
  if (origin) return origin === publicOrigin;
  return req.method === 'GET' && req.url === '/api/vision/status';
}
