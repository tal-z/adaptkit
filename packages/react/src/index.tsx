/**
 * React bindings for AdaptKit.
 *
 * Import path: `@adaptkit/react`
 */
import {
  createContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import AdaptKit from '@adaptkit/core';
import type {
  AdaptKitConfig,
  AdaptKitEvent,
  AdaptContext,
  EnvironmentContext,
  FrictionContext,
  BehaviorContext,
  FamiliarityContext,
  TaskContext,
} from '@adaptkit/core';

// ─── Internal Store ───
// Uses a version counter to bridge AdaptKit's event bus to React's
// useSyncExternalStore. Snapshots are cached per-version so that
// useSyncExternalStore always gets referentially stable values
// (required to avoid infinite re-render loops).

type Listener = () => void;

const listeners = new Set<Listener>();
let storeVersion = 0;

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getVersion(): number {
  return storeVersion;
}

function notifyListeners(): void {
  storeVersion++;
  for (const listener of listeners) {
    listener();
  }
}

// Bus subscription — set up lazily
let busUnsub: (() => void) | null = null;
let notifyScheduled = false;

function ensureBusSubscription(): void {
  if (busUnsub) return;
  busUnsub = AdaptKit.on('*', () => {
    // Batch: coalesce multiple bus events within the same frame
    // into a single re-render. setTimeout pushes notification
    // outside React's commit phase to avoid update loops.
    if (!notifyScheduled) {
      notifyScheduled = true;
      setTimeout(() => {
        notifyScheduled = false;
        notifyListeners();
      }, 0);
    }
  });
}

// ─── Context (React Context, not AdaptContext) ───

interface AdaptProviderContextValue {
  started: boolean;
}

const AdaptProviderContext = createContext<AdaptProviderContextValue | null>(null);

// ─── Provider ───

interface AdaptProviderProps {
  config?: AdaptKitConfig;
  children: ReactNode;
}

/**
 * Initializes AdaptKit and provides context to descendant hooks.
 * Call once near the root of your app.
 *
 * ```tsx
 * <AdaptProvider config={{ debug: true }}>
 *   <App />
 * </AdaptProvider>
 * ```
 */
function AdaptProvider({ config, children }: AdaptProviderProps): ReactNode {
  const configRef = useRef(config);

  useLayoutEffect(() => {
    AdaptKit.start(configRef.current);
    ensureBusSubscription();
    // Notify subscribers synchronously so hooks read correct initial state
    // (e.g. familiarity from localStorage) before the browser paints.
    // useLayoutEffect fires after render but before paint, so this re-render
    // is invisible — no flash of default/stale values.
    notifyListeners();

    return () => {
      AdaptKit.stop();
      if (busUnsub) {
        busUnsub();
        busUnsub = null;
      }
    };
  }, []);

  return (
    <AdaptProviderContext.Provider value={{ started: true }}>
      {children}
    </AdaptProviderContext.Provider>
  );
}

// ─── Snapshot Cache ───
// Caches snapshots per version so useSyncExternalStore always receives
// referentially stable objects. Without this, getContext() returns new
// objects on every call, which useSyncExternalStore interprets as a
// store change during its commit-phase consistency check.

function useCachedSnapshot<T>(compute: () => T): () => T {
  const cache = useRef<{ version: number; value: T } | null>(null);

  return useCallback(() => {
    const currentVersion = getVersion();
    if (cache.current && cache.current.version === currentVersion) {
      return cache.current.value;
    }
    const value = compute();
    cache.current = { version: currentVersion, value };
    return value;
  }, [compute]);
}

// ─── Hooks ───

/**
 * Returns the full adaptive context, optionally scoped to a step/component.
 * Re-renders when any context dimension changes.
 *
 * ```tsx
 * const adapt = useAdapt('checkout-form');
 * adapt.environment.viewport // 'compact' | 'medium' | 'wide'
 * adapt.friction.level       // 0 | 1 | 2 | 3
 * ```
 */
function useAdapt(scope?: string): AdaptContext {
  const compute = useCallback(() => AdaptKit.getContext(scope), [scope]);
  const getSnapshot = useCachedSnapshot(compute);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Returns only the environment context dimension.
 */
function useEnvironment(): EnvironmentContext {
  const compute = useCallback(() => AdaptKit.getEnvironment(), []);
  const getSnapshot = useCachedSnapshot(compute);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Returns only the friction context dimension for a given scope.
 */
function useFriction(scope?: string): FrictionContext {
  const compute = useCallback(() => AdaptKit.getContext(scope).friction, [scope]);
  const getSnapshot = useCachedSnapshot(compute);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Returns only the behavior context dimension.
 */
function useBehavior(): BehaviorContext {
  const compute = useCallback(() => AdaptKit.getContext().behavior, []);
  const getSnapshot = useCachedSnapshot(compute);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Returns only the familiarity context dimension for a given scope.
 * Records a visit to the scope on mount so visitCount reflects the current
 * session without requiring a click.
 */
function useFamiliarity(scope: string): FamiliarityContext {
  // useEffect fires after all layout effects, including AdaptProvider's useLayoutEffect
  // which calls start() — so familiarityTracker is guaranteed initialized here.
  useEffect(() => {
    AdaptKit.recordVisit(scope);
  }, [scope]);

  const compute = useCallback(() => AdaptKit.getContext(scope).familiarity, [scope]);
  const getSnapshot = useCachedSnapshot(compute);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Returns only the task context dimension.
 */
function useTask(): TaskContext {
  const compute = useCallback(() => AdaptKit.getContext().task, []);
  const getSnapshot = useCachedSnapshot(compute);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Subscribe to specific AdaptKit events. The handler is stable across
 * re-renders (uses a ref internally).
 *
 * ```tsx
 * useAdaptEvent('ADAPT_RAGE_CLICK', (event) => {
 *   analytics.track('friction', event);
 * });
 * ```
 */
function useAdaptEvent(eventType: string, handler: (event: AdaptKitEvent) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const unsub = AdaptKit.on(eventType, (event) => {
      handlerRef.current(event);
    });
    return unsub;
  }, [eventType]);
}

export {
  AdaptProvider,
  useAdapt,
  useEnvironment,
  useFriction,
  useBehavior,
  useFamiliarity,
  useTask,
  useAdaptEvent,
};

export type {
  AdaptProviderProps,
  AdaptContext,
  EnvironmentContext,
  FrictionContext,
  BehaviorContext,
  FamiliarityContext,
  TaskContext,
  AdaptKitEvent,
};
