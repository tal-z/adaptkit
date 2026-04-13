import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ActionBus } from '../bus.js';
import { FamiliarityTracker } from '../familiarity.js';
import type { ContextChangeEvent } from '../types.js';

describe('FamiliarityTracker', () => {
  let bus: ActionBus;
  let tracker: FamiliarityTracker;

  beforeEach(() => {
    localStorage.clear();
    bus = new ActionBus();
    tracker = new FamiliarityTracker(bus);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('initial state', () => {
    it('should return default familiarity for unknown scope', () => {
      const ctx = tracker.getFamiliarity('checkout');
      expect(ctx.visitCount).toBe(0);
      expect(ctx.hasCompleted).toBe(false);
      expect(ctx.isFirstVisit).toBe(true);
      expect(ctx.lastVisitMs).toBeNull();
    });
  });

  describe('recordVisit', () => {
    it('should increment visit count on first visit', () => {
      tracker.recordVisit('checkout');
      const ctx = tracker.getFamiliarity('checkout');
      expect(ctx.visitCount).toBe(1);
      expect(ctx.isFirstVisit).toBe(true);
    });

    it('should increment visit count on subsequent visits (across sessions)', () => {
      tracker.recordVisit('checkout');
      tracker.resetSession();
      tracker.recordVisit('checkout');
      tracker.resetSession();
      tracker.recordVisit('checkout');
      const ctx = tracker.getFamiliarity('checkout');
      expect(ctx.visitCount).toBe(3);
      expect(ctx.isFirstVisit).toBe(false);
    });

    it('should track lastVisitMs', () => {
      tracker.recordVisit('checkout');
      const ctx = tracker.getFamiliarity('checkout');
      // Should be very recent (within last second)
      expect(ctx.lastVisitMs).not.toBeNull();
      expect(ctx.lastVisitMs!).toBeLessThan(1000);
    });

    it('should emit ADAPT_FAMILIARITY_CHANGE on first visit per session', () => {
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_FAMILIARITY_CHANGE', (e) => events.push(e as ContextChangeEvent));

      tracker.recordVisit('checkout');
      expect(events).toHaveLength(1);
      expect(events[0].field).toBe('visitCount');
      expect(events[0].previousValue).toBe(0);
      expect(events[0].currentValue).toBe(1);
    });

    it('should not emit duplicate FAMILIARITY_CHANGE for same scope in session', () => {
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_FAMILIARITY_CHANGE', (e) => events.push(e as ContextChangeEvent));

      tracker.recordVisit('checkout');
      tracker.recordVisit('checkout');
      tracker.recordVisit('checkout');

      // Only one event per scope per session
      expect(events).toHaveLength(1);
    });

    it('should emit for different scopes independently', () => {
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_FAMILIARITY_CHANGE', (e) => events.push(e as ContextChangeEvent));

      tracker.recordVisit('checkout');
      tracker.recordVisit('settings');

      expect(events).toHaveLength(2);
    });

    it('should persist to localStorage', () => {
      tracker.recordVisit('checkout');

      // Create a new tracker from the same localStorage
      const tracker2 = new FamiliarityTracker(bus);
      const ctx = tracker2.getFamiliarity('checkout');
      expect(ctx.visitCount).toBe(1);
    });
  });

  describe('markCompleted', () => {
    it('should mark a visited scope as completed', () => {
      tracker.recordVisit('checkout');
      tracker.markCompleted('checkout');

      const ctx = tracker.getFamiliarity('checkout');
      expect(ctx.hasCompleted).toBe(true);
    });

    it('should create scope if marking completed before visit', () => {
      tracker.markCompleted('checkout');

      const ctx = tracker.getFamiliarity('checkout');
      expect(ctx.hasCompleted).toBe(true);
      expect(ctx.visitCount).toBe(1);
    });

    it('should persist completion to localStorage', () => {
      tracker.recordVisit('checkout');
      tracker.markCompleted('checkout');

      const tracker2 = new FamiliarityTracker(bus);
      expect(tracker2.getFamiliarity('checkout').hasCompleted).toBe(true);
    });
  });

  describe('resetSession', () => {
    it('should allow FAMILIARITY_CHANGE to fire again after session reset', () => {
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_FAMILIARITY_CHANGE', (e) => events.push(e as ContextChangeEvent));

      tracker.recordVisit('checkout');
      expect(events).toHaveLength(1);

      tracker.resetSession();

      tracker.recordVisit('checkout');
      expect(events).toHaveLength(2);
    });

    it('should not clear persisted data', () => {
      tracker.recordVisit('checkout');
      tracker.resetSession();

      const ctx = tracker.getFamiliarity('checkout');
      expect(ctx.visitCount).toBe(1);
    });
  });

  describe('reset', () => {
    it('should clear all data from localStorage', () => {
      tracker.recordVisit('checkout');
      tracker.recordVisit('settings');
      tracker.reset();

      expect(tracker.getFamiliarity('checkout').visitCount).toBe(0);
      expect(tracker.getFamiliarity('settings').visitCount).toBe(0);
    });
  });

  describe('resetScope', () => {
    it('should clear only the specified scope', () => {
      tracker.recordVisit('checkout');
      tracker.recordVisit('settings');
      tracker.resetScope('checkout');

      expect(tracker.getFamiliarity('checkout').visitCount).toBe(0);
      expect(tracker.getFamiliarity('checkout').isFirstVisit).toBe(true);
      // settings should be unaffected
      expect(tracker.getFamiliarity('settings').visitCount).toBe(1);
    });

    it('should clear session tracking for the scope', () => {
      tracker.recordVisit('checkout');
      tracker.resetScope('checkout');

      // Should be able to record a fresh visit
      tracker.recordVisit('checkout');
      expect(tracker.getFamiliarity('checkout').visitCount).toBe(1);
    });

    it('should handle resetting a non-existent scope', () => {
      expect(() => tracker.resetScope('nonexistent')).not.toThrow();
    });
  });

  describe('storage failure handling', () => {
    it('should degrade gracefully when localStorage.setItem throws', () => {
      vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      // Should not throw
      expect(() => tracker.recordVisit('checkout')).not.toThrow();
      expect(() => tracker.markCompleted('checkout')).not.toThrow();

      vi.restoreAllMocks();
    });

    it('should degrade gracefully when localStorage.getItem throws', () => {
      vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
        throw new DOMException('SecurityError');
      });

      // Should create tracker with empty state, not throw
      const tracker2 = new FamiliarityTracker(bus);
      expect(tracker2.getFamiliarity('checkout').visitCount).toBe(0);

      vi.restoreAllMocks();
    });

    it('should handle corrupt JSON in localStorage', () => {
      localStorage.setItem('adaptkit_familiarity', '{invalid json');

      const tracker2 = new FamiliarityTracker(bus);
      expect(tracker2.getFamiliarity('checkout').visitCount).toBe(0);
    });

    it('should handle schema version mismatch', () => {
      localStorage.setItem(
        'adaptkit_familiarity',
        JSON.stringify({
          version: 999,
          scopes: { checkout: { visits: 5, completed: true, lastVisit: 0 } },
        }),
      );

      const tracker2 = new FamiliarityTracker(bus);
      // Version mismatch → start fresh
      expect(tracker2.getFamiliarity('checkout').visitCount).toBe(0);
    });
  });
});
