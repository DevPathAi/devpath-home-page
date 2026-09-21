// 번들러 없음 — 배포 산출물(dist/)을 만드는 단순 복사 빌드.
// 배포 대상 파일만 dist/로 미러링해 tests/·docs/·apps-script/·node_modules를 서빙에서 제외한다.
// CF Pages 설정: build command = `npm run build`, output dir = `dist`.
import { cp, rm, mkdir, writeFile, readdir, readFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { collectNotes, renderNote, renderIndex, renderSitemap, renderHomepageNotes } from './scripts/notes.mjs';
import { resolveSitemapLastmods } from './scripts/sitemap-lastmod.mjs';
import { collectUpdates, renderUpdatesFeed, renderUpdatesPage } from './scripts/updates.mjs';
import { renderPagesWorker } from './scripts/pages-worker.mjs';

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
// Pages Functions 를 dist 안에 묶는다(advanced mode). functions/ 는 dist 밖이라, dist 만 배포하는
// 릴리스 파이프라인에서는 /api/* 가 통째로 빠진다(2026-09-21 운영 실측). 묶을 수 없는 함수가
// 있으면 여기서 예외가 나 빌드가 중단된다.
await writeFile(dist + '/_worker.js', renderPagesWorker(root + 'functions'));
console.log('bundled Pages Functions into _worker.js');

// 개발 기록 렌더. 원고 검증에 실패하면 여기서 예외가 나 빌드가 중단된다 —
// 조용히 누락되는 것보다 시끄럽게 실패하는 쪽을 택한다.
const notes = collectNotes(root + 'content/notes');
const noteTemplate = readFileSync(root + 'templates/note.html', 'utf-8');
const indexTemplate = readFileSync(root + 'templates/notes-index.html', 'utf-8');
const sitemapLastmods = resolveSitemapLastmods(notes, {
  root,
  overrideDate: process.env.SITEMAP_BUILD_DATE?.trim() || undefined,
});

await mkdir(dist + '/notes', { recursive: true });
for (const note of notes) {
  await writeFile(dist + `/notes/${note.slug}.html`, renderNote(note, noteTemplate));
}
await writeFile(dist + '/notes/index.html', renderIndex(notes, indexTemplate));
await writeFile(
  dist + '/sitemap.xml',
  renderSitemap(notes, { lastmods: sitemapLastmods }),
);
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

// 운영 analytics identity. src/config.js 는 window.LEVA_CONFIG 가 없으면 development/dev 로
// 떨어져 방문자를 분석에서 제외한다(2026-09-17 운영 실측). appVersion 은 소스 SHA, 환경은
// production 이 기본이며 로컬 검증에서는 ANALYTICS_ENVIRONMENT 로 바꿀 수 있다.
const appVersion = (process.env.APP_VERSION || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' })).trim();
if (!/^[0-9a-f]{40}$/.test(appVersion)) throw new Error(`APP_VERSION 이 40자 SHA 가 아니다: ${appVersion}`);
const analyticsEnvironment = process.env.ANALYTICS_ENVIRONMENT || 'production';
const runtimeConfig = `<script>window.LEVA_CONFIG=${JSON.stringify({ appVersion, analyticsEnvironment })};</script>`;
async function injectRuntimeConfig(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { await injectRuntimeConfig(path); continue; }
    if (!entry.name.endsWith('.html')) continue;
    const html = await readFile(path, 'utf8');
    if (html.includes('window.LEVA_CONFIG')) continue;
    // </head> 앞에 둔다: 어떤 스크립트보다 먼저 평가되고, 모듈 스크립트가 없는 페이지에도 같은 계약을 준다.
    const at = html.indexOf('</head>');
    if (at === -1) throw new Error(`${path}: </head> 가 없어 런타임 설정을 주입할 수 없다`);
    await writeFile(path, html.slice(0, at) + runtimeConfig + '\n' + html.slice(at));
  }
}
await injectRuntimeConfig(dist);
console.log(`injected runtime config appVersion=${appVersion.slice(0, 8)} env=${analyticsEnvironment}`);

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
