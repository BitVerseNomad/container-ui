# SME Reviews — Design Doc 06 (Iteration 06, W6: Compose Projects — Read Only)

## Reviewer 1: Engineer

### HOLDS:
- None — read-only compose project management is the correct approach per SPEC.md.

### WEAKENED:
- "Path validation" is vague — what constitutes a valid path? (Exists? Readable? Contains docker-compose.yml?) [Confidence: 60%]
- No mention of docker-compose file format validation (v2 vs. v3, Compose spec). [Confidence: 70%]

### KILLED:
- Any compose editing UI — correctly scoped as read-only per SPEC.md Principle 2. [Confidence: 95%]

### MISSING:
- Multi-file compose detection: How are docker-compose.prod.yml, docker-compose.dev.yml handled? [Confidence: 80%]
- Project discovery: How are compose projects discovered? (Scan directories? User-specified paths?) [Confidence: 85%]
- Plugin detection: What plugins are detected, and how are they surfaced? [Confidence: 75%]

---

## Reviewer 2: Product Manager

### HOLDS:
- None — read-only compose management is the right call per SPEC.md.

### WEAKENED:
- The value of read-only compose management is unclear — why not just edit the YAML file directly? [Confidence: 50%]

### KILLED:
- A compose editor — correctly deferred as per SPEC.md "no compose editor" decision. [Confidence: 95%]

### MISSING:
- User persona: Who benefits from read-only compose management? (DevOps? Multi-project developers?) [Confidence: 75%]
- Success metric: What defines success for read-only compose management? (Fewer YAML errors? Faster project switching?) [Confidence: 80%]
- Edge case: What happens if a compose file references a service not defined in the project? [Confidence: 70%]

---

## Reviewer 3: UX

### HOLDS:
- None — read-only UI is lower risk.

### WEAKENED:
- No visual distinction between active and inactive compose projects. [Confidence: 65%]

### KILLED:
- A compose editor UI — correctly deferred to a future iteration. [Confidence: 95%]

### MISSING:
- Project status visualization: How are running/stopped/partially-running projects distinguished? [Confidence: 80%]
- Empty state: What's shown when no compose projects are found? [Confidence: 75%]