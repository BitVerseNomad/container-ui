# Stopped: WO-1.3c

## Step

Step 5.3. The step asks for a lint probe that reports two errors, then deletes the probe and keeps the new lint guard.

## Command

```bash
cat > src/dev/Probe.tsx <<'PROBE'
export const Probe = () => <button style={{ color: "red" }}>x</button>;
PROBE
npm run lint
```

## Output

This is the full output after step 5.2 added the guard from the work order.

```text

> openpier@0.2.1 lint
> eslint src --ext .ts,.tsx


/Users/fsousa/Desktop/colima-ui/src/App.tsx
   70:6  warning  React Hook useEffect has a missing dependency: 'reloadProfiles'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
  119:6  warning  React Hook useEffect has a missing dependency: 'active'. Either include it or remove the dependency array          react-hooks/exhaustive-deps
  129:6  warning  React Hook useEffect has a missing dependency: 'vm.op'. Either include it or remove the dependency array           react-hooks/exhaustive-deps
  333:6  warning  React Hook useMemo has a missing dependency: 'kubeOn'. Either include it or remove the dependency array            react-hooks/exhaustive-deps

/Users/fsousa/Desktop/colima-ui/src/BringOver.tsx
  145:6  warning  React Hook useEffect has a missing dependency: 'check'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/fsousa/Desktop/colima-ui/src/CommandPalette.tsx
  84:8  warning  React Hook useCallback has a missing dependency: 'highlightedCommand'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/fsousa/Desktop/colima-ui/src/Commands.tsx
  42:6  warning  React Hook useEffect has a missing dependency: 'last'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/fsousa/Desktop/colima-ui/src/Containers.tsx
  174:6    warning  React Hook useEffect has a missing dependency: 'infoOf'. Either include it or remove the dependency array                                                                            react-hooks/exhaustive-deps
  231:101  warning  Unused eslint-disable directive (no problems were reported from 'react-hooks/exhaustive-deps')
  234:9    warning  The 'gaps' conditional could make the dependencies of useEffect Hook (at line 245) change on every render. To fix this, wrap the initialization of 'gaps' in its own useMemo() Hook  react-hooks/exhaustive-deps

/Users/fsousa/Desktop/colima-ui/src/Profiles.tsx
  38:18  warning  Unused eslint-disable directive (no problems were reported from 'react-hooks/exhaustive-deps')

/Users/fsousa/Desktop/colima-ui/src/PullPanel.tsx
  43:6  warning  React Hook useEffect has missing dependencies: 'search' and 'searchFor'. Either include them or remove the dependency array  react-hooks/exhaustive-deps

/Users/fsousa/Desktop/colima-ui/src/dev/Gallery.tsx
  2:1  error  '../ui/op' import is restricted from being used by a pattern. Use the components in src/ui/op  no-restricted-imports

/Users/fsousa/Desktop/colima-ui/src/dev/Probe.tsx
  1:28  error  Use <Button> from src/ui/op                        no-restricted-syntax
  1:36  error  No inline styles. Use a class from the stylesheet  no-restricted-syntax

/Users/fsousa/Desktop/colima-ui/src/guidance/fix-engine.ts
  108:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  125:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  212:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  231:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  239:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  248:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/Users/fsousa/Desktop/colima-ui/src/guidance/guided-run.ts
  222:52  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/Users/fsousa/Desktop/colima-ui/src/hooks.ts
  16:3  warning  Unused eslint-disable directive (no problems were reported from 'react-hooks/exhaustive-deps')
  30:6  warning  React Hook useCallback was passed a dependency list that is not an array literal. This means we can't statically verify whether you've passed the correct dependencies  react-hooks/exhaustive-deps
  30:6  warning  React Hook useCallback has a missing dependency: 'load'. Either include it or remove the dependency array                                                               react-hooks/exhaustive-deps

/Users/fsousa/Desktop/colima-ui/src/lib/k8s.ts
   11:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   22:15  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   27:57  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   99:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  107:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/Users/fsousa/Desktop/colima-ui/src/lib/network.ts
   9:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  13:74  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  33:91  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/Users/fsousa/Desktop/colima-ui/src/ui/Drawer.tsx
  22:25  warning  The ref value 'opener.current' will likely have changed by the time this effect cleanup function runs. If this ref points to a node rendered by React, copy 'opener.current' to a variable inside the effect, and use that variable in the cleanup function  react-hooks/exhaustive-deps

/Users/fsousa/Desktop/colima-ui/src/ui/components/Dialog.tsx
   49:6  warning  React Hook useCallback has a missing dependency: 'onClose'. Either include it or remove the dependency array. If 'onClose' changes too often, find the parent component that defines it and wrap that definition in useCallback  react-hooks/exhaustive-deps
  148:6  warning  React Hook useCallback has a missing dependency: 'onClose'. Either include it or remove the dependency array. If 'onClose' changes too often, find the parent component that defines it and wrap that definition in useCallback  react-hooks/exhaustive-deps

✖ 36 problems (3 errors, 33 warnings)
  0 errors and 3 warnings potentially fixable with the `--fix` option.

```

## Expected

Two errors in `src/dev/Probe.tsx`:

```text
Use <Button> from src/ui/op
No inline styles. Use a class from the stylesheet.
```

and no other errors. The guard must allow `src/dev/Gallery.tsx` to import the new components from `../ui/op`, because step 2 says the gallery imports the new providers from there.

## What happened

The probe gets the two expected errors. `src/dev/Gallery.tsx` gets one more error:

```text
2:1  error  '../ui/op' import is restricted from being used by a pattern. Use the components in src/ui/op  no-restricted-imports
```

The pattern `**/ui` in step 5.2 matches the directory and everything under it, so it also matches `../ui/op`. That is the only path the gallery is told to use.

## What I tried

1. Ran `npm run lint` with the probe in place. It exited 1 with three errors, including the gallery import error above.
2. Changed the gallery import to `../ui/op/index` and ran `npx eslint src/dev/Gallery.tsx`. It exited 1 with the same restricted import error. Then I restored the import.

## Why this is a stop

The work order tells the gallery to import from `../ui/op` and tells the lint guard to block `**/ui`. The guard cannot do both. The Done when check needs `npm run lint` to exit 0, so the work order cannot pass without changing the given guard or changing the given gallery import. Both would be guessing.

## Files on this branch

The branch has the gallery, the Vite environment types, the main entry point change, `scripts/not-migrated.json`, `scripts/check-not-migrated.mjs`, and the lint guard from steps 1 to 5. It does not have `scripts/check-gallery.mjs` yet, because step 6 comes after the stop.
