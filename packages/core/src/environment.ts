import type { EnvironmentContext, ContextChangeEvent } from './types.js';
import { CONTEXT_EVENTS } from './types.js';
import type { ActionBus } from './bus.js';

// ─── Viewport Breakpoints ───
// Bucketed to reduce fingerprinting entropy — never expose raw pixel counts.
const COMPACT_MAX = 640;
const MEDIUM_MAX = 1024;

// ─── Connection Mapping ───
// Maps navigator.connection.effectiveType to bucketed values.
const CONNECTION_MAP: Record<string, EnvironmentContext['connection']> = {
  'slow-2g': 'slow',
  '2g': 'slow',
  '3g': 'moderate',
  '4g': 'fast',
};

// ─── Device Memory Thresholds ───
// Bucketed: low <= 2GB, moderate <= 4GB, high > 4GB.
const LOW_MEMORY_MAX = 2;
const MODERATE_MEMORY_MAX = 4;

function bucketViewport(width: number): EnvironmentContext['viewport'] {
  if (width < COMPACT_MAX) return 'compact';
  if (width < MEDIUM_MAX) return 'medium';
  return 'wide';
}

function bucketConnection(effectiveType: string | undefined): EnvironmentContext['connection'] {
  if (!effectiveType) return null;
  return CONNECTION_MAP[effectiveType] ?? null;
}

function bucketDeviceMemory(gb: number | undefined): EnvironmentContext['deviceMemory'] {
  if (gb === undefined) return null;
  if (gb <= LOW_MEMORY_MAX) return 'low';
  if (gb <= MODERATE_MEMORY_MAX) return 'moderate';
  return 'high';
}

export class EnvironmentDetector {
  private context: EnvironmentContext;
  private overrides: Partial<EnvironmentContext> = {};
  private cleanups: Array<() => void> = [];

  constructor(private bus: ActionBus) {
    this.context = this.detectInitial();
  }

  /** Start listening for environment changes. */
  start(): void {
    this.listenMediaQuery('(pointer: coarse)', (matches) => {
      this.update('pointer', matches ? 'coarse' : 'fine');
    });

    this.listenMediaQuery('(hover: hover)', (matches) => {
      this.update('hoverCapable', matches);
    });

    this.listenMediaQuery('(prefers-reduced-motion: reduce)', (matches) => {
      this.update('prefersReducedMotion', matches);
    });

    this.listenMediaQuery('(prefers-contrast: more)', (matches) => {
      this.update('prefersHighContrast', matches);
    });

    this.listenMediaQuery('(prefers-color-scheme: dark)', (matches) => {
      this.update('colorScheme', matches ? 'dark' : 'light');
    });

    // Viewport changes via resize — bucketed to avoid noisy updates
    const onResize = () => {
      this.update('viewport', bucketViewport(window.innerWidth));
    };
    window.addEventListener('resize', onResize, { passive: true });
    this.cleanups.push(() => window.removeEventListener('resize', onResize));

    // Connection changes via Network Information API
    const nav = navigator as NavigatorWithConnection;
    if (nav.connection) {
      const onConnectionChange = () => {
        this.update('connection', bucketConnection(nav.connection?.effectiveType));
      };
      nav.connection.addEventListener('change', onConnectionChange);
      this.cleanups.push(() => nav.connection?.removeEventListener('change', onConnectionChange));
    }

    // Input modality from pointer events — more accurate than media query
    // because a laptop with touchscreen reports fine pointer but user might be touching
    const onPointerDown = (e: PointerEvent) => {
      const modality = e.pointerType as EnvironmentContext['inputModality'];
      if (modality === 'mouse' || modality === 'touch' || modality === 'pen') {
        this.update('inputModality', modality);
      }
    };
    document.addEventListener('pointerdown', onPointerDown as EventListener, { passive: true });
    this.cleanups.push(() =>
      document.removeEventListener('pointerdown', onPointerDown as EventListener),
    );

    // Keyboard-only modality: detect when user navigates via keyboard without pointer
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') {
        this.update('inputModality', 'keyboard');
      }
    };
    document.addEventListener('keydown', onKeyDown as EventListener, { passive: true });
    this.cleanups.push(() => document.removeEventListener('keydown', onKeyDown as EventListener));
  }

  /** Stop all listeners. */
  stop(): void {
    for (const cleanup of this.cleanups) {
      cleanup();
    }
    this.cleanups = [];
  }

  /** Get current environment context snapshot (with overrides applied). */
  getEnvironment(): EnvironmentContext {
    return { ...this.context, ...this.overrides };
  }

  /** Override specific environment values. Overrides are layered on top of
   *  detected values — real detection continues running in the background.
   *  Emits ENVIRONMENT_CHANGE for each field that changes. */
  overrideEnvironment(overrides: Partial<EnvironmentContext>): void {
    const current = this.getEnvironment();
    Object.assign(this.overrides, overrides);
    const updated = this.getEnvironment();

    for (const key of Object.keys(overrides) as Array<keyof EnvironmentContext>) {
      if (current[key] !== updated[key]) {
        const event: ContextChangeEvent = {
          type: CONTEXT_EVENTS.ENVIRONMENT_CHANGE,
          timestamp: Date.now(),
          field: key,
          previousValue: current[key],
          currentValue: updated[key],
        };
        this.bus.emit(event);
      }
    }
  }

  /** Clear all environment overrides, restoring detected values.
   *  Emits ENVIRONMENT_CHANGE for each field that changes back. */
  clearEnvironmentOverrides(): void {
    const current = this.getEnvironment();
    this.overrides = {};
    const restored = this.getEnvironment();

    for (const key of Object.keys(current) as Array<keyof EnvironmentContext>) {
      if (current[key] !== restored[key]) {
        const event: ContextChangeEvent = {
          type: CONTEXT_EVENTS.ENVIRONMENT_CHANGE,
          timestamp: Date.now(),
          field: key,
          previousValue: current[key],
          currentValue: restored[key],
        };
        this.bus.emit(event);
      }
    }
  }

  /** Reset to initial detected values and clear overrides. */
  reset(): void {
    this.context = this.detectInitial();
    this.overrides = {};
  }

  // ─── Internals ───

  private detectInitial(): EnvironmentContext {
    const nav = navigator as NavigatorWithConnection;

    return {
      inputModality: this.detectInitialModality(),
      pointer: this.matchMedia('(pointer: coarse)') ? 'coarse' : 'fine',
      hoverCapable: this.matchMedia('(hover: hover)'),
      viewport: bucketViewport(typeof window !== 'undefined' ? window.innerWidth : 1024),
      connection: bucketConnection(nav.connection?.effectiveType),
      prefersReducedMotion: this.matchMedia('(prefers-reduced-motion: reduce)'),
      prefersHighContrast: this.matchMedia('(prefers-contrast: more)'),
      colorScheme: this.matchMedia('(prefers-color-scheme: dark)')
        ? 'dark'
        : this.matchMedia('(prefers-color-scheme: light)')
          ? 'light'
          : null,
      deviceMemory: bucketDeviceMemory((nav as NavigatorWithMemory).deviceMemory),
    };
  }

  private detectInitialModality(): EnvironmentContext['inputModality'] {
    // Best guess from media query — actual events will override
    if (this.matchMedia('(pointer: coarse)')) return 'touch';
    return 'mouse';
  }

  private matchMedia(query: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    try {
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  }

  private listenMediaQuery(query: string, onChange: (matches: boolean) => void): void {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (typeof window === 'undefined' || !window.matchMedia) return;
    try {
      const mql = window.matchMedia(query);
      const handler = (e: MediaQueryListEvent) => onChange(e.matches);
      mql.addEventListener('change', handler);
      this.cleanups.push(() => mql.removeEventListener('change', handler));
    } catch {
      // matchMedia not supported
    }
  }

  private update<K extends keyof EnvironmentContext>(field: K, value: EnvironmentContext[K]): void {
    const previous = this.context[field];
    if (previous === value) return;

    this.context[field] = value;

    const event: ContextChangeEvent = {
      type: CONTEXT_EVENTS.ENVIRONMENT_CHANGE,
      timestamp: Date.now(),
      field,
      previousValue: previous,
      currentValue: value,
    };
    this.bus.emit(event);
  }
}

// ─── Navigator Extensions ───
// These APIs are not in all TypeScript lib definitions.

interface NetworkInformation extends EventTarget {
  effectiveType?: string;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
}

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}
