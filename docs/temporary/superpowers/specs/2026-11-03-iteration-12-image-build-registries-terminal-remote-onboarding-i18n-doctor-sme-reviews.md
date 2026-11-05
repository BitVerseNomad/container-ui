# SME Reviews — Design Doc 12 (Iteration 12, W13+W14: Image Build, Registries, Terminal, Remote, Linux, Onboarding, i18n, Doctor Extensions)

## Reviewer 1: Engineer

### HOLDS:
- None — this iteration covers a lot of ground, but each sub-scope is well-defined.

### WEAKENED:
- This iteration covers 14 work items — scope is too large for a single iteration. [Confidence: 80%]
- \"Lazydocker integration\" is vague — what features, what level of integration? [Confidence: 65%]
- \"Doctor extensions\" is extremely vague — what extensions, what API? [Confidence: 70%]

### KILLED:
- Building a full terminal emulator — a command log is more appropriate. [Confidence: 85%]
- Full remote Docker support — remote support is correctly deferred. [Confidence: 80%]

### MISSING:
- Image build: How are build contexts and Dockerfiles specified? [Confidence: 80%]
- Registry push: How are credentials managed for registry pushes? [Confidence: 85%]
- Terminal integration: How is terminal output captured and displayed? [Confidence: 80%]
- Remote Docker: What protocols are supported (SSH? TLS?). [Confidence: 75%]
- Onboarding flow: What is the step-by-step onboarding experience? [Confidence: 85%]
- i18n: What locales are supported initially? How are translations managed? [Confidence: 75%]
- Doctor extensions API: What is the extension interface? [Confidence: 70%]

---

## Reviewer 2: Product Manager

### HOLDS:
- None — each sub-scope has value, but combined scope is concerning.

### WEAKENED:
- This iteration covers too many unrelated features — each should be its own iteration. [Confidence: 85%]
- \"Onboarding\" value is unclear — what is the ideal onboarding experience? [Confidence: 60%]

### KILLED:
- A full IDE — this is a Docker management tool, not an IDE. [Confidence: 90%]

### MISSING:
- Prioritization: Which sub-features are P0 vs. P1 vs. P2? [Confidence: 85%]
- User personas: Who benefits from each sub-feature? (Developers? DevOps? Beginners?) [Confidence: 80%]
- Success metrics: What defines success for each sub-feature? [Confidence: 85%]
- Onboarding: What is the minimum viable onboarding experience? [Confidence: 75%]
- i18n: Which locales are prioritized, and why? [Confidence: 70%]

---

## Reviewer 3: UX

### HOLDS:
- None — each sub-scope has familiar UI patterns.

### WEAKENED:
- Twelve unrelated features crammed into one iteration creates UX inconsistency risk. [Confidence: 80%]
- No unified design language across all sub-features. [Confidence: 70%]

### KILLED:
- A full terminal emulator — a command log is sufficient. [Confidence: 90%]
- A full IDE — this is a Docker management tool. [Confidence: 95%]

### MISSING:
- Image build UX: How do users specify build parameters? [Confidence: 75%]
- Terminal UX: What does the terminal integration look like? [Confidence: 80%]
- Onboarding UX: What is the step-by-step onboarding flow? [Confidence: 85%]
- Empty states: What's shown for each feature when no data exists? [Confidence: 80%]
- i18n: How are UI strings externalized for translation? [Confidence: 70%]