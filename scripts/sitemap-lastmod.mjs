import { execFileSync } from 'node:child_process';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
      { cwd: root, encoding: 'utf8' },
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
  return Object.fromEntries(Object.entries(sources).map(([route, paths]) => [
    route,
    latestGitDate(paths, { root, execFile }),
  ]));
}
