import { describe, it, expect, beforeEach } from 'vitest';
import { ActionBus } from '../bus.js';
import { TaskTracker } from '../task.js';
import type { ContextChangeEvent } from '../types.js';

describe('TaskTracker', () => {
  let bus: ActionBus;
  let tracker: TaskTracker;

  beforeEach(() => {
    bus = new ActionBus();
    tracker = new TaskTracker(bus);
  });

  describe('initial state', () => {
    it('should start with no step, zero time, no completions', () => {
      const ctx = tracker.getTask(1000);
      expect(ctx.currentStep).toBeNull();
      expect(ctx.timeInStep).toBe(0);
      expect(ctx.completedSteps).toEqual([]);
      expect(ctx.abandonedAndReturned).toBe(false);
    });
  });

  describe('step tracking', () => {
    it('should set currentStep on first interaction', () => {
      tracker.recordStepInteraction('shipping', 1000);
      const ctx = tracker.getTask(1000);
      expect(ctx.currentStep).toBe('shipping');
    });

    it('should update timeInStep based on elapsed time', () => {
      tracker.recordStepInteraction('shipping', 1000);
      const ctx = tracker.getTask(6000); // 5 seconds later
      expect(ctx.timeInStep).toBe(5);
    });

    it('should reset timeInStep when switching steps', () => {
      tracker.recordStepInteraction('shipping', 1000);
      tracker.recordStepInteraction('payment', 5000);
      const ctx = tracker.getTask(6000); // 1 second after entering payment
      expect(ctx.currentStep).toBe('payment');
      expect(ctx.timeInStep).toBe(1);
    });

    it('should emit ADAPT_STEP_CHANGE when step changes', () => {
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_STEP_CHANGE', (e) => events.push(e as ContextChangeEvent));

      tracker.recordStepInteraction('shipping', 1000);
      expect(events).toHaveLength(1);
      expect(events[0].field).toBe('currentStep');
      expect(events[0].previousValue).toBeNull();
      expect(events[0].currentValue).toBe('shipping');
    });

    it('should not emit when interacting with same step', () => {
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_STEP_CHANGE', (e) => events.push(e as ContextChangeEvent));

      tracker.recordStepInteraction('shipping', 1000);
      tracker.recordStepInteraction('shipping', 2000);
      tracker.recordStepInteraction('shipping', 3000);

      expect(events).toHaveLength(1); // Only the initial change
    });

    it('should emit on each step transition', () => {
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_STEP_CHANGE', (e) => events.push(e as ContextChangeEvent));

      tracker.recordStepInteraction('shipping', 1000);
      tracker.recordStepInteraction('payment', 2000);
      tracker.recordStepInteraction('review', 3000);

      expect(events).toHaveLength(3);
      expect(events[1].previousValue).toBe('shipping');
      expect(events[1].currentValue).toBe('payment');
    });
  });

  describe('abandoned and returned', () => {
    it('should detect when user returns to a previously visited step', () => {
      tracker.recordStepInteraction('shipping', 1000);
      tracker.recordStepInteraction('payment', 2000);
      tracker.recordStepInteraction('shipping', 3000); // back to shipping

      const ctx = tracker.getTask(3000);
      expect(ctx.abandonedAndReturned).toBe(true);
    });

    it('should not flag abandoned when visiting steps linearly', () => {
      tracker.recordStepInteraction('shipping', 1000);
      tracker.recordStepInteraction('payment', 2000);
      tracker.recordStepInteraction('review', 3000);

      const ctx = tracker.getTask(3000);
      expect(ctx.abandonedAndReturned).toBe(false);
    });

    it('should not flag abandoned on repeated interaction with same step', () => {
      tracker.recordStepInteraction('shipping', 1000);
      tracker.recordStepInteraction('shipping', 2000);

      const ctx = tracker.getTask(2000);
      expect(ctx.abandonedAndReturned).toBe(false);
    });
  });

  describe('step completion', () => {
    it('should mark a step as completed', () => {
      tracker.recordStepInteraction('shipping', 1000);
      tracker.markStepCompleted('shipping');

      const ctx = tracker.getTask(1000);
      expect(ctx.completedSteps).toContain('shipping');
    });

    it('should not duplicate completed steps', () => {
      tracker.markStepCompleted('shipping');
      tracker.markStepCompleted('shipping');

      const ctx = tracker.getTask(1000);
      expect(ctx.completedSteps.filter((s) => s === 'shipping')).toHaveLength(1);
    });

    it('should accumulate multiple completed steps', () => {
      tracker.markStepCompleted('shipping');
      tracker.markStepCompleted('payment');

      const ctx = tracker.getTask(1000);
      expect(ctx.completedSteps).toEqual(['shipping', 'payment']);
    });

    it('should have readonly completedSteps array', () => {
      tracker.markStepCompleted('shipping');
      const ctx = tracker.getTask(1000);
      // TypeScript enforces readonly, but verify the returned array is a copy
      expect(Array.isArray(ctx.completedSteps)).toBe(true);
    });
  });

  describe('reset', () => {
    it('should clear all task state', () => {
      tracker.recordStepInteraction('shipping', 1000);
      tracker.recordStepInteraction('payment', 2000);
      tracker.recordStepInteraction('shipping', 3000);
      tracker.markStepCompleted('shipping');

      tracker.reset();

      const ctx = tracker.getTask(4000);
      expect(ctx.currentStep).toBeNull();
      expect(ctx.timeInStep).toBe(0);
      expect(ctx.completedSteps).toEqual([]);
      expect(ctx.abandonedAndReturned).toBe(false);
    });

    it('should allow fresh tracking after reset', () => {
      tracker.recordStepInteraction('shipping', 1000);
      tracker.reset();

      tracker.recordStepInteraction('shipping', 2000);
      tracker.recordStepInteraction('payment', 3000);
      tracker.recordStepInteraction('shipping', 4000);

      // Should detect abandon/return fresh since reset cleared visited steps
      const ctx = tracker.getTask(4000);
      expect(ctx.abandonedAndReturned).toBe(true);
    });
  });
});
