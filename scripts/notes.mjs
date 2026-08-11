// 원고 수집·검증·렌더. 파일 쓰기는 하지 않고 문자열만 반환한다 —
// 테스트가 파일시스템 없이 단언할 수 있게 하기 위해서다.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from 'marked';

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

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

// String.replace의 두 번째 인자를 문자열로 주면 $&·$1 같은 패턴이 치환된다.
// 원고 본문에 그런 문자열이 있으면 조용히 깨지므로 함수 형태로 넘긴다.
function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`템플릿 자리표시자 ${key}에 줄 값이 없다`);
    return values[key];
  });
}

export function renderNote(note, template) {
  const url = `https://leva.ai.kr/notes/${note.slug}`;
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: note.title,
    description: note.description,
    datePublished: note.date,
    url,
    author: { '@type': 'Organization', name: 'Leva' },
  });

  return fill(template, {
    title: escapeHtml(note.title),
    description: escapeHtml(note.description),
    slug: note.slug,
    date: note.date,
    jsonld,
    body: marked.parse(note.body),
  });
}

export function renderIndex(notes, template) {
  const items = notes
    .map((note) => [
      '      <li class="note-list__item">',
      `        <a href="/notes/${note.slug}">${escapeHtml(note.title)}</a>`,
      `        <p class="legal__meta">${note.date}</p>`,
      `        <p>${escapeHtml(note.description)}</p>`,
      '      </li>',
    ].join('\n'))
    .join('\n');

  return fill(template, { items });
}

const SITE = 'https://leva.ai.kr';
// 원고와 무관하게 항상 존재하는 페이지. 날짜를 고정값으로 둬 빌드마다
// sitemap이 흔들리지 않게 한다(Date.now를 쓰지 않는 이유).
const STATIC_PAGES = [
  { path: '/', lastmod: '2026-08-10' },
  { path: '/privacy', lastmod: '2026-08-10' },
  { path: '/beta', lastmod: '2026-08-11' },
  { path: '/about', lastmod: '2026-08-11' },
];

export function renderSitemap(notes) {
  const latest = notes.length > 0 ? notes[0].date : '2026-08-10';
  const entries = [
    ...STATIC_PAGES.map((p) => ({ loc: `${SITE}${p.path}`, lastmod: p.lastmod })),
    // Pages는 디렉터리 인덱스를 /notes → /notes/로 308 리다이렉트한다(라이브 실측).
    // 슬래시 없는 형태를 담으면 크롤러가 홉을 한 번 더 탄다.
    { loc: `${SITE}/notes/`, lastmod: latest },
    ...notes.map((n) => ({ loc: `${SITE}/notes/${n.slug}`, lastmod: n.date })),
  ].sort((a, b) => a.loc.localeCompare(b.loc));

  const urls = entries
    .map((e) => `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
