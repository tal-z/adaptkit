import type { FrictionEvent, ThresholdOverrides } from './types.js';
import { ActionBus } from './bus.js';
import type { MutationTracker } from './mutation-tracker.js';

// ─── Suppression Windows ───

const SCROLL_SUPPRESSION_MS = 1_500;
const KEYBOARD_SUPPRESSION_MS = 2_000;

// Signals suppressed by scroll activity
const SCROLL_SUPPRESSED = new Set(['ADAPT_DEAD_CLICK', 'ADAPT_BLOCKED_INTENT']);

// Signals suppressed by rapid keyboard/tab navigation
const KEYBOARD_SUPPRESSED = new Set(['ADAPT_FORM_THRASHING']);

// ─── Confidence Weights ───

// Per-signal base confidence: higher for multi-event patterns (rage click),
// lower for single-event ambiguous signals (dead click, input resignation).
const BASE_CONFIDENCE: Record<string, number> = {
  ADAPT_RAGE_CLICK: 0.7, // Multi-click pattern — very strong signal
  ADAPT_DEAD_CLICK: 0.35, // Single click, inherently ambiguous
  ADAPT_BLOCKED_INTENT: 0.55, // Retry pattern — user demonstrated repeated intent
  ADAPT_FORM_THRASHING: 0.55, // Multi-field cycling — sustained pattern
  ADAPT_INPUT_RESIGNATION: 0.45, // Could be intentional editing (cut/undo)
  ADAPT_FRUSTRATION_TEXT: 0.55, // Text pattern match — explicit signal
};
const DEFAULT_BASE_CONFIDENCE = 0.5;

const SEMANTIC_NODE_BONUS = 0.15;
const PRIMARY_ACTION_BONUS = 0.1;
const MODIFIER_DELETE_BONUS = 0.1;
const NATIVE_TAG_BONUS = 0.1;
const ARIA_ROLE_BONUS = 0.05;

// ─── Buffered Event ───

interface BufferedEvent {
  event: FrictionEvent;
  confidence: number;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
}

function generateSessionId(): string {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'sess-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export class ContextEngine {
  private lastScrollTime = 0;
  private lastKeyboardTime = 0;
  private buffered = new Map<string, BufferedEvent>();
  private sessionId: string;
  private eventIndex = 0;
  private emissionTimestamps: number[] = [];
  private droppedEventCount = 0;

  constructor(
    private bus: ActionBus,
    private config: ThresholdOverrides,
    private debug: boolean,
    private mutationTracker: MutationTracker | null = null,
  ) {
    this.sessionId = generateSessionId();
  }

  /** Track user activity for suppression checks. */
  trackActivity(kind: 'scroll' | 'keydown', now: number): void {
    if (kind === 'scroll') this.lastScrollTime = now;
    if (kind === 'keydown') this.lastKeyboardTime = now;
  }

  /** Signal that an action completed. Discards any buffered event whose target matches any of the provided selectors. */
  trackCompletion(selectors: string[]): void {
    const selectorSet = new Set(selectors);
    for (const [key, buffered] of this.buffered) {
      if (selectorSet.has(buffered.event.target)) {
        clearTimeout(buffered.timer);
        this.buffered.delete(key);
        if (this.debug) {
          console.log(
            `[AdaptKit:context] Discarded ${buffered.event.type} on ${buffered.event.target} — user self-recovered`,
          );
        }
      }
    }
  }

  /** Evaluate a candidate friction event. May emit, buffer, or suppress. */
  evaluate(event: FrictionEvent, now: number): void {
    // 1. Negative signal gating
    if (this.isSuppressed(event, now)) {
      if (this.debug) {
        console.log(
          `[AdaptKit:context] Suppressed ${event.type} on ${event.target} — negative signal active`,
        );
      }
      return;
    }

    // 2. Confidence scoring
    const confidence = this.computeConfidence(event);

    if (confidence < this.config.emissionFloor) {
      if (this.debug) {
        console.log(
          `[AdaptKit:context] Below floor ${event.type} on ${event.target} — confidence ${confidence.toFixed(2)} < ${this.config.emissionFloor}`,
        );
      }
      return;
    }

    // 3. Completion-gated emission: buffer the event
    const key = `${event.type}:${event.target}`;

    // If there's already a buffered event for this key, replace it
    const existing = this.buffered.get(key);
    if (existing) {
      clearTimeout(existing.timer);
    }

    // Annotate the event with confidence and session metadata
    event.metrics.confidence = confidence;
    event.sessionId = this.sessionId;
    event.eventIndex = this.eventIndex++;

    const timer = setTimeout(() => {
      this.buffered.delete(key);
      if (this.isRateLimited()) {
        this.droppedEventCount++;
        if (this.debug) {
          console.log(
            `[AdaptKit:context] Rate-limited ${event.type} on ${event.target} (dropped: ${this.droppedEventCount})`,
          );
        }
        return;
      }
      this.recordEmission();
      this.bus.emit(event);
      if (this.debug) {
        console.log(
          `[AdaptKit:context] Emitted ${event.type} on ${event.target} (confidence: ${confidence.toFixed(2)})`,
        );
      }
    }, this.config.completionWindowMs);

    this.buffered.set(key, {
      event,
      confidence,
      expiresAt: now + this.config.completionWindowMs,
      timer,
    });

    // 4. DOM mutation-based completion gating:
    // If the mutation tracker is available, watch for DOM mutations near the
    // event's target. If a mutation occurs within the completion window,
    // discard the buffered event (the app responded to the user's action).
    if (this.mutationTracker) {
      this.watchForMutationCompletion(key, event);
    }
  }

  /** Flush all buffered events immediately (for stop/teardown). */
  flush(): void {
    for (const [key, buffered] of this.buffered) {
      clearTimeout(buffered.timer);
      this.bus.emit(buffered.event);
      this.buffered.delete(key);
    }
  }

  /** Clear all state without emitting. */
  destroy(): void {
    for (const [, buffered] of this.buffered) {
      clearTimeout(buffered.timer);
    }
    this.buffered.clear();
    this.lastScrollTime = 0;
    this.lastKeyboardTime = 0;
  }

  /** Reset for a new session (SPA route change). Clears buffered events,
   *  suppression state, rate-limit counters, and generates a new session identity. */
  resetSession(): void {
    for (const [, buffered] of this.buffered) {
      clearTimeout(buffered.timer);
    }
    this.buffered.clear();
    this.lastScrollTime = 0;
    this.lastKeyboardTime = 0;
    this.sessionId = generateSessionId();
    this.eventIndex = 0;
    this.emissionTimestamps = [];
    this.droppedEventCount = 0;
  }

  // ─── Internals ───

  private watchForMutationCompletion(key: string, event: FrictionEvent): void {
    if (!this.mutationTracker) return;

    // We need a DOM element reference to watch. The event only has a CSS selector string.
    // Try to resolve it to a DOM element.
    try {
      const el = document.querySelector(event.target);
      if (!el) return;

      this.mutationTracker.watchForMutation(
        el,
        event.target,
        this.config.completionWindowMs,
        (mutated) => {
          if (mutated) {
            const buffered = this.buffered.get(key);
            if (buffered) {
              clearTimeout(buffered.timer);
              this.buffered.delete(key);
              if (this.debug) {
                console.log(
                  `[AdaptKit:context] Discarded ${event.type} on ${event.target} — DOM mutation detected (completion)`,
                );
              }
            }
          }
        },
      );
    } catch {
      // querySelector can throw on invalid selectors
    }
  }

  private isRateLimited(): boolean {
    const max = this.config.maxEventsPerMinute;
    if (max <= 0) return false;
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    this.emissionTimestamps = this.emissionTimestamps.filter((t) => t > oneMinuteAgo);
    return this.emissionTimestamps.length >= max;
  }

  private recordEmission(): void {
    this.emissionTimestamps.push(Date.now());
  }

  private isSuppressed(event: FrictionEvent, now: number): boolean {
    // Scroll suppression
    if (SCROLL_SUPPRESSED.has(event.type)) {
      if (now - this.lastScrollTime < SCROLL_SUPPRESSION_MS) {
        return true;
      }
    }

    // Keyboard/tab suppression
    if (KEYBOARD_SUPPRESSED.has(event.type)) {
      if (now - this.lastKeyboardTime < KEYBOARD_SUPPRESSION_MS) {
        return true;
      }
    }

    return false;
  }

  private computeConfidence(event: FrictionEvent): number {
    let score = BASE_CONFIDENCE[event.type] ?? DEFAULT_BASE_CONFIDENCE;

    // Interactive element type bonus: native tags are stronger signals than cursor:pointer
    const reason = event.metrics.interactiveReason as string | undefined;
    if (reason?.startsWith('tag:')) {
      score += NATIVE_TAG_BONUS;
    } else if (reason?.startsWith('role:')) {
      score += ARIA_ROLE_BONUS;
    }

    // Semantic node present → bonus
    if (event.semantic?.nodeId) {
      score += SEMANTIC_NODE_BONUS;
    }

    // Primary action role → higher consequence friction
    if (event.semantic?.role === 'primary-action') {
      score += PRIMARY_ACTION_BONUS;
    }

    // Delete modifier → extra consequence
    if (event.semantic?.modifier === 'delete') {
      score += MODIFIER_DELETE_BONUS;
    }

    return Math.min(1, score);
  }
}
