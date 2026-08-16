# 서비스 이용약관 신설 — 설계

- 작성일: 2026-08-12
- 상태: 설계 승인 대기
- 관련 레포: `devpath-home-page` · `devpath-frontend` · `devpath-shared` · `devpath-platform-svc`

## 1. 문제

동의 화면이 「서비스 이용약관 동의」를 **필수**로 받는데, 약관 문서가 존재하지 않는다.

- `apps/web/lib/src/features/consent/presentation/consent_page.dart:16` — `terms('TERMS', true, ...)` 에 `docUrl` 이 없다.
- 같은 파일 51-53행 주석이 이미 이 문제를 알고 있다: "한 줄 요약만 보여주고 동의를 받는 것은 동의로 성립하기 어렵다. 문서가 공개된 항목에만 있다."
- `PRIVACY` 는 `https://leva.ai.kr/privacy` 로 전문을 연다. `TERMS` 만 전문이 없다.

즉 **읽을 수 없는 문서에 필수 동의를 받고 있는 상태**다.

## 2. 범위

**무료 베타의 현재 상태만 규정한다.** 결제·환불·청약철회 조항은 넣지 않는다.

근거(실측):

- `devpath-platform-svc` 에 `payment` 패키지가 없다 — 결제 미구현.
- `beta.html:79` — "베타 기간에는 전부 무료입니다. 카드 등록도, 결제 정보 입력도 없습니다."
- `index.html:273` 의 9,900원/월은 "준비 중" 표시일 뿐 판매 중이 아니다.

유료 개시 시 약관을 개정한다(§7 개정 절차가 이를 규정한다).

## 3. 약관 조항 구성

`terms.html` 본문. 개인정보 관련 항목은 처리방침으로 위임하고 중복 기재하지 않는다.

| # | 조항 | 핵심 내용 |
|---|---|---|
| 1 | 목적 | 회사와 회원 간 서비스 이용 조건·절차를 정한다 |
| 2 | 용어의 정의 | 회원 · 콘텐츠 · 베타 서비스 |
| 3 | 약관의 게시와 개정 | 개정 시 사전 공지, 중대한 변경은 재동의 |
| 4 | 서비스의 내용 | 적응형 진단 · AI 학습 경로 · AI 멘토 · 커뮤니티 Q&A · 코드 샌드박스. **베타이며 무상 제공임을 명시** |
| 5 | 이용계약의 성립 | GitHub·Google OAuth 가입, **만 14세 이상**(서버 차단과 일치) |
| 6 | 회원의 의무·금지행위 | 계정 도용, 자동화 수집, 샌드박스 악용(채굴·공격·과다 자원 점유), 타인의 비밀값 업로드 |
| 7 | **이용자 콘텐츠의 권리** | 저작권은 이용자에게 귀속. 회사는 서비스 제공·개선·품질 향상 목적의 **무상·비독점 이용허락**을 받는다 |
| 8 | **AI 생성물의 성격과 한계** | 진단 결과·학습 경로·멘토 답변은 참고 자료이며 정확성·완전성을 보장하지 않는다. 최종 판단과 책임은 이용자에게 있다 |
| 9 | **커뮤니티 운영과 제재** | 신고 접수 → 관리자 판정 → 게시물 비공개 · 이용제한. 이미 구현된 신고 기능의 근거 조항 |
| 10 | 서비스의 변경·중단 | 베타이므로 기능이 변경·중단될 수 있다. 중요한 변경은 사전 고지 |
| 11 | 광고의 게재 | 제3자 광고(애드센스 등). 처리방침 §7(쿠키·자동수집)과 연결 |
| 12 | 계정 해지 및 이용제한 | 회원 탈퇴, 회사의 이용제한 사유와 절차 |
| 13 | 면책 | 무상 제공, 학습 성과 미보장, 회원 간 분쟁, 천재지변·회선 장애 |
| 14 | 분쟁 해결·준거법 | 대한민국 법 |
| 부칙 | 시행일 | 배포일 |

### 의도적으로 넣지 않는 것

| 항목 | 이유 |
|---|---|
| 결제·환불·청약철회 | 결제 미구현. §2 참조 |
| 위치정보 | 수집하지 않음 |
| 사업장 주소 | 무상 서비스라 전자상거래법상 표시의무 대상이 아니다. `privacy.html` 과 같은 기준을 적용한다 |

### 표기

- 사업자: 상호 `레바` · 사업자등록번호 `796-76-00732` (`privacy.html:259-260` 과 동일)
- 문의: `info@leva.ai.kr`

## 4. 기존 이용자 재동의

약관 게시 전에 가입한 이용자는 「존재하지 않는 문서」에 동의한 상태다. **다음 접속 시 재동의를 받는다.**

### 발동 방식 — 일회성 마이그레이션

실측 결과 재동의에 필요한 뼈대가 이미 있다.

- `ConsentType` 은 상수별 `version` 필드를 갖는다. 현재 전부 `"v1"`(`ConsentType.java:5-9`).
- `Consent` 엔티티가 `version` 을 저장한다(`Consent.java:14`, `ConsentService.java:41`).
- 라우터 게이트는 `auth.user.consentStatus == ConsentStatus.done` 만 본다(`router.dart:56-61`). **버전을 비교하지 않는다.**
- `consentStatus` 는 `User` 엔티티에 저장된 문자열이며 동의 제출 시 `"DONE"` 이 된다(`ConsentService.java:52`).

따라서 `consent_status` 를 `PENDING` 으로 되돌리면 **기존 게이트가 그대로 `/consent` 로 보낸다.** 프론트 로직은 한 줄도 바뀌지 않는다.

### 되돌림의 범위와 부작용

- **대상**: `consent_status = 'DONE'` 인 모든 이용자. `PENDING` 인 이용자는 이미 게이트에 걸려 있으므로 건드리지 않는다.
- **기존 동의 이력(`consent` 행)은 삭제하지 않는다.** 언제 무엇에 동의했는지는 법정 증빙이므로 보존한다. 되돌리는 것은 `user.consent_status` 뿐이다.
- **부작용 — PRIVACY도 함께 다시 받는다.** 동의 화면은 필수 2종(TERMS·PRIVACY)을 한 번에 제출하는 구조다(`consent_page.dart:57`). `consent_status` 는 항목별이 아니라 이용자 단위이므로, 약관만 개정해도 처리방침 동의를 다시 체크하게 된다.
  - 이를 수용한다. PRIVACY 의 `ConsentType.version` 은 `"v1"` 그대로 두므로, 저장되는 동의 이력에는 "처리방침 v1 에 다시 동의" 로 남아 사실과 어긋나지 않는다.
  - 항목별 재동의가 필요해지는 시점은 §4의 "대안" 에 적은 파생 판정 도입 시점과 같다.

### 대안을 택하지 않은 이유

- **파생 판정(`consentStatus` 를 버전 비교로 계산)**: 이후 개정이 enum 한 줄로 끝나지만, `User`·`UserSummary`·`statusOf`·게이트 응답을 모두 손봐야 하고, 필수 2종 중 하나만 개정돼도 둘 다 다시 받게 되는 UX를 별도로 다뤄야 한다. 실제로 약관을 두 번 이상 개정할 때 개정 이력 표시와 함께 도입하는 편이 낫다.
- **별도 재동의 화면**: 지금은 개정이 아니라 최초 게시라 "무엇이 바뀌었는지" 보여줄 이력이 없다.

## 5. 변경 지점

### 5.1 `devpath-home-page`

| 파일 | 변경 |
|---|---|
| `terms.html` | 신설. `privacy.html` 의 `.legal` 구조·스타일을 따른다 |
| `build.mjs:14` | `DEPLOY_ENTRIES` 에 `'terms.html'` 추가 |
| `scripts/notes.mjs:106` | `STATIC_PAGES` 에 `{ path: '/terms', lastmod: '2026-08-12' }` 추가 |
| `index.html` · `privacy.html` · `beta.html` | footer 및 본문 상호 링크 |
| e2e 스모크 | `/terms` 200 · 제목 · 사업자 표기 단언 |

> **함정**: `build.mjs:24-27` 은 존재하지 않는 엔트리를 예외 없이 건너뛴다. `DEPLOY_ENTRIES` 에 등록하지 않으면 파일을 만들어도 **조용히 배포되지 않는다.** `STATIC_PAGES` 누락은 sitemap에서만 조용히 빠진다. 두 배열 등록을 테스트로 고정한다.

### 5.2 `devpath-frontend`

| 파일 | 변경 |
|---|---|
| `apps/web/lib/src/features/consent/presentation/consent_page.dart:16` | `terms` 에 `docUrl: 'https://leva.ai.kr/terms'` 추가 |
| `apps/web/test/features/consent/consent_page_test.dart` | 약관 항목에서 전문 링크가 열리는지 단언(PRIVACY 테스트와 같은 방식) |

### 5.3 `devpath-shared`

`src/main/resources/db/migration/V202608121001__terms_v2_reconsent.sql` 신설 — 기존 이용자의 `consent_status` 를 `PENDING` 으로 되돌린다.

> **함정**: shared 발행은 `main` 푸시에서만 자동으로 돈다. develop 머지 후 `gh workflow run publish.yml --ref develop` 으로 **수동 발행**해야 서비스가 새 마이그레이션을 본다.

### 5.4 `devpath-platform-svc`

`ConsentType.TERMS(true, "v2")` 로 올린다. 다른 타입은 `"v1"` 유지 — 개정된 것은 약관뿐이다.

## 6. 검증

| 대상 | 방법 |
|---|---|
| home-page | `npm test`(vitest) + playwright 스모크. **`dist/terms.html` 이 실제로 생성되는지**와 sitemap에 `/terms` 가 들어가는지를 직접 단언한다 |
| frontend | `melos run test` — `docUrl` 존재 단언 |
| platform-svc | `./gradlew test` — 동의 제출 시 TERMS 가 `"v2"` 로 저장되는지. 재동의 발동 자체는 마이그레이션이 하므로 여기서 검증하지 않는다 |
| 라이브 | `curl.exe -4` 로 `/terms` 200 · canonical · sitemap 반복 측정 |

> **함정**: 배포 직후 단발 측정은 믿을 수 없다. CF 엣지가 경로별로 옛/새를 섞어 응답한 사례가 하루 6회 관측됐다. 안정될 때까지 반복 측정한다.

## 7. 배포 순서

순서를 지키지 않으면 **읽을 수 없는 약관에 동의하라는 화면**이 뜬다.

1. **`terms.html` 배포 → 라이브 실측 통과**
   - home-page는 머지만으로 배포되지 않는다. wrangler 직접 업로드이며 **CF Pages production 브랜치는 `develop`** 이다. `--branch=main` 으로 올리면 preview로 가고 `leva.ai.kr` 은 바뀌지 않는다.
2. **frontend `docUrl` 배선 → `develop`→`main` 릴리스**
   - `web-deploy` 는 `refs/heads/main` 에서만 돈다. 릴리스하지 않으면 앱에 반영되지 않는다.
   - 이미 대기 중인 처리방침 링크(PR #124)와 함께 나간다.
3. **shared 마이그레이션 발행 → 중앙 마이그레이션 잡 → `ConsentType` v2 배포** (마지막)

1·2가 라이브에서 확인되기 전에 3을 실행하지 않는다.

## 8. 열린 항목

- 약관 본문 전문은 구현 단계에서 작성한다. 이 설계는 조항 구성과 각 조항이 담아야 할 내용을 고정한다.
- 법률 전문가 검토는 이 작업 범위 밖이다. 초안 성격임을 사용자가 인지한 상태다.
