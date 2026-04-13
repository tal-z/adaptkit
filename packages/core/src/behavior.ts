import type { BehaviorContext, ContextChangeEvent } from './types.js';
import { CONTEXT_EVENTS } from './types.js';
import type { ActionBus } from './bus.js';

// ─── EWMA Parameters ───
// Alpha controls recency bias: higher = more weight on recent events.
// 0.2 gives ~90% recency within last 10 samples — balances noise smoothing
// with responsiveness to behavioral shifts.
const EWMA_ALPHA = 0.2;

// Scroll buffer max entries (not configurable — internal memory bound)
const SCROLL_BUFFER_MAX = 30;

export interface BehaviorThresholds {
  rapidTempoMs: number;
  deliberateTempoMs: number;
  keyboardFirstMinEvents: number;
  keyboardFirstRatio: number;
  keyboardFirstHysteresisLow: number;
  changeDebouncMs: number;
  scrollScanningVelocity: number;
  scrollReadingVelocityMax: number;
  scrollSearchDirectionChangesMin: number;
  scrollWindowMs: number;
}

interface ScrollEntry {
  timestamp: number;
  scrollY: number;
}

export class BehaviorProfiler {
  private context: BehaviorContext;
  private thresholds: BehaviorThresholds;

  // EWMA state for interaction tempo
  private ewmaInterval: number | null = null;
  private lastInteractionTime: number | null = null;

  // Keyboard-first tracking
  private keyboardNavEvents = 0;
  private pointerNavEvents = 0;
  private keyboardFirstStabilized = false;

  // Scroll behavior tracking
  private scrollBuffer: ScrollEntry[] = [];

  // Debounce: pending changes are held before emission
  private pendingChanges = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private bus: ActionBus,
    thresholds: BehaviorThresholds,
  ) {
    this.thresholds = thresholds;
    this.context = {
      interactionTempo: 'moderate',
      keyboardFirst: false,
      scrollBehavior: null,
    };
  }

  /** Record a click or focusin event for tempo + keyboard-first calculation. */
  recordInteraction(kind: 'pointer' | 'keyboard', now: number): void {
    // Tempo: EWMA of inter-event intervals
    if (this.lastInteractionTime !== null) {
      const interval = now - this.lastInteractionTime;
      // Ignore very large gaps (>10s) — user was away, not interacting slowly
      if (interval < 10_000) {
        if (this.ewmaInterval === null) {
          this.ewmaInterval = interval;
        } else {
          this.ewmaInterval = EWMA_ALPHA * interval + (1 - EWMA_ALPHA) * this.ewmaInterval;
        }
        this.updateTempo();
      }
    }
    this.lastInteractionTime = now;

    // Keyboard-first tracking
    if (kind === 'keyboard') {
      this.keyboardNavEvents++;
    } else {
      this.pointerNavEvents++;
    }
    this.updateKeyboardFirst();
  }

  /** Record a scroll event for scroll behavior classification. */
  recordScroll(scrollY: number, now: number): void {
    this.scrollBuffer.push({ timestamp: now, scrollY });

    // Evict old entries
    const cutoff = now - this.thresholds.scrollWindowMs;
    while (this.scrollBuffer.length > 0 && this.scrollBuffer[0].timestamp < cutoff) {
      this.scrollBuffer.shift();
    }
    while (this.scrollBuffer.length > SCROLL_BUFFER_MAX) {
      this.scrollBuffer.shift();
    }

    this.updateScrollBehavior();
  }

  /** Get current behavior context snapshot. */
  getBehavior(): BehaviorContext {
    return { ...this.context };
  }

  /** Clear all profiling state. */
  reset(): void {
    this.ewmaInterval = null;
    this.lastInteractionTime = null;
    this.keyboardNavEvents = 0;
    this.pointerNavEvents = 0;
    this.keyboardFirstStabilized = false;
    this.scrollBuffer = [];

    for (const timer of this.pendingChanges.values()) {
      clearTimeout(timer);
    }
    this.pendingChanges.clear();

    this.context = {
      interactionTempo: 'moderate',
      keyboardFirst: false,
      scrollBehavior: null,
    };
  }

  /** Stop profiler — clears pending debounce timers. */
  stop(): void {
    for (const timer of this.pendingChanges.values()) {
      clearTimeout(timer);
    }
    this.pendingChanges.clear();
  }

  // ─── Internals ───

  private updateTempo(): void {
    if (this.ewmaInterval === null) return;

    let tempo: BehaviorContext['interactionTempo'];
    if (this.ewmaInterval < this.thresholds.rapidTempoMs) {
      tempo = 'rapid';
    } else if (this.ewmaInterval > this.thresholds.deliberateTempoMs) {
      tempo = 'deliberate';
    } else {
      tempo = 'moderate';
    }

    this.debouncedUpdate('interactionTempo', tempo);
  }

  private updateKeyboardFirst(): void {
    const total = this.keyboardNavEvents + this.pointerNavEvents;
    if (total < this.thresholds.keyboardFirstMinEvents) return;

    const ratio = this.keyboardNavEvents / total;
    let newValue: boolean;

    if (!this.keyboardFirstStabilized) {
      // Initial determination
      newValue = ratio >= this.thresholds.keyboardFirstRatio;
      this.keyboardFirstStabilized = true;
    } else {
      // Hysteresis: require sustained counter-evidence to flip
      if (this.context.keyboardFirst) {
        // Currently keyboard-first — only flip off if ratio drops below low threshold
        newValue = ratio >= this.thresholds.keyboardFirstHysteresisLow;
      } else {
        // Currently not keyboard-first — only flip on if ratio exceeds high threshold
        newValue = ratio >= this.thresholds.keyboardFirstRatio;
      }
    }

    this.debouncedUpdate('keyboardFirst', newValue);
  }

  private updateScrollBehavior(): void {
    if (this.scrollBuffer.length < 3) return;

    const first = this.scrollBuffer[0];
    const last = this.scrollBuffer[this.scrollBuffer.length - 1];
    const timeDelta = last.timestamp - first.timestamp;
    if (timeDelta === 0) return;

    // Compute average velocity (pixels per second)
    const totalDistance = Math.abs(last.scrollY - first.scrollY);

    // Ignore tiny scrolls — a small flick over a short time can produce
    // misleadingly high velocity (e.g., 80px in 30ms = 2666 px/s).
    // Require at least 200px of movement before classifying.
    if (totalDistance < 200) return;

    const velocity = (totalDistance / timeDelta) * 1000;

    // Count direction changes
    let directionChanges = 0;
    for (let i = 2; i < this.scrollBuffer.length; i++) {
      const prev = this.scrollBuffer[i - 1].scrollY - this.scrollBuffer[i - 2].scrollY;
      const curr = this.scrollBuffer[i].scrollY - this.scrollBuffer[i - 1].scrollY;
      // Direction change: sign flip (ignoring zero-delta entries)
      if (prev !== 0 && curr !== 0 && Math.sign(prev) !== Math.sign(curr)) {
        directionChanges++;
      }
    }

    let behavior: BehaviorContext['scrollBehavior'];
    if (directionChanges >= this.thresholds.scrollSearchDirectionChangesMin) {
      behavior = 'searching';
    } else if (velocity > this.thresholds.scrollScanningVelocity) {
      behavior = 'scanning';
    } else if (velocity <= this.thresholds.scrollReadingVelocityMax) {
      behavior = 'reading';
    } else {
      // Between reading and scanning — moderate pace, no clear pattern
      behavior = 'reading';
    }

    this.debouncedUpdate('scrollBehavior', behavior);
  }

  private debouncedUpdate<K extends keyof BehaviorContext>(
    field: K,
    value: BehaviorContext[K],
  ): void {
    if (this.context[field] === value) {
      // No change — cancel any pending debounce for this field
      const pending = this.pendingChanges.get(field);
      if (pending) {
        clearTimeout(pending);
        this.pendingChanges.delete(field);
      }
      return;
    }

    // Cancel existing debounce for this field
    const existing = this.pendingChanges.get(field);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.pendingChanges.delete(field);

      const previous = this.context[field];
      if (previous === value) return;

      this.context[field] = value;

      const event: ContextChangeEvent = {
        type: CONTEXT_EVENTS.BEHAVIOR_CHANGE,
        timestamp: Date.now(),
        field,
        previousValue: previous,
        currentValue: value,
      };
      this.bus.emit(event);
    }, this.thresholds.changeDebouncMs);

    this.pendingChanges.set(field, timer);
  }
}
