import { describe, it, expect, beforeEach } from 'vitest';
import { FormThrashSensor } from '../sensors/form-thrash.js';
import { focusEnvelope, submitEnvelope, stubElement } from './helpers.js';
import { FORM_THRASH_COOLDOWN_MS } from '../constants.js';

describe('FormThrashSensor', () => {
  let sensor: FormThrashSensor;

  beforeEach(() => {
    sensor = new FormThrashSensor();
  });

  it('should fire when field A has 4 visits and field B has 3 (2 unique fields)', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    // A→B→A→B→A→B→A = A has 4, B has 3, 2 fields
    const sequence = [elA, elB, elA, elB, elA, elB, elA];
    let result = null;
    for (let i = 0; i < sequence.length; i++) {
      const el = sequence[i];
      const sel = el === elA ? 'input#a' : 'input#b';
      result = sensor.process(
        focusEnvelope({ element: el, selector: sel, timestamp: i * 100 }),
        i * 100,
      );
    }
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ADAPT_FORM_THRASHING');
  });

  it('should NOT fire with only 3 visits to field A (below threshold)', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    // A→B→A→B→A = A has 3, B has 2
    const sequence = [elA, elB, elA, elB, elA];
    let result = null;
    for (let i = 0; i < sequence.length; i++) {
      const el = sequence[i];
      const sel = el === elA ? 'input#a' : 'input#b';
      result = sensor.process(
        focusEnvelope({ element: el, selector: sel, timestamp: i * 100 }),
        i * 100,
      );
    }
    expect(result).toBeNull();
  });

  it('should NOT fire with 4 visits to field A but only 1 unique field', () => {
    const elA = stubElement('a');
    // Can't get 4 visits to A without switching away (dedup), so need another field
    // But this test is: only 1 unique field in buffer. So we just focus A repeatedly.
    // Due to dedup, consecutive focus on same field is ignored, so we can't reach 4.
    sensor.process(focusEnvelope({ element: elA, selector: 'input#a', timestamp: 0 }), 0);
    sensor.process(focusEnvelope({ element: elA, selector: 'input#a', timestamp: 100 }), 100);
    sensor.process(focusEnvelope({ element: elA, selector: 'input#a', timestamp: 200 }), 200);
    const result = sensor.process(
      focusEnvelope({ element: elA, selector: 'input#a', timestamp: 300 }),
      300,
    );
    // Only 1 entry due to dedup — can't fire
    expect(result).toBeNull();
  });

  it('should NOT fire on normal sequential tab-through (A→B→C→D, each once)', () => {
    const els = [stubElement('a'), stubElement('b'), stubElement('c'), stubElement('d')];
    let result = null;
    for (let i = 0; i < els.length; i++) {
      result = sensor.process(
        focusEnvelope({ element: els[i], selector: `input#f${i}`, timestamp: i * 100 }),
        i * 100,
      );
    }
    expect(result).toBeNull();
  });

  it('should NOT fire when focus events span more than 10s window', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    // Spread visits over 11s — old entries get pruned
    const sequence = [
      { el: elA, t: 0 },
      { el: elB, t: 1000 },
      { el: elA, t: 3000 },
      { el: elB, t: 5000 },
      { el: elA, t: 8000 },
      { el: elB, t: 9000 },
      { el: elA, t: 11000 }, // At this point, t=0 entry is outside 10s window
    ];
    let result = null;
    for (const { el, t } of sequence) {
      const sel = el === elA ? 'input#a' : 'input#b';
      result = sensor.process(focusEnvelope({ element: el, selector: sel, timestamp: t }), t);
    }
    // A: t=3000, t=8000, t=11000 = 3 visits (below 4), so no fire
    expect(result).toBeNull();
  });

  it('should reset on submit and allow re-triggering', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');

    // First thrash
    const seq1 = [elA, elB, elA, elB, elA, elB, elA];
    for (let i = 0; i < seq1.length; i++) {
      const el = seq1[i];
      const sel = el === elA ? 'input#a' : 'input#b';
      sensor.process(focusEnvelope({ element: el, selector: sel, timestamp: i * 100 }), i * 100);
    }

    // Submit clears buffer
    sensor.process(submitEnvelope({ timestamp: 800 }), 800);

    // Second thrash — should fire again (buffer was cleared by submit, not cooldown)
    // Need fresh elements since submit only clears buffer
    const elC = stubElement('c');
    const elD = stubElement('d');
    const seq2 = [elC, elD, elC, elD, elC, elD, elC];
    let result = null;
    for (let i = 0; i < seq2.length; i++) {
      const el = seq2[i];
      const sel = el === elC ? 'input#c' : 'input#d';
      result = sensor.process(
        focusEnvelope({ element: el, selector: sel, timestamp: 900 + i * 100 }),
        900 + i * 100,
      );
    }
    expect(result).not.toBeNull();
  });

  it('should not fire during cooldown after a successful detection', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    // Fire first
    const seq = [elA, elB, elA, elB, elA, elB, elA];
    let firstFire = null;
    for (let i = 0; i < seq.length; i++) {
      const el = seq[i];
      const sel = el === elA ? 'input#a' : 'input#b';
      const r = sensor.process(
        focusEnvelope({ element: el, selector: sel, timestamp: i * 100 }),
        i * 100,
      );
      if (r) firstFire = r;
    }
    expect(firstFire).not.toBeNull();

    // Immediately try again — should be in cooldown
    const elC = stubElement('c');
    const elD = stubElement('d');
    const seq2 = [elC, elD, elC, elD, elC, elD, elC];
    let secondFire = null;
    for (let i = 0; i < seq2.length; i++) {
      const el = seq2[i];
      const sel = el === elC ? 'input#c' : 'input#d';
      const r = sensor.process(
        focusEnvelope({ element: el, selector: sel, timestamp: 700 + i * 100 }),
        700 + i * 100,
      );
      if (r) secondFire = r;
    }
    expect(secondFire).toBeNull();
  });

  it('should deduplicate consecutive focus on the same field', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    // A, A, A, B, A, A, A — deduped to: A, B, A — only 2 visits to A
    sensor.process(focusEnvelope({ element: elA, selector: 'input#a', timestamp: 0 }), 0);
    sensor.process(focusEnvelope({ element: elA, selector: 'input#a', timestamp: 100 }), 100);
    sensor.process(focusEnvelope({ element: elA, selector: 'input#a', timestamp: 200 }), 200);
    sensor.process(focusEnvelope({ element: elB, selector: 'input#b', timestamp: 300 }), 300);
    sensor.process(focusEnvelope({ element: elA, selector: 'input#a', timestamp: 400 }), 400);
    sensor.process(focusEnvelope({ element: elA, selector: 'input#a', timestamp: 500 }), 500);
    const result = sensor.process(
      focusEnvelope({ element: elA, selector: 'input#a', timestamp: 600 }),
      600,
    );
    // A=2 visits, B=1 visit — not enough
    expect(result).toBeNull();
  });

  it('should clear everything on reset()', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    // Partial thrash
    sensor.process(focusEnvelope({ element: elA, selector: 'input#a', timestamp: 0 }), 0);
    sensor.process(focusEnvelope({ element: elB, selector: 'input#b', timestamp: 100 }), 100);
    sensor.process(focusEnvelope({ element: elA, selector: 'input#a', timestamp: 200 }), 200);
    sensor.reset();

    // After reset, those entries are gone — new sequence starts fresh
    const elC = stubElement('c');
    const elD = stubElement('d');
    sensor.process(focusEnvelope({ element: elC, selector: 'input#c', timestamp: 300 }), 300);
    const result = sensor.process(
      focusEnvelope({ element: elD, selector: 'input#d', timestamp: 400 }),
      400,
    );
    expect(result).toBeNull();
  });

  it('should report fieldCount, cycleCount, and fields in metrics', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    const seq = [elA, elB, elA, elB, elA, elB, elA];
    let result = null;
    for (let i = 0; i < seq.length; i++) {
      const el = seq[i];
      const sel = el === elA ? 'input#a' : 'input#b';
      const r = sensor.process(
        focusEnvelope({ element: el, selector: sel, timestamp: i * 100 }),
        i * 100,
      );
      if (r) result = r;
    }
    expect(result).not.toBeNull();
    expect(result!.metrics.fieldCount).toBe(2);
    expect(result!.metrics.cycleCount).toBe(4); // A visited 4 times
    expect(result!.metrics.fields).toContain('input#a');
    expect(result!.metrics.fields).toContain('input#b');
  });

  it('should ignore non-form-field focus events', () => {
    const el = stubElement('div');
    const result = sensor.process(
      focusEnvelope({ element: el, isFormField: false, tag: 'DIV' }),
      1000,
    );
    expect(result).toBeNull();
  });

  it('should fire when both fields exceed threshold (reports highest)', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    // A→B→A→B→A→B→A→B→A = A has 5, B has 4
    const seq = [elA, elB, elA, elB, elA, elB, elA, elB, elA];
    let result = null;
    for (let i = 0; i < seq.length; i++) {
      const el = seq[i];
      const sel = el === elA ? 'input#a' : 'input#b';
      const r = sensor.process(
        focusEnvelope({ element: el, selector: sel, timestamp: i * 100 }),
        i * 100,
      );
      if (r) result = r;
    }
    expect(result).not.toBeNull();
    // First fire should happen when A reaches 4 (at index 6: A,B,A,B,A,B,A)
    expect(result!.metrics.cycleCount as number).toBeGreaterThanOrEqual(4);
  });

  it('should fire on three-field cycling when one field reaches 4 visits', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    const elC = stubElement('c');
    // A→B→C→A→B→C→A→B→A = A has 4, B has 3, C has 2
    const seq = [elA, elB, elC, elA, elB, elC, elA, elB, elA];
    let result = null;
    for (let i = 0; i < seq.length; i++) {
      const el = seq[i];
      const sel = el === elA ? 'input#a' : el === elB ? 'input#b' : 'input#c';
      const r = sensor.process(
        focusEnvelope({ element: el, selector: sel, timestamp: i * 100 }),
        i * 100,
      );
      if (r) result = r;
    }
    expect(result).not.toBeNull();
    expect(result!.metrics.fieldCount).toBe(3);
  });

  it('should fire on rapid cycling (all within 500ms)', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    const seq = [elA, elB, elA, elB, elA, elB, elA];
    let result = null;
    for (let i = 0; i < seq.length; i++) {
      const el = seq[i];
      const sel = el === elA ? 'input#a' : 'input#b';
      const r = sensor.process(
        focusEnvelope({ element: el, selector: sel, timestamp: i * 50 }),
        i * 50,
      );
      if (r) result = r;
    }
    expect(result).not.toBeNull();
  });

  it('should fire on slow cycling (each 3s apart, within 10s window)', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    // A(0)→B(3000)→A(6000)→B(7000)→A(8000)→B(9000)→A(9500)
    // A visits: 0, 6000, 8000, 9500 = 4 within 10s from 9500? cutoff = 9500-10000 = -500 → all in window
    const times = [0, 3000, 6000, 7000, 8000, 9000, 9500];
    const els = [elA, elB, elA, elB, elA, elB, elA];
    let result = null;
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      const sel = el === elA ? 'input#a' : 'input#b';
      const r = sensor.process(
        focusEnvelope({ element: el, selector: sel, timestamp: times[i] }),
        times[i],
      );
      if (r) result = r;
    }
    expect(result).not.toBeNull();
  });

  it('should handle buffer overflow (>30 entries) gracefully', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    expect(() => {
      for (let i = 0; i < 40; i++) {
        const el = i % 2 === 0 ? elA : elB;
        const sel = el === elA ? 'input#a' : 'input#b';
        sensor.process(focusEnvelope({ element: el, selector: sel, timestamp: i * 50 }), i * 50);
      }
    }).not.toThrow();
  });

  it('should give the same element the same field ID across calls', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    // Process A, then B, then A again — A should accumulate
    sensor.process(focusEnvelope({ element: elA, selector: 'input#a', timestamp: 0 }), 0);
    sensor.process(focusEnvelope({ element: elB, selector: 'input#b', timestamp: 100 }), 100);
    sensor.process(focusEnvelope({ element: elA, selector: 'input#a', timestamp: 200 }), 200);
    sensor.process(focusEnvelope({ element: elB, selector: 'input#b', timestamp: 300 }), 300);
    sensor.process(focusEnvelope({ element: elA, selector: 'input#a', timestamp: 400 }), 400);
    sensor.process(focusEnvelope({ element: elB, selector: 'input#b', timestamp: 500 }), 500);
    const result = sensor.process(
      focusEnvelope({ element: elA, selector: 'input#a', timestamp: 600 }),
      600,
    );
    // A has 4 visits, B has 3 → fires
    expect(result).not.toBeNull();
  });

  it('should fire when event arrives at exactly cooldownUntil', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    // First fire
    const seq = [elA, elB, elA, elB, elA, elB, elA];
    let fireTime = 0;
    for (let i = 0; i < seq.length; i++) {
      const el = seq[i];
      const sel = el === elA ? 'input#a' : 'input#b';
      const r = sensor.process(
        focusEnvelope({ element: el, selector: sel, timestamp: i * 100 }),
        i * 100,
      );
      if (r) fireTime = i * 100;
    }
    // cooldownUntil = fireTime + 10000
    const cooldownEnd = fireTime + FORM_THRASH_COOLDOWN_MS;

    // New elements at exactly cooldown boundary
    const elC = stubElement('c');
    const elD = stubElement('d');
    const seq2 = [elC, elD, elC, elD, elC, elD, elC];
    let result = null;
    for (let i = 0; i < seq2.length; i++) {
      const el = seq2[i];
      const sel = el === elC ? 'input#c' : 'input#d';
      const r = sensor.process(
        focusEnvelope({ element: el, selector: sel, timestamp: cooldownEnd + i * 100 }),
        cooldownEnd + i * 100,
      );
      if (r) result = r;
    }
    expect(result).not.toBeNull();
  });

  it('should track mixed element types (input + select + textarea)', () => {
    const elInput = stubElement('input');
    const elSelect = stubElement('select');
    const elTextarea = stubElement('textarea');
    // input→select→textarea→input→select→textarea→input→select→input
    const seq = [
      { el: elInput, tag: 'INPUT', sel: 'input#i' },
      { el: elSelect, tag: 'SELECT', sel: 'select#s' },
      { el: elTextarea, tag: 'TEXTAREA', sel: 'textarea#t' },
      { el: elInput, tag: 'INPUT', sel: 'input#i' },
      { el: elSelect, tag: 'SELECT', sel: 'select#s' },
      { el: elTextarea, tag: 'TEXTAREA', sel: 'textarea#t' },
      { el: elInput, tag: 'INPUT', sel: 'input#i' },
      { el: elSelect, tag: 'SELECT', sel: 'select#s' },
      { el: elInput, tag: 'INPUT', sel: 'input#i' },
    ];
    let result = null;
    for (let i = 0; i < seq.length; i++) {
      const { el, tag, sel } = seq[i];
      const r = sensor.process(
        focusEnvelope({ element: el, tag, selector: sel, timestamp: i * 100 }),
        i * 100,
      );
      if (r) result = r;
    }
    expect(result).not.toBeNull();
    expect(result!.metrics.fieldCount).toBe(3);
  });

  it('should report accurate windowMs (first to last event time span)', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    const seq = [elA, elB, elA, elB, elA, elB, elA];
    let result = null;
    for (let i = 0; i < seq.length; i++) {
      const el = seq[i];
      const sel = el === elA ? 'input#a' : 'input#b';
      const r = sensor.process(
        focusEnvelope({ element: el, selector: sel, timestamp: 1000 + i * 200 }),
        1000 + i * 200,
      );
      if (r) result = r;
    }
    expect(result).not.toBeNull();
    expect(result!.metrics.windowMs).toBe(1200); // 2200 - 1000
  });

  // ─── Form-scope grouping (S3) ───

  it('should NOT fire when cycling between fields in two separate forms', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    // A is in formA, B is in formB — interleaved cycling should NOT trigger
    // because each form's scope only has 1 unique field
    const sequence = [
      { el: elA, sel: 'input#a', form: 'form#formA' },
      { el: elB, sel: 'input#b', form: 'form#formB' },
      { el: elA, sel: 'input#a', form: 'form#formA' },
      { el: elB, sel: 'input#b', form: 'form#formB' },
      { el: elA, sel: 'input#a', form: 'form#formA' },
      { el: elB, sel: 'input#b', form: 'form#formB' },
      { el: elA, sel: 'input#a', form: 'form#formA' },
    ];
    let result = null;
    for (let i = 0; i < sequence.length; i++) {
      const { el, sel, form } = sequence[i];
      const r = sensor.process(
        focusEnvelope({ element: el, selector: sel, formSelector: form, timestamp: i * 100 }),
        i * 100,
      );
      if (r) result = r;
    }
    // Each form scope only has 1 field (minFields=2 not met)
    expect(result).toBeNull();
  });

  it('should fire when thrashing within a single form scope', () => {
    const elA = stubElement('a');
    const elB = stubElement('b');
    const seq = [elA, elB, elA, elB, elA, elB, elA];
    let result = null;
    for (let i = 0; i < seq.length; i++) {
      const el = seq[i];
      const sel = el === elA ? 'input#a' : 'input#b';
      const r = sensor.process(
        focusEnvelope({
          element: el,
          selector: sel,
          formSelector: 'form#checkout',
          timestamp: i * 100,
        }),
        i * 100,
      );
      if (r) result = r;
    }
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ADAPT_FORM_THRASHING');
  });
});
