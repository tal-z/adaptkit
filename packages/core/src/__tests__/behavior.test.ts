import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ActionBus } from '../bus.js';
import { BehaviorProfiler } from '../behavior.js';
import type { BehaviorThresholds } from '../behavior.js';
import type { ContextChangeEvent } from '../types.js';
import { DEFAULT_THRESHOLDS } from '../config.js';

const DEFAULT_BEHAVIOR_THRESHOLDS: BehaviorThresholds = {
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
};

describe('BehaviorProfiler', () => {
  let bus: ActionBus;
  let profiler: BehaviorProfiler;

  beforeEach(() => {
    vi.useFakeTimers();
    bus = new ActionBus();
    profiler = new BehaviorProfiler(bus, DEFAULT_BEHAVIOR_THRESHOLDS);
  });

  afterEach(() => {
    profiler.stop();
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start with moderate tempo, no keyboard-first, null scroll', () => {
      const ctx = profiler.getBehavior();
      expect(ctx.interactionTempo).toBe('moderate');
      expect(ctx.keyboardFirst).toBe(false);
      expect(ctx.scrollBehavior).toBeNull();
    });

    it('should return a copy, not a reference', () => {
      const a = profiler.getBehavior();
      const b = profiler.getBehavior();
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });
  });

  describe('interaction tempo', () => {
    it('should detect rapid tempo from fast interactions', () => {
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_BEHAVIOR_CHANGE', (e) => events.push(e as ContextChangeEvent));

      // Simulate rapid clicks ~200ms apart
      let now = 1000;
      for (let i = 0; i < 15; i++) {
        profiler.recordInteraction('pointer', now);
        now += 200;
      }

      // Advance past debounce
      vi.advanceTimersByTime(600);

      expect(profiler.getBehavior().interactionTempo).toBe('rapid');
    });

    it('should detect deliberate tempo from slow interactions', () => {
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_BEHAVIOR_CHANGE', (e) => events.push(e as ContextChangeEvent));

      // Simulate slow interactions ~2000ms apart
      let now = 1000;
      for (let i = 0; i < 15; i++) {
        profiler.recordInteraction('pointer', now);
        now += 2000;
      }

      vi.advanceTimersByTime(600);

      expect(profiler.getBehavior().interactionTempo).toBe('deliberate');
    });

    it('should ignore gaps longer than 10 seconds (user was away)', () => {
      let now = 1000;
      // Establish rapid baseline
      for (let i = 0; i < 10; i++) {
        profiler.recordInteraction('pointer', now);
        now += 200;
      }
      vi.advanceTimersByTime(600);
      expect(profiler.getBehavior().interactionTempo).toBe('rapid');

      // Long gap — should not affect tempo
      now += 30_000;
      profiler.recordInteraction('pointer', now);
      now += 200;
      profiler.recordInteraction('pointer', now);

      vi.advanceTimersByTime(600);
      // Should still be rapid, not shifted toward deliberate by the 30s gap
      expect(profiler.getBehavior().interactionTempo).toBe('rapid');
    });

    it('should emit ADAPT_BEHAVIOR_CHANGE when tempo transitions', () => {
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_BEHAVIOR_CHANGE', (e) => events.push(e as ContextChangeEvent));

      let now = 1000;
      for (let i = 0; i < 15; i++) {
        profiler.recordInteraction('pointer', now);
        now += 200;
      }

      vi.advanceTimersByTime(600);

      const tempoEvent = events.find((e) => e.field === 'interactionTempo');
      expect(tempoEvent).toBeDefined();
      expect(tempoEvent!.currentValue).toBe('rapid');
      expect(tempoEvent!.previousValue).toBe('moderate');
    });
  });

  describe('keyboard-first detection', () => {
    it('should not stabilize before minimum events', () => {
      // Only 10 events — below the 20-event threshold
      let now = 1000;
      for (let i = 0; i < 10; i++) {
        profiler.recordInteraction('keyboard', now);
        now += 300;
      }

      vi.advanceTimersByTime(600);
      // Still false because not enough events to stabilize
      expect(profiler.getBehavior().keyboardFirst).toBe(false);
    });

    it('should detect keyboard-first after enough keyboard events', () => {
      let now = 1000;
      // 18 keyboard + 2 pointer = 20 total, 90% keyboard
      for (let i = 0; i < 18; i++) {
        profiler.recordInteraction('keyboard', now);
        now += 300;
      }
      for (let i = 0; i < 2; i++) {
        profiler.recordInteraction('pointer', now);
        now += 300;
      }

      vi.advanceTimersByTime(600);
      expect(profiler.getBehavior().keyboardFirst).toBe(true);
    });

    it('should not flip-flop after stabilization (hysteresis)', () => {
      let now = 1000;
      // Establish keyboard-first: 18 keyboard + 2 pointer
      for (let i = 0; i < 18; i++) {
        profiler.recordInteraction('keyboard', now);
        now += 300;
      }
      for (let i = 0; i < 2; i++) {
        profiler.recordInteraction('pointer', now);
        now += 300;
      }
      vi.advanceTimersByTime(600);
      expect(profiler.getBehavior().keyboardFirst).toBe(true);

      // Add 5 more pointer events — ratio drops but should stay keyboard-first
      // due to hysteresis (low threshold = 0.4)
      for (let i = 0; i < 5; i++) {
        profiler.recordInteraction('pointer', now);
        now += 300;
      }
      vi.advanceTimersByTime(600);
      // 18 keyboard / 25 total = 0.72, still above hysteresis low (0.4)
      expect(profiler.getBehavior().keyboardFirst).toBe(true);
    });
  });

  describe('scroll behavior', () => {
    it('should detect scanning from high-velocity unidirectional scrolling', () => {
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_BEHAVIOR_CHANGE', (e) => events.push(e as ContextChangeEvent));

      let now = 1000;
      // Fast downward scroll — large jumps
      for (let i = 0; i < 10; i++) {
        profiler.recordScroll(i * 500, now);
        now += 100;
      }

      vi.advanceTimersByTime(600);
      expect(profiler.getBehavior().scrollBehavior).toBe('scanning');
    });

    it('should detect reading from slow steady scrolling', () => {
      let now = 1000;
      // Slow downward scroll — small increments
      for (let i = 0; i < 10; i++) {
        profiler.recordScroll(i * 50, now);
        now += 200;
      }

      vi.advanceTimersByTime(600);
      expect(profiler.getBehavior().scrollBehavior).toBe('reading');
    });

    it('should detect searching from erratic direction changes', () => {
      let now = 1000;
      // Erratic scrolling — alternating directions
      const positions = [0, 200, 100, 300, 50, 400, 150, 350, 100, 500];
      for (const pos of positions) {
        profiler.recordScroll(pos, now);
        now += 100;
      }

      vi.advanceTimersByTime(600);
      expect(profiler.getBehavior().scrollBehavior).toBe('searching');
    });

    it('should evict old scroll entries outside the window', () => {
      let now = 1000;
      // Old entries
      for (let i = 0; i < 5; i++) {
        profiler.recordScroll(i * 500, now);
        now += 100;
      }

      // Jump forward past scroll window (3s)
      now += 5000;

      // New slow entries — should overwrite old fast pattern
      for (let i = 0; i < 10; i++) {
        profiler.recordScroll(i * 30, now);
        now += 200;
      }

      vi.advanceTimersByTime(600);
      expect(profiler.getBehavior().scrollBehavior).toBe('reading');
    });
  });

  describe('lifecycle', () => {
    it('should reset all state', () => {
      let now = 1000;
      for (let i = 0; i < 15; i++) {
        profiler.recordInteraction('pointer', now);
        now += 200;
      }
      vi.advanceTimersByTime(600);
      expect(profiler.getBehavior().interactionTempo).toBe('rapid');

      profiler.reset();

      expect(profiler.getBehavior().interactionTempo).toBe('moderate');
      expect(profiler.getBehavior().keyboardFirst).toBe(false);
      expect(profiler.getBehavior().scrollBehavior).toBeNull();
    });

    it('should cancel pending debounce timers on stop()', () => {
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_BEHAVIOR_CHANGE', (e) => events.push(e as ContextChangeEvent));

      let now = 1000;
      for (let i = 0; i < 15; i++) {
        profiler.recordInteraction('pointer', now);
        now += 200;
      }

      profiler.stop();
      vi.advanceTimersByTime(600);

      // No events should have been emitted after stop
      expect(events).toHaveLength(0);
    });
  });

  describe('custom thresholds', () => {
    it('should respect custom rapid tempo threshold', () => {
      const customProfiler = new BehaviorProfiler(bus, {
        ...DEFAULT_BEHAVIOR_THRESHOLDS,
        rapidTempoMs: 100, // much stricter — only <100ms counts as rapid
      });

      // 200ms apart — rapid with defaults but NOT with custom threshold
      let now = 1000;
      for (let i = 0; i < 15; i++) {
        customProfiler.recordInteraction('pointer', now);
        now += 200;
      }
      vi.advanceTimersByTime(600);
      expect(customProfiler.getBehavior().interactionTempo).toBe('moderate');

      customProfiler.stop();
    });

    it('should respect custom keyboard-first min events', () => {
      const customProfiler = new BehaviorProfiler(bus, {
        ...DEFAULT_BEHAVIOR_THRESHOLDS,
        keyboardFirstMinEvents: 5, // stabilize after just 5 events
      });

      let now = 1000;
      for (let i = 0; i < 5; i++) {
        customProfiler.recordInteraction('keyboard', now);
        now += 300;
      }
      vi.advanceTimersByTime(600);
      expect(customProfiler.getBehavior().keyboardFirst).toBe(true);

      customProfiler.stop();
    });

    it('should respect custom scroll scanning velocity', () => {
      const customProfiler = new BehaviorProfiler(bus, {
        ...DEFAULT_BEHAVIOR_THRESHOLDS,
        scrollScanningVelocity: 5000, // much higher — harder to trigger scanning
      });

      let now = 1000;
      // This speed (5000px/s) triggers scanning with defaults but not with custom
      for (let i = 0; i < 10; i++) {
        customProfiler.recordScroll(i * 500, now);
        now += 100;
      }
      vi.advanceTimersByTime(600);
      // velocity = 4500/900 * 1000 = 5000, which is NOT > 5000
      expect(customProfiler.getBehavior().scrollBehavior).not.toBe('scanning');

      customProfiler.stop();
    });
  });
});
