import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const evidence = JSON.parse(readFileSync(root('evidence/video-release.v1.json'), 'utf8'));

describe('90초 영상 릴리스 증거', () => {
  it('승인된 immutable provider ID와 재생 계약을 고정한다', () => {
    expect(evidence.mode).toBe('video');
    expect(evidence.provider.videoId).toBe('MTSrOoTlZss');
    expect(evidence.provider.embedUrl).toBe(
      'https://www.youtube-nocookie.com/embed/MTSrOoTlZss?autoplay=1&rel=0',
    );
    expect(evidence.verifiedContent.durationSeconds).toBeGreaterThanOrEqual(89);
    expect(evidence.verifiedContent.durationSeconds).toBeLessThanOrEqual(91);
    expect(evidence.verifiedContent.brand).toBe('Leva');
    expect(evidence.verifiedContent.captions).toContain('Korean captions');
  });

  it('배포 포스터가 검수한 영상 프레임의 고정 해시와 일치한다', () => {
    const actual = createHash('sha256')
      .update(readFileSync(root(evidence.poster.path)))
      .digest('hex');

    expect(evidence.poster).toMatchObject({
      // 2026-09-17: 48 s(컷 6)는 게시본에 검수용 자리표시자 문구가 있어 74 s(컷 10)로 교체했다.
      sourceTimestampSeconds: 74,
      width: 1280,
      height: 720,
    });
    expect(actual).toBe(evidence.poster.sha256);
  });
});
