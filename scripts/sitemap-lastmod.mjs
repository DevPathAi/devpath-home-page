import { execFileSync } from 'node:child_process';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const GIT_OPTIONS = (root) => ({ cwd: root, encoding: 'utf8' });

const STATIC_PAGE_SOURCES = Object.freeze({
  '/': Object.freeze(['index.html', 'content/notes', 'scripts/notes.mjs']),
  '/about': Object.freeze(['about.html']),
  '/beta': Object.freeze(['beta.html']),
  '/contact': Object.freeze(['contact.html']),
  '/privacy': Object.freeze(['privacy.html']),
  '/terms': Object.freeze(['terms.html']),
  '/updates': Object.freeze([
    'templates/updates.html',
    'content/updates',
    'scripts/updates.mjs',
  ]),
});

function validDate(value, source) {
  if (!DATE_RE.test(value)) {
    throw new Error(`sitemap lastmod가 YYYY-MM-DD가 아니다 (${source}): ${value || '<empty>'}`);
  }
  return value;
}

function gitShallowState(root, execFile) {
  try {
    return execFile(
      'git',
      ['rev-parse', '--is-shallow-repository'],
      GIT_OPTIONS(root),
    ).trim();
  } catch (error) {
    throw new Error(`sitemap Git 이력 상태 조회 실패: ${error.message}`);
  }
}

export function ensureCompleteSitemapGitHistory({
  root,
  execFile = execFileSync,
} = {}) {
  const state = gitShallowState(root, execFile);
  if (state === 'false') return false;
  if (state !== 'true') {
    throw new Error(`sitemap Git shallow 상태가 올바르지 않다: ${state || '<empty>'}`);
  }

  try {
    execFile(
      'git',
      ['fetch', '--no-tags', '--unshallow', 'origin'],
      GIT_OPTIONS(root),
    );
  } catch (error) {
    throw new Error(`sitemap 날짜 계산에 필요한 전체 Git 이력 가져오기 실패: ${error.message}`);
  }
  if (gitShallowState(root, execFile) !== 'false') {
    throw new Error('sitemap 날짜 계산에 필요한 전체 Git 이력이 복원되지 않았다');
  }
  return true;
}

export function sitemapSourcePaths(notes) {
  const paths = Object.fromEntries(
    Object.entries(STATIC_PAGE_SOURCES).map(([route, sources]) => [route, [...sources]]),
  );
  paths['/notes/'] = [
    'templates/notes-index.html',
    'content/notes',
    'scripts/notes.mjs',
  ];
  for (const note of notes) {
    paths[`/notes/${note.slug}`] = [
      `content/notes/${note.slug}.md`,
      'templates/note.html',
      'scripts/notes.mjs',
    ];
  }
  return paths;
}

function latestGitDate(paths, { root, execFile }) {
  let value;
  try {
    value = execFile(
      'git',
      ['log', '-1', '--format=%cs', '--', ...paths],
      GIT_OPTIONS(root),
    ).trim();
  } catch (error) {
    throw new Error(`sitemap lastmod git 조회 실패 (${paths.join(', ')}): ${error.message}`);
  }
  return validDate(value, paths.join(', '));
}

export function resolveSitemapLastmods(notes, {
  root,
  execFile = execFileSync,
  overrideDate,
} = {}) {
  const sources = sitemapSourcePaths(notes);
  if (overrideDate !== undefined) {
    const date = validDate(overrideDate, 'SITEMAP_BUILD_DATE');
    return Object.fromEntries(Object.keys(sources).map((route) => [route, date]));
  }
  ensureCompleteSitemapGitHistory({ root, execFile });
  return Object.fromEntries(Object.entries(sources).map(([route, paths]) => [
    route,
    latestGitDate(paths, { root, execFile }),
  ]));
}
