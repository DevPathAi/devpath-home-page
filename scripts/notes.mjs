// 원고 수집·검증·렌더. 파일 쓰기는 하지 않고 문자열만 반환한다 —
// 테스트가 파일시스템 없이 단언할 수 있게 하기 위해서다.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REQUIRED = ['title', 'description', 'date'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseFrontmatter(raw, slug) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error(`${slug}: frontmatter 블록이 없다`);

  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const i = line.indexOf(':');
    if (i < 0) throw new Error(`${slug}: frontmatter 형식 오류 — ${line}`);
    // 값에 콜론이 더 있어도 첫 콜론만 구분자로 쓴다.
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }

  for (const key of REQUIRED) {
    if (!meta[key]) throw new Error(`${slug}: frontmatter에 ${key}가 없다`);
  }
  if (!DATE_RE.test(meta.date)) {
    throw new Error(`${slug}: date는 YYYY-MM-DD여야 한다 — ${meta.date}`);
  }

  const body = m[2];
  // 템플릿이 제목을 h1으로 내보낸다. 본문의 h1은 한 페이지에 h1을 둘로 만든다.
  if (/^#\s/m.test(body)) throw new Error(`${slug}: 본문에 h1(#)을 쓰지 않는다. ##부터 시작할 것`);

  return { title: meta.title, description: meta.description, date: meta.date, body };
}

export function collectNotes(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  if (files.length === 0) throw new Error(`${dir}: 원고가 하나도 없다`);

  const notes = files.map((file) => {
    const slug = file.replace(/\.md$/, '');
    return { slug, ...parseFrontmatter(readFileSync(join(dir, file), 'utf-8'), slug) };
  });

  // 날짜 내림차순. 동률이면 slug 오름차순으로 안정 정렬한다 —
  // 순서가 빌드마다 흔들리면 sitemap과 인덱스에 무의미한 diff가 생긴다.
  notes.sort((a, b) => (a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date)));
  return notes;
}
