// 번들러 없음 — 배포 산출물(dist/)을 만드는 단순 복사 빌드.
// 배포 대상 파일만 dist/로 미러링해 tests/·docs/·apps-script/·node_modules를 서빙에서 제외한다.
// CF Pages 설정: build command = `npm run build`, output dir = `dist`.
import { cp, rm, mkdir, writeFile, readdir, readFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { collectNotes, renderNote, renderIndex, renderSitemap, renderHomepageNotes } from './scripts/notes.mjs';
import { collectUpdates, renderUpdatesFeed, renderUpdatesPage } from './scripts/updates.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const outputDir = process.env.BUILD_OUTPUT_DIR || 'dist';
if (!/^(?:dist|build\/[a-z0-9-]+)$/.test(outputDir)) {
  throw new Error(`허용되지 않은 BUILD_OUTPUT_DIR: ${outputDir}`);
}
const dist = root + outputDir;

// 배포에 포함할 최상위 엔트리(존재하는 것만 복사).
const DEPLOY_ENTRIES = ['index.html', 'privacy.html', 'terms.html', 'beta.html', 'about.html', 'contact.html', '404.html', 'src', 'assets', '_headers', '_redirects', '_routes.json', 'robots.txt', 'favicon.ico', 'ads.txt'];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

let copied = 0;
for (const entry of DEPLOY_ENTRIES) {
  try {
    await cp(root + entry, dist + '/' + entry, { recursive: true });
    copied += 1;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    // 없는 엔트리는 조용히 건너뛴다(빌드 초기 단계 허용).
  }
}
// 개발 기록 렌더. 원고 검증에 실패하면 여기서 예외가 나 빌드가 중단된다 —
// 조용히 누락되는 것보다 시끄럽게 실패하는 쪽을 택한다.
const notes = collectNotes(root + 'content/notes');
const noteTemplate = readFileSync(root + 'templates/note.html', 'utf-8');
const indexTemplate = readFileSync(root + 'templates/notes-index.html', 'utf-8');

await mkdir(dist + '/notes', { recursive: true });
for (const note of notes) {
  await writeFile(dist + `/notes/${note.slug}.html`, renderNote(note, noteTemplate));
}
await writeFile(dist + '/notes/index.html', renderIndex(notes, indexTemplate));
await writeFile(dist + '/sitemap.xml', renderSitemap(notes));
console.log(`rendered ${notes.length} notes`);

const homepagePath = dist + '/index.html';
const homepage = await readFile(homepagePath, 'utf8');
const notesMarker = '<!-- LATEST_NOTES_PLACEHOLDER -->';
if (!homepage.includes(notesMarker)) throw new Error('홈페이지에 최신 개발 기록 자리표시자가 없다');
await writeFile(homepagePath, homepage.replace(notesMarker, renderHomepageNotes(notes)));

const updates = collectUpdates(root + 'content/updates');
const updatesTemplate = readFileSync(root + 'templates/updates.html', 'utf8');
await mkdir(dist + '/updates', { recursive: true });
await writeFile(dist + '/updates/index.html', renderUpdatesPage(updates, updatesTemplate));
await writeFile(dist + '/updates/feed.json', renderUpdatesFeed(updates));
console.log(`rendered ${updates.length} updates`);

// _headers 는 /assets/* 를 max-age=31536000, immutable 로 선언한다. 그런데 파일명이
// styles.css 로 고정이면 내용을 고쳐도 이미 받아 간 브라우저는 1년간 옛 파일을 쓴다 —
// 선언이 사실이 아니었다. 이름에 내용 해시를 넣어 「불변」을 사실로 만든다.
const ASSET_SOURCES_ONLY = ['og-image.template.html']; // OG 이미지 생성용, 배포 대상 아님
const CSS_ENTRY = 'styles.css';
const assetDir = dist + '/assets';
const renamed = new Map();

const assetNames = await readdir(assetDir);
for (const name of assetNames) {
  if (ASSET_SOURCES_ONLY.includes(name)) {
    await rm(assetDir + '/' + name);
    continue;
  }
  // styles.css는 tokens.css의 해시 이름을 내용에 반영한 다음 그 최종 내용으로
  // 해시해야 한다. 먼저 이름을 정하면 content-addressed immutable 계약이 거짓이 된다.
  if (name === CSS_ENTRY) continue;
  const body = await readFile(assetDir + '/' + name);
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 8);
  const dot = name.lastIndexOf('.');
  const hashed = `${name.slice(0, dot)}.${hash}${name.slice(dot)}`;
  await rename(assetDir + '/' + name, assetDir + '/' + hashed);
  renamed.set(name, hashed);
}

let styles = await readFile(assetDir + '/' + CSS_ENTRY, 'utf-8');
for (const [from, to] of renamed) {
  styles = styles.split(`./${from}`).join(`./${to}`);
  styles = styles.split(`/assets/${from}`).join(`/assets/${to}`);
}
await writeFile(assetDir + '/' + CSS_ENTRY, styles);
const stylesHash = createHash('sha256').update(styles).digest('hex').slice(0, 8);
const hashedStyles = `styles.${stylesHash}.css`;
await rename(assetDir + '/' + CSS_ENTRY, assetDir + '/' + hashedStyles);
renamed.set(CSS_ENTRY, hashedStyles);

// 참조가 옛 이름에 남으면 사이트가 통째로 스타일을 잃으므로, 렌더된 글까지 포함해
// dist 안의 모든 HTML 을 훑는다.
const htmlPaths = [
  ...(await readdir(dist)).filter((f) => f.endsWith('.html')).map((f) => `${dist}/${f}`),
  ...(await readdir(dist + '/notes')).map((f) => `${dist}/notes/${f}`),
  `${dist}/updates/index.html`,
];
for (const path of htmlPaths) {
  let html = await readFile(path, 'utf-8');
  for (const [from, to] of renamed) {
    html = html.split(`/assets/${from}`).join(`/assets/${to}`);
  }
  await writeFile(path, html);
}
console.log(`hashed ${renamed.size} assets across ${htmlPaths.length} pages`);

console.log(`built dist/ (${copied} entries)`);
