import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AdaptKit from '../index.js';
import type { FrictionEvent, AdaptKitEvent } from '../types.js';

/** Filter AdaptKitEvent stream to only FrictionEvents (have ruleId property). */
function isFrictionEvent(e: AdaptKitEvent): e is FrictionEvent {
  return 'ruleId' in e;
}

const BUFFER_WAIT = 3000; // Past completion window (2s default)

function click(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function focusin(el: Element): void {
  el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
}

describe('Integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    AdaptKit.stop();
    vi.useFakeTimers();
  });

  afterEach(() => {
    AdaptKit.stop();
    vi.useRealTimers();
  });

  it('should emit ADAPT_RAGE_CLICK on 3 rapid clicks', () => {
    document.body.innerHTML = '<button id="btn">Click me</button>';
    const btn = document.getElementById('btn')!;

    const events: FrictionEvent[] = [];
    AdaptKit.on('ADAPT_RAGE_CLICK', (e) => events.push(e));
    AdaptKit.start();

    click(btn);
    vi.advanceTimersByTime(100);
    click(btn);
    vi.advanceTimersByTime(100);
    click(btn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('ADAPT_RAGE_CLICK');
  });

  it('should warn and not duplicate listeners when start() called twice', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    AdaptKit.start();
    AdaptKit.start();
    expect(warnSpy).toHaveBeenCalledWith('[AdaptKit] Already running. Call stop() first.');
    warnSpy.mockRestore();
  });

  it('should support stop() then start() (clean restart)', () => {
    document.body.innerHTML = '<button id="btn">Click me</button>';
    const btn = document.getElementById('btn')!;

    const events: FrictionEvent[] = [];
    AdaptKit.on('*', (e) => events.push(e));
    AdaptKit.start();
    AdaptKit.stop();
    AdaptKit.start();

    click(btn);
    vi.advanceTimersByTime(100);
    click(btn);
    vi.advanceTimersByTime(100);
    click(btn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('should deliver events to handlers registered before start()', () => {
    // Annotated button passes confidence floor for dead-click
    document.body.innerHTML = '<button id="btn" data-adapt-role="primary-action">Click me</button>';
    const btn = document.getElementById('btn')!;

    const events: FrictionEvent[] = [];
    AdaptKit.on('*', (e) => events.push(e));
    AdaptKit.start();

    click(btn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('should stop emitting events after stop()', () => {
    document.body.innerHTML = '<button id="btn">Click me</button>';
    const btn = document.getElementById('btn')!;

    const events: FrictionEvent[] = [];
    AdaptKit.on('ADAPT_RAGE_CLICK', (e) => events.push(e));
    AdaptKit.start();
    AdaptKit.stop();

    click(btn);
    vi.advanceTimersByTime(100);
    click(btn);
    vi.advanceTimersByTime(100);
    click(btn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    expect(events).toHaveLength(0);
  });

  it('should emit multiple sensor types independently in the same session', () => {
    document.body.innerHTML = `
      <button id="dead-btn" data-adapt-role="primary-action">Dead</button>
      <button id="rage-btn">Rage</button>
      <form>
        <input id="f1" type="text" />
        <input id="f2" type="text" />
      </form>
    `;
    const deadBtn = document.getElementById('dead-btn')!;
    const rageBtn = document.getElementById('rage-btn')!;
    const f1 = document.getElementById('f1')!;
    const f2 = document.getElementById('f2')!;

    const events: FrictionEvent[] = [];
    AdaptKit.on('*', (e) => events.push(e));
    AdaptKit.start();

    // Dead click (annotated → passes confidence floor)
    click(deadBtn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    // Rage click
    click(rageBtn);
    vi.advanceTimersByTime(100);
    click(rageBtn);
    vi.advanceTimersByTime(100);
    click(rageBtn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    // Form thrash
    for (let i = 0; i < 7; i++) {
      focusin(i % 2 === 0 ? f1 : f2);
      vi.advanceTimersByTime(200);
    }
    vi.advanceTimersByTime(BUFFER_WAIT);

    const types = events.map((e) => e.type);
    expect(types).toContain('ADAPT_DEAD_CLICK');
    expect(types).toContain('ADAPT_RAGE_CLICK');
    expect(types).toContain('ADAPT_FORM_THRASHING');
  });

  it('should log to console in debug mode', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    document.body.innerHTML = '<button id="btn">Click me</button>';
    const btn = document.getElementById('btn')!;

    AdaptKit.start({ debug: true });
    click(btn);

    expect(logSpy).toHaveBeenCalled();
    const calls = logSpy.mock.calls.flat().join(' ');
    expect(calls).toContain('[AdaptKit:');
    logSpy.mockRestore();
  });

  it('should auto-enable debug on localhost (jsdom)', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    document.body.innerHTML = '<button id="btn">Click me</button>';
    const btn = document.getElementById('btn')!;

    // No explicit debug flag — should auto-detect localhost in jsdom
    AdaptKit.start();
    click(btn);

    expect(logSpy).toHaveBeenCalled();
    const calls = logSpy.mock.calls.flat().join(' ');
    expect(calls).toContain('[AdaptKit:');
    logSpy.mockRestore();
  });

  it('should respect explicit debug: false even on localhost', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    document.body.innerHTML = '<button id="btn">Click me</button>';
    const btn = document.getElementById('btn')!;

    AdaptKit.start({ debug: false });
    click(btn);

    const calls = logSpy.mock.calls.flat().join(' ');
    expect(calls).not.toContain('[AdaptKit:');
    logSpy.mockRestore();
  });

  it('should emit FrictionEvent with correct shape', () => {
    // Use rage-click (high base confidence, always passes floor)
    document.body.innerHTML = '<button id="btn">Click me</button>';
    const btn = document.getElementById('btn')!;

    const allEvents: AdaptKitEvent[] = [];
    AdaptKit.on('*', (e) => allEvents.push(e));
    AdaptKit.start();

    click(btn);
    vi.advanceTimersByTime(100);
    click(btn);
    vi.advanceTimersByTime(100);
    click(btn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    const events = allEvents.filter(isFrictionEvent);
    expect(events.length).toBeGreaterThanOrEqual(1);
    const event = events[0];
    expect(event).toHaveProperty('type');
    expect(event).toHaveProperty('target');
    expect(event).toHaveProperty('timestamp');
    expect(event).toHaveProperty('ruleId');
    expect(event).toHaveProperty('metrics');
    expect(event).toHaveProperty('semantic');
    expect(event.metrics).toHaveProperty('confidence');
  });

  it('should emit ADAPT_BLOCKED_INTENT on submit failure loop', () => {
    document.body.innerHTML = `
      <form id="myform" onsubmit="event.preventDefault()">
        <input required value="" />
        <button type="submit">Go</button>
      </form>
    `;
    const form = document.getElementById('myform')!;

    const events: FrictionEvent[] = [];
    AdaptKit.on('ADAPT_BLOCKED_INTENT', (e) => events.push(e));
    AdaptKit.start();

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    vi.advanceTimersByTime(3000);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    vi.advanceTimersByTime(BUFFER_WAIT);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('ADAPT_BLOCKED_INTENT');
    expect(events[0].metrics.subtype).toBe('form_submission');
  });

  it('should pass through semantic attributes in FrictionEvent', () => {
    document.body.innerHTML =
      '<button id="btn" data-adapt-role="primary-action" data-adapt-step="checkout">Pay</button>';
    const btn = document.getElementById('btn')!;

    const allEvents: AdaptKitEvent[] = [];
    AdaptKit.on('*', (e) => allEvents.push(e));
    AdaptKit.start();

    click(btn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    const events = allEvents.filter(isFrictionEvent);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].semantic).toMatchObject({
      role: 'primary-action',
      step: 'checkout',
    });
  });

  it('should include confidence score in emitted events', () => {
    document.body.innerHTML = '<button id="btn" data-adapt-role="primary-action">Pay</button>';
    const btn = document.getElementById('btn')!;

    const events: FrictionEvent[] = [];
    AdaptKit.on('*', (e) => events.push(e));
    AdaptKit.start();

    click(btn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    expect(events.length).toBeGreaterThanOrEqual(1);
    const confidence = events[0].metrics.confidence as number;
    // Dead click on primary-action button: 0.35 + 0.10 (tag) + 0.15 (semantic) + 0.10 (primary) = 0.70
    expect(confidence).toBeGreaterThan(0.55);
  });

  it('should suppress dead-click on unannotated cursor:pointer div (below confidence floor)', () => {
    document.body.innerHTML = '<div id="btn" role="button" style="cursor: pointer">Click me</div>';
    const btn = document.getElementById('btn')!;

    const events: FrictionEvent[] = [];
    AdaptKit.on('ADAPT_DEAD_CLICK', (e) => events.push(e));
    AdaptKit.start();

    click(btn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    // Unannotated ARIA role button: base 0.35 + role bonus 0.05 = 0.40 < 0.55 floor
    expect(events).toHaveLength(0);
  });

  it('should discard buffered event if user completes action (completion gating)', () => {
    document.body.innerHTML = `
      <form id="myform" data-adapt-step="checkout">
        <input id="f1" type="text" />
        <input id="f2" type="text" />
        <button type="submit">Go</button>
      </form>
    `;
    const f1 = document.getElementById('f1')!;
    const f2 = document.getElementById('f2')!;
    const form = document.getElementById('myform')!;

    const events: FrictionEvent[] = [];
    AdaptKit.on('ADAPT_FORM_THRASHING', (e) => events.push(e));
    AdaptKit.start();

    // Trigger form thrashing
    for (let i = 0; i < 7; i++) {
      focusin(i % 2 === 0 ? f1 : f2);
      vi.advanceTimersByTime(200);
    }
    // Event is now buffered. Successful submit before buffer expires → discard
    form.dispatchEvent(new Event('submit', { bubbles: true }));
    vi.advanceTimersByTime(BUFFER_WAIT);

    // The form thrash event should have been discarded by completion gating
    // (successful submit on same form selector)
    expect(events).toHaveLength(0);
  });

  // ─── reset() tests ───

  it('should clear sensor state on reset() (rage-click buffer)', () => {
    document.body.innerHTML = '<button id="btn">Click me</button>';
    const btn = document.getElementById('btn')!;

    const events: FrictionEvent[] = [];
    AdaptKit.on('ADAPT_RAGE_CLICK', (e) => events.push(e));
    AdaptKit.start();

    // 2 clicks — not enough for rage-click
    click(btn);
    vi.advanceTimersByTime(100);
    click(btn);
    vi.advanceTimersByTime(100);

    // Reset clears the buffer
    AdaptKit.reset();

    // 1 more click — should NOT fire rage-click (buffer was cleared)
    click(btn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    expect(events).toHaveLength(0);
  });

  it('should generate new sessionId and reset eventIndex after reset()', () => {
    document.body.innerHTML = '<button id="btn">Click me</button>';
    const btn = document.getElementById('btn')!;

    const allEvents: AdaptKitEvent[] = [];
    AdaptKit.on('*', (e) => allEvents.push(e));
    AdaptKit.start();

    // Trigger rage-click to get a sessionId
    click(btn);
    vi.advanceTimersByTime(100);
    click(btn);
    vi.advanceTimersByTime(100);
    click(btn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    const preResetFriction = allEvents.filter(isFrictionEvent);
    expect(preResetFriction.length).toBeGreaterThanOrEqual(1);
    const firstSessionId = preResetFriction[0].sessionId;

    AdaptKit.reset();
    allEvents.length = 0;

    // Trigger another rage-click
    click(btn);
    vi.advanceTimersByTime(100);
    click(btn);
    vi.advanceTimersByTime(100);
    click(btn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    const postResetFriction = allEvents.filter(isFrictionEvent);
    expect(postResetFriction.length).toBeGreaterThanOrEqual(1);

    // New session
    expect(postResetFriction[0].sessionId).not.toBe(firstSessionId);
    // eventIndex restarted — first event in new session should be 0
    const minIndex = Math.min(...postResetFriction.map((e) => e.eventIndex!));
    expect(minIndex).toBe(0);
  });

  it('should keep on() handlers active after reset()', () => {
    document.body.innerHTML = '<button id="btn" data-adapt-role="primary-action">Click me</button>';
    const btn = document.getElementById('btn')!;

    const events: FrictionEvent[] = [];
    AdaptKit.on('*', (e) => events.push(e));
    AdaptKit.start();

    AdaptKit.reset();

    // Trigger a dead-click (annotated → passes confidence floor)
    click(btn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('should be a no-op when reset() called before start()', () => {
    // Should not throw
    expect(() => AdaptKit.reset()).not.toThrow();
  });

  // ─── Privacy integration tests ───

  it('should suppress targetText in dead-click events by default', () => {
    document.body.innerHTML =
      '<button id="btn" data-adapt-role="primary-action">Patient Name</button>';
    const btn = document.getElementById('btn')!;

    const events: FrictionEvent[] = [];
    AdaptKit.on('ADAPT_DEAD_CLICK', (e) => events.push(e));
    AdaptKit.start();

    click(btn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    expect(events).toHaveLength(1);
    expect(events[0].metrics.targetText).toBe('');
  });

  it('should include targetText in dead-click events when collectTargetText is true', () => {
    document.body.innerHTML =
      '<button id="btn" data-adapt-role="primary-action">Submit Order</button>';
    const btn = document.getElementById('btn')!;

    const events: FrictionEvent[] = [];
    AdaptKit.on('ADAPT_DEAD_CLICK', (e) => events.push(e));
    AdaptKit.start({ collectTargetText: true });

    click(btn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    expect(events).toHaveLength(1);
    expect(events[0].metrics.targetText).toBe('Submit Order');
  });

  it('should suppress targetText inside data-adapt-pii even with collectTargetText', () => {
    document.body.innerHTML =
      '<div data-adapt-pii><button id="btn" data-adapt-role="primary-action">Patient Record</button></div>';
    const btn = document.getElementById('btn')!;

    const events: FrictionEvent[] = [];
    AdaptKit.on('ADAPT_DEAD_CLICK', (e) => events.push(e));
    AdaptKit.start({ collectTargetText: true });

    click(btn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    expect(events).toHaveLength(1);
    expect(events[0].metrics.targetText).toBe('');
  });

  it('should still detect rage-click inside data-adapt-pii container', () => {
    document.body.innerHTML =
      '<div data-adapt-pii><button id="btn">Sensitive Button</button></div>';
    const btn = document.getElementById('btn')!;

    const events: FrictionEvent[] = [];
    AdaptKit.on('ADAPT_RAGE_CLICK', (e) => events.push(e));
    AdaptKit.start();

    click(btn);
    vi.advanceTimersByTime(100);
    click(btn);
    vi.advanceTimersByTime(100);
    click(btn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('ADAPT_RAGE_CLICK');
  });

  it('should suppress targetText when piiFilter matches', () => {
    document.body.innerHTML =
      '<button id="btn" data-adapt-role="primary-action" data-patient>Dr. Smith</button>';
    const btn = document.getElementById('btn')!;

    const events: FrictionEvent[] = [];
    AdaptKit.on('ADAPT_DEAD_CLICK', (e) => events.push(e));
    AdaptKit.start({
      collectTargetText: true,
      piiFilter: (el) => el.hasAttribute('data-patient'),
    });

    click(btn);
    vi.advanceTimersByTime(BUFFER_WAIT);

    expect(events).toHaveLength(1);
    expect(events[0].metrics.targetText).toBe('');
  });
});
