import { describe, it, expect, beforeEach } from 'vitest';
import { BlockedIntentSensor } from '../sensors/blocked-intent.js';
import { clickEnvelope, submitEnvelope, stubElement } from './helpers.js';
import { BLOCKED_INTENT_SUBMIT_WINDOW_MS, BLOCKED_INTENT_CLICK_WINDOW_MS } from '../constants.js';

describe('BlockedIntentSensor', () => {
  let sensor: BlockedIntentSensor;

  beforeEach(() => {
    sensor = new BlockedIntentSensor();
  });

  // ─── Rule 1: Submit Failure Loop ───

  describe('Rule 1 — Submit Failure Loop', () => {
    it('should fire on two failed submits on same form within 10s', () => {
      const result1 = sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 1000 }),
        1000,
      );
      expect(result1).toBeNull();

      const result2 = sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 5000 }),
        5000,
      );
      expect(result2).not.toBeNull();
      expect(result2!.type).toBe('ADAPT_BLOCKED_INTENT');
      expect(result2!.metrics.subtype).toBe('form_submission');
    });

    it('should NOT fire on a single failed submit', () => {
      const result = sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 1000 }),
        1000,
      );
      expect(result).toBeNull();
    });

    it('should NOT fire when submits are not failures (no defaultPrevented, no invalid)', () => {
      sensor.process(submitEnvelope({ selector: 'form#login', timestamp: 1000 }), 1000);
      const result = sensor.process(
        submitEnvelope({ selector: 'form#login', timestamp: 5000 }),
        5000,
      );
      expect(result).toBeNull();
    });

    it('should NOT fire when two failed submits are on different forms', () => {
      sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 1000 }),
        1000,
      );
      const result = sensor.process(
        submitEnvelope({ selector: 'form#register', defaultPrevented: true, timestamp: 5000 }),
        5000,
      );
      expect(result).toBeNull();
    });

    it('should NOT fire when two failed submits are >10s apart', () => {
      sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 0 }),
        0,
      );
      const result = sensor.process(
        submitEnvelope({
          selector: 'form#login',
          defaultPrevented: true,
          timestamp: BLOCKED_INTENT_SUBMIT_WINDOW_MS + 1,
        }),
        BLOCKED_INTENT_SUBMIT_WINDOW_MS + 1,
      );
      expect(result).toBeNull();
    });

    it('should respect cooldown after firing', () => {
      // First pair fires
      sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 0 }),
        0,
      );
      const fire = sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 5000 }),
        5000,
      );
      expect(fire).not.toBeNull();

      // During cooldown
      sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 6000 }),
        6000,
      );
      const noFire = sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 8000 }),
        8000,
      );
      expect(noFire).toBeNull();
    });

    it('should fire again after cooldown expires', () => {
      sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 0 }),
        0,
      );
      sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 5000 }),
        5000,
      );
      // cooldownUntil = 5000 + 10000 = 15000

      sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 15000 }),
        15000,
      );
      const result = sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 20000 }),
        20000,
      );
      expect(result).not.toBeNull();
    });

    it('should treat hasInvalidInputs as a failure signal', () => {
      sensor.process(
        submitEnvelope({ selector: 'form#login', hasInvalidInputs: true, timestamp: 1000 }),
        1000,
      );
      const result = sensor.process(
        submitEnvelope({ selector: 'form#login', hasInvalidInputs: true, timestamp: 5000 }),
        5000,
      );
      expect(result).not.toBeNull();
    });

    it('should treat mixed failure signals (defaultPrevented + hasInvalidInputs)', () => {
      sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 1000 }),
        1000,
      );
      const result = sensor.process(
        submitEnvelope({ selector: 'form#login', hasInvalidInputs: true, timestamp: 5000 }),
        5000,
      );
      expect(result).not.toBeNull();
    });

    it('should include timeSinceFirstAttemptMs in metrics', () => {
      sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 1000 }),
        1000,
      );
      const result = sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 4000 }),
        4000,
      );
      expect(result!.metrics.timeSinceFirstAttemptMs).toBe(3000);
    });

    it('should clear tracked failure when a successful submit occurs', () => {
      sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 1000 }),
        1000,
      );
      // Successful submit clears the tracked failure
      sensor.process(submitEnvelope({ selector: 'form#login', timestamp: 3000 }), 3000);
      // Now a failed submit should NOT fire (no prior failure)
      const result = sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 5000 }),
        5000,
      );
      expect(result).toBeNull();
    });

    it('should fire at exactly the window boundary', () => {
      sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 0 }),
        0,
      );
      const result = sensor.process(
        submitEnvelope({
          selector: 'form#login',
          defaultPrevented: true,
          timestamp: BLOCKED_INTENT_SUBMIT_WINDOW_MS,
        }),
        BLOCKED_INTENT_SUBMIT_WINDOW_MS,
      );
      expect(result).not.toBeNull();
    });
  });

  // ─── Rule 2: Click Retry Loop ───

  describe('Rule 2 — Click Retry Loop', () => {
    it('should fire on two clicks on same element within 2s with no DOM change', () => {
      const el = stubElement('btn');
      sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: true,
          timestamp: 0,
        }),
        0,
      );
      const result = sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: false,
          timestamp: 1000,
        }),
        1000,
      );
      expect(result).not.toBeNull();
      expect(result!.type).toBe('ADAPT_BLOCKED_INTENT');
      expect(result!.metrics.subtype).toBe('action_unresponsive');
    });

    it('should NOT fire when DOM changed between clicks', () => {
      const el = stubElement('btn');
      sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: true,
          timestamp: 0,
        }),
        0,
      );
      const result = sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: true,
          timestamp: 1000,
        }),
        1000,
      );
      expect(result).toBeNull();
    });

    it('should NOT fire on clicks on different elements', () => {
      const elA = stubElement('a');
      const elB = stubElement('b');
      sensor.process(
        clickEnvelope({
          element: elA,
          selector: 'button#a',
          domChangedSinceLastClick: true,
          timestamp: 0,
        }),
        0,
      );
      const result = sensor.process(
        clickEnvelope({
          element: elB,
          selector: 'button#b',
          domChangedSinceLastClick: false,
          timestamp: 1000,
        }),
        1000,
      );
      expect(result).toBeNull();
    });

    it('should NOT fire when clicks are >2s apart', () => {
      const el = stubElement('btn');
      sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: true,
          timestamp: 0,
        }),
        0,
      );
      const result = sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: false,
          timestamp: BLOCKED_INTENT_CLICK_WINDOW_MS + 1,
        }),
        BLOCKED_INTENT_CLICK_WINDOW_MS + 1,
      );
      expect(result).toBeNull();
    });

    it('should NOT fire on click to non-interactive element', () => {
      const el = stubElement('div');
      sensor.process(
        clickEnvelope({
          element: el,
          isInteractive: false,
          interactiveReason: null,
          domChangedSinceLastClick: true,
          timestamp: 0,
        }),
        0,
      );
      const result = sensor.process(
        clickEnvelope({
          element: el,
          isInteractive: false,
          interactiveReason: null,
          domChangedSinceLastClick: false,
          timestamp: 500,
        }),
        500,
      );
      expect(result).toBeNull();
    });

    it('should respect cooldown after firing', () => {
      const el = stubElement('btn');
      sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: true,
          timestamp: 0,
        }),
        0,
      );
      const fire = sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: false,
          timestamp: 1000,
        }),
        1000,
      );
      expect(fire).not.toBeNull();

      // During cooldown (1000 + 2000 = 3000)
      sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: true,
          timestamp: 1500,
        }),
        1500,
      );
      const noFire = sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: false,
          timestamp: 2000,
        }),
        2000,
      );
      expect(noFire).toBeNull();
    });

    it('should NOT fire on a single click (no prior click)', () => {
      const el = stubElement('btn');
      const result = sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: false,
          timestamp: 0,
        }),
        0,
      );
      expect(result).toBeNull();
    });

    it('should include timeSinceFirstClickMs in metrics', () => {
      const el = stubElement('btn');
      sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: true,
          timestamp: 100,
        }),
        100,
      );
      const result = sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: false,
          timestamp: 800,
        }),
        800,
      );
      expect(result!.metrics.timeSinceFirstClickMs).toBe(700);
    });

    it('should fire at exactly the click window boundary', () => {
      const el = stubElement('btn');
      sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: true,
          timestamp: 0,
        }),
        0,
      );
      const result = sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: false,
          timestamp: BLOCKED_INTENT_CLICK_WINDOW_MS,
        }),
        BLOCKED_INTENT_CLICK_WINDOW_MS,
      );
      expect(result).not.toBeNull();
    });

    it('should pass through semantic fields when present', () => {
      const el = stubElement('btn');
      sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          adaptRole: 'cta',
          adaptStep: 'payment',
          domChangedSinceLastClick: true,
          timestamp: 0,
        }),
        0,
      );
      const result = sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          adaptRole: 'cta',
          adaptStep: 'payment',
          domChangedSinceLastClick: false,
          timestamp: 1000,
        }),
        1000,
      );
      expect(result).not.toBeNull();
      expect(result!.semantic).toEqual({
        nodeId: null,
        role: 'cta',
        modifier: null,
        step: 'payment',
      });
    });
  });

  // ─── Cross-rule ───

  describe('Cross-rule behavior', () => {
    it('should fire both rules independently in the same session', () => {
      // Rule 2: click retry
      const el = stubElement('btn');
      sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: true,
          timestamp: 0,
        }),
        0,
      );
      const clickResult = sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: false,
          timestamp: 1000,
        }),
        1000,
      );
      expect(clickResult).not.toBeNull();
      expect(clickResult!.metrics.subtype).toBe('action_unresponsive');

      // Rule 1: submit failure
      sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 5000 }),
        5000,
      );
      const submitResult = sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 8000 }),
        8000,
      );
      expect(submitResult).not.toBeNull();
      expect(submitResult!.metrics.subtype).toBe('form_submission');
    });

    it('should clear all state on reset()', () => {
      const el = stubElement('btn');
      sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: true,
          timestamp: 0,
        }),
        0,
      );
      sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 0 }),
        0,
      );

      sensor.reset();

      // Click should not fire (no prior click after reset)
      const clickResult = sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: false,
          timestamp: 500,
        }),
        500,
      );
      expect(clickResult).toBeNull();

      // Submit should not fire (no prior failure after reset)
      const submitResult = sensor.process(
        submitEnvelope({ selector: 'form#login', defaultPrevented: true, timestamp: 500 }),
        500,
      );
      expect(submitResult).toBeNull();
    });

    it('should fire again after cooldown for click retry', () => {
      const el = stubElement('btn');
      // First fire
      sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: true,
          timestamp: 0,
        }),
        0,
      );
      sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: false,
          timestamp: 1000,
        }),
        1000,
      );
      // cooldownUntil = 1000 + 2000 = 3000

      // After cooldown
      sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: true,
          timestamp: 3000,
        }),
        3000,
      );
      const result = sensor.process(
        clickEnvelope({
          element: el,
          selector: 'button#btn',
          domChangedSinceLastClick: false,
          timestamp: 4000,
        }),
        4000,
      );
      expect(result).not.toBeNull();
    });
  });
});
