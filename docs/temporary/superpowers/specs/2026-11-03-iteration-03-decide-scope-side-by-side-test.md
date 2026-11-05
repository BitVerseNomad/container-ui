# Iteration 03: Decide Scope from the Side-by-Side Test (W3)

Date: 2026-11-03. Status: awaiting review.

## Intent

The owner runs the evaluation script `scripts/eval-setup.sh` against Podman Desktop and ColimaStack, fills in `artifacts/eval-scorecard.html`, and pastes the summary back. Based on the scorecard results, a decision is recorded: keep the full roadmap, narrow to the guidance layer plus integrations, or adopt an existing tool. This is a decision-gating iteration — no code changes, only a recorded decision.

**Success:** `artifacts/eval-scorecard.html` is filled; a decision is recorded in `docs/research/2026-10-11-landscape.md`; the product direction is unambiguous.

## Scope

**In:**
- Owner runs `scripts/eval-setup.sh` (evaluation script comparing this project against Podman Desktop and ColimaStack)
- Owner fills `artifacts/eval-scorecard.html` with comparison scores
- Owner pastes the scorecard summary back to the project
- Decision recorded in `docs/research/2026-10-11-landscape.md`:
  - Option A: Keep the full roadmap (all W1–W14)
  - Option B: Narrow to the guidance layer plus integrations only
  - Option C: Adopt an existing tool (Podman Desktop or ColimaStack)
- Decision documented with reasoning and impact on remaining work items

**Out:**
- Any implementation work (this is purely a decision gate)
- Building the evaluation script itself (already exists)

## Research (SPEC.md Principle 2)

Per SPEC.md Principle 2, research was conducted before deciding. Research artifacts stored at:
- `docs/research/2026-10-11-landscape.md` — Side-by-side comparison with Podman Desktop and ColimaStack, scored via `eval-scorecard.html`

## Current State

- `scripts/eval-setup.sh` exists and can run the evaluation
- `artifacts/eval-scorecard.html` exists as a fillable scorecard template
- No decision has been recorded yet — the product direction is open
- This decision gates whether W4–W14 proceed, narrow, or are abandoned

## Design

### 1. Evaluation Script Execution

The evaluation script `scripts/eval-setup.sh` compares this project against two alternatives:

| Dimension | This Project | Podman Desktop | ColimaStack |
|-----------|-------------|----------------|-------------|
| Container listing | Built | Built | Built |
| Health checks | Built | Built | Built |
| Kubernetes | Built | Built | Partial |
| Registry support | Partial (W2 merge) | Built | Partial |
| Compose support | Not started | Built | Built |
| Guidance layer | Partial (Setup tab) | Partial | Partial |
| Prune suggestions | Not started | Partial | Not started |
| Menu bar item | Not started | Not started | Not started |

The owner fills `artifacts/eval-scorecard.html` with numerical scores per dimension, then the script produces a summary.

### 2. Decision Recording

The decision is recorded in `docs/research/2026-10-11-landscape.md` with:
- The scorecard summary (pasted from the scorecard output)
- The selected option (A/B/C)
- Reasoning for the choice
- Impact on remaining work items (which W# are kept/cut/narrowed)
- Owner signature/date

### 3. Impact Mapping

Depending on the decision:

**Option A (Keep full roadmap):**
- All W4–W14 proceed as specified in SPEC.md
- No scope changes needed

**Option B (Narrow to guidance layer + integrations):**
- Keep: W1 (verification), W4 (list UX), W5 (run panel), W8 (diagnostics), W12 (hardening)
- Cut: W6 (compose editor — already read-only), W7 (Colima settings), W9 (menu bar), W10 (command palette), W11 (packaging), W13 (image build/push), W14 (doctor extensions)
- Retain but defer: W2 (registries merge), W3 (this decision)

**Option C (Adopt existing tool):**
- All W4–W14 are abandoned or repurposed
- This project becomes a thin wrapper or integration layer around the chosen tool
- Research artifact `docs/research/2026-10-11-landscape.md` documents the adoption rationale

### 4. Acceptance Criteria

- `artifacts/eval-scorecard.html` is filled with scores from the owner
- `docs/research/2026-10-11-landscape.md` exists with the recorded decision
- The decision includes: selected option, reasoning, impact on W4–W14
- The product direction is unambiguous (no "maybe" or "tbd")
- Owner has signed/confirmed the decision

### 5. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Owner does not run the evaluation script | High | Block on this decision — no further work until recorded |
| Scorecard is subjective or incomplete | Medium | Require owner's written reasoning, not just numbers |
| Decision reverses course mid-implementation | High | Freeze decisions once recorded; require new decision doc to override |

### 6. Open Questions

- None — this iteration exists solely to resolve open questions about scope.
