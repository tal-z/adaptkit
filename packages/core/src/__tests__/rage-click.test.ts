import { describe, it, expect, beforeEach } from 'vitest';
import { RageClickSensor } from '../sensors/rage-click.js';
import { clickEnvelope, stubElement } from './helpers.js';
// Constants used by the sensor (referenced in test comments for threshold documentation)

describe('RageClickSensor', () => {
  let sensor: RageClickSensor;

  beforeEach(() => {
    sensor = new RageClickSensor();
  });

  it('should fire on 3 clicks on the same element within 1000ms', () => {
    const sel = 'button#btn';
    const result1 = sensor.process(clickEnvelope({ selector: sel, timestamp: 0 }), 0);
    const result2 = sensor.process(clickEnvelope({ selector: sel, timestamp: 300 }), 300);
    const result3 = sensor.process(clickEnvelope({ selector: sel, timestamp: 600 }), 600);
    expect(result1).toBeNull();
    expect(result2).toBeNull();
    expect(result3).not.toBeNull();
    expect(result3!.type).toBe('ADAPT_RAGE_CLICK');
  });

  it('should NOT fire on 2 clicks within 1000ms', () => {
    const sel = 'button#btn';
    const result1 = sensor.process(clickEnvelope({ selector: sel, timestamp: 0 }), 0);
    const result2 = sensor.process(clickEnvelope({ selector: sel, timestamp: 500 }), 500);
    expect(result1).toBeNull();
    expect(result2).toBeNull();
  });

  it('should NOT fire when 3 clicks span more than 1000ms', () => {
    const sel = 'button#btn';
    sensor.process(clickEnvelope({ selector: sel, timestamp: 0 }), 0);
    sensor.process(clickEnvelope({ selector: sel, timestamp: 500 }), 500);
    // Third click is at 1001ms — first click at 0ms is outside window (1001 - 1000 = 1)
    const result = sensor.process(clickEnvelope({ selector: sel, timestamp: 1001 }), 1001);
    expect(result).toBeNull();
  });

  it('should NOT fire when 3 clicks are on different elements', () => {
    const result1 = sensor.process(clickEnvelope({ selector: 'button#a', timestamp: 0 }), 0);
    const result2 = sensor.process(clickEnvelope({ selector: 'button#b', timestamp: 300 }), 300);
    const result3 = sensor.process(clickEnvelope({ selector: 'button#c', timestamp: 600 }), 600);
    expect(result1).toBeNull();
    expect(result2).toBeNull();
    expect(result3).toBeNull();
  });

  it('should fire once on 4 clicks (buffer cleared after fire)', () => {
    const sel = 'button#btn';
    sensor.process(clickEnvelope({ selector: sel, timestamp: 0 }), 0);
    sensor.process(clickEnvelope({ selector: sel, timestamp: 200 }), 200);
    const result3 = sensor.process(clickEnvelope({ selector: sel, timestamp: 400 }), 400);
    expect(result3).not.toBeNull();
    // 4th click is during cooldown
    const result4 = sensor.process(clickEnvelope({ selector: sel, timestamp: 600 }), 600);
    expect(result4).toBeNull();
  });

  it('should fire exactly once on a rapid 6-click burst (cooldown)', () => {
    const sel = 'button#btn';
    let fires = 0;
    for (let i = 0; i < 6; i++) {
      const t = i * 100;
      const result = sensor.process(clickEnvelope({ selector: sel, timestamp: t }), t);
      if (result) fires++;
    }
    expect(fires).toBe(1);
  });

  it('should handle >20 clicks without errors (buffer max)', () => {
    const sel = 'button#btn';
    expect(() => {
      for (let i = 0; i < 25; i++) {
        sensor.process(clickEnvelope({ selector: sel, timestamp: i * 10 }), i * 10);
      }
    }).not.toThrow();
  });

  it('should clear buffer and cooldown on reset()', () => {
    const sel = 'button#btn';
    sensor.process(clickEnvelope({ selector: sel, timestamp: 0 }), 0);
    sensor.process(clickEnvelope({ selector: sel, timestamp: 200 }), 200);
    const fire = sensor.process(clickEnvelope({ selector: sel, timestamp: 400 }), 400);
    expect(fire).not.toBeNull();

    sensor.reset();

    // Should be able to fire again immediately with fresh clicks
    sensor.process(clickEnvelope({ selector: sel, timestamp: 500 }), 500);
    sensor.process(clickEnvelope({ selector: sel, timestamp: 600 }), 600);
    const fire2 = sensor.process(clickEnvelope({ selector: sel, timestamp: 700 }), 700);
    expect(fire2).not.toBeNull();
  });

  it('should report correct clickCount and windowMs in metrics', () => {
    const sel = 'button#btn';
    sensor.process(clickEnvelope({ selector: sel, timestamp: 100 }), 100);
    sensor.process(clickEnvelope({ selector: sel, timestamp: 300 }), 300);
    const result = sensor.process(clickEnvelope({ selector: sel, timestamp: 500 }), 500);
    expect(result).not.toBeNull();
    expect(result!.metrics.clickCount).toBe(3);
    expect(result!.metrics.windowMs).toBe(400); // 500 - 100
  });

  it('should fire on 3 clicks at exactly t=0, t=500, t=1000 (inclusive boundary)', () => {
    const sel = 'button#btn';
    sensor.process(clickEnvelope({ selector: sel, timestamp: 0 }), 0);
    sensor.process(clickEnvelope({ selector: sel, timestamp: 500 }), 500);
    // At t=1000, cutoff is 1000 - 1000 = 0, entry at t=0 has timestamp >= 0, so it stays
    const result = sensor.process(clickEnvelope({ selector: sel, timestamp: 1000 }), 1000);
    expect(result).not.toBeNull();
  });

  it('should NOT fire on a double-click (2 in 200ms)', () => {
    const sel = 'button#btn';
    sensor.process(clickEnvelope({ selector: sel, timestamp: 0 }), 0);
    const result = sensor.process(clickEnvelope({ selector: sel, timestamp: 200 }), 200);
    expect(result).toBeNull();
  });

  it('should fire for element A when interleaved: A, B, A, B, A', () => {
    sensor.process(clickEnvelope({ selector: 'button#a', timestamp: 0 }), 0);
    sensor.process(clickEnvelope({ selector: 'button#b', timestamp: 100 }), 100);
    sensor.process(clickEnvelope({ selector: 'button#a', timestamp: 200 }), 200);
    sensor.process(clickEnvelope({ selector: 'button#b', timestamp: 300 }), 300);
    const result = sensor.process(clickEnvelope({ selector: 'button#a', timestamp: 400 }), 400);
    expect(result).not.toBeNull();
    expect(result!.target).toBe('button#a');
  });

  it('should pass through semantic fields when present', () => {
    const sel = 'button#btn';
    sensor.process(
      clickEnvelope({ selector: sel, adaptRole: 'primary', adaptStep: 'checkout', timestamp: 0 }),
      0,
    );
    sensor.process(
      clickEnvelope({
        selector: sel,
        adaptRole: 'primary',
        adaptStep: 'checkout',
        timestamp: 200,
      }),
      200,
    );
    const result = sensor.process(
      clickEnvelope({
        selector: sel,
        adaptRole: 'primary',
        adaptStep: 'checkout',
        timestamp: 400,
      }),
      400,
    );
    expect(result).not.toBeNull();
    expect(result!.semantic).toEqual({
      nodeId: null,
      role: 'primary',
      modifier: null,
      step: 'checkout',
    });
  });

  it('should fire when now === cooldownUntil (cooldown expired)', () => {
    const sel = 'button#btn';
    // First burst fires
    sensor.process(clickEnvelope({ selector: sel, timestamp: 0 }), 0);
    sensor.process(clickEnvelope({ selector: sel, timestamp: 200 }), 200);
    sensor.process(clickEnvelope({ selector: sel, timestamp: 400 }), 400);
    // cooldownUntil = 400 + 1000 = 1400

    // Second burst starting at exactly cooldown boundary
    sensor.process(clickEnvelope({ selector: sel, timestamp: 1400 }), 1400);
    sensor.process(clickEnvelope({ selector: sel, timestamp: 1600 }), 1600);
    const result = sensor.process(clickEnvelope({ selector: sel, timestamp: 1800 }), 1800);
    expect(result).not.toBeNull();
  });

  it('should NOT fire when window prune leaves fewer than 3 clicks', () => {
    const sel = 'button#btn';
    sensor.process(clickEnvelope({ selector: sel, timestamp: 0 }), 0);
    sensor.process(clickEnvelope({ selector: sel, timestamp: 100 }), 100);
    // Gap of 1500ms — the first two clicks will be pruned
    const result = sensor.process(clickEnvelope({ selector: sel, timestamp: 1500 }), 1500);
    expect(result).toBeNull();
  });

  it('should NOT count triple-click toward rage click threshold', () => {
    const sel = 'button#btn';
    // detail=1 (single click), detail=2 (double click), detail=3 (triple click)
    sensor.process(clickEnvelope({ selector: sel, detail: 1, timestamp: 0 }), 0);
    sensor.process(clickEnvelope({ selector: sel, detail: 2, timestamp: 100 }), 100);
    // Third click is a triple-click (paragraph select) — should be excluded
    const result = sensor.process(clickEnvelope({ selector: sel, detail: 3, timestamp: 200 }), 200);
    expect(result).toBeNull();
  });

  it('should group by selector, not element reference (survives React re-render)', () => {
    // Different Element references but same selector — simulates React re-rendering the DOM node
    const sel = 'button#btn';
    sensor.process(clickEnvelope({ element: stubElement('a'), selector: sel, timestamp: 0 }), 0);
    sensor.process(
      clickEnvelope({ element: stubElement('b'), selector: sel, timestamp: 300 }),
      300,
    );
    const result = sensor.process(
      clickEnvelope({ element: stubElement('c'), selector: sel, timestamp: 600 }),
      600,
    );
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ADAPT_RAGE_CLICK');
    expect(result!.target).toBe(sel);
  });
});
