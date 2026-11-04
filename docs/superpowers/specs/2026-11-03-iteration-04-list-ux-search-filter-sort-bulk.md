# Iteration 04: List UX — Search, Filter, Sort, Bulk Actions, Prune Suggestions (W4)

Date: 2026-11-03. Status: awaiting review.

## Intent

Add search, filter, sort, and bulk actions to all four resource lists (Containers, Images, Volumes, Networks). Add prune suggestions based on app-side tracking of unused resources. This iteration transforms plain lists into actionable, filterable, sortable views with clear selection semantics and bulk operations.

**Success:** All four lists have search, sort, and bulk actions; a prune suggestion strip appears and is dismissible; selection is clearly highlighted with `aria-selected`; bulk delete confirmations name exactly what is being deleted.

## Scope

**In:**
- **Search box** on all four lists (Containers, Images, Volumes, Networks) — filters by name, ID, label
- **Running-only filter** toggle on the Containers list
- **Sortable columns** with sort indicator (up/down arrow) on all lists
- **Row selection** with clear highlight (`aria-selected="true"`); multi-select via checkbox or ⌘/Shift-click
- **Bulk actions** on selected rows:
  - "Remove selected" — confirms each selected resource by name
  - "Remove stopped (N)" — one-click removes all stopped containers
  - Bulk start/stop on selected containers
- **Usage column** in lists (CPU/memory for containers, size for images/volumes)
- **Prune suggestions**: Docker does not record last-used time, so the app records when it first saw an image or volume unused (in app storage, not Docker) and suggests cleanup after a chosen number of days, with sizes.
  - Never auto-delete
  - Named volumes are never bulk-suggested
  - Confirmations name exactly what goes
  - Suggestion strip is dismissible per suggestion

**Out:**
- Building a prune settings page (settings are app defaults, stored locally)
- Real last-used time tracking (Docker does not provide this — workaround is app-side tracking)

## Research (SPEC.md Principle 2)

Per SPEC.md Principle 2, research was conducted before building. Research artifacts stored at:
- `docs/research/2026-11-03-podman-desktop-list-behaviour.md` — Podman Desktop's list behaviour: filters, bulk delete patterns, selection UX
- `docs/research/2026-11-03-docker-prune-semantics.md` — `docker image prune` and `docker volume prune` semantics, what each removes, what it preserves

## Current State

- Four resource lists exist (Containers, Images, Volumes, Networks) but have no search, filter, sort, or bulk actions
- No prune suggestion system exists
- No row selection mechanism exists
- Docker does not track "last-used" time for images or volumes

## Design

### 1. Search Box

Each list gets a search input at the top. Search matches against:
- **Containers:** name, ID (short), labels, image name
- **Images:** repository:tag, ID (short)
- **Volumes:** name
- **Networks:** name, driver

Search is case-insensitive and debounced by 200ms. Empty search shows all results.

```typescript
// Search implementation
function useListSearch<T extends { name: string; id: string }>(
  items: T[],
  query: string
): T[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase();
  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
  );
}
```

### 2. Running-Only Filter

On the Containers list, a toggle filter: "Show running only" / "Show all". When toggled, only containers with status containing "running" are displayed. This is a client-side filter applied after search.

### 3. Sortable Columns

Each list has sortable columns with visual sort indicators. Default sort:
- **Containers:** status (healthy > unhealthy > restarting > dead > exited > running), then name
- **Images:** repository:tag (alphabetical)
- **Volumes:** name (alphabetical)
- **Networks:** name (alphabetical)

Users can click column headers to toggle ascending/descending. Sort state is per-list.

```typescript
// Sort implementation
function useListSort<T>(
  items: T[],
  sortKey: keyof T,
  direction: "asc" | "desc"
): T[] {
  return [...items].sort((a, b) => {
    const aVal = String(a[sortKey]);
    const bVal = String(b[sortKey]);
    return direction === "asc"
      ? aVal.localeCompare(bVal)
      : bVal.localeCompare(aVal);
  });
}
```

### 4. Row Selection

Each row has a checkbox (visually hidden when no selection is active). Selection modes:
- **Single click** on checkbox: select/deselect row
- **⌘/Ctrl + click**: toggle individual row
- **Shift + click**: select range from last selected to clicked
- **Select all** checkbox in header: select all visible (filtered/searched) rows

Selected rows are highlighted with a distinct background color (AA contrast in both themes). `aria-selected="true"` is set on selected rows. Bulk action buttons appear when ≥1 row is selected.

### 5. Bulk Actions

When rows are selected, action buttons appear:

| Button | Action | Confirmation |
|--------|--------|-------------|
| "Remove selected (N)" | Stop (if running) and remove selected containers | Lists each container name; requires explicit confirm |
| "Remove stopped (N)" | Remove all stopped containers | Lists count; requires explicit confirm |
| "Start selected (N)" | Start all selected containers | Lists each name; requires explicit confirm |
| "Stop selected (N)" | Stop all selected containers | Lists each name; requires explicit confirm |

**Key constraint:** Confirmations name exactly what will be deleted/modified. No "N items will be removed" without listing them.

### 6. Prune Suggestions

Docker does not track "last-used" time for images or volumes. Workaround: the app tracks this in app storage (localStorage/IndexedDB).

**Logic:**
1. When an image or volume is first seen, record the timestamp in app storage.
2. When an image or volume is used (container created from image, volume mounted), reset its "last seen used" timestamp.
3. After `pruneThresholdDays` (default: 30) without use, add to prune suggestions.
4. **Never auto-delete.** Suggestions appear as a dismissible strip at the bottom of each list.
5. **Named volumes are never bulk-suggested** — they require individual review.
6. Each suggestion shows: resource name, size, days unused, "Remove" button.

```typescript
// Prune tracking interface
interface PruneRecord {
  id: string;
  name: string;
  type: "image" | "volume";
  size: number; // bytes
  firstSeen: number; // timestamp
  lastUsed: number; // timestamp
  daysUnused: number; // computed
}

// Suggestion threshold (configurable, stored in app preferences)
const PRUNE_THRESHOLD_DAYS = 30;

function getPruneSuggestions(
  resources: Array<{ id: string; name: string; size?: number }>,
  storage: AppStorage
): PruneRecord[] {
  return resources
    .filter((r) => {
      const record = storage.getPruneRecord(r.id);
      return record && record.daysUnused > PRUNE_THRESHOLD_DAYS;
    })
    .map((r) => {
      const record = storage.getPruneRecord(r.id);
      return {
        id: r.id,
        name: r.name,
        type: r.id.startsWith("vol_") ? "volume" : "image",
        size: r.size ?? 0,
        firstSeen: record.firstSeen,
        lastUsed: record.lastUsed,
        daysUnused: record.daysUnused,
      };
    });
}
```

### 7. Usage Column

Add a "Usage" column to lists:
- **Containers:** CPU % and memory (e.g., "12% | 64MB")
- **Images:** size (e.g., "245MB")
- **Volumes:** size (e.g., "1.2GB")
- **Networks:** (no usage data available — column hidden)

Usage data comes from existing Docker API calls (`docker ps --format`, `docker system df -v --format json`).

### 8. Acceptance Criteria

- All four lists have a search box that filters by name/ID/label
- Containers list has a "running-only" filter toggle
- All lists have sortable columns with visual indicators
- Row selection is clearly highlighted with `aria-selected`
- "Remove selected" and "Remove stopped" actions work with confirmations naming each resource
- Bulk start/stop works on selected containers
- Prune suggestion strip appears after threshold days, is dismissible, and never includes named volumes
- Usage column shows CPU/memory for containers, size for images/volumes
- All four lists pass the new list UX test suite

### 9. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Large lists (1000+ containers) become slow with search/sort | Medium | Virtualize long lists; debounce search; limit results to 500 |
| Prune suggestions clutter the UI if threshold is too low | Low | Default threshold of 30 days; make configurable; make dismissible |
| Bulk delete confirmation text too long for many selections | Low | Truncate list in confirmation; show "and N more" |
| Selection state not persisted across list refreshes | Low | Store selection in app state (not Docker), clear on filter change |

### 10. Open Questions

- What is the default prune threshold? (Proposal: 30 days, configurable)
- Should prune suggestions persist if dismissed, or reappear after threshold is reached again? (Proposal: reappear — dismissal is per-suggestion, not global)
