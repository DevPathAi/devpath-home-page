import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ROOT,
  loadFontManifest,
} from './visual-evidence.mjs';

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function fontCacheDirectory() {
  return join(ROOT, loadFontManifest().cache_directory);
}

export async function verifyVisualFonts() {
  const manifest = loadFontManifest();
  const directory = fontCacheDirectory();
  for (const font of manifest.fonts) {
    const path = join(directory, font.file);
    if (!existsSync(path)) throw new Error(`missing pinned visual font: ${font.file}`);
    const actual = hash(await readFile(path));
    if (actual !== font.sha256) throw new Error(`visual font hash mismatch: ${font.file}`);
  }
  return { directory, manifest };
}

async function downloadFont(font, directory) {
  const response = await fetch(font.url, { redirect: 'error' });
  if (!response.ok) throw new Error(`failed to download ${font.file}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (hash(bytes) !== font.sha256) throw new Error(`downloaded visual font hash mismatch: ${font.file}`);
  const temporary = join(directory, `${font.file}.tmp`);
  await writeFile(temporary, bytes, { flag: 'wx' });
  await rename(temporary, join(directory, font.file));
}

export async function prepareVisualFonts() {
  const manifest = loadFontManifest();
  const directory = fontCacheDirectory();
  await mkdir(directory, { recursive: true });
  for (const font of manifest.fonts) {
    const path = join(directory, font.file);
    let valid = false;
    try {
      valid = existsSync(path) && hash(await readFile(path)) === font.sha256;
    } catch {
      valid = false;
    }
    if (valid) continue;
    await rm(path, { force: true });
    await rm(`${path}.tmp`, { force: true });
    await downloadFont(font, directory);
  }
  return verifyVisualFonts();
}

export async function loadVisualFontAssets() {
  const { directory, manifest } = await verifyVisualFonts();
  return Promise.all(manifest.fonts.map(async (font) => ({
    ...font,
    bytes: await readFile(join(directory, font.file)),
  })));
}

async function cli() {
  const command = process.argv[2];
  if (command === 'prepare') await prepareVisualFonts();
  else if (command === 'verify') await verifyVisualFonts();
  else throw new Error('usage: visual-fonts.mjs <prepare|verify>');
  process.stdout.write(`visual fonts ${command} complete\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await cli();
}
