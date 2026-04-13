// ─── Envelopes (collector → sensor data transfer) ───

export interface ClickEnvelope {
  kind: 'click';
  timestamp: number;
  target: ClickTarget;
  /** Whether any DOM mutation was observed since the previous click.
   *  Set by the collector via MutationObserver. Default true (conservative). */
  domChangedSinceLastClick: boolean;
}

export interface ClickTarget {
  /** Reference to the resolved interactive element (for buffer identity comparison).
   *  NOT serializable — will be dropped if/when sensors move to a Worker.
   *  Sensors should prefer `selector` for logging but may use `element` for
   *  reference equality in short-lived buffers (rage click grouping). */
  element: Element;
  /** Pre-computed deterministic CSS selector */
  selector: string;
  /** Uppercase tag name: "BUTTON", "A", "DIV", etc. */
  tag: string;
  /** innerText, truncated to 50 chars */
  text: string;
  /** Whether this element is considered interactive (and why) */
  isInteractive: boolean;
  interactiveReason: string | null;
  /** MouseEvent.detail — 3 for triple-click (paragraph select), used to filter non-friction clicks */
  detail: number;
  /** Detection flags — all DOM inspection results pre-computed */
  hasHref: boolean;
  hrefValue: string | null;
  isDisabled: boolean;
  isInsideForm: boolean;
  isSubmitType: boolean;
  defaultPrevented: boolean;
  /** Semantic passthrough — included when present, null otherwise. */
  adaptRole: string | null;
  adaptStep: string | null;
  /** Resolved from Semantic Graph when available. */
  semanticNodeId: string | null;
  semanticModifier: string | null;
}

export interface FocusEnvelope {
  kind: 'focusin';
  timestamp: number;
  target: FocusTarget;
}

export interface FocusTarget {
  element: Element;
  selector: string;
  tag: string;
  /** Whether target is a form field (input, select, textarea) */
  isFormField: boolean;
  /** CSS selector of the nearest <form> ancestor, or null if not inside a form. */
  formSelector: string | null;
  adaptRole: string | null;
  adaptStep: string | null;
  /** Resolved from Semantic Graph when available. */
  semanticNodeId: string | null;
  semanticModifier: string | null;
}

export interface SubmitEnvelope {
  kind: 'submit';
  timestamp: number;
  target: SubmitTarget;
}

export interface SubmitTarget {
  /** Reference to the form element */
  element: Element;
  /** Pre-computed deterministic CSS selector for the form */
  selector: string;
  /** Whether event.preventDefault() was called by another handler */
  defaultPrevented: boolean;
  /** Whether the form contains inputs matching :invalid */
  hasInvalidInputs: boolean;
}

export interface InputEnvelope {
  kind: 'input';
  timestamp: number;
  target: InputTarget;
}

export interface InputTarget {
  element: Element;
  selector: string;
  tag: string;
  /** Current value length of the input */
  bufferLength: number;
  /** Current text value (for frustration text regex). Empty for password/PII fields. */
  text: string;
  /** Keyboard shortcut that preceded this input event (e.g., 'selectAll', 'cut', 'undo'), or null. */
  precedingShortcut: string | null;
}

export type SensorEnvelope = ClickEnvelope | FocusEnvelope | SubmitEnvelope | InputEnvelope;

// ─── Public Contract ───

export const FRICTION_EVENTS = {
  RAGE_CLICK: 'ADAPT_RAGE_CLICK',
  DEAD_CLICK: 'ADAPT_DEAD_CLICK',
  FORM_THRASHING: 'ADAPT_FORM_THRASHING',
  BLOCKED_INTENT: 'ADAPT_BLOCKED_INTENT',
  INPUT_RESIGNATION: 'ADAPT_INPUT_RESIGNATION',
  FRUSTRATION_TEXT: 'ADAPT_FRUSTRATION_TEXT',
} as const;

export type FrictionEventType = (typeof FRICTION_EVENTS)[keyof typeof FRICTION_EVENTS];

export interface FrictionEvent {
  /** Which friction signal fired */
  type: FrictionEventType;
  /** Deterministic CSS selector identifying the target element */
  target: string;
  /** Unix ms timestamp of emission */
  timestamp: number;
  /** Versioned rule identifier for debugging (e.g. "rage-click-v1") */
  ruleId: string;
  /** Raw metrics that caused the signal to fire — sensor-specific shape */
  metrics: Record<string, number | string | string[]>;
  /** Semantic context — resolved from the Semantic Graph when available,
   *  or from raw data-adapt-* attributes as fallback. */
  semantic: {
    nodeId: string | null;
    role: string | null;
    modifier: string | null;
    step: string | null;
  } | null;
  /** Signals that were evaluated but suppressed by mutual exclusion priority.
   *  Present only when this event caused lower-priority sensors to be skipped. */
  suppressedSignals?: Array<{ type: FrictionEventType; ruleId: string }>;
  /** Session ID — stable for the lifetime of a single start()/stop() cycle. */
  sessionId?: string;
  /** Monotonically increasing event index within the session. */
  eventIndex?: number;
}

export interface AdaptKitConfig {
  /** Log all sensor evaluations and events to console (default: false) */
  debug?: boolean;
  /** Override default thresholds for any sensor. Unspecified values use HCI-grounded defaults. */
  thresholds?: Partial<ThresholdOverrides>;
  /** When true, capture the first 50 characters of textContent on clicked elements
   *  into the targetText metric. Default: false (text is always empty). */
  collectTargetText?: boolean;
  /** Custom PII check. Called for every input and click event. Return true to treat
   *  the element as PII — text and bufferLength will be suppressed. Runs in addition
   *  to the built-in PII checks. */
  piiFilter?: (element: Element) => boolean;
}

export interface ThresholdOverrides {
  // Rage Click
  rageClickCount: number;
  rageClickWindowMs: number;
  rageClickCooldownMs: number;
  // Dead Click
  deadClickCooldownMs: number;
  deadClickMutationWindowMs: number;
  // Blocked Intent
  blockedIntentSubmitWindowMs: number;
  blockedIntentSubmitCooldownMs: number;
  blockedIntentClickWindowMs: number;
  blockedIntentClickCooldownMs: number;
  // Form Thrashing
  formThrashWindowMs: number;
  formThrashMinRevisits: number;
  formThrashMinFields: number;
  formThrashCooldownMs: number;
  // Input Resignation
  resignationRatio: number;
  resignationWindowMs: number;
  resignationCooldownMs: number;
  // Frustration Text
  frustrationTextCooldownMs: number;
  // Context Engine
  completionWindowMs: number;
  emissionFloor: number;
  /** Maximum events emitted per minute. 0 = unlimited. */
  maxEventsPerMinute: number;
  // Behavior Profiling
  behaviorRapidTempoMs: number;
  behaviorDeliberateTempoMs: number;
  behaviorKeyboardFirstMinEvents: number;
  behaviorKeyboardFirstRatio: number;
  behaviorKeyboardFirstHysteresisLow: number;
  behaviorChangeDebouncMs: number;
  scrollScanningVelocity: number;
  scrollReadingVelocityMax: number;
  scrollSearchDirectionChangesMin: number;
  scrollWindowMs: number;
  // Friction Level Derivation
  frictionHighConfidence: number;
  frictionSustainedWindowMs: number;
  frictionSustainedMinEvents: number;
}

// ─── Semantic Graph ───

export interface SemanticNode {
  /** Stable node ID. From data-adapt-id if present, otherwise CSS selector. */
  id: string;
  /** Base role from data-adapt-role (left of colon). */
  role: string | null;
  /** Validated modifier from data-adapt-role (right of colon). */
  modifier: string | null;
  /** Workflow step from data-adapt-step. */
  step: string | null;
  /** CSS selector for the DOM element. */
  selector: string;
  /** Parent semantic node ID (first ancestor with data-adapt-*). null for root nodes. */
  parentId: string | null;
  /** Child semantic node IDs. */
  children: string[];
}

// ─── Context Dimensions ───

export interface EnvironmentContext {
  /** Detected from actual pointer events — more accurate than media query alone */
  inputModality: 'mouse' | 'touch' | 'pen' | 'keyboard';
  /** From (pointer: coarse/fine) media query */
  pointer: 'coarse' | 'fine';
  /** From (hover: hover/none) media query */
  hoverCapable: boolean;
  /** Bucketed from window dimensions. Breakpoints: compact < 640px, medium < 1024px, wide >= 1024px */
  viewport: 'compact' | 'medium' | 'wide';
  /** From navigator.connection.effectiveType when available. Falls back to null. */
  connection: 'slow' | 'moderate' | 'fast' | null;
  /** From prefers-reduced-motion media query */
  prefersReducedMotion: boolean;
  /** From prefers-contrast media query */
  prefersHighContrast: boolean;
  /** From prefers-color-scheme media query */
  colorScheme: 'light' | 'dark' | null;
  /** From navigator.deviceMemory when available */
  deviceMemory: 'low' | 'moderate' | 'high' | null;
}

export interface BehaviorContext {
  /** Derived from inter-event timing distribution */
  interactionTempo: 'rapid' | 'moderate' | 'deliberate';
  /** True when keyboard navigation events significantly outnumber pointer events */
  keyboardFirst: boolean;
  /** Derived from scroll event velocity and pattern */
  scrollBehavior: 'scanning' | 'reading' | 'searching' | null;
}

export interface FamiliarityContext {
  /** Number of sessions that have included this scope */
  visitCount: number;
  /** Whether the user has completed this flow/step before */
  hasCompleted: boolean;
  /** Convenience: visitCount === 1 */
  isFirstVisit: boolean;
  /** Milliseconds since last session with this scope. null if first visit. */
  lastVisitMs: number | null;
}

export interface TaskContext {
  /** Currently active step (from most recent data-adapt-step interaction) */
  currentStep: string | null;
  /** Seconds spent on current step (snapshot value — use stepEnteredAt for a live counter) */
  timeInStep: number;
  /** Unix ms timestamp when the current step became active. Use this to compute a live
   *  elapsed-time counter in React: Math.round((Date.now() - stepEnteredAt) / 1000) */
  stepEnteredAt: number | null;
  /** Steps that have been marked complete this session */
  completedSteps: readonly string[];
  /** True if user left this flow (interacted with a different step) and came back */
  abandonedAndReturned: boolean;
}

export interface FrictionContext {
  /** Aggregate friction level for the current scope: 0 (none) to 3 (high) */
  level: 0 | 1 | 2 | 3;
  /** Most recent friction events (last 5) targeting this scope */
  recentSignals: readonly FrictionEvent[];
  /** Convenience: has any friction event fired on this scope in the current session */
  hasSignals: boolean;
}

export interface AdaptContext {
  environment: EnvironmentContext;
  friction: FrictionContext;
  behavior: BehaviorContext;
  familiarity: FamiliarityContext;
  task: TaskContext;
}

// ─── Context Change Events ───

export const CONTEXT_EVENTS = {
  ENVIRONMENT_CHANGE: 'ADAPT_ENVIRONMENT_CHANGE',
  BEHAVIOR_CHANGE: 'ADAPT_BEHAVIOR_CHANGE',
  FAMILIARITY_CHANGE: 'ADAPT_FAMILIARITY_CHANGE',
  STEP_CHANGE: 'ADAPT_STEP_CHANGE',
} as const;

export type ContextEventType = (typeof CONTEXT_EVENTS)[keyof typeof CONTEXT_EVENTS];

/** Base interface shared by all AdaptKit events. */
export interface AdaptKitEventBase {
  /** Event type identifier */
  type: string;
  /** Unix ms timestamp of emission */
  timestamp: number;
}

/** Emitted when an environment, behavior, familiarity, or task value changes. */
export interface ContextChangeEvent extends AdaptKitEventBase {
  type: ContextEventType;
  /** Which field within the context dimension changed */
  field: string;
  /** Value before the change */
  previousValue: unknown;
  /** Value after the change */
  currentValue: unknown;
}

/** Union of all event types that flow through the ActionBus. */
export type AdaptKitEvent = FrictionEvent | ContextChangeEvent;

// ─── Sensor Interface ───

export interface Sensor {
  readonly id: string;
  /** Which envelope kinds this sensor processes */
  readonly accepts: ReadonlyArray<SensorEnvelope['kind']>;
  /** Process an envelope. Return a FrictionEvent if threshold met, null otherwise. */
  process(envelope: SensorEnvelope, now: number): FrictionEvent | null;
  /** Clear all internal state (buffers, cooldowns, field maps). */
  reset(): void;
}
