[&larr; Back to README](../README.md)

# Vanilla JS & Framework Integration

## Vanilla JS

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

## SPA Support

Call `reset()` on route changes to clear sensor state while keeping listeners active:

```js
// React Router example
useEffect(() => {
  AdaptKit.reset();
}, [location.pathname]);
```

## Vue (composable pattern)

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

## Other Frameworks

Any framework can use `@adaptkit/core` directly via `AdaptKit.start()`, `AdaptKit.getContext()`, and `AdaptKit.on()`. Wrap these in your framework's reactive primitive (signals, stores, observables) to get automatic re-renders.

---

See also: [React Integration](react.md) | [The Five Dimensions](dimensions.md) | [API Reference](api-reference.md)
