// 번들러 없음 — 배포 산출물(dist/)을 만드는 단순 복사 빌드.
// 배포 대상 파일만 dist/로 미러링해 tests/·docs/·apps-script/·node_modules를 서빙에서 제외한다.
// CF Pages 설정: build command = `npm run build`, output dir = `dist`.
import { cp, rm, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { collectNotes, renderNote, renderIndex, renderSitemap } from './scripts/notes.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const dist = root + 'dist';

// 배포에 포함할 최상위 엔트리(존재하는 것만 복사).
const DEPLOY_ENTRIES = ['index.html', 'privacy.html', 'beta.html', '404.html', 'src', 'assets', '_headers', '_redirects', '_routes.json', 'robots.txt', 'favicon.ico', 'ads.txt'];

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

console.log(`built dist/ (${copied} entries)`);
