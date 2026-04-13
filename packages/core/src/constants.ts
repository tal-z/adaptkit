// ─── Rage Click ───
export const RAGE_CLICK_COUNT = 3;
export const RAGE_CLICK_WINDOW_MS = 1_000;
export const RAGE_CLICK_COOLDOWN_MS = 1_000;
export const RAGE_CLICK_BUFFER_MAX = 20;

// ─── Dead Click ───
export const DEAD_CLICK_COOLDOWN_MS = 500;
export const DEAD_CLICK_MUTATION_WINDOW_MS = 300;
export const DEAD_CLICK_TEXT_MAX_LENGTH = 50;

// ─── Blocked Intent ───
export const BLOCKED_INTENT_SUBMIT_WINDOW_MS = 10_000;
export const BLOCKED_INTENT_SUBMIT_COOLDOWN_MS = 10_000;
export const BLOCKED_INTENT_CLICK_WINDOW_MS = 2_000;
export const BLOCKED_INTENT_CLICK_COOLDOWN_MS = 2_000;

// ─── Input Resignation ───
export const RESIGNATION_RATIO = 0.7; // 70% of text deleted
export const RESIGNATION_WINDOW_MS = 1_500; // within 1.5s
export const RESIGNATION_COOLDOWN_MS = 3_000;

// ─── Frustration Text ───
export const FRUSTRATION_TEXT_MIN_LENGTH = 3;
export const FRUSTRATION_TEXT_COOLDOWN_MS = 3_000;

// ─── Form Thrashing ───
export const FORM_THRASH_WINDOW_MS = 10_000;
export const FORM_THRASH_MIN_REVISITS = 4;
export const FORM_THRASH_MIN_FIELDS = 2;
export const FORM_THRASH_COOLDOWN_MS = 10_000;
export const FORM_THRASH_BUFFER_MAX = 30;

// ─── Behavior Profiling ───
export const BEHAVIOR_RAPID_TEMPO_MS = 400;
export const BEHAVIOR_DELIBERATE_TEMPO_MS = 1_500;
export const BEHAVIOR_KEYBOARD_FIRST_MIN_EVENTS = 20;
export const BEHAVIOR_KEYBOARD_FIRST_RATIO = 0.6;
export const BEHAVIOR_KEYBOARD_FIRST_HYSTERESIS_LOW = 0.4;
export const BEHAVIOR_CHANGE_DEBOUNCE_MS = 500;
export const SCROLL_SCANNING_VELOCITY = 2_000;
export const SCROLL_READING_VELOCITY_MAX = 800;
export const SCROLL_SEARCH_DIRECTION_CHANGES_MIN = 4;
export const SCROLL_WINDOW_MS = 3_000;

// ─── Friction Level Derivation ───
export const FRICTION_HIGH_CONFIDENCE = 0.7;
export const FRICTION_SUSTAINED_WINDOW_MS = 10_000;
export const FRICTION_SUSTAINED_MIN_EVENTS = 3;
