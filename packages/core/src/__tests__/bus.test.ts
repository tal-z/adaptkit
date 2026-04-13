import { describe, it, expect, vi } from 'vitest';
import { ActionBus } from '../bus.js';
import type { FrictionEvent } from '../types.js';

function makeEvent(type: string = 'ADAPT_RAGE_CLICK'): FrictionEvent {
  return {
    type: type as FrictionEvent['type'],
    target: 'button#test',
    timestamp: Date.now(),
    ruleId: 'test-v1',
    metrics: {},
    semantic: null,
  };
}

describe('ActionBus', () => {
  it('should deliver events to subscribers', () => {
    const bus = new ActionBus();
    const handler = vi.fn();
    bus.on('ADAPT_RAGE_CLICK', handler);
    const event = makeEvent('ADAPT_RAGE_CLICK');
    bus.emit(event);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should fire multiple handlers on the same event type', () => {
    const bus = new ActionBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('ADAPT_RAGE_CLICK', h1);
    bus.on('ADAPT_RAGE_CLICK', h2);
    bus.emit(makeEvent('ADAPT_RAGE_CLICK'));
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('should unsubscribe via the returned function', () => {
    const bus = new ActionBus();
    const handler = vi.fn();
    const unsub = bus.on('ADAPT_RAGE_CLICK', handler);
    unsub();
    bus.emit(makeEvent('ADAPT_RAGE_CLICK'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('should unsubscribe via off()', () => {
    const bus = new ActionBus();
    const handler = vi.fn();
    bus.on('ADAPT_RAGE_CLICK', handler);
    bus.off('ADAPT_RAGE_CLICK', handler);
    bus.emit(makeEvent('ADAPT_RAGE_CLICK'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('should deliver all event types to wildcard * listener', () => {
    const bus = new ActionBus();
    const handler = vi.fn();
    bus.on('*', handler);
    bus.emit(makeEvent('ADAPT_RAGE_CLICK'));
    bus.emit(makeEvent('ADAPT_DEAD_CLICK'));
    bus.emit(makeEvent('ADAPT_FORM_THRASHING'));
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('should isolate handler errors without breaking other handlers', () => {
    const bus = new ActionBus();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const badHandler = () => {
      throw new Error('boom');
    };
    const goodHandler = vi.fn();
    bus.on('ADAPT_RAGE_CLICK', badHandler);
    bus.on('ADAPT_RAGE_CLICK', goodHandler);
    bus.emit(makeEvent('ADAPT_RAGE_CLICK'));
    expect(goodHandler).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('should remove all listeners on clear()', () => {
    const bus = new ActionBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('ADAPT_RAGE_CLICK', h1);
    bus.on('*', h2);
    bus.clear();
    bus.emit(makeEvent('ADAPT_RAGE_CLICK'));
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('should not throw when emitting with no listeners', () => {
    const bus = new ActionBus();
    expect(() => bus.emit(makeEvent())).not.toThrow();
  });

  it('should only fire a handler once per emit even if registered twice', () => {
    const bus = new ActionBus();
    const handler = vi.fn();
    bus.on('ADAPT_RAGE_CLICK', handler);
    bus.on('ADAPT_RAGE_CLICK', handler);
    bus.emit(makeEvent('ADAPT_RAGE_CLICK'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should fire type-specific handlers before wildcard handlers', () => {
    const bus = new ActionBus();
    const order: string[] = [];
    bus.on('ADAPT_RAGE_CLICK', () => order.push('specific'));
    bus.on('*', () => order.push('wildcard'));
    bus.emit(makeEvent('ADAPT_RAGE_CLICK'));
    expect(order).toEqual(['specific', 'wildcard']);
  });
});
