import type { Sensor, SensorEnvelope, InputEnvelope, FrictionEvent } from '../types.js';
import { FRUSTRATION_TEXT_MIN_LENGTH, FRUSTRATION_TEXT_COOLDOWN_MS } from '../constants.js';
import { FRICTION_EVENTS } from '../types.js';

// Ported from vibe-trace: 33 patterns grouped by category.
// Text is never stored in sensor state or emitted in events.
const FRUSTRATION_PATTERNS: RegExp[] = [
  /broken/i,
  /does ?n[o']?t work/i,
  /not working/i,
  /won[o']?t (work|load|open|submit|send|save)/i,
  /can[o']?t (find|figure|do|get|see|click|log|sign)/i,
  /why (is|does|won|can|isn|doesn|did|do)/i,
  /how (do i|the hell|the heck|tf|am i supposed)/i,
  /what the (hell|heck|fuck|f\b)/i,
  /\bfuck/i,
  /\bshit\b/i,
  /\bdamn(\s?it)?\b/i,
  /\bwtf+\b/i,
  /\bomf?g\b/i,
  /\bffs\b/i,
  /\bugh+\b/i,
  /\bargh+\b/i,
  /\bjfc\b/i,
  /frustrat/i,
  /makes? no sense/i,
  /this (sucks|is (terrible|awful|horrible|garbage|trash|ass|bad|buggy|slow))/i,
  /so (annoying|confusing|slow|bad|dumb)/i,
  /hate this/i,
  /\bstupid\b/i,
  /waste of time/i,
  /giv(e|ing) up/i,
  /nothing (works|happens|is happening)/i,
  /\bimpossible\b/i,
  /tried everything/i,
  /i[']?m (lost|confused|stuck)/i,
  /no idea (how|what|why|where)/i,
  /completely (lost|broken|useless)/i,
  /help me/i,
];

// Skip fields that are typically used for conversational/search input, not UI interaction
const SKIP_TYPES = new Set(['search']);
const SKIP_NAMES = /chat|message|comment/i;

// Minimum text length change before re-evaluating patterns (debounce)
const REEVALUATE_DELTA = 3;

// Minimum time a field must have been active before frustration text is evaluated
const MIN_FIELD_ACTIVE_MS = 5_000;

export interface FrustrationTextConfig {
  cooldownMs?: number;
}

export class FrustrationTextSensor implements Sensor {
  readonly id = 'frustration-text';
  readonly accepts = ['input'] as const;

  private readonly cooldownMs: number;
  private cooldownUntil = 0;
  private lastEvaluatedLength = new WeakMap<Element, number>();
  private fieldFirstSeen = new WeakMap<Element, number>();

  constructor(config?: FrustrationTextConfig) {
    this.cooldownMs = config?.cooldownMs ?? FRUSTRATION_TEXT_COOLDOWN_MS;
  }

  process(envelope: SensorEnvelope, now: number): FrictionEvent | null {
    if (envelope.kind !== 'input') return null;
    const input = envelope as InputEnvelope;

    if (now < this.cooldownUntil) return null;

    const el = input.target.element;

    // Track first seen time — always, even before other checks
    if (!this.fieldFirstSeen.has(el)) {
      this.fieldFirstSeen.set(el, now);
    }

    const text = input.target.text;
    if (text.length < FRUSTRATION_TEXT_MIN_LENGTH) return null;

    // Skip search and conversational fields
    if (this.shouldSkipField(el)) return null;

    // Only evaluate after field has been active for a while
    if (now - this.fieldFirstSeen.get(el)! < MIN_FIELD_ACTIVE_MS) return null;

    // Debounce: only re-evaluate when text length changes significantly
    const lastLen = this.lastEvaluatedLength.get(el) ?? 0;
    if (Math.abs(text.length - lastLen) < REEVALUATE_DELTA) return null;
    this.lastEvaluatedLength.set(el, text.length);

    const matched = matchFrustrationPattern(text);
    if (!matched) return null;

    this.cooldownUntil = now + this.cooldownMs;

    return {
      type: FRICTION_EVENTS.FRUSTRATION_TEXT,
      target: input.target.selector,
      timestamp: now,
      ruleId: 'frustration-text-v1',
      metrics: { matchedPattern: matched },
      semantic: null,
    };
  }

  reset(): void {
    this.cooldownUntil = 0;
    this.lastEvaluatedLength = new WeakMap();
    this.fieldFirstSeen = new WeakMap();
  }

  private shouldSkipField(el: Element): boolean {
    if (typeof el.getAttribute !== 'function') return false;
    const type = el.getAttribute('type')?.toLowerCase();
    if (type && SKIP_TYPES.has(type)) return true;
    const role = el.getAttribute('role')?.toLowerCase();
    if (role === 'search') return true;
    const name = el.getAttribute('name');
    if (name && SKIP_NAMES.test(name)) return true;
    return false;
  }
}

function matchFrustrationPattern(text: string): string | null {
  for (const pattern of FRUSTRATION_PATTERNS) {
    if (pattern.test(text)) return pattern.source;
  }
  return null;
}
