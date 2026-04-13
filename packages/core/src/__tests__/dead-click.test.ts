import { describe, it, expect, beforeEach } from 'vitest';
import { DeadClickSensor } from '../sensors/dead-click.js';
import { clickEnvelope } from './helpers.js';
import { DEAD_CLICK_COOLDOWN_MS } from '../constants.js';

describe('DeadClickSensor', () => {
  let sensor: DeadClickSensor;

  beforeEach(() => {
    sensor = new DeadClickSensor();
  });

  // ─── shouldEvaluate (synchronous pre-filter) ───

  describe('shouldEvaluate', () => {
    it('should return envelope for interactive button', () => {
      const env = clickEnvelope();
      expect(sensor.shouldEvaluate(env, 1000)).toBe(env);
    });

    it('should return null when isInteractive is false', () => {
      const result = sensor.shouldEvaluate(
        clickEnvelope({ isInteractive: false, interactiveReason: null }),
        1000,
      );
      expect(result).toBeNull();
    });

    it('should return null when defaultPrevented is true', () => {
      const result = sensor.shouldEvaluate(clickEnvelope({ defaultPrevented: true }), 1000);
      expect(result).toBeNull();
    });

    it('should return null when hasHref is true and hrefValue is a real URL', () => {
      const result = sensor.shouldEvaluate(
        clickEnvelope({ hasHref: true, hrefValue: '/page', tag: 'A' }),
        1000,
      );
      expect(result).toBeNull();
    });

    it('should return envelope when hasHref is true but hrefValue is "#"', () => {
      const result = sensor.shouldEvaluate(
        clickEnvelope({ hasHref: true, hrefValue: '#', tag: 'A' }),
        1000,
      );
      expect(result).not.toBeNull();
    });

    it('should return envelope when hasHref is true but hrefValue is ""', () => {
      const result = sensor.shouldEvaluate(
        clickEnvelope({ hasHref: true, hrefValue: '', tag: 'A' }),
        1000,
      );
      expect(result).not.toBeNull();
    });

    it('should return envelope when hasHref is true but hrefValue starts with "javascript:"', () => {
      const result = sensor.shouldEvaluate(
        clickEnvelope({ hasHref: true, hrefValue: 'javascript:void(0)', tag: 'A' }),
        1000,
      );
      expect(result).not.toBeNull();
    });

    it('should return null when isDisabled is true', () => {
      const result = sensor.shouldEvaluate(clickEnvelope({ isDisabled: true }), 1000);
      expect(result).toBeNull();
    });

    it('should return null when isSubmitType AND isInsideForm', () => {
      const result = sensor.shouldEvaluate(
        clickEnvelope({ isSubmitType: true, isInsideForm: true }),
        1000,
      );
      expect(result).toBeNull();
    });

    it('should return envelope when isSubmitType but NOT isInsideForm (orphan submit)', () => {
      const result = sensor.shouldEvaluate(
        clickEnvelope({ isSubmitType: true, isInsideForm: false }),
        1000,
      );
      expect(result).not.toBeNull();
    });

    it('should return null for INPUT tag (native behavior)', () => {
      const result = sensor.shouldEvaluate(clickEnvelope({ tag: 'INPUT' }), 1000);
      expect(result).toBeNull();
    });

    it('should return null for SELECT tag (native behavior)', () => {
      const result = sensor.shouldEvaluate(clickEnvelope({ tag: 'SELECT' }), 1000);
      expect(result).toBeNull();
    });

    it('should return null for TEXTAREA tag (native behavior)', () => {
      const result = sensor.shouldEvaluate(clickEnvelope({ tag: 'TEXTAREA' }), 1000);
      expect(result).toBeNull();
    });

    it('should respect per-selector cooldown', () => {
      const env1 = clickEnvelope({ selector: 'button#a' });
      expect(sensor.shouldEvaluate(env1, 1000)).not.toBeNull();
      // buildEvent sets the cooldown
      sensor.buildEvent(env1, 1000);

      const env2 = clickEnvelope({ selector: 'button#a' });
      expect(sensor.shouldEvaluate(env2, 1100)).toBeNull();
    });

    it('should allow evaluation again after cooldown expires', () => {
      const env1 = clickEnvelope({ selector: 'button#a' });
      sensor.shouldEvaluate(env1, 1000);
      sensor.buildEvent(env1, 1000);

      const env2 = clickEnvelope({ selector: 'button#a' });
      expect(sensor.shouldEvaluate(env2, 1000 + DEAD_CLICK_COOLDOWN_MS + 1)).not.toBeNull();
    });
  });

  // ─── buildEvent ───

  describe('buildEvent', () => {
    it('should return a FrictionEvent with correct type and ruleId', () => {
      const env = clickEnvelope({ selector: 'button#a' });
      const event = sensor.buildEvent(env, 1000);
      expect(event.type).toBe('ADAPT_DEAD_CLICK');
      expect(event.ruleId).toBe('dead-click-v2');
      expect(event.target).toBe('button#a');
      expect(event.timestamp).toBe(1000);
    });

    it('should include interactiveReason in metrics', () => {
      const event = sensor.buildEvent(clickEnvelope({ interactiveReason: 'role:button' }), 1000);
      expect(event.metrics.interactiveReason).toBe('role:button');
    });

    it('should include isDisabled and isInsideForm in metrics', () => {
      const event = sensor.buildEvent(
        clickEnvelope({ isDisabled: false, isInsideForm: true }),
        1000,
      );
      expect(event.metrics.isDisabled).toBe('false');
      expect(event.metrics.isInsideForm).toBe('true');
    });

    it('should pass through semantic fields when present', () => {
      const event = sensor.buildEvent(
        clickEnvelope({ adaptRole: 'primary', adaptStep: 'checkout' }),
        1000,
      );
      expect(event.semantic).toEqual({
        nodeId: null,
        role: 'primary',
        modifier: null,
        step: 'checkout',
      });
    });

    it('should set semantic to null when no semantic attributes present', () => {
      const event = sensor.buildEvent(clickEnvelope(), 1000);
      expect(event.semantic).toBeNull();
    });

    it('should set cooldown after building event', () => {
      const env = clickEnvelope({ selector: 'button#a' });
      sensor.buildEvent(env, 1000);
      // Now shouldEvaluate should reject due to cooldown
      expect(sensor.shouldEvaluate(clickEnvelope({ selector: 'button#a' }), 1100)).toBeNull();
    });
  });

  // ─── reset ───

  describe('reset', () => {
    it('should clear all state', () => {
      const env = clickEnvelope({ selector: 'button#a' });
      sensor.shouldEvaluate(env, 1000);
      sensor.buildEvent(env, 1000);

      sensor.reset();

      // Should allow evaluation again after reset
      expect(sensor.shouldEvaluate(clickEnvelope({ selector: 'button#a' }), 1100)).not.toBeNull();
    });
  });
});
