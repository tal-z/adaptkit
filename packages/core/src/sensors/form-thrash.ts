import type { Sensor, SensorEnvelope, FocusEnvelope, FrictionEvent } from '../types.js';
import {
  FORM_THRASH_WINDOW_MS,
  FORM_THRASH_MIN_REVISITS,
  FORM_THRASH_MIN_FIELDS,
  FORM_THRASH_COOLDOWN_MS,
  FORM_THRASH_BUFFER_MAX,
} from '../constants.js';
import { FRICTION_EVENTS } from '../types.js';

interface BufferEntry {
  fieldId: number;
  selector: string;
  timestamp: number;
}

interface FormScope {
  focusBuffer: BufferEntry[];
  lastFieldId: number | null;
}

export interface FormThrashConfig {
  windowMs?: number;
  minRevisits?: number;
  minFields?: number;
  cooldownMs?: number;
}

const GLOBAL_SCOPE = '__global__';

export class FormThrashSensor implements Sensor {
  readonly id = 'form-thrash';
  readonly accepts = ['focusin', 'submit'] as const;

  private readonly windowMs: number;
  private readonly minRevisits: number;
  private readonly minFields: number;
  private readonly cooldownMs: number;

  private fieldIds = new WeakMap<Element, number>();
  private nextFieldId = 1;
  private scopes = new Map<string, FormScope>();
  private cooldownUntil = 0;

  constructor(config?: FormThrashConfig) {
    this.windowMs = config?.windowMs ?? FORM_THRASH_WINDOW_MS;
    this.minRevisits = config?.minRevisits ?? FORM_THRASH_MIN_REVISITS;
    this.minFields = config?.minFields ?? FORM_THRASH_MIN_FIELDS;
    this.cooldownMs = config?.cooldownMs ?? FORM_THRASH_COOLDOWN_MS;
  }

  process(envelope: SensorEnvelope, now: number): FrictionEvent | null {
    if (envelope.kind === 'submit') {
      // Submit clears all scopes (form-scope-specific clear could be added later)
      this.scopes.clear();
      this.cooldownUntil = 0;
      return null;
    }

    if (envelope.kind !== 'focusin') return null;
    const focus = envelope as FocusEnvelope;

    if (!focus.target.isFormField) return null;
    if (now < this.cooldownUntil) return null;

    let fieldId = this.fieldIds.get(focus.target.element);
    if (fieldId === undefined) {
      fieldId = this.nextFieldId++;
      this.fieldIds.set(focus.target.element, fieldId);
    }

    // Get or create form scope
    const scopeKey = focus.target.formSelector ?? GLOBAL_SCOPE;
    let scope = this.scopes.get(scopeKey);
    if (!scope) {
      scope = { focusBuffer: [], lastFieldId: null };
      this.scopes.set(scopeKey, scope);
    }

    // Deduplicate consecutive focus on same field within the same scope
    if (fieldId === scope.lastFieldId) return null;
    scope.lastFieldId = fieldId;

    scope.focusBuffer.push({ fieldId, selector: focus.target.selector, timestamp: now });

    while (scope.focusBuffer.length > FORM_THRASH_BUFFER_MAX) {
      scope.focusBuffer.shift();
    }

    const cutoff = now - this.windowMs;
    scope.focusBuffer = scope.focusBuffer.filter((entry) => entry.timestamp >= cutoff);

    const fieldCounts = new Map<number, number>();
    const fieldSelectors = new Map<number, string>();
    for (const entry of scope.focusBuffer) {
      fieldCounts.set(entry.fieldId, (fieldCounts.get(entry.fieldId) || 0) + 1);
      fieldSelectors.set(entry.fieldId, entry.selector);
    }

    let maxRevisits = 0;
    for (const count of fieldCounts.values()) {
      if (count > maxRevisits) maxRevisits = count;
    }
    const uniqueFields = fieldCounts.size;

    if (maxRevisits >= this.minRevisits && uniqueFields >= this.minFields) {
      const fields: string[] = [];
      for (const [fid, selector] of fieldSelectors) {
        if ((fieldCounts.get(fid) || 0) >= 1) fields.push(selector);
      }

      const first = scope.focusBuffer[0];
      const last = scope.focusBuffer[scope.focusBuffer.length - 1];
      const windowMs = last.timestamp - first.timestamp;

      const event: FrictionEvent = {
        type: FRICTION_EVENTS.FORM_THRASHING,
        target: focus.target.selector,
        timestamp: now,
        ruleId: 'form-thrash-v1',
        metrics: { fieldCount: uniqueFields, cycleCount: maxRevisits, windowMs, fields },
        semantic:
          focus.target.adaptRole || focus.target.adaptStep
            ? {
                nodeId: focus.target.semanticNodeId,
                role: focus.target.adaptRole,
                modifier: focus.target.semanticModifier,
                step: focus.target.adaptStep,
              }
            : null,
      };

      scope.focusBuffer = [];
      this.cooldownUntil = now + this.cooldownMs;
      return event;
    }

    return null;
  }

  reset(): void {
    this.scopes.clear();
    this.cooldownUntil = 0;
    this.fieldIds = new WeakMap();
    this.nextFieldId = 1;
  }
}
