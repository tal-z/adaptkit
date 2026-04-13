import type {
  Sensor,
  FrictionEvent,
  FrictionEventType,
  ClickEnvelope,
  FocusEnvelope,
} from './types.js';
import { ActionBus } from './bus.js';
import {
  buildClickEnvelope,
  buildFocusEnvelope,
  buildSubmitEnvelope,
  buildInputEnvelope,
} from './envelopes.js';
import type { PrivacyOptions } from './envelopes.js';
import type { SemanticGraph } from './semantic-graph.js';
import type { ContextEngine } from './context-engine.js';
import type { MutationTracker } from './mutation-tracker.js';
import type { DeadClickSensor } from './sensors/dead-click.js';
import type { BehaviorProfiler } from './behavior.js';
import type { TaskTracker } from './task.js';
import type { FamiliarityTracker } from './familiarity.js';

interface RecentKey {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  timestamp: number;
}

const SHORTCUT_WINDOW_MS = 200;
const RECENT_KEYS_MAX = 3;

function detectShortcut(recentKeys: RecentKey[], now: number): string | null {
  for (const k of recentKeys) {
    if (now - k.timestamp > SHORTCUT_WINDOW_MS) continue;
    const mod = k.ctrlKey || k.metaKey;
    if (!mod) continue;
    const key = k.key.toLowerCase();
    if (key === 'a') return 'selectAll';
    if (key === 'x') return 'cut';
    if (key === 'z') return 'undo';
  }
  return null;
}

export class EventCollector {
  private clickHandler: ((e: Event) => void) | null = null;
  private focusHandler: ((e: Event) => void) | null = null;
  private submitHandler: ((e: Event) => void) | null = null;
  private inputHandler: ((e: Event) => void) | null = null;
  private scrollHandler: ((e: Event) => void) | null = null;
  private keydownHandler: ((e: Event) => void) | null = null;
  private recentKeys: RecentKey[] = [];
  /** Timestamp of last Tab/Enter/Space keydown — used to avoid double-counting
   *  keyboard navigation in focusin (which fires immediately after Tab). */
  private lastKeyboardNavAt = 0;

  constructor(
    private bus: ActionBus,
    private sensors: Sensor[],
    private selectorFn: (el: Element) => string,
    private debug: boolean,
    private privacy: PrivacyOptions,
    private graph: SemanticGraph | null = null,
    private contextEngine: ContextEngine | null = null,
    private mutationTracker: MutationTracker | null = null,
    private deadClickSensor: DeadClickSensor | null = null,
    private deadClickMutationWindowMs: number = 300,
    private behaviorProfiler: BehaviorProfiler | null = null,
    private taskTracker: TaskTracker | null = null,
    private familiarityTracker: FamiliarityTracker | null = null,
  ) {}

  start(): void {
    const clickSensors = this.sensors.filter((s) => s.accepts.includes('click'));
    const focusSensors = this.sensors.filter((s) => s.accepts.includes('focusin'));
    const submitSensors = this.sensors.filter((s) => s.accepts.includes('submit'));
    const inputSensors = this.sensors.filter((s) => s.accepts.includes('input'));

    const handleClick = (e: Event) => {
      const envelope = buildClickEnvelope(e as MouseEvent, this.selectorFn, this.privacy);
      this.enrichWithGraph(envelope);

      // Per-element mutation check: did the DOM near THIS element change since the last click?
      if (this.mutationTracker) {
        envelope.domChangedSinceLastClick = this.mutationTracker.hasMutationNear(
          envelope.target.element,
        );
        this.mutationTracker.resetAfterClick();
      }

      const now = Date.now();

      // Forward to behavior profiler and task/familiarity trackers
      this.behaviorProfiler?.recordInteraction('pointer', now);
      if (envelope.target.adaptStep) {
        this.taskTracker?.recordStepInteraction(envelope.target.adaptStep, now);
        this.familiarityTracker?.recordVisit(envelope.target.adaptStep);
      }

      // Synchronous sensor chain: rage-click → blocked-intent
      // Continue evaluating after first fire to capture suppressed signals as metadata
      let primaryResult: FrictionEvent | null = null;
      const suppressed: Array<{ type: FrictionEventType; ruleId: string }> = [];

      for (const sensor of clickSensors) {
        const result = sensor.process(envelope, now);
        if (this.debug) this.logSensorEvaluation(sensor, result);
        if (result) {
          if (!primaryResult) {
            primaryResult = result;
          } else {
            suppressed.push({ type: result.type, ruleId: result.ruleId });
          }
        }
      }

      if (primaryResult) {
        if (suppressed.length > 0) {
          primaryResult.suppressedSignals = suppressed;
        }
        if (this.mutationTracker) {
          this.mutationTracker.pause();
        }
        this.emitOrEvaluate(primaryResult, now);
        if (this.mutationTracker) {
          this.mutationTracker.resume();
        }
        return;
      }

      // Async dead-click path: if no synchronous sensor fired, evaluate dead-click
      // via post-click mutation window
      if (this.deadClickSensor && this.mutationTracker) {
        const candidate = this.deadClickSensor.shouldEvaluate(envelope, now);
        if (candidate) {
          if (this.debug) {
            console.log(
              `[AdaptKit:dead-click] Candidate — watching for mutation (${this.deadClickMutationWindowMs}ms)`,
            );
          }
          this.mutationTracker.watchForMutation(
            candidate.target.element,
            candidate.target.selector,
            this.deadClickMutationWindowMs,
            (mutated) => {
              if (!mutated) {
                const event = this.deadClickSensor!.buildEvent(candidate, now);
                if (this.debug) {
                  console.log(
                    `[AdaptKit:dead-click] FIRED — no mutation within window on ${event.target}`,
                  );
                }
                this.emitOrEvaluate(event, Date.now());
              } else if (this.debug) {
                console.log(
                  `[AdaptKit:dead-click] Suppressed — mutation detected near ${candidate.target.selector}`,
                );
              }
            },
          );
        } else if (this.debug) {
          console.log('[AdaptKit:dead-click] evaluated — no candidate');
        }
      }
    };
    this.clickHandler = handleClick;

    const handleFocusin = (e: Event) => {
      const envelope = buildFocusEnvelope(e as FocusEvent, this.selectorFn);
      this.enrichWithGraph(envelope);
      const now = Date.now();

      // Forward to behavior profiler — but skip if this focus was caused by a
      // keyboard navigation key (Tab/Enter/Space) within the last 50ms, since
      // the keydown handler already recorded it as 'keyboard'.
      if (now - this.lastKeyboardNavAt > 50) {
        this.behaviorProfiler?.recordInteraction('pointer', now);
      }
      if (envelope.target.adaptStep) {
        this.taskTracker?.recordStepInteraction(envelope.target.adaptStep, now);
        this.familiarityTracker?.recordVisit(envelope.target.adaptStep);
      }

      for (const sensor of focusSensors) {
        const result = sensor.process(envelope, now);
        if (this.debug) this.logSensorEvaluation(sensor, result);
        if (result) {
          this.emitOrEvaluate(result, now);
          return;
        }
      }
    };
    this.focusHandler = handleFocusin;

    const handleSubmit = (e: Event) => {
      const envelope = buildSubmitEnvelope(e, this.selectorFn);
      const now = Date.now();

      // Track successful submits for completion gating — discard buffered
      // events for the form itself and any elements inside it
      if (!envelope.target.defaultPrevented && !envelope.target.hasInvalidInputs) {
        if (this.contextEngine) {
          const selectors = [envelope.target.selector];
          try {
            const form = envelope.target.element;
            const children = form.querySelectorAll(
              '[data-adapt-role], [data-adapt-step], input, select, textarea, button',
            );
            for (const child of children) {
              selectors.push(this.selectorFn(child));
            }
          } catch {
            /* form might not support querySelectorAll */
          }
          this.contextEngine.trackCompletion(selectors);
        }

        // Mark step completed in task tracker on successful form submit
        if (this.taskTracker) {
          try {
            const form = envelope.target.element;
            const stepEl = form.closest('[data-adapt-step]');
            const step = stepEl?.getAttribute('data-adapt-step');
            if (step) {
              this.taskTracker.recordStepInteraction(step, now);
              this.taskTracker.markStepCompleted(step);
            }
          } catch {
            /* closest might not be available */
          }
        }
      }

      for (const sensor of submitSensors) {
        const result = sensor.process(envelope, now);
        if (this.debug) this.logSensorEvaluation(sensor, result);
        if (result) {
          this.emitOrEvaluate(result, now);
          return;
        }
      }
    };
    this.submitHandler = handleSubmit;

    const handleInput = (e: Event) => {
      const envelope = buildInputEnvelope(e, this.selectorFn, this.privacy);
      if (!envelope) return;
      const now = Date.now();

      // Detect preceding keyboard shortcut (Ctrl+A/X/Z) for input resignation exclusion
      envelope.target.precedingShortcut = detectShortcut(this.recentKeys, now);

      for (const sensor of inputSensors) {
        const result = sensor.process(envelope, now);
        if (this.debug) this.logSensorEvaluation(sensor, result);
        if (result) {
          this.emitOrEvaluate(result, now);
          return;
        }
      }
    };
    this.inputHandler = handleInput;

    // Suppression signal listeners
    const handleScroll = () => {
      const now = Date.now();
      this.contextEngine?.trackActivity('scroll', now);
      this.behaviorProfiler?.recordScroll(typeof window !== 'undefined' ? window.scrollY : 0, now);
    };

    this.scrollHandler = handleScroll;

    const handleKeydown = (e: Event) => {
      const ke = e as KeyboardEvent;

      // Record recent keydown for shortcut detection (input resignation exclusion)
      this.recentKeys.push({
        key: ke.key,
        ctrlKey: ke.ctrlKey,
        metaKey: ke.metaKey,
        timestamp: Date.now(),
      });
      while (this.recentKeys.length > RECENT_KEYS_MAX) {
        this.recentKeys.shift();
      }

      // Forward Tab/navigation keys to behavior profiler for keyboard-first detection
      if (ke.key === 'Tab' || ke.key === 'Enter' || ke.key === ' ') {
        const now = Date.now();
        this.lastKeyboardNavAt = now;
        this.behaviorProfiler?.recordInteraction('keyboard', now);
      }

      // Tab/Shift+Tab are navigation keys — they should NOT suppress form-thrashing,
      // since Tab-based field cycling IS the canonical form-thrashing pattern
      if (ke.key === 'Tab') return;
      this.contextEngine?.trackActivity('keydown', Date.now());
    };
    this.keydownHandler = handleKeydown;

    document.addEventListener('click', this.clickHandler, { passive: true });
    document.addEventListener('focusin', this.focusHandler, { passive: true });
    document.addEventListener('submit', this.submitHandler, { passive: true });
    document.addEventListener('input', this.inputHandler, { passive: true });
    document.addEventListener('scroll', this.scrollHandler, { passive: true, capture: true });
    document.addEventListener('keydown', this.keydownHandler, { passive: true });
  }

  stop(): void {
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
      this.clickHandler = null;
    }
    if (this.focusHandler) {
      document.removeEventListener('focusin', this.focusHandler);
      this.focusHandler = null;
    }
    if (this.submitHandler) {
      document.removeEventListener('submit', this.submitHandler);
      this.submitHandler = null;
    }
    if (this.inputHandler) {
      document.removeEventListener('input', this.inputHandler);
      this.inputHandler = null;
    }
    if (this.scrollHandler) {
      document.removeEventListener('scroll', this.scrollHandler, {
        capture: true,
      } as EventListenerOptions);
      this.scrollHandler = null;
    }
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    if (this.deadClickSensor) {
      this.deadClickSensor.reset();
    }

    for (const sensor of this.sensors) {
      sensor.reset();
    }
  }

  /** Reset all sensor state without removing event listeners.
   *  Used by AdaptKit.reset() for SPA route changes. */
  resetSensors(): void {
    for (const sensor of this.sensors) {
      sensor.reset();
    }
    if (this.deadClickSensor) {
      this.deadClickSensor.reset();
    }
    this.recentKeys = [];
    this.behaviorProfiler?.reset();
    this.taskTracker?.reset();
    this.familiarityTracker?.resetSession();
  }

  /** Route result through context engine if available, else emit directly. */
  private emitOrEvaluate(result: FrictionEvent, now: number): void {
    if (this.contextEngine) {
      this.contextEngine.evaluate(result, now);
    } else {
      this.bus.emit(result);
    }
  }

  private enrichWithGraph(envelope: ClickEnvelope | FocusEnvelope): void {
    if (!this.graph) return;
    const node = this.graph.resolve(envelope.target.element);
    if (!node) return;
    envelope.target.semanticNodeId = node.id;
    envelope.target.semanticModifier = node.modifier;
    if (node.role) envelope.target.adaptRole = node.role;
    if (node.step) envelope.target.adaptStep = node.step;
  }

  private logSensorEvaluation(sensor: Sensor, result: FrictionEvent | null): void {
    if (result) {
      console.log(`[AdaptKit:${sensor.id}] FIRED — ${result.type} on ${result.target}`);
    } else {
      console.log(`[AdaptKit:${sensor.id}] evaluated — no emission`);
    }
  }
}
