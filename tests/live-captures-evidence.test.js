import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const sha256 = (path) => createHash('sha256').update(readFileSync(root(path))).digest('hex');
const manifest = JSON.parse(readFileSync(root('evidence/live-captures.v1.json'), 'utf8'));

// CLAUDE.md 「실제 화면과 미디어 증거」: 실제 화면은 배포 후보 앱에서 캡처하고 role, route,
// viewport, capture time, app source/deployment SHA, original/derived hash 를 manifest 에 기록한다.
describe('실제 화면 캡처 manifest', () => {
  it('schema 와 세 캡처 슬롯이 있다', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.captures.map((c) => c.asset).sort()).toEqual([
      'assets/live-backend-path.png',
      'assets/live-diagnostic-result.png',
      'assets/live-mentor.png',
    ]);
  });

  it('현재 테마 캡처는 원본·파생 해시가 파일과 일치하고 출처가 완전하다', () => {
    for (const capture of manifest.captures.filter((c) => c.status === 'current')) {
      expect(capture.role).toMatch(/^(guest|member)$/);
      expect(capture.route).toMatch(/^\/[a-z-]*/);
      expect(capture.viewport).toMatchObject({ width: expect.any(Number), height: expect.any(Number), deviceScaleFactor: expect.any(Number) });
      expect(capture.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(capture.app.sourceSha).toMatch(/^[0-9a-f]{40}$/);
      expect(capture.app.imageDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(capture.derivation).toEqual(expect.arrayContaining(['crop', 'resize']));
      expect(existsSync(root(capture.original.path))).toBe(true);
      expect(sha256(capture.original.path)).toBe(capture.original.sha256);
      expect(sha256(capture.asset)).toBe(capture.derived.sha256);
    }
  });

  it('개편 전 캡처는 재캡처 대기로 표시되고 파일 해시가 고정된다', () => {
    for (const capture of manifest.captures.filter((c) => c.status === 'pending_recapture')) {
      expect(capture.capturedAt).toBe('2026-09-05');
      expect(capture.note).toContain('2026-09-16');
      expect(sha256(capture.asset)).toBe(capture.derived.sha256);
    }
  });

  it('히어로 캡처는 진단 신뢰도 0% 화면이 아니다', () => {
    const diagnostic = manifest.captures.find((c) => c.asset === 'assets/live-diagnostic-result.png');
    expect(diagnostic.status).toBe('current');
    expect(diagnostic.observed.confidence).not.toBe('0%');
  });
});
