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
  independent 44×44 px target at 320/600/840/1240 with explicit inline-text
  exceptions, reduced motion, mobile-menu Escape/focus return, and the complete
  open compact-menu Tab/ring/activation/trap-exit journey.
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

The single authoritative local diagnostic command is the pinned-Docker wrapper:

```bash
npm run visual:evidence:docker
```

Release sealing uses the same wrapper, but the orchestrator must supply both an
absolute path to the canonical global candidate's raw bytes and its independently
transported expected hash:

```bash
MISSION_CANDIDATE_SPEC_PATH='/absolute/path/to/candidate-spec.raw.json' \
MISSION_CANDIDATE_SPEC_SHA256='<64-lowercase-hex-out-of-band-sha256>' \
npm run visual:evidence:docker
```

The pair is atomic: either value without the other is rejected, uppercase or
malformed hashes are rejected, and the raw file is hashed before Docker starts.
The wrapper mounts only that file read-only at `/mission-candidate/spec.raw`,
passes the fixed container path plus expected hash into the pinned container,
and the evidence generator verifies the same raw bytes again. The sanitized
outputs are always `test-results/visual-a11y/manifests/visual-evidence.v2.json`
and `test-results/visual-a11y/manifests/a11y-evidence.v2.json`.

It uses the exact multi-architecture image digest in `baseline_policy.platform`,
isolates Linux `node_modules` in a disposable Docker volume, and runs the full
contract/font/production-dist/manifest sequence. A read-only common Git metadata
mount lets the container independently resolve both committed trees,
including from a linked Windows worktree. It refuses a dirty worktree so
the evidence-producer SHA names the exact committed implementation. Direct host
runs on Windows or macOS are useful for iteration but are **non-authoritative**
for visual evidence.

When the external pair is absent, the committed Home candidate is used only as
a Home-local diagnostic/ordinary-CI preflight binding. That fallback artifact is
not a global release-seal input. The GitOps release workflow owns the canonical
candidate path and out-of-band hash and must never replace them with the Home
fixture hash.

Before rendering, the gate resolves the candidate's rendered-product commit,
hashes every committed non-evidence tree entry, and requires the producer's
corresponding product tree to be byte-identical. Only the explicit evidence
allowlist (visual specs, schemas, baselines, validators, and their documentation)
may differ between those commits. A dirty tree, a producer SHA other than HEAD,
an uncommitted SHA, or any runtime/build-source drift is rejected before build.

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
the verified rendered-product tree, candidate-spec, catalog, and font-manifest
SHA-256 values. A release harness binds the global candidate only with the
verified `MISSION_CANDIDATE_SPEC_PATH`/`MISSION_CANDIDATE_SPEC_SHA256` pair;
a hash by itself is never trusted. Manifests allow only aggregate
status/count/hash fields—no HTML,
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
review file binds the rendered product commit and verified product-tree hash,
candidate spec, ordered catalog, and the verified on-disk PNG hashes. Baseline
images may enforce regression before
approval, but `pending_external_review` is not release approval.

## External release evidence

Automated evidence does not replace assistive-technology validation. NVDA with
Chromium and VoiceOver with Safari remain manual pre-release gates, as does
human approval of the initial visual baseline. Brand/install/share asset work
is intentionally excluded until the approved Leva master asset exists.
