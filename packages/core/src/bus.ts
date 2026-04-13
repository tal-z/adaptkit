import type { AdaptKitEvent } from './types.js';

type Handler = (event: AdaptKitEvent) => void;

export class ActionBus {
  private listeners = new Map<string, Set<Handler>>();

  /** Subscribe to an event type (or '*' for all). Returns an unsubscribe function. */
  on(eventType: string, handler: Handler): () => void {
    let set = this.listeners.get(eventType);
    if (!set) {
      set = new Set();
      this.listeners.set(eventType, set);
    }
    set.add(handler);
    return () => this.off(eventType, handler);
  }

  /** Unsubscribe a specific handler from an event type. */
  off(eventType: string, handler: Handler): void {
    const set = this.listeners.get(eventType);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  /** Emit an event to all matching subscribers. */
  emit(event: AdaptKitEvent): void {
    // Type-specific handlers first
    const typeHandlers = this.listeners.get(event.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          handler(event);
        } catch (err) {
          console.error('[AdaptKit] Handler error:', err);
        }
      }
    }

    // Then wildcard handlers
    const wildcardHandlers = this.listeners.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler(event);
        } catch (err) {
          console.error('[AdaptKit] Handler error:', err);
        }
      }
    }
  }

  /** Remove all subscribers. */
  clear(): void {
    this.listeners.clear();
  }
}
