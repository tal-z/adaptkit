# AdaptKit

A client-side context engine for building adaptive web UI.

## The Problem

Building UI that adapts to user conditions requires cobbling together scattered browser APIs, manual localStorage bookkeeping, and ad-hoc event tracking — with no unified abstraction. AdaptKit provides a single import that gives any component the full picture of what it should adapt to: device environment, interaction friction, behavior patterns, familiarity, and task progress.

## Packages

| Package           | Description                   | Install                       |
| ----------------- | ----------------------------- | ----------------------------- |
| `@adaptkit/core`  | Pure SDK, no React dependency | `npm install @adaptkit/core`  |
| `@adaptkit/react` | React hooks and provider      | `npm install @adaptkit/react` |

## Quick Start

### npm

```bash
npm install @adaptkit/core
# React users also need:
npm install @adaptkit/react
```

```js
import AdaptKit from '@adaptkit/core';

AdaptKit.start();

// Get the full adaptive context at any time
const ctx = AdaptKit.getContext();
console.log(ctx.environment.viewport); // 'compact' | 'medium' | 'wide'
console.log(ctx.environment.pointer); // 'coarse' | 'fine'
console.log(ctx.friction.level); // 0 | 1 | 2 | 3

// Listen for specific events
AdaptKit.on('ADAPT_RAGE_CLICK', (event) => {
  console.log('Friction detected:', event);
});
```

### React

```tsx
import { AdaptProvider, useAdapt } from '@adaptkit/react';

function App() {
  return (
    <AdaptProvider>
      <CheckoutForm />
    </AdaptProvider>
  );
}

function CheckoutForm() {
  const adapt = useAdapt('checkout-form');

  return (
    <Form
      layout={adapt.environment.viewport === 'compact' ? 'stacked' : 'inline'}
      buttonSize={adapt.environment.pointer === 'coarse' ? 'large' : 'medium'}
      showHints={adapt.familiarity.isFirstVisit || adapt.friction.level > 0}
      animate={!adapt.environment.prefersReducedMotion}
    />
  );
}
```

### Script Tag

```html
<script src="https://unpkg.com/@adaptkit/core/dist/index.global.js"></script>
<script>
  AdaptKit.AdaptKit.start();
  const ctx = AdaptKit.AdaptKit.getContext();
</script>
```

## The Five Dimensions

AdaptKit provides adaptive context across five dimensions:

### 1. Environment — what is the user working with?

Detects device capabilities and OS preferences using media queries, pointer events, and Navigator APIs. Values are bucketed to reduce fingerprinting entropy.

```js
const env = AdaptKit.getEnvironment();
env.inputModality; // 'mouse' | 'touch' | 'pen' | 'keyboard'
env.pointer; // 'coarse' | 'fine'
env.hoverCapable; // boolean
env.viewport; // 'compact' (<640px) | 'medium' (<1024px) | 'wide' (>=1024px)
env.connection; // 'slow' | 'moderate' | 'fast' | null
env.prefersReducedMotion; // boolean
env.prefersHighContrast; // boolean
env.colorScheme; // 'light' | 'dark' | null
env.deviceMemory; // 'low' | 'moderate' | 'high' | null
```

Environment values update in real-time via `matchMedia` change listeners and pointer events — no polling.

### 2. Friction — where is the user struggling right now?

Six HCI-grounded friction sensors detect objective interaction problems:

| Signal                    | What it detects                                  | Default threshold     |
| ------------------------- | ------------------------------------------------ | --------------------- |
| `ADAPT_RAGE_CLICK`        | 3+ clicks on same element within 1s              | 3 clicks, 1s window   |
| `ADAPT_DEAD_CLICK`        | Click on interactive element with no response    | 300ms mutation window |
| `ADAPT_FORM_THRASHING`    | Repeated field cycling (4+ revisits, 2+ fields)  | 10s window            |
| `ADAPT_BLOCKED_INTENT`    | Retry after failed submit or unresponsive click  | 2s/10s window         |
| `ADAPT_INPUT_RESIGNATION` | Rapid bulk text deletion (>70%)                  | 1.5s window           |
| `ADAPT_FRUSTRATION_TEXT`  | Frustrated language in text inputs (33 patterns) | 5s activity minimum   |

Friction is aggregated into a 0-3 level per scope:

```js
const ctx = AdaptKit.getContext('checkout');
ctx.friction.level; // 0 (none) | 1 (low) | 2 (moderate) | 3 (high)
ctx.friction.hasSignals; // boolean
ctx.friction.recentSignals; // last 5 FrictionEvents
```

### 3. Behavior — how does this user interact?

Derives interaction patterns from events already captured by the collector — no additional DOM listeners.

```js
const ctx = AdaptKit.getContext();
ctx.behavior.interactionTempo; // 'rapid' | 'moderate' | 'deliberate'
ctx.behavior.keyboardFirst; // boolean (stabilizes after ~20 events)
ctx.behavior.scrollBehavior; // 'scanning' | 'reading' | 'searching' | null
```

- **Tempo** uses exponentially-weighted moving averages for recency bias
- **Keyboard-first** has hysteresis to prevent flip-flopping
- **Scroll behavior** classifies based on velocity and direction change frequency

### 4. Familiarity — has this user been here before?

Per-component/step visit tracking via localStorage (origin-scoped, no cross-domain tracking):

```js
const ctx = AdaptKit.getContext('checkout');
ctx.familiarity.visitCount; // number of sessions with this scope
ctx.familiarity.hasCompleted; // has the user finished this flow before?
ctx.familiarity.isFirstVisit; // convenience: visitCount === 1
ctx.familiarity.lastVisitMs; // ms since last session (null if first)
```

Mark completion explicitly:

```js
AdaptKit.markCompleted('checkout');
```

### 5. Task — where is the user in the workflow?

Tracks workflow progress within a session, driven by `data-adapt-step` attributes:

```js
const ctx = AdaptKit.getContext();
ctx.task.currentStep; // 'shipping' | 'payment' | null
ctx.task.timeInStep; // seconds in current step
ctx.task.completedSteps; // ['shipping']
ctx.task.abandonedAndReturned; // user left and came back to this step
```

## React Integration

### Provider

Wrap your app with `AdaptProvider` to initialize AdaptKit:

```tsx
import { AdaptProvider } from '@adaptkit/react';

function App() {
  return (
    <AdaptProvider config={{ debug: process.env.NODE_ENV === 'development' }}>
      <YourApp />
    </AdaptProvider>
  );
}
```

### Primary Hook

`useAdapt(scope?)` returns the full adaptive context, re-rendering only when values change:

```tsx
import { useAdapt } from '@adaptkit/react';

function Navigation() {
  const adapt = useAdapt();

  if (adapt.environment.viewport === 'compact') {
    return <HamburgerMenu />;
  }
  return <DesktopNav />;
}
```

### Granular Hooks

Use individual dimension hooks when you only need one piece:

```tsx
import { useEnvironment, useFriction, useBehavior, useFamiliarity, useTask } from '@adaptkit/react';

function Component() {
  const env = useEnvironment();
  const friction = useFriction('checkout');
  const behavior = useBehavior();
  const familiarity = useFamiliarity('checkout');
  const task = useTask();
}
```

### Event Hook

Subscribe to specific AdaptKit events:

```tsx
import { useAdaptEvent } from '@adaptkit/react';

function Analytics() {
  useAdaptEvent('ADAPT_RAGE_CLICK', (event) => {
    analytics.track('friction', { type: event.type, target: event.target });
  });
  return null;
}
```

## Vanilla JS Integration

```js
import AdaptKit from '@adaptkit/core';

AdaptKit.start();

// Poll context
const ctx = AdaptKit.getContext('checkout');

// Subscribe to events
AdaptKit.on('*', (event) => {
  console.log(event.type, event);
});

// Subscribe to specific event types
AdaptKit.on('ADAPT_ENVIRONMENT_CHANGE', (event) => {
  console.log('Environment changed:', event.field, event.currentValue);
});
```

## Semantic Instrumentation

Optional DOM attributes that improve friction detection accuracy and enable task tracking:

```html
<!-- Role: what this element does -->
<button data-adapt-role="primary-action:submit">Place Order</button>

<!-- Step: which workflow step this belongs to -->
<div data-adapt-step="shipping">
  <input data-adapt-role="required-input" />
</div>

<!-- Privacy: suppress text collection from this subtree -->
<div data-adapt-pii>
  <input type="text" name="ssn" />
</div>
```

### Valid Roles

`primary-action`, `secondary-action`, `nav-link`, `required-input`, `optional-input`, `info-toggle`, `error-message`, `dialog`, `form-group`, `loading-state`, `search`, `media-control`, `drag-handle`

### Valid Modifiers (action roles only)

`delete`, `save`, `submit`, `cancel`, `navigate`, `confirm`

Format: `data-adapt-role="base-role:modifier"` (e.g., `primary-action:delete`)

### Steps

`data-adapt-step="step-name"` enables task tracking and scoped familiarity. Elements within a step scope automatically track visit counts and workflow progress.

## Configuration

```js
AdaptKit.start({
  // Log sensor evaluations and events to console (auto-detects localhost)
  debug: false,

  // Opt-in to collect first 50 chars of clicked element text
  collectTargetText: false,

  // Custom PII filter (runs alongside built-in checks)
  piiFilter: (element) => element.hasAttribute('data-sensitive'),

  // Override any detection threshold
  thresholds: {
    rageClickCount: 3,
    rageClickWindowMs: 1000,
    rageClickCooldownMs: 1000,
    deadClickCooldownMs: 500,
    deadClickMutationWindowMs: 300,
    blockedIntentSubmitWindowMs: 10000,
    blockedIntentClickWindowMs: 2000,
    formThrashWindowMs: 10000,
    formThrashMinRevisits: 4,
    formThrashMinFields: 2,
    resignationRatio: 0.7,
    resignationWindowMs: 1500,
    frustrationTextCooldownMs: 3000,
    completionWindowMs: 2000,
    emissionFloor: 0.55,
    maxEventsPerMinute: 0, // 0 = unlimited
  },
});
```

## Event Reference

### Friction Events

All friction events share this shape:

```ts
interface FrictionEvent {
  type: FrictionEventType;
  target: string; // CSS selector
  timestamp: number; // Unix ms
  ruleId: string; // e.g. "rage-click-v1"
  metrics: Record<string, number | string | string[]>;
  semantic: { nodeId; role; modifier; step } | null;
  sessionId?: string;
  eventIndex?: number;
}
```

### Context Change Events

Emitted when environment, behavior, familiarity, or task values change:

```ts
interface ContextChangeEvent {
  type: ContextEventType; // e.g. 'ADAPT_ENVIRONMENT_CHANGE'
  timestamp: number;
  field: string; // which field changed
  previousValue: unknown;
  currentValue: unknown;
}
```

Event types: `ADAPT_ENVIRONMENT_CHANGE`, `ADAPT_BEHAVIOR_CHANGE`, `ADAPT_FAMILIARITY_CHANGE`, `ADAPT_STEP_CHANGE`

## Privacy & Data Collection

AdaptKit is designed for privacy-first operation:

- **No PII collection**: text capture is opt-in (`collectTargetText`), built-in PII detection blocks password, email, phone, SSN, and name fields
- **No server**: everything runs client-side, no data leaves the browser
- **No cookies**: familiarity data uses localStorage (origin-scoped by browser policy)
- **No cross-domain tracking**: localStorage is inherently origin-scoped
- **Bucketed values**: environment data uses coarse buckets (`compact`/`medium`/`wide` instead of exact pixel counts) to resist fingerprinting
- **Custom filtering**: `piiFilter` callback and `data-adapt-pii` attribute for application-specific PII boundaries

This design makes AdaptKit viable in regulated environments (HIPAA, PCI-DSS, GDPR) without requiring legal review to clear data collection concerns.

## Free vs. Premium

### Free Tier: `@adaptkit/core` (this package)

Everything runs client-side. No server. No account. No data leaves the browser.

Includes all five context dimensions, all six friction sensors, the semantic graph, the React SDK, configurable thresholds, and per-device familiarity tracking.

### Premium Tier: `@adaptkit/premium` (future)

Planned capabilities for teams that need server-side intelligence:

- **Dynamic baselines**: statistically calibrated thresholds from aggregate anonymous telemetry, replacing static heuristic defaults
- **Server-side decisioning**: optimal intervention strategies returned from the server when friction is detected
- **Cross-session familiarity**: server-persisted interaction history, not limited to localStorage
- **Managed optimization**: continuous improvement of intervention success rates

The premium tier is not yet available. The free tier is fully functional and designed to be useful on its own.

## SPA Support

Call `reset()` on route changes to clear sensor state while keeping listeners active:

```js
// React Router example
useEffect(() => {
  AdaptKit.reset();
}, [location.pathname]);
```

## Framework Support

### React (primary)

Full SDK via `@adaptkit/react` — see [React Integration](#react-integration) above.

### Vue (composable pattern)

```js
import { ref, onMounted, onUnmounted } from 'vue';
import AdaptKit from '@adaptkit/core';

export function useAdapt(scope) {
  const context = ref(AdaptKit.getContext(scope));

  let unsub;
  onMounted(() => {
    AdaptKit.start();
    unsub = AdaptKit.on('*', () => {
      context.value = AdaptKit.getContext(scope);
    });
  });

  onUnmounted(() => {
    unsub?.();
    AdaptKit.stop();
  });

  return context;
}
```

### Vanilla JS

Use `AdaptKit.start()`, `AdaptKit.getContext()`, and `AdaptKit.on()` directly.

## API Reference

```ts
interface AdaptKitInstance {
  // Lifecycle
  start(config?: AdaptKitConfig): void;
  stop(): void;
  reset(): void;

  // Context
  getContext(scope?: string): AdaptContext;
  getEnvironment(): EnvironmentContext;
  markCompleted(scope: string): void;

  // Events
  on(eventType: string, handler: (event: AdaptKitEvent) => void): () => void;
  off(eventType: string, handler: (event: AdaptKitEvent) => void): void;

  // Semantic Graph
  getGraph(): { nodes: SemanticNode[] } | null;
}
```

## Architecture

```
DOM Events ──> Collector ──> Sensors ──> Context Engine ──> Action Bus ──> Your App
     |                                                           ^
     |──> Environment Detector ──────────────────────────────────|
     |──> Behavior Profiler ─────────────────────────────────────|
     |──> Task Tracker ──────────────────────────────────────────|
     └──> Familiarity Tracker (localStorage) ────────────────────┘
                            |
                    Context Aggregator ──> getContext() / useAdapt()
```

**Key invariant**: sensors are pure functions on serializable envelopes — they never touch the DOM. This enables future Web Worker migration without refactoring.

## Known Limitations

1. **Dead-click detection** relies on MutationObserver. Framework updates that don't produce DOM mutations within 300ms may trigger false positives.
2. **CSS-in-JS class hashes** are filtered from selectors, but novel hash patterns may not be recognized.
3. **Shadow DOM** is supported for semantic graph resolution, but mutation tracking does not cross shadow boundaries.
4. **Form thrashing** requires `<form>` ancestors for field grouping. Fields outside forms are tracked in a global scope.
5. **Input resignation** cannot distinguish intentional select-all-delete from frustration-driven deletion when no Ctrl/Cmd key is detected.
6. **Frustration text patterns** are English-only.
7. **Familiarity tracking** is per-device (localStorage). Users on multiple devices will appear as first-time visitors on each.
8. **Behavior profiling** needs ~10 interactions before tempo stabilizes, and ~20 navigation events before keyboard-first stabilizes.
9. **Connection detection** requires the Network Information API (`navigator.connection`), which is not available in all browsers.
10. **Device memory detection** requires `navigator.deviceMemory`, available only in Chromium-based browsers.

## Demos

A suite of 5 interactive demos showcases each adaptive dimension in a realistic mini-application. The UI visibly adapts as you interact — resize the browser, struggle with a form, scroll through content, or revisit a page.

| Demo            | What it shows                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| **Environment** | Product card adapting to viewport, pointer type, color scheme, motion preferences, and connection speed     |
| **Friction**    | Payment form that detects struggle and progressively offers help — hints, clearer errors, simplified layout |
| **Behavior**    | Documentation page that adapts to interaction tempo, keyboard navigation, and scroll patterns               |
| **Familiarity** | Onboarding wizard that simplifies on return visits                                                          |
| **Task**        | Multi-step checkout with time awareness, step tracking, and return detection                                |

### Running the demos

```bash
# Build the packages first (demos consume dist/)
pnpm run build

# Start the demo dev server
pnpm run demo
```

The demos live in `demo/` with their own Vite + React setup. They depend on `@adaptkit/core` and `@adaptkit/react` as pnpm workspace packages, so `pnpm install` at the repo root wires everything up automatically — no separate install step needed.

If you're iterating on both the SDK and demos simultaneously, run `pnpm --filter @adaptkit/core run dev` (tsup watch) in one terminal and `pnpm run demo` (Vite dev server) in another.

## Development

```bash
pnpm install          # Install all workspace deps and wire symlinks
pnpm run build        # Build packages/core then packages/react
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

## License

[Elastic License 2.0](LICENSE)
