import { describe, expect, it, vi } from 'vitest';

import {
  ensureCompleteSitemapGitHistory,
  resolveSitemapLastmods,
  sitemapSourcePaths,
} from '../scripts/sitemap-lastmod.mjs';

const NOTES = [
  { slug: 'newer' },
  { slug: 'older' },
];

describe('sitemap source-aware lastmod', () => {
  it('정적 페이지와 글마다 실제 렌더 소스를 묶는다', () => {
    const sources = sitemapSourcePaths(NOTES);

    expect(sources['/']).toEqual([
      'index.html',
      'content/notes',
      'scripts/notes.mjs',
    ]);
    expect(sources['/about']).toEqual(['about.html']);
    expect(sources['/beta']).toEqual(['beta.html']);
    expect(sources['/notes/']).toEqual([
      'templates/notes-index.html',
      'content/notes',
      'scripts/notes.mjs',
    ]);
    expect(sources['/notes/newer']).toEqual([
      'content/notes/newer.md',
      'templates/note.html',
      'scripts/notes.mjs',
    ]);
  });

  it('각 소스 묶음의 마지막 커밋일을 별도로 조회한다', () => {
    const execFile = vi.fn((_command, args) => {
      if (args[0] === 'rev-parse') return 'false\n';
      const paths = args.slice(args.indexOf('--') + 1);
      if (paths.includes('about.html')) return '2026-08-11\n';
      if (paths.includes('beta.html')) return '2026-09-13\n';
      if (paths.includes('templates/note.html')) return '2026-09-12\n';
      return '2026-09-10\n';
    });

    const lastmods = resolveSitemapLastmods(NOTES, {
      root: 'C:/repo',
      execFile,
    });

    expect(lastmods['/about']).toBe('2026-08-11');
    expect(lastmods['/beta']).toBe('2026-09-13');
    expect(lastmods['/notes/newer']).toBe('2026-09-12');
    expect(execFile).toHaveBeenCalledWith(
      'git',
      ['log', '-1', '--format=%cs', '--', 'about.html'],
      { cwd: 'C:/repo', encoding: 'utf8' },
    );
  });

  it('얕은 checkout은 origin의 전체 이력을 받은 뒤 날짜를 계산한다', () => {
    const execFile = vi.fn()
      .mockReturnValueOnce('true\n')
      .mockReturnValueOnce('')
      .mockReturnValueOnce('false\n');

    expect(ensureCompleteSitemapGitHistory({
      root: 'C:/repo',
      execFile,
    })).toBe(true);
    expect(execFile.mock.calls).toEqual([
      ['git', ['rev-parse', '--is-shallow-repository'], { cwd: 'C:/repo', encoding: 'utf8' }],
      ['git', ['fetch', '--no-tags', '--unshallow', 'origin'], { cwd: 'C:/repo', encoding: 'utf8' }],
      ['git', ['rev-parse', '--is-shallow-repository'], { cwd: 'C:/repo', encoding: 'utf8' }],
    ]);
  });

  it('얕은 이력을 완성할 수 없으면 부정확한 sitemap 대신 빌드를 막는다', () => {
    const execFile = vi.fn()
      .mockReturnValueOnce('true\n')
      .mockImplementationOnce(() => { throw new Error('network unavailable'); });

    expect(() => ensureCompleteSitemapGitHistory({
      root: 'C:/repo',
      execFile,
    })).toThrow('전체 Git 이력');
  });

  it('명시적 재현 날짜가 있으면 git 없이 모든 경로에 사용한다', () => {
    const execFile = vi.fn();
    const lastmods = resolveSitemapLastmods(NOTES, {
      root: 'C:/repo',
      execFile,
      overrideDate: '2026-09-13',
    });

    expect(new Set(Object.values(lastmods))).toEqual(new Set(['2026-09-13']));
    expect(execFile).not.toHaveBeenCalled();
  });

  it('git이나 override가 올바른 날짜를 주지 않으면 잘못된 sitemap 생성을 막는다', () => {
    const execFile = vi.fn((_command, args) => (
      args[0] === 'rev-parse' ? 'false\n' : ''
    ));
    expect(() => resolveSitemapLastmods(NOTES, {
      root: 'C:/repo',
      execFile,
    })).toThrow('YYYY-MM-DD');
    expect(() => resolveSitemapLastmods(NOTES, {
      root: 'C:/repo',
      overrideDate: '2026/09/13',
    })).toThrow('YYYY-MM-DD');
  });
});
