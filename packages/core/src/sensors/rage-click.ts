import type { Sensor, SensorEnvelope, ClickEnvelope, FrictionEvent } from '../types.js';
import {
  RAGE_CLICK_COUNT,
  RAGE_CLICK_WINDOW_MS,
  RAGE_CLICK_COOLDOWN_MS,
  RAGE_CLICK_BUFFER_MAX,
} from '../constants.js';
import { FRICTION_EVENTS } from '../types.js';

interface BufferEntry {
  selector: string;
  timestamp: number;
}

export interface RageClickConfig {
  count?: number;
  windowMs?: number;
  cooldownMs?: number;
}

export class RageClickSensor implements Sensor {
  readonly id = 'rage-click';
  readonly accepts = ['click'] as const;

  private readonly count: number;
  private readonly windowMs: number;
  private readonly cooldownMs: number;

  private buffer: BufferEntry[] = [];
  private cooldownUntil = 0;

  constructor(config?: RageClickConfig) {
    this.count = config?.count ?? RAGE_CLICK_COUNT;
    this.windowMs = config?.windowMs ?? RAGE_CLICK_WINDOW_MS;
    this.cooldownMs = config?.cooldownMs ?? RAGE_CLICK_COOLDOWN_MS;
  }

  process(envelope: SensorEnvelope, now: number): FrictionEvent | null {
    if (envelope.kind !== 'click') return null;
    const click = envelope as ClickEnvelope;

    if (now < this.cooldownUntil) return null;

    // Triple-click is "select paragraph" — a standard browser behavior, not friction
    if (click.target.detail >= 3) return null;

    this.buffer.push({
      selector: click.target.selector,
      timestamp: now,
    });

    while (this.buffer.length > RAGE_CLICK_BUFFER_MAX) {
      this.buffer.shift();
    }

    const cutoff = now - this.windowMs;
    this.buffer = this.buffer.filter((entry) => entry.timestamp >= cutoff);

    const groups = new Map<string, BufferEntry[]>();
    for (const entry of this.buffer) {
      let group = groups.get(entry.selector);
      if (!group) {
        group = [];
        groups.set(entry.selector, group);
      }
      group.push(entry);
    }

    let maxGroup: BufferEntry[] | null = null;
    for (const group of groups.values()) {
      if (!maxGroup || group.length > maxGroup.length) {
        maxGroup = group;
      }
    }

    if (maxGroup && maxGroup.length >= this.count) {
      const first = maxGroup[0];
      const last = maxGroup[maxGroup.length - 1];
      const windowMs = last.timestamp - first.timestamp;

      const event: FrictionEvent = {
        type: FRICTION_EVENTS.RAGE_CLICK,
        target: maxGroup[0].selector,
        timestamp: now,
        ruleId: 'rage-click-v1',
        metrics: {
          clickCount: maxGroup.length,
          windowMs,
          targetTag: click.target.tag,
        },
        semantic:
          click.target.adaptRole || click.target.adaptStep
            ? {
                nodeId: click.target.semanticNodeId,
                role: click.target.adaptRole,
                modifier: click.target.semanticModifier,
                step: click.target.adaptStep,
              }
            : null,
      };

      this.buffer = [];
      this.cooldownUntil = now + this.cooldownMs;
      return event;
    }

    return null;
  }

  reset(): void {
    this.buffer = [];
    this.cooldownUntil = 0;
  }
}
