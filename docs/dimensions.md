[&larr; Back to README](../README.md)

# The Five Dimensions

AdaptKit provides adaptive context across five dimensions:

## 1. Environment — what is the user working with?

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

## 2. Friction — where is the user struggling right now?

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

## 3. Behavior — how does this user interact?

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

## 4. Familiarity — has this user been here before?

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

## 5. Task — where is the user in the workflow?

Tracks workflow progress within a session, driven by `data-adapt-step` attributes:

```js
const ctx = AdaptKit.getContext();
ctx.task.currentStep; // 'shipping' | 'payment' | null
ctx.task.timeInStep; // seconds in current step
ctx.task.completedSteps; // ['shipping']
ctx.task.abandonedAndReturned; // user left and came back to this step
```

---

See also: [React Integration](react.md) | [Vanilla JS & Frameworks](vanilla-js.md) | [Configuration](configuration.md)
