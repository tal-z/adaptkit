[&larr; Back to README](../README.md)

# API Reference

## AdaptKit Instance

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

---

See also: [Configuration](configuration.md) | [The Five Dimensions](dimensions.md)
