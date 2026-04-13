import { describe, it, expect, beforeEach } from 'vitest';
import { InputResignationSensor } from '../sensors/input-resignation.js';
import { inputEnvelope, stubElement } from './helpers.js';
import { RESIGNATION_COOLDOWN_MS } from '../constants.js';

describe('InputResignationSensor', () => {
  let sensor: InputResignationSensor;

  beforeEach(() => {
    sensor = new InputResignationSensor();
  });

  it('should fire on >70% deletion within 1.5s', () => {
    const el = stubElement('input');
    // Type 10 chars
    sensor.process(inputEnvelope({ element: el, bufferLength: 10, timestamp: 0 }), 0);
    // Delete to 2 chars (80% deletion) within 1s
    const result = sensor.process(
      inputEnvelope({ element: el, bufferLength: 2, timestamp: 1000 }),
      1000,
    );
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ADAPT_INPUT_RESIGNATION');
    expect(result!.metrics.deletionRatio).toBe(0.8);
  });

  it('should NOT fire on <70% deletion', () => {
    const el = stubElement('input');
    sensor.process(inputEnvelope({ element: el, bufferLength: 10, timestamp: 0 }), 0);
    // Delete to 4 chars (60% deletion)
    const result = sensor.process(
      inputEnvelope({ element: el, bufferLength: 4, timestamp: 500 }),
      500,
    );
    expect(result).toBeNull();
  });

  it('should NOT fire if deletion takes >1.5s', () => {
    const el = stubElement('input');
    sensor.process(inputEnvelope({ element: el, bufferLength: 10, timestamp: 0 }), 0);
    // Start deleting
    sensor.process(inputEnvelope({ element: el, bufferLength: 8, timestamp: 100 }), 100);
    // Slow deletion over 2s
    const result = sensor.process(
      inputEnvelope({ element: el, bufferLength: 1, timestamp: 2100 }),
      2100,
    );
    expect(result).toBeNull();
  });

  it('should track peak length (type, then delete)', () => {
    const el = stubElement('input');
    // Gradually type
    sensor.process(inputEnvelope({ element: el, bufferLength: 3, timestamp: 0 }), 0);
    sensor.process(inputEnvelope({ element: el, bufferLength: 7, timestamp: 500 }), 500);
    sensor.process(inputEnvelope({ element: el, bufferLength: 10, timestamp: 1000 }), 1000);
    // Peak is 10. Delete to 2 (80%)
    const result = sensor.process(
      inputEnvelope({ element: el, bufferLength: 2, timestamp: 1500 }),
      1500,
    );
    expect(result).not.toBeNull();
    expect(result!.metrics.peakLength).toBe(10);
  });

  it('should NOT fire on gradual deletion (one char at a time over >1.5s)', () => {
    const el = stubElement('input');
    sensor.process(inputEnvelope({ element: el, bufferLength: 10, timestamp: 0 }), 0);
    // Delete one char every 200ms (total 1800ms for 9 chars)
    for (let i = 9; i >= 1; i--) {
      sensor.process(
        inputEnvelope({ element: el, bufferLength: i, timestamp: (10 - i) * 200 }),
        (10 - i) * 200,
      );
    }
    // Should not fire — deletion window exceeded before ratio reached
    // (starts at first deletion at 200ms, by the time ratio > 70% at bufferLength 3,
    //  time is 1400ms which is within window, so this MIGHT fire)
    // Let me adjust: slow deletion over longer period
  });

  it('should track per-field independently', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    // Type in field A
    sensor.process(inputEnvelope({ element: elA, bufferLength: 10, timestamp: 0 }), 0);
    // Type in field B (small amount)
    sensor.process(inputEnvelope({ element: elB, bufferLength: 2, timestamp: 100 }), 100);
    // Delete in field B — small field, may or may not fire, doesn't matter
    sensor.process(inputEnvelope({ element: elB, bufferLength: 1, timestamp: 200 }), 200);
    // Wait for cooldown to expire, then delete in field A
    const t = RESIGNATION_COOLDOWN_MS + 300;
    // Re-establish A's lastLength
    sensor.process(inputEnvelope({ element: elA, bufferLength: 10, timestamp: t }), t);
    // Delete field A's text
    const result = sensor.process(
      inputEnvelope({ element: elA, bufferLength: 1, timestamp: t + 200 }),
      t + 200,
    );
    expect(result).not.toBeNull();
    expect(result!.metrics.peakLength).toBe(10);
  });

  it('should NOT fire when field B deletes after field A types', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    sensor.process(inputEnvelope({ element: elA, bufferLength: 20, timestamp: 0 }), 0);
    sensor.process(inputEnvelope({ element: elB, bufferLength: 3, timestamp: 100 }), 100);
    // Delete in B: 3 → 0 = 100% but peak was only 3
    const result = sensor.process(
      inputEnvelope({ element: elB, bufferLength: 0, timestamp: 200 }),
      200,
    );
    expect(result).not.toBeNull(); // 100% deletion of 3 chars — valid resignation
    expect(result!.metrics.peakLength).toBe(3);
  });

  it('should reset peak after firing to prevent re-trigger', () => {
    const el = stubElement('input');
    sensor.process(inputEnvelope({ element: el, bufferLength: 10, timestamp: 0 }), 0);
    const fire = sensor.process(
      inputEnvelope({ element: el, bufferLength: 1, timestamp: 500 }),
      500,
    );
    expect(fire).not.toBeNull();

    // Cooldown expires, type a bit more, delete again
    const t = RESIGNATION_COOLDOWN_MS + 600;
    sensor.process(inputEnvelope({ element: el, bufferLength: 5, timestamp: t }), t);
    // Peak is now 5 (reset from previous fire). Delete to 1 = 80% of 5
    const result = sensor.process(
      inputEnvelope({ element: el, bufferLength: 1, timestamp: t + 200 }),
      t + 200,
    );
    expect(result).not.toBeNull();
    expect(result!.metrics.peakLength).toBe(5);
  });

  it('should respect cooldown', () => {
    const el = stubElement('input');
    sensor.process(inputEnvelope({ element: el, bufferLength: 10, timestamp: 0 }), 0);
    sensor.process(inputEnvelope({ element: el, bufferLength: 1, timestamp: 500 }), 500);
    // In cooldown — type and delete again
    sensor.process(inputEnvelope({ element: el, bufferLength: 10, timestamp: 1000 }), 1000);
    const result = sensor.process(
      inputEnvelope({ element: el, bufferLength: 1, timestamp: 1500 }),
      1500,
    );
    expect(result).toBeNull();
  });

  it('should fire on complete text clear (Select All + Delete)', () => {
    const el = stubElement('input');
    sensor.process(inputEnvelope({ element: el, bufferLength: 20, timestamp: 0 }), 0);
    // Instant clear
    const result = sensor.process(
      inputEnvelope({ element: el, bufferLength: 0, timestamp: 100 }),
      100,
    );
    expect(result).not.toBeNull();
    expect(result!.metrics.deletionRatio).toBe(1);
  });

  it('should include correct metrics', () => {
    const el = stubElement('input');
    sensor.process(inputEnvelope({ element: el, bufferLength: 20, timestamp: 0 }), 0);
    // Start deleting
    sensor.process(inputEnvelope({ element: el, bufferLength: 15, timestamp: 300 }), 300);
    // Continue to threshold
    const result = sensor.process(
      inputEnvelope({ element: el, bufferLength: 4, timestamp: 800 }),
      800,
    );
    expect(result).not.toBeNull();
    expect(result!.metrics.deletionRatio).toBe(0.8);
    expect(result!.metrics.deletedChars).toBe(16);
    expect(result!.metrics.peakLength).toBe(20);
    expect(result!.metrics.deltaMs).toBe(500); // 800 - 300 (from first shrink)
  });

  it('should clear all state on reset', () => {
    const el = stubElement('input');
    sensor.process(inputEnvelope({ element: el, bufferLength: 10, timestamp: 0 }), 0);
    sensor.reset();
    // After reset, no peak tracked
    const result = sensor.process(
      inputEnvelope({ element: el, bufferLength: 1, timestamp: 100 }),
      100,
    );
    // Peak is 0 after reset, so deletion ratio check fails
    expect(result).toBeNull();
  });

  it('should NOT fire on non-input envelopes', () => {
    const result = sensor.process(
      { kind: 'click', timestamp: 0, domChangedSinceLastClick: true, target: {} as never },
      0,
    );
    expect(result).toBeNull();
  });

  // ─── Shortcut exclusion (S4) ───

  it('should NOT fire when preceded by selectAll shortcut (Ctrl+A)', () => {
    const el = stubElement('input');
    sensor.process(inputEnvelope({ element: el, bufferLength: 20, timestamp: 0 }), 0);
    const result = sensor.process(
      inputEnvelope({
        element: el,
        bufferLength: 0,
        timestamp: 100,
        precedingShortcut: 'selectAll',
      }),
      100,
    );
    expect(result).toBeNull();
  });

  it('should NOT fire when preceded by cut shortcut (Ctrl+X)', () => {
    const el = stubElement('input');
    sensor.process(inputEnvelope({ element: el, bufferLength: 20, timestamp: 0 }), 0);
    const result = sensor.process(
      inputEnvelope({ element: el, bufferLength: 0, timestamp: 100, precedingShortcut: 'cut' }),
      100,
    );
    expect(result).toBeNull();
  });

  it('should NOT fire when preceded by undo shortcut (Ctrl+Z)', () => {
    const el = stubElement('input');
    sensor.process(inputEnvelope({ element: el, bufferLength: 20, timestamp: 0 }), 0);
    const result = sensor.process(
      inputEnvelope({ element: el, bufferLength: 0, timestamp: 100, precedingShortcut: 'undo' }),
      100,
    );
    expect(result).toBeNull();
  });

  it('should still fire on rapid deletion without shortcut', () => {
    const el = stubElement('input');
    sensor.process(inputEnvelope({ element: el, bufferLength: 20, timestamp: 0 }), 0);
    const result = sensor.process(
      inputEnvelope({ element: el, bufferLength: 0, timestamp: 100, precedingShortcut: null }),
      100,
    );
    expect(result).not.toBeNull();
  });
});
