import type { Sensor, SensorEnvelope, InputEnvelope, FrictionEvent } from '../types.js';
import { RESIGNATION_RATIO, RESIGNATION_WINDOW_MS, RESIGNATION_COOLDOWN_MS } from '../constants.js';
import { FRICTION_EVENTS } from '../types.js';

interface FieldState {
  peakLength: number;
  deletionStartTime: number;
  lastLength: number;
}

export interface InputResignationConfig {
  ratio?: number;
  windowMs?: number;
  cooldownMs?: number;
}

export class InputResignationSensor implements Sensor {
  readonly id = 'input-resignation';
  readonly accepts = ['input'] as const;

  private readonly ratio: number;
  private readonly windowMs: number;
  private readonly cooldownMs: number;

  private fields = new WeakMap<Element, FieldState>();
  private cooldownUntil = 0;

  constructor(config?: InputResignationConfig) {
    this.ratio = config?.ratio ?? RESIGNATION_RATIO;
    this.windowMs = config?.windowMs ?? RESIGNATION_WINDOW_MS;
    this.cooldownMs = config?.cooldownMs ?? RESIGNATION_COOLDOWN_MS;
  }

  process(envelope: SensorEnvelope, now: number): FrictionEvent | null {
    if (envelope.kind !== 'input') return null;
    const input = envelope as InputEnvelope;

    if (now < this.cooldownUntil) return null;

    const target = input.target;
    let field = this.fields.get(target.element);
    if (!field) {
      field = { peakLength: 0, deletionStartTime: 0, lastLength: 0 };
      this.fields.set(target.element, field);
    }

    const newLen = target.bufferLength;
    const prevLen = field.lastLength;
    field.lastLength = newLen;

    if (newLen >= prevLen) {
      if (newLen > field.peakLength) field.peakLength = newLen;
      field.deletionStartTime = 0;
      return null;
    }

    if (field.deletionStartTime === 0) field.deletionStartTime = now;
    if (field.peakLength === 0) return null;

    const deletionRatio = (field.peakLength - newLen) / field.peakLength;
    const deltaMs = now - field.deletionStartTime;

    if (deletionRatio >= this.ratio && deltaMs <= this.windowMs) {
      // Suppress if preceded by a keyboard shortcut (Select All, Cut, Undo)
      // These indicate intentional editing, not frustration
      const shortcut = input.target.precedingShortcut;
      if (shortcut === 'selectAll' || shortcut === 'cut' || shortcut === 'undo') {
        field.peakLength = newLen;
        field.deletionStartTime = 0;
        return null;
      }

      const result: FrictionEvent = {
        type: FRICTION_EVENTS.INPUT_RESIGNATION,
        target: target.selector,
        timestamp: now,
        ruleId: 'input-resignation-v1',
        metrics: {
          deletionRatio: Math.round(deletionRatio * 100) / 100,
          deletedChars: field.peakLength - newLen,
          peakLength: field.peakLength,
          deltaMs,
        },
        semantic: null,
      };

      field.peakLength = newLen;
      field.deletionStartTime = 0;
      this.cooldownUntil = now + this.cooldownMs;
      return result;
    }

    return null;
  }

  reset(): void {
    this.fields = new WeakMap();
    this.cooldownUntil = 0;
  }
}
