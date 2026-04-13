import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MutationTracker } from '../mutation-tracker.js';

const stubSelector = (el: Element) => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '');

describe('MutationTracker', () => {
  let tracker: MutationTracker;

  beforeEach(() => {
    document.body.innerHTML = '';
    tracker = new MutationTracker(stubSelector);
    vi.useFakeTimers();
  });

  afterEach(() => {
    tracker.stop();
    vi.useRealTimers();
  });

  describe('hasMutationNear', () => {
    it('should return false when no mutations have occurred', () => {
      document.body.innerHTML = '<button id="btn">Click</button>';
      const btn = document.getElementById('btn')!;
      tracker.start(document.body);
      expect(tracker.hasMutationNear(btn)).toBe(false);
    });

    it('should return true after a mutation on the element itself', async () => {
      document.body.innerHTML = '<div id="target"><span>Text</span></div>';
      const target = document.getElementById('target')!;
      tracker.start(document.body);

      // Trigger a mutation on the target
      target.appendChild(document.createElement('p'));
      // MutationObserver is async — flush microtasks
      await vi.advanceTimersByTimeAsync(0);

      expect(tracker.hasMutationNear(target)).toBe(true);
    });

    it('should return true for a child of a mutated element', async () => {
      document.body.innerHTML = '<div id="parent"><button id="btn">Click</button></div>';
      const parent = document.getElementById('parent')!;
      const btn = document.getElementById('btn')!;
      tracker.start(document.body);

      // Mutation on parent (sibling added next to button)
      parent.appendChild(document.createElement('span'));
      await vi.advanceTimersByTimeAsync(0);

      expect(tracker.hasMutationNear(btn)).toBe(true);
    });

    it('should return false for unrelated element when mutation happens elsewhere', async () => {
      document.body.innerHTML =
        '<div id="a"><span id="a-child">A</span></div><div id="b"><button id="b-btn">B</button></div>';
      const bBtn = document.getElementById('b-btn')!;
      const a = document.getElementById('a')!;
      tracker.start(document.body);

      // Mutation in section A
      a.appendChild(document.createElement('p'));
      await vi.advanceTimersByTimeAsync(0);

      // B's button should not see this mutation as "near"
      // (the mutation is on A, which shares document.body as common ancestor,
      // but the ancestor walk is limited to 5 levels)
      expect(tracker.hasMutationNear(bBtn)).toBe(false);
    });
  });

  describe('resetAfterClick', () => {
    it('should clear mutation records', async () => {
      document.body.innerHTML = '<div id="target">Text</div>';
      const target = document.getElementById('target')!;
      tracker.start(document.body);

      target.appendChild(document.createElement('span'));
      await vi.advanceTimersByTimeAsync(0);
      expect(tracker.hasMutationNear(target)).toBe(true);

      tracker.resetAfterClick();
      expect(tracker.hasMutationNear(target)).toBe(false);
    });
  });

  describe('watchForMutation', () => {
    it('should call onResult(false) when no mutation occurs within window', async () => {
      document.body.innerHTML = '<button id="btn">Click</button>';
      const btn = document.getElementById('btn')!;
      tracker.start(document.body);

      const callback = vi.fn();
      tracker.watchForMutation(btn, 'button#btn', 300, callback);

      // Advance past the window
      await vi.advanceTimersByTimeAsync(301);

      expect(callback).toHaveBeenCalledWith(false);
    });

    it('should call onResult(true) when mutation occurs near element within window', async () => {
      document.body.innerHTML = '<div id="container"><button id="btn">Click</button></div>';
      const container = document.getElementById('container')!;
      const btn = document.getElementById('btn')!;
      tracker.start(document.body);

      const callback = vi.fn();
      tracker.watchForMutation(btn, 'button#btn', 300, callback);

      // Trigger mutation near the button (in its container)
      container.appendChild(document.createElement('span'));
      await vi.advanceTimersByTimeAsync(0);

      expect(callback).toHaveBeenCalledWith(true);
    });

    it('should not call onResult twice', async () => {
      document.body.innerHTML = '<div id="container"><button id="btn">Click</button></div>';
      const container = document.getElementById('container')!;
      const btn = document.getElementById('btn')!;
      tracker.start(document.body);

      const callback = vi.fn();
      tracker.watchForMutation(btn, 'button#btn', 300, callback);

      // Mutation resolves it
      container.appendChild(document.createElement('span'));
      await vi.advanceTimersByTimeAsync(0);

      // Advance past window — should not get a second call
      await vi.advanceTimersByTimeAsync(301);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('pause / resume', () => {
    it('should not record mutations while paused', async () => {
      document.body.innerHTML = '<div id="target">Text</div>';
      const target = document.getElementById('target')!;
      tracker.start(document.body);

      tracker.pause();
      target.appendChild(document.createElement('span'));
      await vi.advanceTimersByTimeAsync(0);
      tracker.resume();

      expect(tracker.hasMutationNear(target)).toBe(false);
    });

    it('should record mutations after resume', async () => {
      document.body.innerHTML = '<div id="target">Text</div>';
      const target = document.getElementById('target')!;
      tracker.start(document.body);

      tracker.pause();
      tracker.resume();
      target.appendChild(document.createElement('span'));
      await vi.advanceTimersByTimeAsync(0);

      expect(tracker.hasMutationNear(target)).toBe(true);
    });
  });

  describe('staleness cleanup', () => {
    it('should clear mutatedNodes after 10s of no clicks', async () => {
      document.body.innerHTML = '<div id="target">Text</div>';
      const target = document.getElementById('target')!;
      tracker.start(document.body);

      // Trigger a mutation
      target.appendChild(document.createElement('span'));
      await vi.advanceTimersByTimeAsync(0);
      expect(tracker.hasMutationNear(target)).toBe(true);

      // Advance past the staleness window (10s)
      await vi.advanceTimersByTimeAsync(10_001);

      expect(tracker.hasMutationNear(target)).toBe(false);
    });

    it('should reset staleness timer on resetAfterClick', async () => {
      document.body.innerHTML = '<div id="target">Text</div>';
      const target = document.getElementById('target')!;
      tracker.start(document.body);

      target.appendChild(document.createElement('span'));
      await vi.advanceTimersByTimeAsync(0);
      expect(tracker.hasMutationNear(target)).toBe(true);

      // Click resets the stale timer
      tracker.resetAfterClick();

      // Add another mutation
      target.appendChild(document.createElement('p'));
      await vi.advanceTimersByTimeAsync(0);
      expect(tracker.hasMutationNear(target)).toBe(true);

      // Advance 10s — the staleness timer from the new mutation should fire
      await vi.advanceTimersByTimeAsync(10_001);
      expect(tracker.hasMutationNear(target)).toBe(false);
    });

    it('should enforce hard cap on mutatedNodes size', async () => {
      // Create >500 distinct parent elements, each getting a child mutation,
      // to produce >500 distinct mutation targets
      let html = '';
      for (let i = 0; i < 501; i++) {
        html += `<div id="p${i}"></div>`;
      }
      document.body.innerHTML = html;
      tracker.start(document.body);

      // Trigger a mutation in each distinct parent — each flush adds mutation targets
      for (let i = 0; i < 501; i++) {
        const parent = document.getElementById(`p${i}`)!;
        parent.appendChild(document.createElement('span'));
        // Flush after each batch to ensure distinct mutation records
        await vi.advanceTimersByTimeAsync(0);
      }

      // Hard cap (500) should have cleared the set at some point
      const firstEl = document.getElementById('p0')!;
      expect(tracker.hasMutationNear(firstEl)).toBe(false);
    });
  });

  describe('stop', () => {
    it('should cancel all pending watches', () => {
      document.body.innerHTML = '<button id="btn">Click</button>';
      const btn = document.getElementById('btn')!;
      tracker.start(document.body);

      const callback = vi.fn();
      tracker.watchForMutation(btn, 'button#btn', 300, callback);

      tracker.stop();
      vi.advanceTimersByTime(500);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should cancel the staleness timer', async () => {
      document.body.innerHTML = '<div id="target">Text</div>';
      const target = document.getElementById('target')!;
      tracker.start(document.body);

      target.appendChild(document.createElement('span'));
      await vi.advanceTimersByTimeAsync(0);

      tracker.stop();

      // Re-create tracker to verify no stale callbacks leak from old instance
      tracker = new MutationTracker(stubSelector);
      tracker.start(document.body);

      target.appendChild(document.createElement('p'));
      await vi.advanceTimersByTimeAsync(0);
      expect(tracker.hasMutationNear(target)).toBe(true);
    });
  });
});
