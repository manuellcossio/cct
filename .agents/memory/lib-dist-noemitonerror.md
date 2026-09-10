---
name: Composite lib dist + noEmitOnError pitfall
description: Why tsc --build/--force can wipe a lib's dist and break api-server typecheck
---

# tsc --build wiping composite lib dist

`tsconfig.base.json` sets `noEmitOnError: true`. Some integration libs (e.g. `@workspace/integrations-openai-ai-server`, `*-react`) have PRE-EXISTING type errors (AbortError on p-retry, response.data possibly undefined, missing `react`/`node` types).

- Libs' package `exports` point at `./src/*.ts`, so runtime (tsx) and most editor resolution use source directly — the app runs fine without `dist`.
- But api-server typecheck uses TS **project references**, which require each referenced composite lib's emitted `dist/*.d.ts`. If that dist is missing → `error TS6305: Output file ... has not been built`.
- Running `pnpm run typecheck:libs` or `tsc -b --force` will CLEAN then try to rebuild; for a lib with type errors + noEmitOnError it emits nothing, leaving dist missing and breaking api-server typecheck even though you changed nothing in that lib.

**Fix / restore:** force-emit declarations ignoring the pre-existing errors:
`npx tsc -p lib/<broken-lib>/tsconfig.json --noEmitOnError false`
Then api-server typecheck passes again. Do NOT try to "fix" those unrelated lib errors unless asked.

**Also:** after editing a `lib/db` schema, rebuild the db lib (`npx tsc -b lib/db/tsconfig.json`) so consumers see new columns in types.
