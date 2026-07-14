// 번들러 없음 — 배포 산출물(dist/)을 만드는 단순 복사 빌드.
// 배포 대상 파일만 dist/로 미러링해 tests/·docs/·apps-script/·node_modules를 서빙에서 제외한다.
// CF Pages 설정: build command = `npm run build`, output dir = `dist`.
import { cp, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./', import.meta.url));
const dist = root + 'dist';

// 배포에 포함할 최상위 엔트리(존재하는 것만 복사).
const DEPLOY_ENTRIES = ['index.html', 'src', 'assets', '_headers', '_redirects', 'robots.txt', 'favicon.ico'];

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
console.log(`built dist/ (${copied} entries)`);
