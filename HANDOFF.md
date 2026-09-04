# 레바 홈페이지 Phase 0 — 다음 세션 핸드오프

> 갱신: 2026-09-04 23:00 KST
> 상태: **계획·엔지니어링 검토 완료, 구현 전**
> 문서 브랜치: `docs/homepage-phase0-handoff-20260904`
> 기준: `origin/develop@bf3f37d`

## 다음 세션의 한 줄 목표

승인된 Phase 0 계획에 따라 `leva.ai.kr`의 사실·CTA·SEO·증거를 정렬하고, 앱 UTM 소비자 호환을 먼저 배포한 뒤 구 랜딩을 단계적으로 종료한다.

## 이번 세션에서 완료한 것

- 홈페이지 정식 구조안을 Phase 0 실행 범위로 축소하고 엔지니어링 검토를 마쳤다.
- 아키텍처 7건, 코드 품질 3건, 테스트 7건, 성능 3건을 결정했다.
- 테스트 공백 16건을 계획에 편입했고 계획상 치명적 공백은 0건이다.
- 실행 계획, QA 계획, 12개 구현 작업을 이 저장소에 고정했다.
- 기존 제품 저장소에는 구현 변경을 넣지 않았다.
- 90초 영상 v1.3 검수본과 GovTech [그림 1]용 PNG 3종의 로컬 산출물을 확인했다.

## 기준 문서

- [Phase 0 엔지니어링 계획](docs/plan/2026-09-04-homepage-phase0-engineering-plan.md)
- [Phase 0 QA 계획](docs/plan/2026-09-04-homepage-phase0-qa-plan.md)
- [구현 작업 T1~T12](docs/plan/2026-09-04-homepage-phase0-tasks.jsonl)

계획 파일의 마지막 판정은 `ENG CLEARED`, `NO UNRESOLVED DECISIONS`다.

## 확정 결정

1. 범위는 Phase 0만 구현한다. Phase 1~3은 로드맵으로 남긴다.
2. 구현은 기존 작업 브랜치가 아니라 각 저장소의 최신 `origin/develop`에서 새 브랜치를 만들어 시작한다.
3. 배포 순서는 다음과 같다.

   ```text
   R0 앱 analytics v2 소비자 호환
      ↓
   RA 홈페이지 사실·CTA·SEO·실화면 증거 정렬
      ↓
   RB 구 리드 기능 제거 + 구 랜딩 단계적 종료
      ↓
   RC AdSense 승인 확인 후 수동 광고 1개 활성화
   ```

4. Home의 `/api/lead`, `/api/stats`는 RA 동안 롤백용으로만 남기고 RB에서 클라이언트·Functions·테스트·Apps Script까지 제거한다.
5. 대기자 등록의 단일 소유자는 앱이다. Home의 리드 폼과 traction UI는 제거한다.
6. 공개 4단계의 네 번째는 `진행 확인과 다음 미션`이다. `자동 경로 보정`과 확인되지 않은 조건부 잠금 주장은 Home·영상에서 제거하고 계획 기능은 `/beta`에만 둔다.
7. UTM은 앱에서 엄격히 검증하고 세션 저장 후 주소창에서 제거한다. analytics v2 소비자를 먼저 배포한다.
8. Home 전용 GitOps 배포·롤백 워크플로를 만들고, 30분 카나리에서 Home 소유 실패가 2회 연속일 때만 자동 롤백한다.
9. AdSense는 `review`와 `approved_manual` 모드를 빌드 계약으로 분리한다. 승인 전에는 검증 스크립트와 `ads.txt`만 유지한다.
10. 승인 후 광고는 `/notes/{slug}` 상세 페이지의 수동 반응형 슬롯 1개만 허용한다. 홈·소개·베타·앱에는 광고를 두지 않고 Auto ads를 사용하지 않는다.
11. 제품 화면은 원본 PNG를 보존하고 공개용 WebP 640/960/1440을 생성한다. 캡처 출처와 해시를 provenance manifest로 관리한다.
12. 성능 예산과 3회 측정 중앙값 판정은 엔지니어링 계획의 D20~D22를 그대로 적용한다.

## 다음 작업 순서

1. `devpath-frontend`: 최신 `origin/develop`에서 R0 브랜치를 만들고 analytics v2·UTM 수신 계약을 테스트 우선으로 구현한다.
2. `devpath-home-page`: 별도 RA 브랜치에서 `site.config.mjs`, 사실 문구, 앱 CTA, SEO, Before/After 및 4단계 실화면 증거를 구현한다.
3. `devpath-gitops`: Home 전용 release/rollback workflow와 manifest schema v2를 구현한다.
4. R0을 먼저 배포·검증한 뒤 RA를 배포한다.
5. RA 안정화 후 RB manifest의 `inventory → export_verified → redirect → observed → runtime_disabled → credential_revoked → archived` 순서를 지킨다.
6. Google 승인 확인 전 RC를 실행하지 않는다. 승인 확인 후 `approved_manual`로 별도 릴리스한다.
7. UI 구현 전 `/plan-design-review`를 실행해 화면 계층·모바일 CTA·광고 슬롯 여백을 검토한다.

## 관련 저장소 상태

| 저장소 | 2026-09-04 확인 상태 | 다음 세션 주의 |
|---|---|---|
| `devpath-home-page` | 기존 worktree `feat/seo-note-cta@51d8f10`, clean, `origin/develop`보다 59커밋 뒤 | 기존 브랜치에서 구현 금지 |
| `devpath-frontend` | `feat/evidence-auth-smoke@e8d6235` | 사용자 소유 untracked `AGENTS.md`, `CODEX.md` 보존 |
| `devpath-gitops` | `fix/bypass-observable-contract@b1c577c` | 사용자 소유 untracked `AGENTS.md`, `CODEX.md` 보존 |
| `devpath-landing-page` | `develop@b725ef4`, clean | RB 전까지 삭제·아카이브 금지 |

## 로컬 산출물

### 90초 영상

- 검수본: `D:\workspace\dpa\leva-90s-video\output\leva-90s-guide-review-v1.3.mp4`
- SHA-256: `748165184F5FFF2277E4EC6B7B4B30D82C9CAB89428150E75FAB56EE4C3B78C0`
- 규격: 90초, 1920×1080, 30fps, H.264/AAC
- 상태: 컷 4~9 실녹화·컷 5 자막 순차 교체·Before 실제 원문 확인 완료
- 게시 전 남은 일: `leva-90s-video/FOUNDER-NARRATION.md` 기준 창업자 육성 11블록 교체 후 재빌드·검수·업로드
- 브라우저 프로필 `leva-90s-video/.chrome-profile`은 인증 정보 가능성이 있어 커밋 금지

### GovTech [그림 1] PNG

- `D:\workspace\dpa\govtech-figure1-screens\01-guest-diagnostic.png`
  SHA-256 `C4D3C1E70A1F007C7532B0168BF3D175C3F283C2E5E7D64FFC0389253100B7D2`
- `D:\workspace\dpa\govtech-figure1-screens\02-personalized-roadmap.png`
  SHA-256 `4CD8B6C256D6F5757F9100CDA89B51084D0DC07ED32AAA9A68E2BB81D17AF5D7`
- `D:\workspace\dpa\govtech-figure1-screens\03-ai-mentor-session.png`
  SHA-256 `1A8DF667593A9BB580A42764B4C222BE655C36D49901B5891D7C957E5A458559`
- 원문: `D:\workspace\dpa\04_[개발보고서]_2026년_GovTech_창업경진대회_레바.hwpx`
- 주의: HWPX 수정 시각이 PNG 생성보다 앞선다. 세 이미지가 문서에 삽입됐다고 간주하지 말고 다음 편집 전에 실제 문서 내부를 확인한다.

## 검증 및 운영 메모

- `plan-eng-review` 로그: 20 issues, 0 unresolved, 0 critical gaps, `CLEAR (PLAN)`.
- 문서 브랜치 검증: `npm test` 37 files / 377 tests 통과, `npm run test:e2e` 34 tests 통과, `npm run build` 성공(10 notes, 13 entries).
- `npm ci` 감사에서 기존 의존성 취약점 7건(중간 4, 높음 2, 치명적 1)이 보고됐다. 이번 문서 변경은 `package-lock.json`을 수정하지 않았으며, 취약점 갱신은 별도 보안 작업으로 다룬다.
- GStack 브라우저 실행 파일은 로컬에서 `Cannot find server.ts`로 실패했다. 대체 Playwright로 `https://app.leva.ai.kr/diagnostic`의 로드와 title을 확인했지만 Flutter semantics는 충분한 UI 텍스트를 노출하지 않았다.
- GStack decision-log 보조 명령은 로컬 모듈 `../lib/gstack-decision` 누락으로 실패했다. 리뷰 로그와 계획 문서는 정상 저장됐다.
- GStack `gstack-redact`도 로컬 모듈 `../lib/redact-engine` 누락으로 실행되지 않았다. 대신 공개 저장소 기준의 자격증명 패턴 검사를 실행해 일치 항목 0건을 확인했다.
- 구 랜딩 종료는 되돌리기 어려운 단계다. export 검증·redirect 관찰·runtime disable을 마치기 전에 자격증명을 폐기하지 않는다.

## 다음 세션 시작 명령

```powershell
cd D:\workspace\dpa\.worktrees\home-homepage-phase0-handoff-20260904
git fetch origin --prune
git pull --ff-only
```

worktree가 없는 다른 장비라면 `devpath-home-page`를 clone/fetch한 뒤 원격 문서 브랜치 `origin/docs/homepage-phase0-handoff-20260904`를 체크아웃한다. 그다음 `/context-restore`로 최신 체크포인트를 읽고, `/plan-design-review`를 먼저 실행한다. 실제 구현 브랜치는 이 문서 브랜치가 아니라 해당 저장소의 최신 `origin/develop`에서 새로 만든다.
