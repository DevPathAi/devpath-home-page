# Home visual/accessibility evidence v2

This gate tests only the production `dist` build of `/`. It does not contact a
live environment, mutate deployment state, or retain page/learner content in
evidence manifests.

## Coverage

- Light production UI: full-page baselines at 320, 600, 840, and 1240 CSS px.
- Browser accessibility: axe WCAG 2 A/AA through 2.2 AA at 320/600/840/1240
  plus the open 320 menu, true 200% text reflow with exact computed-size checks
  and a synthetic long Korean identifier, complete keyboard focus order/rings/
  activation/trap exit, heading order, one primary action per section, every
  independent 44×44 px target with explicit inline-text exceptions, reduced
  motion, and mobile-menu Escape/focus return.
- Deterministic runtime: Chromium/Playwright 1.61.1, `ko-KR`, UTC, DPR 1,
  light color scheme, reduced motion, frozen clock, one worker, animation-off
  screenshots, and loopback-only browser requests.
- Fonts: the preparation step downloads five versioned jsDelivr files into the
  ignored `.visual-cache/fonts` directory and verifies every SHA-256. The
  browser then receives those bytes from the local test harness and waits for
  `document.fonts.ready` before assertions or screenshots.

The Home currently exposes no production dark-theme activation. Dark coverage
is therefore recorded as `not_applicable`, with a reason and a pending
`product-design` approval field in `e2e/visual/case-catalog.v2.json`. Dormant
dark tokens must not be activated only for a hidden test screenshot.

## Canonical verification

The single authoritative local command is the pinned-Docker wrapper:

```bash
npm run visual:evidence:docker
```

It uses the exact multi-architecture image digest in `baseline_policy.platform`,
isolates Linux `node_modules` in a disposable Docker volume, and runs the full
contract/font/production-dist/manifest sequence. It refuses a dirty worktree so
the evidence-producer SHA names the exact committed implementation. Direct host
runs on Windows or macOS are useful for iteration but are **non-authoritative**
for visual evidence.

For a non-authoritative quick host check only:

```bash
npm ci
npm run visual:contracts
npm run visual:fonts
npm run test:visual
npm run visual:evidence:validate
```

The generated `visual-evidence.v2.json` and `a11y-evidence.v2.json` distinguish
the rendered-product Git SHA from the evidence-producer Git SHA and also bind
the candidate-spec, catalog, and font-manifest SHA-256 values. A release harness can override the local candidate-spec binding with
`MISSION_CANDIDATE_SPEC_SHA256`; the value must be exactly 64 lowercase hex
characters. Manifests allow only aggregate status/count/hash fields—no HTML,
selectors, URLs, screenshot paths, form values, logs, or authored content.
Passing automated cases produce `release_ready`, except a passing visual set
with unapproved baselines is `diagnostic_pending_review`. Any missing or failed
required case produces a schema-valid `diagnostic_failure` manifest; the normal
validation command still fails unless every required case passed with failed=0.

## Baseline updates

CI never updates snapshots. Initial bootstrap and later changes go through
`npm run visual:baseline:update` inside the exact image named by
`baseline_policy.platform`.

The updater fails closed unless all review variables are present. The following
commands are environment inputs **inside the pinned Linux container**, not an
authoritative host invocation:

```bash
HOME_VISUAL_BASELINE_PLATFORM='<catalog platform including digest>'
HOME_VISUAL_BASELINE_STATUS='approved'
HOME_VISUAL_BASELINE_REVIEW_ID='design-review-123'
HOME_VISUAL_BASELINE_REVIEWER='reviewer-id'
HOME_VISUAL_BASELINE_REASON='bounded review rationale'
HOME_VISUAL_BASELINE_REVIEWED_AT='2026-08-16T00:00:00.000Z'
npm run visual:baseline:update
```

An initial candidate or an already-pending candidate may stay
`pending_external_review` only with `HOME_VISUAL_BASELINE_BOOTSTRAP=true`; this
does not claim approval. An approved baseline can never be downgraded to
pending, and its replacement requires approved metadata and a timestamp. The
review file binds the rendered product, candidate spec, ordered catalog, and
the verified on-disk PNG hashes. Baseline images may enforce regression before
approval, but `pending_external_review` is not release approval.

## External release evidence

Automated evidence does not replace assistive-technology validation. NVDA with
Chromium and VoiceOver with Safari remain manual pre-release gates, as does
human approval of the initial visual baseline. Brand/install/share asset work
is intentionally excluded until the approved Leva master asset exists.
