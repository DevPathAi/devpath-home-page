import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, collectNotes } from '../scripts/notes.mjs';

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

describe('parseFrontmatter', () => {
  it('세 필수 값과 본문을 분리한다', () => {
    const raw = '---\ntitle: 제목\ndescription: 설명\ndate: 2026-08-10\n---\n\n## 소제목\n';

    const note = parseFrontmatter(raw, 'slug');

    expect(note.title).toBe('제목');
    expect(note.description).toBe('설명');
    expect(note.date).toBe('2026-08-10');
    expect(note.body.trim()).toBe('## 소제목');
  });

  it('frontmatter 블록이 없으면 실패한다', () => {
    expect(() => parseFrontmatter('본문만 있다', 'slug')).toThrow(/frontmatter/);
  });

  it('콜론이 여러 개인 값도 온전히 읽는다', () => {
    const raw = '---\ntitle: 제목\ndescription: 비율은 1:2:3이다\ndate: 2026-08-10\n---\n\n## 소제목\n';

    expect(parseFrontmatter(raw, 'slug').description).toBe('비율은 1:2:3이다');
  });
});

describe('collectNotes', () => {
  it('최신순으로 수집한다', () => {
    const notes = collectNotes(fixture('notes-ok'));

    expect(notes.map((n) => n.slug)).toEqual(['second-post', 'first-post']);
  });

  it('필수 키가 없으면 어느 원고인지 밝히며 실패한다', () => {
    expect(() => collectNotes(fixture('notes-missing-title'))).toThrow(/bad.*title/s);
  });

  it('date가 YYYY-MM-DD가 아니면 실패한다', () => {
    expect(() => collectNotes(fixture('notes-bad-date'))).toThrow(/date/);
  });

  it('본문에 h1이 있으면 실패한다', () => {
    expect(() => collectNotes(fixture('notes-h1-in-body'))).toThrow(/h1/);
  });

  it('원고가 하나도 없으면 실패한다', () => {
    expect(() => collectNotes(fixture('notes-empty'))).toThrow(/원고/);
  });
});
