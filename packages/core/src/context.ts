import type { AdaptContext, FrictionContext, FrictionEvent, FamiliarityContext } from './types.js';
import type { EnvironmentDetector } from './environment.js';
import type { BehaviorProfiler } from './behavior.js';
import type { FamiliarityTracker } from './familiarity.js';
import type { TaskTracker } from './task.js';

// ─── Friction Level Derivation ───
// Maps raw friction events into a 0–3 severity level.
// 0: no friction events in scope
// 1: one low-confidence event or one event near the emission floor
// 2: multiple events or one high-confidence event
// 3: sustained pattern — multiple events in a short window, or escalating signals

export interface FrictionLevelThresholds {
  highConfidence: number;
  sustainedWindowMs: number;
  sustainedMinEvents: number;
}

const MAX_RECENT_SIGNALS = 5;

function deriveFrictionLevel(events: FrictionEvent[], t: FrictionLevelThresholds): 0 | 1 | 2 | 3 {
  if (events.length === 0) return 0;

  const now = Date.now();
  const recentEvents = events.filter((e) => now - e.timestamp < t.sustainedWindowMs);

  // Sustained pattern: N+ events within the window
  if (recentEvents.length >= t.sustainedMinEvents) return 3;

  // High-confidence single event
  if (events.length === 1) {
    const confidence = (events[0].metrics.confidence as number | undefined) ?? 0;
    return confidence >= t.highConfidence ? 2 : 1;
  }

  // Multiple events (2+) but not sustained pattern
  return 2;
}

export class ContextAggregator {
  /** Friction events per scope. Global scope stored under empty string key. */
  private frictionEvents = new Map<string, FrictionEvent[]>();
  private frictionThresholds: FrictionLevelThresholds;

  constructor(
    private environment: EnvironmentDetector,
    private behavior: BehaviorProfiler,
    private familiarity: FamiliarityTracker,
    private task: TaskTracker,
    frictionThresholds: FrictionLevelThresholds,
  ) {
    this.frictionThresholds = frictionThresholds;
  }

  /** Record a friction event for aggregation.
   *  Called by the bus subscription in index.ts. */
  recordFrictionEvent(event: FrictionEvent): void {
    // Store under global scope
    this.addToScope('', event);

    // Store under step scope if available
    if (event.semantic?.step) {
      this.addToScope(event.semantic.step, event);
    }
  }

  /** Get unified context, optionally scoped to a step/component. */
  getContext(scope?: string): AdaptContext {
    const scopeKey = scope ?? '';
    const frictionForScope = this.frictionEvents.get(scopeKey) ?? [];
    const recentSignals = frictionForScope.slice(-MAX_RECENT_SIGNALS);

    const friction: FrictionContext = {
      level: deriveFrictionLevel(frictionForScope, this.frictionThresholds),
      recentSignals,
      hasSignals: frictionForScope.length > 0,
    };

    return {
      environment: this.environment.getEnvironment(),
      friction,
      behavior: this.behavior.getBehavior(),
      familiarity: scope ? this.familiarity.getFamiliarity(scope) : DEFAULT_FAMILIARITY,
      task: this.task.getTask(),
    };
  }

  /** Clear friction event history for a new session. */
  reset(): void {
    this.frictionEvents.clear();
  }

  // ─── Internals ───

  private addToScope(scope: string, event: FrictionEvent): void {
    let events = this.frictionEvents.get(scope);
    if (!events) {
      events = [];
      this.frictionEvents.set(scope, events);
    }
    events.push(event);
    // Keep only recent events to prevent unbounded growth
    while (events.length > MAX_RECENT_SIGNALS * 2) {
      events.shift();
    }
  }
}

const DEFAULT_FAMILIARITY: FamiliarityContext = {
  visitCount: 0,
  hasCompleted: false,
  isFirstVisit: true,
  lastVisitMs: null,
};
