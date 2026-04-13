# Changelog

## 0.2.0

AdaptKit expands from a friction-detection SDK into a unified adaptive context layer. All changes are additive — existing friction detection behavior, event shapes, and thresholds are unchanged.

### New: Five-Dimension Adaptive Context

- **Environment detection** (`src/environment.ts`) — input modality, pointer precision, viewport bucket, connection speed, OS preferences (reduced motion, high contrast, color scheme), device memory. All detected via event listeners and `matchMedia` — no polling.
- **Behavior profiling** (`src/behavior.ts`) — interaction tempo (EWMA-based), keyboard-first detection (with hysteresis), scroll behavior classification (scanning/reading/searching). Piggybacks on existing collector listeners — zero additional DOM event subscriptions.
- **Familiarity tracking** (`src/familiarity.ts`) — per-scope visit count, completion status, recency. Persisted to localStorage with versioned schema. Handles storage failures gracefully (private browsing, quota exceeded).
- **Task state tracking** (`src/task.ts`) — current step, time in step, completed steps, abandoned-and-returned detection. Driven by `data-adapt-step` interactions.
- **Context aggregator** (`src/context.ts`) — combines all five dimensions into a single `AdaptContext` object. Friction events aggregated into 0-3 severity level per scope.

### New: Expanded Public API

- `AdaptKit.getContext(scope?)` — returns the full `AdaptContext` for a scope
- `AdaptKit.getEnvironment()` — convenience method for environment data
- `AdaptKit.markCompleted(scope)` — signals task/familiarity completion

### New: React SDK (`@adaptkit/core/react`)

Shipped as a subpath export — `import { useAdapt } from '@adaptkit/core/react'`.

- `AdaptProvider` — initializes AdaptKit, manages lifecycle
- `useAdapt(scope?)` — full adaptive context hook
- `useEnvironment()`, `useFriction(scope?)`, `useBehavior()`, `useFamiliarity(scope)`, `useTask()` — granular dimension hooks
- `useAdaptEvent(type, handler)` — event subscription hook
- Built on `useSyncExternalStore` for concurrent mode compatibility
- React >= 18 as peer dependency (optional — core works without React)

### New: Context Change Events

- `ADAPT_ENVIRONMENT_CHANGE` — emitted when any environment value changes
- `ADAPT_BEHAVIOR_CHANGE` — emitted when behavior profile transitions
- `ADAPT_FAMILIARITY_CHANGE` — emitted on first visit to a scope per session
- `ADAPT_STEP_CHANGE` — emitted when the active workflow step changes

### New: Widened Type System

- `AdaptKitEvent` union type (superset of `FrictionEvent` and `ContextChangeEvent`)
- `ContextChangeEvent` interface with `field`, `previousValue`, `currentValue`
- Context dimension interfaces: `EnvironmentContext`, `BehaviorContext`, `FamiliarityContext`, `TaskContext`, `FrictionContext`, `AdaptContext`
- `CONTEXT_EVENTS` constant object (parallel to existing `FRICTION_EVENTS`)

### Changed

- `ActionBus` handler type widened from `FrictionEvent` to `AdaptKitEvent`. Existing `FrictionEvent` handlers continue to work without changes — the bus is backward compatible.
- `AdaptKit.on()` / `AdaptKit.off()` accept `AdaptKitEvent` handlers (superset of `FrictionEvent`).

### Build

- New build entry: `dist/react.js` + `dist/react.d.ts` for the React SDK
- Package exports: `"."` (core) and `"./react"` (React SDK)
- React added as optional peer dependency (>= 18)

---

## 0.1.0

Initial release.

### Friction Signals

- **ADAPT_RAGE_CLICK** — 3+ clicks on the same element within 1s
- **ADAPT_DEAD_CLICK** — click on an element that looks interactive but has no detectable handler
- **ADAPT_FORM_THRASHING** — repeated focus cycling between form fields (4+ revisits, 2+ fields)
- **ADAPT_BLOCKED_INTENT** — user retries a failed action (submit failure loop, click retry with no DOM response)
- **ADAPT_INPUT_RESIGNATION** — rapid bulk text deletion (>70% within 1.5s)
- **ADAPT_FRUSTRATION_TEXT** — frustrated language detected in text inputs (33 patterns)

### Architecture

- Envelope-based sensor pipeline: DOM inspection happens once in the collector, sensors receive plain data objects
- Context Engine with negative signal gating, confidence scoring, and completion-gated emission
- Semantic Graph built from `data-adapt-role` and `data-adapt-step` DOM attributes
- Typed pub/sub Action Bus with wildcard support and error-isolated handlers
- All thresholds configurable via `start({ thresholds: {...} })`

### Build

- ESM (`dist/index.js`) for bundlers
- IIFE (`dist/index.global.js`) for script tags, exposes `window.AdaptKit`
- Full TypeScript declarations (`dist/index.d.ts`)
- Zero runtime dependencies
