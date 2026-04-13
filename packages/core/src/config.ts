import type { ThresholdOverrides } from './types.js';
import * as C from './constants.js';

export const DEFAULT_THRESHOLDS: ThresholdOverrides = {
  rageClickCount: C.RAGE_CLICK_COUNT,
  rageClickWindowMs: C.RAGE_CLICK_WINDOW_MS,
  rageClickCooldownMs: C.RAGE_CLICK_COOLDOWN_MS,
  deadClickCooldownMs: C.DEAD_CLICK_COOLDOWN_MS,
  deadClickMutationWindowMs: C.DEAD_CLICK_MUTATION_WINDOW_MS,
  blockedIntentSubmitWindowMs: C.BLOCKED_INTENT_SUBMIT_WINDOW_MS,
  blockedIntentSubmitCooldownMs: C.BLOCKED_INTENT_SUBMIT_COOLDOWN_MS,
  blockedIntentClickWindowMs: C.BLOCKED_INTENT_CLICK_WINDOW_MS,
  blockedIntentClickCooldownMs: C.BLOCKED_INTENT_CLICK_COOLDOWN_MS,
  formThrashWindowMs: C.FORM_THRASH_WINDOW_MS,
  formThrashMinRevisits: C.FORM_THRASH_MIN_REVISITS,
  formThrashMinFields: C.FORM_THRASH_MIN_FIELDS,
  formThrashCooldownMs: C.FORM_THRASH_COOLDOWN_MS,
  resignationRatio: C.RESIGNATION_RATIO,
  resignationWindowMs: C.RESIGNATION_WINDOW_MS,
  resignationCooldownMs: C.RESIGNATION_COOLDOWN_MS,
  frustrationTextCooldownMs: C.FRUSTRATION_TEXT_COOLDOWN_MS,
  completionWindowMs: 2_000,
  emissionFloor: 0.55,
  maxEventsPerMinute: 0,
  // Behavior Profiling
  behaviorRapidTempoMs: C.BEHAVIOR_RAPID_TEMPO_MS,
  behaviorDeliberateTempoMs: C.BEHAVIOR_DELIBERATE_TEMPO_MS,
  behaviorKeyboardFirstMinEvents: C.BEHAVIOR_KEYBOARD_FIRST_MIN_EVENTS,
  behaviorKeyboardFirstRatio: C.BEHAVIOR_KEYBOARD_FIRST_RATIO,
  behaviorKeyboardFirstHysteresisLow: C.BEHAVIOR_KEYBOARD_FIRST_HYSTERESIS_LOW,
  behaviorChangeDebouncMs: C.BEHAVIOR_CHANGE_DEBOUNCE_MS,
  scrollScanningVelocity: C.SCROLL_SCANNING_VELOCITY,
  scrollReadingVelocityMax: C.SCROLL_READING_VELOCITY_MAX,
  scrollSearchDirectionChangesMin: C.SCROLL_SEARCH_DIRECTION_CHANGES_MIN,
  scrollWindowMs: C.SCROLL_WINDOW_MS,
  // Friction Level Derivation
  frictionHighConfidence: C.FRICTION_HIGH_CONFIDENCE,
  frictionSustainedWindowMs: C.FRICTION_SUSTAINED_WINDOW_MS,
  frictionSustainedMinEvents: C.FRICTION_SUSTAINED_MIN_EVENTS,
};

export function resolveThresholds(overrides?: Partial<ThresholdOverrides>): ThresholdOverrides {
  if (!overrides) return { ...DEFAULT_THRESHOLDS };
  return { ...DEFAULT_THRESHOLDS, ...overrides };
}
