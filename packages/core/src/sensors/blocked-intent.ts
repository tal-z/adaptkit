import type {
  Sensor,
  SensorEnvelope,
  ClickEnvelope,
  SubmitEnvelope,
  FrictionEvent,
} from '../types.js';
import {
  BLOCKED_INTENT_SUBMIT_WINDOW_MS,
  BLOCKED_INTENT_SUBMIT_COOLDOWN_MS,
  BLOCKED_INTENT_CLICK_WINDOW_MS,
  BLOCKED_INTENT_CLICK_COOLDOWN_MS,
} from '../constants.js';
import { FRICTION_EVENTS } from '../types.js';

interface LastClick {
  selector: string;
  element: Element;
  timestamp: number;
}

interface FailedSubmit {
  selector: string;
  timestamp: number;
}

export interface BlockedIntentConfig {
  submitWindowMs?: number;
  submitCooldownMs?: number;
  clickWindowMs?: number;
  clickCooldownMs?: number;
}

export class BlockedIntentSensor implements Sensor {
  readonly id = 'blocked-intent';
  readonly accepts = ['click', 'submit'] as const;

  private readonly submitWindowMs: number;
  private readonly submitCooldownMs: number;
  private readonly clickWindowMs: number;
  private readonly clickCooldownMs: number;

  private lastClick: LastClick | null = null;
  private clickCooldownUntil = 0;
  private failedSubmits = new Map<string, FailedSubmit>();
  private submitCooldownUntil = 0;

  constructor(config?: BlockedIntentConfig) {
    this.submitWindowMs = config?.submitWindowMs ?? BLOCKED_INTENT_SUBMIT_WINDOW_MS;
    this.submitCooldownMs = config?.submitCooldownMs ?? BLOCKED_INTENT_SUBMIT_COOLDOWN_MS;
    this.clickWindowMs = config?.clickWindowMs ?? BLOCKED_INTENT_CLICK_WINDOW_MS;
    this.clickCooldownMs = config?.clickCooldownMs ?? BLOCKED_INTENT_CLICK_COOLDOWN_MS;
  }

  process(envelope: SensorEnvelope, now: number): FrictionEvent | null {
    if (envelope.kind === 'submit') return this.processSubmit(envelope as SubmitEnvelope, now);
    if (envelope.kind === 'click') return this.processClick(envelope as ClickEnvelope, now);
    return null;
  }

  private processSubmit(envelope: SubmitEnvelope, now: number): FrictionEvent | null {
    const target = envelope.target;
    const isFailure = target.defaultPrevented || target.hasInvalidInputs;

    if (!isFailure) {
      this.failedSubmits.delete(target.selector);
      return null;
    }

    if (now >= this.submitCooldownUntil) {
      const prev = this.failedSubmits.get(target.selector);
      if (prev && now - prev.timestamp <= this.submitWindowMs) {
        this.failedSubmits.delete(target.selector);
        this.submitCooldownUntil = now + this.submitCooldownMs;

        return {
          type: FRICTION_EVENTS.BLOCKED_INTENT,
          target: target.selector,
          timestamp: now,
          ruleId: 'blocked-intent-submit-v1',
          metrics: {
            subtype: 'form_submission',
            timeSinceFirstAttemptMs: now - prev.timestamp,
            defaultPrevented: target.defaultPrevented ? 'true' : 'false',
            hasInvalidInputs: target.hasInvalidInputs ? 'true' : 'false',
          },
          semantic: null,
        };
      }
    }

    this.failedSubmits.set(target.selector, { selector: target.selector, timestamp: now });
    return null;
  }

  private processClick(envelope: ClickEnvelope, now: number): FrictionEvent | null {
    const target = envelope.target;

    if (!target.isInteractive) {
      this.lastClick = null;
      return null;
    }

    if (
      now >= this.clickCooldownUntil &&
      this.lastClick &&
      this.lastClick.element === target.element &&
      !envelope.domChangedSinceLastClick &&
      now - this.lastClick.timestamp <= this.clickWindowMs
    ) {
      const timeSinceMs = now - this.lastClick.timestamp;
      this.lastClick = null;
      this.clickCooldownUntil = now + this.clickCooldownMs;

      return {
        type: FRICTION_EVENTS.BLOCKED_INTENT,
        target: target.selector,
        timestamp: now,
        ruleId: 'blocked-intent-click-v1',
        metrics: {
          subtype: 'action_unresponsive',
          timeSinceFirstClickMs: timeSinceMs,
          targetTag: target.tag,
          targetText: target.text,
          interactiveReason: target.interactiveReason ?? 'unknown',
        },
        semantic:
          target.adaptRole || target.adaptStep
            ? {
                nodeId: target.semanticNodeId,
                role: target.adaptRole,
                modifier: target.semanticModifier,
                step: target.adaptStep,
              }
            : null,
      };
    }

    this.lastClick = { selector: target.selector, element: target.element, timestamp: now };
    return null;
  }

  reset(): void {
    this.lastClick = null;
    this.clickCooldownUntil = 0;
    this.failedSubmits.clear();
    this.submitCooldownUntil = 0;
  }
}
