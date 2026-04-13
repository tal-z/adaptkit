[&larr; Back to README](../README.md)

# React Integration

## Provider

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

## Primary Hook

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

## Granular Hooks

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

## Event Hook

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

---

See also: [The Five Dimensions](dimensions.md) | [Vanilla JS & Frameworks](vanilla-js.md) | [API Reference](api-reference.md)
