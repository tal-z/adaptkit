# AdaptKit

A client-side context engine for building adaptive web UI.

## The Problem

Building UI that adapts to user conditions requires cobbling together scattered browser APIs, manual localStorage bookkeeping, and ad-hoc event tracking — with no unified abstraction. AdaptKit provides a single import that gives any component the full picture of what it should adapt to: device environment, interaction friction, behavior patterns, familiarity, and task progress.

## Packages

| Package           | Description                   | Install                       |
| ----------------- | ----------------------------- | ----------------------------- |
| `@adaptkit/core`  | Pure SDK, no React dependency | `npm install @adaptkit/core`  |
| `@adaptkit/react` | React hooks and provider      | `npm install @adaptkit/react` |

## Table of Contents

- [Quick Start](#quick-start)
- [The Five Dimensions](#the-five-dimensions) — [Full Guide](docs/dimensions.md)
- [React Integration](docs/react.md)
- [Vanilla JS & Frameworks](docs/vanilla-js.md)
- [Configuration & Instrumentation](docs/configuration.md)
- [API Reference](docs/api-reference.md)
- [Privacy & Data Collection](#privacy--data-collection)
- [Free vs. Premium](#free-vs-premium)
- [Demos](#demos)
- [Contributing](CONTRIBUTING.md)
- [License](#license)

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

| Dimension                                                                         | Question                        | Key Fields                                            |
| --------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------- |
| [Environment](docs/dimensions.md#1-environment--what-is-the-user-working-with)    | What is the user working with?  | `viewport`, `pointer`, `colorScheme`, `connection`    |
| [Friction](docs/dimensions.md#2-friction--where-is-the-user-struggling-right-now) | Where is the user struggling?   | `level` (0-3), `hasSignals`, `recentSignals`          |
| [Behavior](docs/dimensions.md#3-behavior--how-does-this-user-interact)            | How does this user interact?    | `interactionTempo`, `keyboardFirst`, `scrollBehavior` |
| [Familiarity](docs/dimensions.md#4-familiarity--has-this-user-been-here-before)   | Has this user been here before? | `visitCount`, `isFirstVisit`, `hasCompleted`          |
| [Task](docs/dimensions.md#5-task--where-is-the-user-in-the-workflow)              | Where are they in the workflow? | `currentStep`, `timeInStep`, `completedSteps`         |

See the [full dimensions guide](docs/dimensions.md) for code examples and details.

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

## Demos

| Demo            | What it shows                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| **Environment** | Product card adapting to viewport, pointer type, color scheme, motion preferences, and connection speed     |
| **Friction**    | Payment form that detects struggle and progressively offers help — hints, clearer errors, simplified layout |
| **Behavior**    | Documentation page that adapts to interaction tempo, keyboard navigation, and scroll patterns               |
| **Familiarity** | Onboarding wizard that simplifies on return visits                                                          |
| **Task**        | Multi-step checkout with time awareness, step tracking, and return detection                                |

**[Live demo &rarr;](https://tal-z.github.io/adaptkit/)**

## License

[Elastic License 2.0](LICENSE)
