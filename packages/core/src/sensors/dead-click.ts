import type { ClickEnvelope, FrictionEvent } from '../types.js';
import { DEAD_CLICK_COOLDOWN_MS } from '../constants.js';
import { FRICTION_EVENTS } from '../types.js';

const NATIVE_FORM_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

export interface DeadClickConfig {
  cooldownMs?: number;
}

/**
 * Dead click detection via post-click mutation window.
 *
 * Unlike other sensors, DeadClickSensor is NOT part of the synchronous sensor chain.
 * The collector calls `shouldEvaluate` to pre-filter, then uses MutationTracker's
 * `watchForMutation` to asynchronously check if the DOM changed near the clicked element.
 * If no mutation occurs within the window, `buildEvent` produces the FrictionEvent.
 */
export class DeadClickSensor {
  readonly id = 'dead-click';

  private readonly cooldownMs: number;
  private cooldowns = new Map<string, number>();
  private invocationCount = 0;

  constructor(config?: DeadClickConfig) {
    this.cooldownMs = config?.cooldownMs ?? DEAD_CLICK_COOLDOWN_MS;
  }

  /**
   * Synchronous pre-filter: returns the envelope if this click is a dead-click candidate,
   * or null if it should be skipped. Does NOT check for handlers — that's replaced by
   * the post-click mutation window in the collector.
   */
  shouldEvaluate(envelope: ClickEnvelope, now: number): ClickEnvelope | null {
    const target = envelope.target;

    this.invocationCount++;

    if (this.invocationCount % 10 === 0) {
      for (const [key, expiry] of this.cooldowns) {
        if (expiry <= now) this.cooldowns.delete(key);
      }
    }

    if (!target.isInteractive) return null;

    const cooldownExpiry = this.cooldowns.get(target.selector);
    if (cooldownExpiry !== undefined && cooldownExpiry > now) return null;

    if (target.defaultPrevented) return null;
    if (target.hasHref && isMeaningfulHref(target.hrefValue)) return null;
    if (target.isSubmitType && target.isInsideForm) return null;
    if (target.isDisabled) return null;
    if (NATIVE_FORM_TAGS.has(target.tag)) return null;

    return envelope;
  }

  /**
   * Build the FrictionEvent for a confirmed dead click (no mutation occurred within the window).
   * Also sets the cooldown for this selector.
   */
  buildEvent(envelope: ClickEnvelope, now: number): FrictionEvent {
    const target = envelope.target;
    this.cooldowns.set(target.selector, now + this.cooldownMs);

    return {
      type: FRICTION_EVENTS.DEAD_CLICK,
      target: target.selector,
      timestamp: now,
      ruleId: 'dead-click-v2',
      metrics: {
        targetTag: target.tag,
        targetText: target.text,
        interactiveReason: target.interactiveReason ?? 'unknown',
        isDisabled: target.isDisabled ? 'true' : 'false',
        isInsideForm: target.isInsideForm ? 'true' : 'false',
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

  reset(): void {
    this.cooldowns.clear();
    this.invocationCount = 0;
  }
}

function isMeaningfulHref(href: string | null): boolean {
  if (href === null || href === '' || href === '#') return false;
  if (href.startsWith('javascript:')) return false;
  return true;
}
