# Contributing

## Setup

```bash
pnpm install          # Install all workspace deps and wire symlinks
pnpm run build        # Build packages/core then packages/react
```

## Development Commands

```bash
pnpm test             # Run all tests (345 core + 11 react)
pnpm run typecheck    # TypeScript check across all packages
pnpm run lint         # ESLint across all packages
pnpm run check        # Full check (typecheck + lint + format + test)
pnpm run demo         # Start demo dev server
```

To work on a single package:

```bash
pnpm --filter @adaptkit/core run dev        # Watch mode build (core)
pnpm --filter @adaptkit/react run test      # Tests (react only)
pnpm --filter @adaptkit/core run typecheck  # Typecheck (core only)
```

## Running the Demos

The demos live in `demo/` with their own Vite + React setup. They depend on `@adaptkit/core` and `@adaptkit/react` as pnpm workspace packages, so `pnpm install` at the repo root wires everything up automatically — no separate install step needed.

```bash
pnpm run build   # Build packages first (demos consume dist/)
pnpm run demo    # Start the demo dev server
```

If you're iterating on both the SDK and demos simultaneously, run `pnpm --filter @adaptkit/core run dev` (tsup watch) in one terminal and `pnpm run demo` (Vite dev server) in another.
