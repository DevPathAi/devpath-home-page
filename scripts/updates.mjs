// 공지 원고를 한 번 검증해 HTML과 앱용 feed에 함께 투영한다.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from 'marked';
import { escapeHtml } from './notes.mjs';

const REQUIRED = ['title', 'summary', 'date', 'type'];
const ALLOWED_TYPES = new Set(['notice', 'change']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const APP_ORIGIN = 'https://app.leva.ai.kr';

function parseBoolean(value, key, slug) {
  if (value === undefined) return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${slug}: ${key}는 true 또는 false여야 한다`);
}

function isSafeCtaHref(value) {
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    return new URL(value).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

export function parseUpdate(raw, slug) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${slug}: frontmatter 블록이 없다`);

  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const separator = line.indexOf(':');
    if (separator < 0) throw new Error(`${slug}: frontmatter 형식 오류 — ${line}`);
    meta[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  for (const key of REQUIRED) {
    if (!meta[key]) throw new Error(`${slug}: frontmatter에 ${key}가 없다`);
  }
  if (!DATE_RE.test(meta.date)) throw new Error(`${slug}: date는 YYYY-MM-DD여야 한다`);
  if (!ALLOWED_TYPES.has(meta.type)) throw new Error(`${slug}: 허용되지 않은 type — ${meta.type}`);
  if (/^#\s/m.test(match[2])) throw new Error(`${slug}: 본문에 h1(#)을 쓰지 않는다`);

  const bannerEnabled = parseBoolean(meta.bannerEnabled, 'bannerEnabled', slug);
  const banner = {};
  if (bannerEnabled) {
    for (const key of ['startsAt', 'endsAt', 'ctaLabel', 'ctaHref']) {
      if (!meta[key]) throw new Error(`${slug}: 배너에는 ${key}가 필요하다`);
      banner[key] = meta[key];
    }
    const startsAt = Date.parse(banner.startsAt);
    const endsAt = Date.parse(banner.endsAt);
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt > endsAt) {
      throw new Error(`${slug}: startsAt과 endsAt 시간 범위가 올바르지 않다`);
    }
    if (!isSafeCtaHref(banner.ctaHref)) throw new Error(`${slug}: 안전하지 않은 ctaHref`);
  }

  return {
    slug,
    title: meta.title,
    summary: meta.summary,
    date: meta.date,
    type: meta.type,
    body: match[2],
    bannerEnabled,
    ...banner,
  };
}

export function collectUpdates(dir) {
  const files = readdirSync(dir).filter((file) => file.endsWith('.md'));
  if (files.length === 0) throw new Error(`${dir}: 공지 원고가 하나도 없다`);

  return files
    .map((file) => {
      const slug = file.replace(/\.md$/, '');
      return parseUpdate(readFileSync(join(dir, file), 'utf8'), slug);
    })
    .sort((a, b) => (a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date)));
}

function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`템플릿 자리표시자 ${key}에 줄 값이 없다`);
    return values[key];
  });
}

export function renderUpdatesPage(updates, template) {
  const labels = { notice: '공지', change: '변경 기록' };
  const items = updates.map((item) => [
    `      <article class="update" id="${escapeHtml(item.slug)}">`,
    '        <div class="update__meta">',
    `          <span class="update__type">${labels[item.type]}</span>`,
    `          <time datetime="${item.date}">${item.date.replaceAll('-', '.')}</time>`,
    '        </div>',
    `        <h2>${escapeHtml(item.title)}</h2>`,
    `        <p class="update__summary">${escapeHtml(item.summary)}</p>`,
    `        <div class="update__body">${marked.parse(item.body)}</div>`,
    '      </article>',
  ].join('\n')).join('\n');

  return fill(template, { items });
}

export function renderUpdatesFeed(updates) {
  const feed = {
    schemaVersion: 1,
    items: updates.map(({ slug, title, summary, date, type }) => ({
      slug,
      title,
      summary,
      date,
      type,
      url: `/updates#${slug}`,
    })),
    banners: updates.filter((item) => item.bannerEnabled).map((item) => ({
      id: item.slug,
      title: item.title,
      summary: item.summary,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      cta: { label: item.ctaLabel, href: item.ctaHref },
    })),
  };
  const json = JSON.stringify(feed, null, 2) + '\n';
  if (Buffer.byteLength(json) > 32 * 1024) throw new Error('updates feed가 32 KiB 제한을 넘었다');
  return json;
}
