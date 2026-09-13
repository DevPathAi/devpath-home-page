// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL as NodeURL } from 'node:url';

const root = (path) => fileURLToPath(new NodeURL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(root(path), 'utf8');

const htmlSources = [
  ['index.html', 'index.html'],
  ['beta.html', 'beta.html'],
  ['contact.html', 'contact.html'],
  ['templates/note.html', 'templates/note.html'],
];

const textSources = [
  ['mentor update', 'content/updates/2026-09-05-mentor-invitations.md'],
  ['support update', 'content/updates/2026-09-05-support-channels.md'],
  ['waitlist email', 'apps-script/Code.gs'],
];

function assertNoOutboundAttribution(rawUrl, label) {
  const url = new NodeURL(rawUrl.replaceAll('&amp;', '&'));
  expect([...url.searchParams.keys()].filter((key) => key.startsWith('utm_')), label).toEqual([]);
}

describe('사이트에서 앱으로 가는 CTA', () => {
  it.each(htmlSources)('%s의 앱 링크에 외부 유입용 UTM을 다시 싣지 않는다', (label, path) => {
    const document = new DOMParser().parseFromString(read(path), 'text/html');
    const links = [...document.querySelectorAll('a[href^="https://app.leva.ai.kr/"]')];
    expect(links.length, label).toBeGreaterThan(0);
    for (const link of links) assertNoOutboundAttribution(link.getAttribute('href'), `${label}: ${link.textContent.trim()}`);
  });

  it.each(textSources)('%s의 앱 URL에도 외부 유입용 UTM을 다시 싣지 않는다', (label, path) => {
    const urls = read(path).match(/https:\/\/app\.leva\.ai\.kr\/[^\s)'\"]+/g) ?? [];
    expect(urls.length, label).toBeGreaterThan(0);
    for (const url of urls) assertNoOutboundAttribution(url, label);
  });
});
