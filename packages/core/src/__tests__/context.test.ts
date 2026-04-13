import { describe, it, expect, beforeEach } from 'vitest';
import { ActionBus } from '../bus.js';
import { EnvironmentDetector } from '../environment.js';
import { BehaviorProfiler } from '../behavior.js';
import { FamiliarityTracker } from '../familiarity.js';
import { TaskTracker } from '../task.js';
import { ContextAggregator } from '../context.js';
import type { FrictionEvent } from '../types.js';
import { DEFAULT_THRESHOLDS } from '../config.js';

function makeFrictionEvent(overrides?: Partial<FrictionEvent>): FrictionEvent {
  return {
    type: 'ADAPT_RAGE_CLICK',
    target: 'button#test',
    timestamp: Date.now(),
    ruleId: 'rage-click-v1',
    metrics: { clickCount: 3, windowMs: 800, confidence: 0.7 },
    semantic: null,
    ...overrides,
  };
}

describe('ContextAggregator', () => {
  let bus: ActionBus;
  let environment: EnvironmentDetector;
  let behavior: BehaviorProfiler;
  let familiarity: FamiliarityTracker;
  let task: TaskTracker;
  let aggregator: ContextAggregator;

  beforeEach(() => {
    localStorage.clear();
    bus = new ActionBus();
    environment = new EnvironmentDetector(bus);
    behavior = new BehaviorProfiler(bus, {
      rapidTempoMs: DEFAULT_THRESHOLDS.behaviorRapidTempoMs,
      deliberateTempoMs: DEFAULT_THRESHOLDS.behaviorDeliberateTempoMs,
      keyboardFirstMinEvents: DEFAULT_THRESHOLDS.behaviorKeyboardFirstMinEvents,
      keyboardFirstRatio: DEFAULT_THRESHOLDS.behaviorKeyboardFirstRatio,
      keyboardFirstHysteresisLow: DEFAULT_THRESHOLDS.behaviorKeyboardFirstHysteresisLow,
      changeDebouncMs: DEFAULT_THRESHOLDS.behaviorChangeDebouncMs,
      scrollScanningVelocity: DEFAULT_THRESHOLDS.scrollScanningVelocity,
      scrollReadingVelocityMax: DEFAULT_THRESHOLDS.scrollReadingVelocityMax,
      scrollSearchDirectionChangesMin: DEFAULT_THRESHOLDS.scrollSearchDirectionChangesMin,
      scrollWindowMs: DEFAULT_THRESHOLDS.scrollWindowMs,
    });
    familiarity = new FamiliarityTracker(bus);
    task = new TaskTracker(bus);
    aggregator = new ContextAggregator(environment, behavior, familiarity, task, {
      highConfidence: DEFAULT_THRESHOLDS.frictionHighConfidence,
      sustainedWindowMs: DEFAULT_THRESHOLDS.frictionSustainedWindowMs,
      sustainedMinEvents: DEFAULT_THRESHOLDS.frictionSustainedMinEvents,
    });
  });

  describe('getContext', () => {
    it('should return all five dimensions', () => {
      const ctx = aggregator.getContext();
      expect(ctx).toHaveProperty('environment');
      expect(ctx).toHaveProperty('friction');
      expect(ctx).toHaveProperty('behavior');
      expect(ctx).toHaveProperty('familiarity');
      expect(ctx).toHaveProperty('task');
    });

    it('should return zero friction when no events recorded', () => {
      const ctx = aggregator.getContext();
      expect(ctx.friction.level).toBe(0);
      expect(ctx.friction.recentSignals).toEqual([]);
      expect(ctx.friction.hasSignals).toBe(false);
    });

    it('should return default familiarity when no scope specified', () => {
      const ctx = aggregator.getContext();
      expect(ctx.familiarity.visitCount).toBe(0);
      expect(ctx.familiarity.isFirstVisit).toBe(true);
    });

    it('should return scoped familiarity when scope is provided', () => {
      familiarity.recordVisit('checkout');
      familiarity.resetSession();
      familiarity.recordVisit('checkout');
      const ctx = aggregator.getContext('checkout');
      expect(ctx.familiarity.visitCount).toBe(2);
      expect(ctx.familiarity.isFirstVisit).toBe(false);
    });
  });

  describe('friction aggregation', () => {
    it('should report level 1 for a single low-confidence event', () => {
      aggregator.recordFrictionEvent(makeFrictionEvent({ metrics: { confidence: 0.55 } }));
      const ctx = aggregator.getContext();
      expect(ctx.friction.level).toBe(1);
      expect(ctx.friction.hasSignals).toBe(true);
    });

    it('should report level 2 for a single high-confidence event', () => {
      aggregator.recordFrictionEvent(makeFrictionEvent({ metrics: { confidence: 0.8 } }));
      const ctx = aggregator.getContext();
      expect(ctx.friction.level).toBe(2);
    });

    it('should report level 2 for multiple events', () => {
      aggregator.recordFrictionEvent(makeFrictionEvent({ metrics: { confidence: 0.55 } }));
      aggregator.recordFrictionEvent(makeFrictionEvent({ metrics: { confidence: 0.55 } }));
      const ctx = aggregator.getContext();
      expect(ctx.friction.level).toBe(2);
    });

    it('should report level 3 for sustained pattern (3+ recent events)', () => {
      const now = Date.now();
      for (let i = 0; i < 3; i++) {
        aggregator.recordFrictionEvent(
          makeFrictionEvent({ timestamp: now - 1000 + i * 100, metrics: { confidence: 0.6 } }),
        );
      }
      const ctx = aggregator.getContext();
      expect(ctx.friction.level).toBe(3);
    });

    it('should keep at most 5 recent signals', () => {
      for (let i = 0; i < 8; i++) {
        aggregator.recordFrictionEvent(makeFrictionEvent());
      }
      const ctx = aggregator.getContext();
      expect(ctx.friction.recentSignals).toHaveLength(5);
    });

    it('should scope friction events by step', () => {
      aggregator.recordFrictionEvent(
        makeFrictionEvent({
          semantic: { nodeId: null, role: null, modifier: null, step: 'checkout' },
        }),
      );

      const checkoutCtx = aggregator.getContext('checkout');
      expect(checkoutCtx.friction.hasSignals).toBe(true);

      const settingsCtx = aggregator.getContext('settings');
      expect(settingsCtx.friction.hasSignals).toBe(false);
    });

    it('should also store scoped events in global scope', () => {
      aggregator.recordFrictionEvent(
        makeFrictionEvent({
          semantic: { nodeId: null, role: null, modifier: null, step: 'checkout' },
        }),
      );

      // Global scope should also have the event
      const globalCtx = aggregator.getContext();
      expect(globalCtx.friction.hasSignals).toBe(true);
    });
  });

  describe('reset', () => {
    it('should clear friction event history', () => {
      aggregator.recordFrictionEvent(makeFrictionEvent());
      aggregator.reset();

      const ctx = aggregator.getContext();
      expect(ctx.friction.level).toBe(0);
      expect(ctx.friction.hasSignals).toBe(false);
    });
  });

  describe('custom friction thresholds', () => {
    it('should respect custom sustained min events', () => {
      const customAggregator = new ContextAggregator(environment, behavior, familiarity, task, {
        highConfidence: DEFAULT_THRESHOLDS.frictionHighConfidence,
        sustainedWindowMs: DEFAULT_THRESHOLDS.frictionSustainedWindowMs,
        sustainedMinEvents: 2, // lowered from 3 to 2
      });

      const now = Date.now();
      customAggregator.recordFrictionEvent(
        makeFrictionEvent({ timestamp: now - 500, metrics: { confidence: 0.6 } }),
      );
      customAggregator.recordFrictionEvent(
        makeFrictionEvent({ timestamp: now - 200, metrics: { confidence: 0.6 } }),
      );

      // With default (3), this would be level 2. With custom (2), it should be level 3.
      const ctx = customAggregator.getContext();
      expect(ctx.friction.level).toBe(3);
    });

    it('should respect custom high confidence threshold', () => {
      const customAggregator = new ContextAggregator(environment, behavior, familiarity, task, {
        highConfidence: 0.9, // raised from 0.7 to 0.9
        sustainedWindowMs: DEFAULT_THRESHOLDS.frictionSustainedWindowMs,
        sustainedMinEvents: DEFAULT_THRESHOLDS.frictionSustainedMinEvents,
      });

      // 0.8 confidence — high with defaults, but NOT with custom threshold
      customAggregator.recordFrictionEvent(makeFrictionEvent({ metrics: { confidence: 0.8 } }));
      const ctx = customAggregator.getContext();
      expect(ctx.friction.level).toBe(1); // not 2, because 0.8 < 0.9
    });
  });
});
