# Home visual/accessibility evidence v2

This gate tests only the production `dist` build of `/`. It does not contact a
live environment, mutate deployment state, or retain page/learner content in
evidence manifests.

## Coverage

- Light production UI: full-page baselines at 320, 600, 840, and 1240 CSS px.
- Browser accessibility: axe WCAG 2 A/AA through 2.2 AA, 200% text reflow with
  a synthetic long Korean identifier, keyboard focus, heading order, one
  primary action per section, 44×44 px independent targets, reduced motion,
  and mobile-menu Escape/focus return.
- Deterministic runtime: Chromium/Playwright 1.61.1, `ko-KR`, UTC, DPR 1,
  light color scheme, reduced motion, frozen clock, one worker, animation-off
  screenshots, and loopback-only browser requests.
- Fonts: the preparation step downloads four versioned jsDelivr files into the
  ignored `.visual-cache/fonts` directory and verifies every SHA-256. The
  browser then receives those bytes from the local test harness and waits for
  `document.fonts.ready` before assertions or screenshots.

The Home currently exposes no production dark-theme activation. Dark coverage
is therefore recorded as `not_applicable`, with a reason and a pending
`product-design` approval field in `e2e/visual/case-catalog.v2.json`. Dormant
dark tokens must not be activated only for a hidden test screenshot.

## Local verification

```bash
npm ci
npm run visual:contracts
npm run visual:fonts
npm run test:visual
npm run visual:evidence:validate
```

The generated `visual-evidence.v2.json` and `a11y-evidence.v2.json` bind the
current Home Git SHA, candidate-spec SHA-256, catalog SHA-256, and font-manifest
SHA-256. A release harness can override the local candidate-spec binding with
`MISSION_CANDIDATE_SPEC_SHA256`; the value must be exactly 64 lowercase hex
characters. Manifests allow only aggregate status/count/hash fields—no HTML,
selectors, URLs, screenshot paths, form values, logs, or authored content.

## Baseline updates

CI never updates snapshots. Initial bootstrap and later changes go through
`npm run visual:baseline:update` inside the exact image named by
`baseline_policy.platform`.

The updater fails closed unless all review variables are present:

```bash
HOME_VISUAL_BASELINE_PLATFORM='<catalog platform including digest>'
HOME_VISUAL_BASELINE_STATUS='approved'
HOME_VISUAL_BASELINE_REVIEW_ID='design-review-123'
HOME_VISUAL_BASELINE_REVIEWER='reviewer-id'
HOME_VISUAL_BASELINE_REASON='bounded review rationale'
HOME_VISUAL_BASELINE_REVIEWED_AT='2026-08-16T00:00:00.000Z'
npm run visual:baseline:update
```

Only a first baseline set may use `pending_external_review`, and that also
requires `HOME_VISUAL_BASELINE_BOOTSTRAP=true`. Once any baseline exists, every
change requires `approved` metadata. The review file records only bounded
metadata and artifact hashes. Baseline images may enforce regression before
approval, but a `pending_external_review` status is not release approval.

## External release evidence

Automated evidence does not replace assistive-technology validation. NVDA with
Chromium and VoiceOver with Safari remain manual pre-release gates, as does
human approval of the initial visual baseline. Brand/install/share asset work
is intentionally excluded until the approved Leva master asset exists.
