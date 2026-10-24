import { readFile } from 'node:fs/promises';

export function parseEnvValue(content, name) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error('INVALID_CONFIG_NAME');
  // Horizontal whitespace keeps an empty assignment from consuming the next line.
  const match = content.replace(/^\uFEFF/, '').match(new RegExp(`^[ \\t]*${name}[ \\t]*=[ \\t]*(?:"([^"\\r\\n]*)"|'([^'\\r\\n]*)'|([^\\r\\n#]*))`, 'm'));
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

export async function readEnvValue(name, { env = process.env, file = new URL('./.env', import.meta.url) } = {}) {
  if (env[name]?.trim()) return env[name].trim();
  try { return parseEnvValue(await readFile(file, 'utf8'), name); }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
}
