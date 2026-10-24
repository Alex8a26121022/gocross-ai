import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

test('Macau feed photographs are local, credited and within the download budget', async () => {
  const root = new URL('../public/assets/macau/', import.meta.url);
  const { photos } = JSON.parse(await readFile(new URL('credits.json', root), 'utf8'));
  assert.ok(photos.length >= 4 && photos.length <= 6);
  let bytes = 0;
  for (const photo of photos) {
    assert.match(photo.file, /^bg-[a-z-]+\.jpg$/);
    assert.match(photo.source, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    assert.ok(photo.author && photo.license && photo.licenseUrl && photo.changes);
    assert.ok(photo.width >= 1400 && photo.width <= 1800);
    const size = (await stat(new URL(photo.file, root))).size;
    assert.equal(size, photo.bytes);
    bytes += size;
  }
  assert.ok(bytes <= 1_500_000, `Added JPEGs total ${bytes} bytes`);
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const stage = html.slice(html.indexOf('<div class="bg-stage"'), html.indexOf('<div class="app-shell"'));
  const referenced = [...stage.matchAll(/src="([^"]+)"/g)].map((match) => match[1]);
  for (const source of new Set(referenced)) {
    assert.match(source, /^\/assets\/macau\/[a-z-]+\.jpg$/);
    assert.ok((await stat(new URL(source.slice(1), new URL('../public/', import.meta.url)))).size > 0);
  }
});
