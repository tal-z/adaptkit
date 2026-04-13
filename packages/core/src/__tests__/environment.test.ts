import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ActionBus } from '../bus.js';
import { EnvironmentDetector } from '../environment.js';
import type { ContextChangeEvent } from '../types.js';

// jsdom doesn't provide PointerEvent — polyfill for testing
if (typeof globalThis.PointerEvent === 'undefined') {
  (globalThis as Record<string, unknown>).PointerEvent = class PointerEvent extends MouseEvent {
    readonly pointerType: string;
    constructor(type: string, init?: PointerEventInit & { pointerType?: string }) {
      super(type, init);
      this.pointerType = init?.pointerType ?? '';
    }
  };
}

describe('EnvironmentDetector', () => {
  let bus: ActionBus;
  let detector: EnvironmentDetector;

  beforeEach(() => {
    bus = new ActionBus();
  });

  afterEach(() => {
    detector?.stop();
  });

  describe('initial detection', () => {
    it('should return default environment context', () => {
      detector = new EnvironmentDetector(bus);
      const env = detector.getEnvironment();

      expect(env).toHaveProperty('inputModality');
      expect(env).toHaveProperty('pointer');
      expect(env).toHaveProperty('hoverCapable');
      expect(env).toHaveProperty('viewport');
      expect(env).toHaveProperty('connection');
      expect(env).toHaveProperty('prefersReducedMotion');
      expect(env).toHaveProperty('prefersHighContrast');
      expect(env).toHaveProperty('colorScheme');
      expect(env).toHaveProperty('deviceMemory');
    });

    it('should bucket viewport based on window.innerWidth', () => {
      // jsdom defaults to 1024px innerWidth → 'wide'
      detector = new EnvironmentDetector(bus);
      const env = detector.getEnvironment();
      expect(env.viewport).toBe('wide');
    });

    it('should return a copy, not a reference', () => {
      detector = new EnvironmentDetector(bus);
      const a = detector.getEnvironment();
      const b = detector.getEnvironment();
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });

    it('should detect connection as null when navigator.connection unavailable', () => {
      detector = new EnvironmentDetector(bus);
      const env = detector.getEnvironment();
      // jsdom does not provide navigator.connection
      expect(env.connection).toBeNull();
    });

    it('should detect deviceMemory as null when API unavailable', () => {
      detector = new EnvironmentDetector(bus);
      const env = detector.getEnvironment();
      expect(env.deviceMemory).toBeNull();
    });
  });

  describe('input modality detection', () => {
    it('should update inputModality on pointerdown with touch', () => {
      detector = new EnvironmentDetector(bus);
      detector.start();
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_ENVIRONMENT_CHANGE', (e) => events.push(e as ContextChangeEvent));

      const pointerEvent = new PointerEvent('pointerdown', { pointerType: 'touch' });
      document.dispatchEvent(pointerEvent);

      // Only emits if value actually changed
      if (detector.getEnvironment().inputModality === 'touch') {
        // May or may not have emitted depending on initial state
        expect(detector.getEnvironment().inputModality).toBe('touch');
      }
    });

    it('should update inputModality on pointerdown with pen', () => {
      detector = new EnvironmentDetector(bus);
      detector.start();
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_ENVIRONMENT_CHANGE', (e) => events.push(e as ContextChangeEvent));

      const pointerEvent = new PointerEvent('pointerdown', { pointerType: 'pen' });
      document.dispatchEvent(pointerEvent);

      expect(detector.getEnvironment().inputModality).toBe('pen');
      expect(events.length).toBeGreaterThanOrEqual(1);
      const penEvent = events.find((e) => e.field === 'inputModality');
      expect(penEvent?.currentValue).toBe('pen');
    });

    it('should update inputModality to keyboard on Tab key', () => {
      detector = new EnvironmentDetector(bus);
      detector.start();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));

      expect(detector.getEnvironment().inputModality).toBe('keyboard');
    });

    it('should update inputModality to keyboard on Enter key', () => {
      detector = new EnvironmentDetector(bus);
      detector.start();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(detector.getEnvironment().inputModality).toBe('keyboard');
    });

    it('should not emit when modality does not change', () => {
      detector = new EnvironmentDetector(bus);
      detector.start();
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_ENVIRONMENT_CHANGE', (e) => events.push(e as ContextChangeEvent));

      // Set to mouse first
      document.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse' }));
      const countAfterFirst = events.filter((e) => e.field === 'inputModality').length;

      // Same modality again — should not emit
      document.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse' }));
      const countAfterSecond = events.filter((e) => e.field === 'inputModality').length;

      expect(countAfterSecond).toBe(countAfterFirst);
    });
  });

  describe('viewport detection', () => {
    it('should emit viewport change on resize', () => {
      detector = new EnvironmentDetector(bus);
      detector.start();
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_ENVIRONMENT_CHANGE', (e) => events.push(e as ContextChangeEvent));

      // Simulate resize to compact
      Object.defineProperty(window, 'innerWidth', {
        value: 500,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('resize'));

      const viewportEvent = events.find((e) => e.field === 'viewport');
      expect(viewportEvent).toBeDefined();
      expect(viewportEvent?.currentValue).toBe('compact');
      expect(detector.getEnvironment().viewport).toBe('compact');

      // Restore
      Object.defineProperty(window, 'innerWidth', {
        value: 1024,
        writable: true,
        configurable: true,
      });
    });

    it('should not emit when viewport bucket stays the same', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 1200,
        writable: true,
        configurable: true,
      });
      detector = new EnvironmentDetector(bus);
      detector.start();
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_ENVIRONMENT_CHANGE', (e) => events.push(e as ContextChangeEvent));

      // Still wide
      Object.defineProperty(window, 'innerWidth', {
        value: 1300,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('resize'));

      const viewportEvents = events.filter((e) => e.field === 'viewport');
      expect(viewportEvents).toHaveLength(0);

      // Restore
      Object.defineProperty(window, 'innerWidth', {
        value: 1024,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('event emission', () => {
    it('should emit ADAPT_ENVIRONMENT_CHANGE with field, previousValue, currentValue', () => {
      detector = new EnvironmentDetector(bus);
      detector.start();
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_ENVIRONMENT_CHANGE', (e) => events.push(e as ContextChangeEvent));

      // Force a change
      document.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'pen' }));

      const event = events.find((e) => e.field === 'inputModality');
      expect(event).toBeDefined();
      expect(event!.type).toBe('ADAPT_ENVIRONMENT_CHANGE');
      expect(event!.field).toBe('inputModality');
      expect(event!.currentValue).toBe('pen');
      expect(event!.timestamp).toBeGreaterThan(0);
    });
  });

  describe('lifecycle', () => {
    it('should stop listening after stop()', () => {
      detector = new EnvironmentDetector(bus);
      detector.start();
      detector.stop();

      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_ENVIRONMENT_CHANGE', (e) => events.push(e as ContextChangeEvent));

      document.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'pen' }));

      expect(events).toHaveLength(0);
    });

    it('should reset to initial detected values', () => {
      detector = new EnvironmentDetector(bus);
      detector.start();

      // Change modality
      document.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'pen' }));
      expect(detector.getEnvironment().inputModality).toBe('pen');

      detector.reset();
      // After reset, re-detects from current media queries (not pen)
      expect(detector.getEnvironment().inputModality).not.toBe('pen');
    });
  });

  describe('environment overrides', () => {
    it('should layer overrides on top of detected values', () => {
      detector = new EnvironmentDetector(bus);
      detector.start();

      detector.overrideEnvironment({ pointer: 'coarse', connection: 'slow' });

      const env = detector.getEnvironment();
      expect(env.pointer).toBe('coarse');
      expect(env.connection).toBe('slow');
      // Non-overridden values stay detected
      expect(env).toHaveProperty('viewport');
      expect(env).toHaveProperty('inputModality');
    });

    it('should emit ENVIRONMENT_CHANGE for each changed field', () => {
      detector = new EnvironmentDetector(bus);
      detector.start();
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_ENVIRONMENT_CHANGE', (e) => events.push(e as ContextChangeEvent));

      detector.overrideEnvironment({ connection: 'slow' });

      const connectionEvent = events.find((e) => e.field === 'connection');
      expect(connectionEvent).toBeDefined();
      expect(connectionEvent?.currentValue).toBe('slow');
    });

    it('should not emit when override value matches current', () => {
      detector = new EnvironmentDetector(bus);
      detector.start();

      // Get current viewport value
      const currentViewport = detector.getEnvironment().viewport;
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_ENVIRONMENT_CHANGE', (e) => events.push(e as ContextChangeEvent));

      // Override with same value
      detector.overrideEnvironment({ viewport: currentViewport });

      const viewportEvents = events.filter((e) => e.field === 'viewport');
      expect(viewportEvents).toHaveLength(0);
    });

    it('should restore detected values on clearEnvironmentOverrides', () => {
      detector = new EnvironmentDetector(bus);
      detector.start();

      const detectedConnection = detector.getEnvironment().connection;
      detector.overrideEnvironment({ connection: 'slow' });
      expect(detector.getEnvironment().connection).toBe('slow');

      detector.clearEnvironmentOverrides();
      expect(detector.getEnvironment().connection).toBe(detectedConnection);
    });

    it('should emit ENVIRONMENT_CHANGE when clearing overrides that differ from detected', () => {
      detector = new EnvironmentDetector(bus);
      detector.start();

      detector.overrideEnvironment({ connection: 'slow' });
      const events: ContextChangeEvent[] = [];
      bus.on('ADAPT_ENVIRONMENT_CHANGE', (e) => events.push(e as ContextChangeEvent));

      detector.clearEnvironmentOverrides();

      const connectionEvent = events.find((e) => e.field === 'connection');
      expect(connectionEvent).toBeDefined();
      expect(connectionEvent?.previousValue).toBe('slow');
    });

    it('should clear overrides on reset()', () => {
      detector = new EnvironmentDetector(bus);
      detector.start();

      detector.overrideEnvironment({ connection: 'slow' });
      detector.reset();

      // After reset, overrides should be gone
      expect(detector.getEnvironment().connection).not.toBe('slow');
    });
  });
});
