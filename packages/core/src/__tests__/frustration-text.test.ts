import { describe, it, expect, beforeEach } from 'vitest';
import { FrustrationTextSensor } from '../sensors/frustration-text.js';
import { inputEnvelope, stubElement } from './helpers.js';
import { FRUSTRATION_TEXT_COOLDOWN_MS } from '../constants.js';

// The sensor requires 5s of field activity before evaluating.
// All tests that expect pattern matching must use t >= 5000.
const ACTIVE_OFFSET = 5000;

describe('FrustrationTextSensor', () => {
  let sensor: FrustrationTextSensor;

  beforeEach(() => {
    sensor = new FrustrationTextSensor();
  });

  function processWithActive(el: Element, text: string, t: number) {
    // First event establishes the field as "first seen"
    sensor.process(inputEnvelope({ element: el, text: '', timestamp: 0 }), 0);
    // Second event at t >= ACTIVE_OFFSET passes the activity check
    return sensor.process(inputEnvelope({ element: el, text, timestamp: t }), t);
  }

  // ─── Pattern Matching ───

  it('should fire on "this is broken"', () => {
    const el = stubElement('input');
    const result = processWithActive(el, 'this is broken', ACTIVE_OFFSET);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ADAPT_FRUSTRATION_TEXT');
  });

  it('should fire on "doesn\'t work"', () => {
    const el = stubElement('input');
    const result = processWithActive(el, "it doesn't work", ACTIVE_OFFSET);
    expect(result).not.toBeNull();
  });

  it('should fire on "won\'t load"', () => {
    const el = stubElement('input');
    const result = processWithActive(el, "the page won't load", ACTIVE_OFFSET);
    expect(result).not.toBeNull();
  });

  it('should fire on "can\'t find"', () => {
    const el = stubElement('input');
    const result = processWithActive(el, "I can't find the button", ACTIVE_OFFSET);
    expect(result).not.toBeNull();
  });

  it('should fire on "why is this so slow"', () => {
    const el = stubElement('input');
    const result = processWithActive(el, 'why is this so slow', ACTIVE_OFFSET);
    expect(result).not.toBeNull();
  });

  it('should fire on "how do i submit"', () => {
    const el = stubElement('input');
    const result = processWithActive(el, 'how do i submit this form', ACTIVE_OFFSET);
    expect(result).not.toBeNull();
  });

  it('should fire on profanity "wtf"', () => {
    const el = stubElement('input');
    const result = processWithActive(el, 'wtf is going on', ACTIVE_OFFSET);
    expect(result).not.toBeNull();
  });

  it('should fire on "ugh"', () => {
    const el = stubElement('input');
    const result = processWithActive(el, 'ughhh yeah', ACTIVE_OFFSET);
    expect(result).not.toBeNull();
  });

  it('should fire on "this sucks"', () => {
    const el = stubElement('input');
    const result = processWithActive(el, 'this sucks so much', ACTIVE_OFFSET);
    expect(result).not.toBeNull();
  });

  it('should fire on "giving up"', () => {
    const el = stubElement('input');
    const result = processWithActive(el, "i'm giving up on this", ACTIVE_OFFSET);
    expect(result).not.toBeNull();
  });

  it('should fire on "i\'m stuck"', () => {
    const el = stubElement('input');
    const result = processWithActive(el, "i'm stuck on this step", ACTIVE_OFFSET);
    expect(result).not.toBeNull();
  });

  it('should fire on "help me"', () => {
    const el = stubElement('input');
    const result = processWithActive(el, 'someone help me please', ACTIVE_OFFSET);
    expect(result).not.toBeNull();
  });

  it('should fire on "nothing works"', () => {
    const el = stubElement('input');
    const result = processWithActive(el, 'nothing works on this site', ACTIVE_OFFSET);
    expect(result).not.toBeNull();
  });

  // ─── Non-matches ───

  it('should NOT fire on normal text', () => {
    const el = stubElement('input');
    const result = processWithActive(el, 'Hello, my name is John', ACTIVE_OFFSET);
    expect(result).toBeNull();
  });

  it('should NOT fire on text shorter than min length', () => {
    const el = stubElement('input');
    const result = processWithActive(el, 'ug', ACTIVE_OFFSET);
    expect(result).toBeNull();
  });

  it('should NOT fire on empty text (PII field)', () => {
    const el = stubElement('input');
    const result = processWithActive(el, '', ACTIVE_OFFSET);
    expect(result).toBeNull();
  });

  // ─── Cooldown ───

  it('should respect cooldown after firing', () => {
    const el = stubElement('input');
    const fire = processWithActive(el, 'this is broken', ACTIVE_OFFSET);
    expect(fire).not.toBeNull();

    const noFire = sensor.process(
      inputEnvelope({ element: el, text: 'this also sucks', timestamp: ACTIVE_OFFSET + 1000 }),
      ACTIVE_OFFSET + 1000,
    );
    expect(noFire).toBeNull();
  });

  it('should fire again after cooldown expires', () => {
    const el = stubElement('input');
    processWithActive(el, 'this is broken', ACTIVE_OFFSET);
    const t = ACTIVE_OFFSET + FRUSTRATION_TEXT_COOLDOWN_MS + 1;
    const result = sensor.process(
      inputEnvelope({ element: el, text: 'still broken yeah', timestamp: t }),
      t,
    );
    expect(result).not.toBeNull();
  });

  it('should include matchedPattern in metrics', () => {
    const el = stubElement('input');
    const result = processWithActive(el, 'wtf is this', ACTIVE_OFFSET);
    expect(result).not.toBeNull();
    expect(result!.metrics.matchedPattern).toBeTruthy();
  });

  it('should clear cooldown on reset', () => {
    const el = stubElement('input');
    processWithActive(el, 'broken stuff', ACTIVE_OFFSET);
    sensor.reset();
    const el2 = stubElement('input2');
    const result = processWithActive(el2, 'broken again yeah', ACTIVE_OFFSET);
    expect(result).not.toBeNull();
  });

  it('should NOT fire on non-input envelopes', () => {
    const result = sensor.process(
      { kind: 'click', timestamp: 0, domChangedSinceLastClick: true, target: {} as never },
      0,
    );
    expect(result).toBeNull();
  });

  // ─── Field-type exclusion (S5) ───

  it('should NOT fire on search input (type="search")', () => {
    const el = { getAttribute: (attr: string) => (attr === 'type' ? 'search' : null) } as Element;
    sensor.process(inputEnvelope({ element: el, text: '', timestamp: 0 }), 0);
    const result = sensor.process(
      inputEnvelope({ element: el, text: 'this is broken', timestamp: ACTIVE_OFFSET }),
      ACTIVE_OFFSET,
    );
    expect(result).toBeNull();
  });

  it('should NOT fire on fields with role="search"', () => {
    const el = {
      getAttribute: (attr: string) => (attr === 'role' ? 'search' : null),
    } as Element;
    sensor.process(inputEnvelope({ element: el, text: '', timestamp: 0 }), 0);
    const result = sensor.process(
      inputEnvelope({ element: el, text: 'this is broken', timestamp: ACTIVE_OFFSET }),
      ACTIVE_OFFSET,
    );
    expect(result).toBeNull();
  });

  it('should NOT fire on fields with name containing "chat"', () => {
    const el = {
      getAttribute: (attr: string) => (attr === 'name' ? 'chat-input' : null),
    } as Element;
    sensor.process(inputEnvelope({ element: el, text: '', timestamp: 0 }), 0);
    const result = sensor.process(
      inputEnvelope({ element: el, text: 'this is broken', timestamp: ACTIVE_OFFSET }),
      ACTIVE_OFFSET,
    );
    expect(result).toBeNull();
  });

  // ─── Debouncing (S5) ───

  it('should NOT re-evaluate when text length changes by less than 3 chars', () => {
    const el = stubElement('input');
    // Establish field
    sensor.process(inputEnvelope({ element: el, text: '', timestamp: 0 }), 0);
    // First evaluation at ACTIVE_OFFSET (delta from 0 to 14 = 14, >= 3)
    const r1 = sensor.process(
      inputEnvelope({ element: el, text: 'this is broken', timestamp: ACTIVE_OFFSET }),
      ACTIVE_OFFSET,
    );
    expect(r1).not.toBeNull(); // fires

    // Wait for cooldown
    const t2 = ACTIVE_OFFSET + FRUSTRATION_TEXT_COOLDOWN_MS + 1;
    // Text changed by only 1 char — should skip evaluation
    const r2 = sensor.process(
      inputEnvelope({ element: el, text: 'this is broken!', timestamp: t2 }),
      t2,
    );
    expect(r2).toBeNull(); // debounced — delta is only 1 char
  });

  // ─── Minimum field active time (S5) ───

  it('should NOT fire before field has been active for 5s', () => {
    const el = stubElement('input');
    // First event at t=0 establishes first-seen time
    sensor.process(inputEnvelope({ element: el, text: '', timestamp: 0 }), 0);
    // Event at t=1000 (only 1s active — below 5s threshold)
    const result = sensor.process(
      inputEnvelope({ element: el, text: 'this is broken', timestamp: 1000 }),
      1000,
    );
    expect(result).toBeNull();
  });
});
