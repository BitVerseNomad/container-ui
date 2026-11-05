# Iteration 02: Merge Registries Branch and Finish (W2)

Date: 2026-11-03. Status: awaiting review.

## Intent

Merge the `feat/registries` branch into `integration` (resolving 4-file conflicts) and add AWS/ECS scenarios to the preview mock so `scripts/check-registries.mjs` passes. This is a prerequisite for any registry-related work downstream — the registries tab exists on `feat/registries` but is not yet on `integration`.

**Success:** `integration` includes the registries tab; `check-registries.mjs` is green; all 10 other test suites pass; unit tests pass; README and research notes updated.

## Scope

**In:**
- Resolve 4-file merge conflicts between `integration` and `feat/registries`:
  - `src/useEnv.ts`: union of optional tools (`kubectl`, `k9s`, `aws`, `ecr_helper`)
  - `src/styles.css`: keep both appended blocks
  - `src-tauri/src/main.rs`: union functions, tests, `EnvReport`, `env_check` gains `aws`/`ecr_helper`, `validate_install` adds `awscli`/`docker-credential-helper-ecr`, handler list gets `aws`/`docker_config_read`/`docker_config_write`
  - `preview/mock.ts`: union env object and invoke cases (`aws`, `docker_config_read`/`write`, `kubectl`, `open_terminal`)
- Add AWS scenarios to `preview/mock.ts`: `?aws=ready|expired|noaws|noconfig|nohelper`
- Mock `aws` command: `configure list-profiles`, `configure get sso_session|sso_start_url|role_arn|region`, `sts get-caller-identity`, `ecr describe-repositories`, `ecr describe-images`
- Mock `docker_config_read`/`docker_config_write`
- Add registries suite to Playwright test list

**Out:**
- Building the registries UI tab (already exists on `feat/registries`)
- Real AWS account verification (SSO behaviour with helper — flagged as known issue)

## Research (SPEC.md Principle 2)

Per SPEC.md Principle 2, research was conducted before building. Research artifacts stored at:
- `docs/research/2026-11-03-aws-ecr-integration.md` — AWS SSO, ECR credential helper setup, `docker-credential-helper-ecr` behavior
- `docs/research/2026-11-03-docker-registry-credentials.md` — Docker credential store (`~/.docker/config.json`), `credsStore` vs `credHelpers`

## Current State

- `feat/registries` branch exists with a complete registries tab
- `integration` branch does not include the registries tab
- A trial merge hit conflicts in 4 files and was aborted
- `scripts/check-registries.mjs` exists but expects scenarios not yet in `preview/mock.ts`
- Known issue: SSO behaviour with the ECR credential helper is not yet verified on a real AWS account (SPEC.md §6)

## Design

### 1. Merge Resolution (Core Mechanism)

The merge between `integration` and `feat/registries` hits conflicts in 4 files. Resolution per SPEC.md §3:

```typescript
// src/useEnv.ts — union of optional tools
type OptionalTools = "kubectl" | "k9s" | "aws" | "ecr_helper";

// src-tauri/src/main.rs — EnvReport gains aws/ecr_helper
interface EnvReport {
  // ... existing fields
  aws?: ToolStatus;
  ecr_helper?: ToolStatus;
}

// preview/mock.ts — union env object and invoke cases
const mockEnv: EnvReport = {
  // ... existing fields
  aws: { installed: true, version: "2.0.0" },
  ecr_helper: { installed: true, version: "0.7.0" },
};
```

### 2. Preview Mock Scenarios

Add AWS scenarios to `preview/mock.ts` that `check-registries.mjs` expects:

```typescript
// Scenario: ?aws=ready — all AWS tools present and configured
{ aws: { installed: true }, ecr_helper: { installed: true }, docker_config: { credHelpers: { "public.ecr.aws": "ecr-login" } } }

// Scenario: ?aws=expired — SSO session expired
{ aws: { installed: true, ssoExpired: true }, ecr_helper: { installed: true } }

// Scenario: ?aws=noaws — AWS CLI not installed
{ aws: { installed: false }, ecr_helper: { installed: true } }

// Scenario: ?aws=noconfig — no docker config.json credentials
{ docker_config: { hasConfig: false } }

// Scenario: ?aws=nohelper — ECR credential helper not installed
{ aws: { installed: true }, ecr_helper: { installed: false } }
```

Mock command implementations:
- `aws configure list-profiles` → returns configured profiles
- `aws configure get sso_session|sso_start_url|role_arn|region` → returns SSO config
- `aws sts get-caller-identity` → returns account ID
- `aws ecr describe-repositories` → returns ECR repos
- `aws ecr describe-images` → returns images in a repo

### 3. Test Integration

Add the registries suite to the Playwright test list (alongside the existing 10 suites):
- `scripts/check-registries.mjs` — validates the registries tab
- Ensure all 11 suites pass (existing 10 + registries)

### 4. Acceptance Criteria

- `integration` branch includes the registries tab
- `check-registries.mjs` passes green
- All 10 existing test suites still pass
- Unit tests pass
- README updated with registries tab description
- Research notes committed at `docs/research/2026-11-03-aws-ecr-integration.md` and `docs/research/2026-11-03-docker-registry-credentials.md`
- Real-account SSO verification flagged as a known issue (SPEC.md §6)

### 5. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Merge conflicts in Rust backend (`src-tauri/src/main.rs`) with 8 hunks | High | Careful manual resolution; union all additions from both sides |
| SSO behavior with ECR credential helper differs from mock | Medium | Flag as known issue; document in README |
| Mock returns stale objects (React bails out on identical state) | Low | Ensure mocks return fresh objects per call |

### 6. Open Questions

- None. The registries UI tab already exists on `feat/registries`; this iteration is purely merge + mock completion.
