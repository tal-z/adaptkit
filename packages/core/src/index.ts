import type {
  FrictionEvent,
  FrictionEventType,
  AdaptKitConfig,
  SemanticNode,
  AdaptKitEvent,
  ContextChangeEvent,
  ContextEventType,
  EnvironmentContext,
  BehaviorContext,
  FamiliarityContext,
  TaskContext,
  FrictionContext,
  AdaptContext,
} from './types.js';
import { FRICTION_EVENTS, CONTEXT_EVENTS } from './types.js';
import { ActionBus } from './bus.js';
import { EventCollector } from './collector.js';
import { getSelector } from './selector.js';
import type { PrivacyOptions } from './envelopes.js';
import { SemanticGraph } from './semantic-graph.js';
import { MutationTracker } from './mutation-tracker.js';
import { resolveThresholds } from './config.js';
import { ContextEngine } from './context-engine.js';
import { EnvironmentDetector } from './environment.js';
import { BehaviorProfiler } from './behavior.js';
import { FamiliarityTracker } from './familiarity.js';
import { TaskTracker } from './task.js';
import { ContextAggregator } from './context.js';
import {
  RageClickSensor,
  DeadClickSensor,
  FormThrashSensor,
  BlockedIntentSensor,
  FrustrationTextSensor,
  InputResignationSensor,
} from './sensors/index.js';

interface AdaptKitInstance {
  start(config?: AdaptKitConfig): void;
  stop(): void;
  /** Clear sensor state for a new session (e.g., SPA route change).
   *  Keeps listeners and subscribers active. No-op if not started. */
  reset(): void;
  on(eventType: string, handler: (event: AdaptKitEvent) => void): () => void;
  off(eventType: string, handler: (event: AdaptKitEvent) => void): void;
  /** Get the current semantic graph snapshot. Returns null if not started. */
  getGraph(): { nodes: SemanticNode[] } | null;
  /** Get current adaptive context, optionally scoped to a step/component. */
  getContext(scope?: string): AdaptContext;
  /** Get current environment context (convenience, equivalent to getContext().environment). */
  getEnvironment(): EnvironmentContext;
  /** Record a visit to a scope. Called automatically by useFamiliarity() — call this
   *  manually in vanilla JS when a scoped view becomes active. */
  recordVisit(scope: string): void;
  /** Signal that a user completed a task/step (updates familiarity + task state). */
  markCompleted(scope: string): void;
  /** Override specific environment values for simulation/demo purposes.
   *  Real detection continues in the background. */
  overrideEnvironment(overrides: Partial<EnvironmentContext>): void;
  /** Clear all environment overrides, restoring detected values. */
  clearEnvironmentOverrides(): void;
  /** Clear familiarity data. If scope is provided, clears only that scope.
   *  If no scope, clears all familiarity data from localStorage. */
  resetFamiliarity(scope?: string): void;
}

let bus: ActionBus | null = null;
let collector: EventCollector | null = null;
let graph: SemanticGraph | null = null;
let mutationTracker: MutationTracker | null = null;
let contextEngine: ContextEngine | null = null;
let environmentDetector: EnvironmentDetector | null = null;
let behaviorProfiler: BehaviorProfiler | null = null;
let familiarityTracker: FamiliarityTracker | null = null;
let taskTracker: TaskTracker | null = null;
let contextAggregator: ContextAggregator | null = null;
let frictionSubscription: (() => void) | null = null;
let running = false;

function ensureBus(): ActionBus {
  if (!bus) {
    bus = new ActionBus();
  }
  return bus;
}

function start(config?: AdaptKitConfig): void {
  if (running) {
    console.warn('[AdaptKit] Already running. Call stop() first.');
    return;
  }

  const activeBus = ensureBus();
  const debug =
    config?.debug ??
    (typeof location !== 'undefined' &&
      (location.hostname === 'localhost' || location.hostname === '127.0.0.1'));
  const t = resolveThresholds(config?.thresholds);
  const privacy: PrivacyOptions = {
    collectTargetText: config?.collectTargetText ?? false,
    piiFilter: config?.piiFilter,
  };

  // Build the Semantic Graph from DOM instrumentation
  graph = new SemanticGraph(getSelector, debug);
  graph.build();
  graph.observe();

  // Synchronous sensor chain — order matters for mutual exclusion:
  // Click:  rage-click → blocked-intent (dead-click is now async, handled separately)
  // Submit: form-thrash → blocked-intent
  const sensors = [
    new RageClickSensor({
      count: t.rageClickCount,
      windowMs: t.rageClickWindowMs,
      cooldownMs: t.rageClickCooldownMs,
    }),
    new FormThrashSensor({
      windowMs: t.formThrashWindowMs,
      minRevisits: t.formThrashMinRevisits,
      minFields: t.formThrashMinFields,
      cooldownMs: t.formThrashCooldownMs,
    }),
    new BlockedIntentSensor({
      submitWindowMs: t.blockedIntentSubmitWindowMs,
      submitCooldownMs: t.blockedIntentSubmitCooldownMs,
      clickWindowMs: t.blockedIntentClickWindowMs,
      clickCooldownMs: t.blockedIntentClickCooldownMs,
    }),
    new FrustrationTextSensor({ cooldownMs: t.frustrationTextCooldownMs }),
    new InputResignationSensor({
      ratio: t.resignationRatio,
      windowMs: t.resignationWindowMs,
      cooldownMs: t.resignationCooldownMs,
    }),
  ];

  // Dead click uses async post-click mutation window instead of handler detection
  const deadClickSensor = new DeadClickSensor({ cooldownMs: t.deadClickCooldownMs });

  // Mutation tracking: per-element DOM change detection for blocked-intent and dead-click
  mutationTracker = new MutationTracker(getSelector);
  mutationTracker.start(document.body);

  contextEngine = new ContextEngine(activeBus, t, debug, mutationTracker);

  // ─── New Modules ───

  environmentDetector = new EnvironmentDetector(activeBus);
  environmentDetector.start();

  behaviorProfiler = new BehaviorProfiler(activeBus, {
    rapidTempoMs: t.behaviorRapidTempoMs,
    deliberateTempoMs: t.behaviorDeliberateTempoMs,
    keyboardFirstMinEvents: t.behaviorKeyboardFirstMinEvents,
    keyboardFirstRatio: t.behaviorKeyboardFirstRatio,
    keyboardFirstHysteresisLow: t.behaviorKeyboardFirstHysteresisLow,
    changeDebouncMs: t.behaviorChangeDebouncMs,
    scrollScanningVelocity: t.scrollScanningVelocity,
    scrollReadingVelocityMax: t.scrollReadingVelocityMax,
    scrollSearchDirectionChangesMin: t.scrollSearchDirectionChangesMin,
    scrollWindowMs: t.scrollWindowMs,
  });

  familiarityTracker = new FamiliarityTracker(activeBus);

  taskTracker = new TaskTracker(activeBus);

  contextAggregator = new ContextAggregator(
    environmentDetector,
    behaviorProfiler,
    familiarityTracker,
    taskTracker,
    {
      highConfidence: t.frictionHighConfidence,
      sustainedWindowMs: t.frictionSustainedWindowMs,
      sustainedMinEvents: t.frictionSustainedMinEvents,
    },
  );

  // Subscribe to friction events for aggregation
  frictionSubscription = activeBus.on('*', (event) => {
    if ('ruleId' in event) {
      contextAggregator?.recordFrictionEvent(event as FrictionEvent);
    }
  });

  collector = new EventCollector(
    activeBus,
    sensors,
    getSelector,
    debug,
    privacy,
    graph,
    contextEngine,
    mutationTracker,
    deadClickSensor,
    t.deadClickMutationWindowMs,
    behaviorProfiler,
    taskTracker,
    familiarityTracker,
  );
  collector.start();
  running = true;
}

function stop(): void {
  if (collector) {
    collector.stop();
    collector = null;
  }
  if (mutationTracker) {
    mutationTracker.stop();
    mutationTracker = null;
  }
  if (graph) {
    graph.destroy();
    graph = null;
  }
  if (contextEngine) {
    contextEngine.flush();
    contextEngine.destroy();
    contextEngine = null;
  }
  if (environmentDetector) {
    environmentDetector.stop();
    environmentDetector = null;
  }
  if (behaviorProfiler) {
    behaviorProfiler.stop();
    behaviorProfiler = null;
  }
  if (frictionSubscription) {
    frictionSubscription();
    frictionSubscription = null;
  }
  familiarityTracker = null;
  taskTracker = null;
  contextAggregator = null;
  running = false;
}

function reset(): void {
  if (!running) return;
  collector?.resetSensors();
  contextEngine?.resetSession();
  mutationTracker?.cancelAllWatches();
  mutationTracker?.resetAfterClick();
  environmentDetector?.reset();
  behaviorProfiler?.reset();
  familiarityTracker?.resetSession();
  taskTracker?.reset();
  contextAggregator?.reset();

  // Emit a synthetic event so React hooks re-render with the reset state
  const activeBus = ensureBus();
  activeBus.emit({
    type: CONTEXT_EVENTS.FAMILIARITY_CHANGE,
    timestamp: Date.now(),
    field: 'reset',
    previousValue: null,
    currentValue: null,
  } as ContextChangeEvent);
}

function getGraph(): { nodes: SemanticNode[] } | null {
  return graph ? graph.toJSON() : null;
}

function getContext(scope?: string): AdaptContext {
  if (!contextAggregator) {
    // Return sensible defaults when not started
    return {
      environment: {
        inputModality: 'mouse',
        pointer: 'fine',
        hoverCapable: true,
        viewport: 'wide',
        connection: null,
        prefersReducedMotion: false,
        prefersHighContrast: false,
        colorScheme: null,
        deviceMemory: null,
      },
      friction: { level: 0, recentSignals: [], hasSignals: false },
      behavior: { interactionTempo: 'moderate', keyboardFirst: false, scrollBehavior: null },
      familiarity: { visitCount: 0, hasCompleted: false, isFirstVisit: true, lastVisitMs: null },
      task: {
        currentStep: null,
        timeInStep: 0,
        stepEnteredAt: null,
        completedSteps: [],
        abandonedAndReturned: false,
      },
    };
  }
  return contextAggregator.getContext(scope);
}

function getEnvironment(): EnvironmentContext {
  return getContext().environment;
}

function recordVisit(scope: string): void {
  familiarityTracker?.recordVisit(scope);
}

function markCompleted(scope: string): void {
  familiarityTracker?.markCompleted(scope);
  taskTracker?.markStepCompleted(scope);
}

function overrideEnvironment(overrides: Partial<EnvironmentContext>): void {
  environmentDetector?.overrideEnvironment(overrides);
}

function clearEnvironmentOverrides(): void {
  environmentDetector?.clearEnvironmentOverrides();
}

function resetFamiliarity(scope?: string): void {
  if (scope) {
    familiarityTracker?.resetScope(scope);
  } else {
    familiarityTracker?.reset();
  }
  // Emit FAMILIARITY_CHANGE so React hooks re-render
  const activeBus = ensureBus();
  activeBus.emit({
    type: CONTEXT_EVENTS.FAMILIARITY_CHANGE,
    timestamp: Date.now(),
    field: 'reset',
    previousValue: null,
    currentValue: null,
  } as ContextChangeEvent);
}

function on(eventType: string, handler: (event: AdaptKitEvent) => void): () => void {
  return ensureBus().on(eventType, handler);
}

function off(eventType: string, handler: (event: AdaptKitEvent) => void): void {
  ensureBus().off(eventType, handler);
}

const AdaptKit: AdaptKitInstance = {
  start,
  stop,
  reset,
  on,
  off,
  getGraph,
  getContext,
  getEnvironment,
  recordVisit,
  markCompleted,
  overrideEnvironment,
  clearEnvironmentOverrides,
  resetFamiliarity,
};

export default AdaptKit;
export { AdaptKit };
export type {
  FrictionEvent,
  FrictionEventType,
  AdaptKitConfig,
  SemanticNode,
  AdaptKitEvent,
  ContextChangeEvent,
  ContextEventType,
  EnvironmentContext,
  BehaviorContext,
  FamiliarityContext,
  TaskContext,
  FrictionContext,
  AdaptContext,
};
export { FRICTION_EVENTS, CONTEXT_EVENTS };
