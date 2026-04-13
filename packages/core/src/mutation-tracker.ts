const MAX_ANCESTOR_WALK = 5;

const MO_OPTIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
};

interface PendingWatch {
  element: Element;
  selector: string;
  timer: ReturnType<typeof setTimeout>;
  resolved: boolean;
  onResult: (mutated: boolean) => void;
}

export class MutationTracker {
  private observer: MutationObserver | null = null;
  private mutatedNodes = new Set<Node>();
  private anyMutation = false;
  private pendingWatches: PendingWatch[] = [];
  private root: Element | null = null;
  private staleTimer: ReturnType<typeof setTimeout> | null = null;

  private static readonly STALE_MS = 10_000;
  private static readonly MAX_MUTATED_NODES = 500;

  constructor(private selectorFn: (el: Element) => string) {}

  start(root: Element): void {
    this.root = root;
    this.observer = new MutationObserver((mutations) => this.handleMutations(mutations));
    this.observer.observe(root, MO_OPTIONS);
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    for (const watch of this.pendingWatches) {
      clearTimeout(watch.timer);
    }
    this.pendingWatches = [];
    this.mutatedNodes.clear();
    this.anyMutation = false;
    this.root = null;
    if (this.staleTimer) {
      clearTimeout(this.staleTimer);
      this.staleTimer = null;
    }
  }

  /** Check if an element or any of its ancestors had a structural mutation since last reset. */
  hasMutationNear(element: Element): boolean {
    if (!this.anyMutation) return false;

    let current: Node | null = element;
    let depth = 0;
    while (current && depth < MAX_ANCESTOR_WALK) {
      if (this.mutatedNodes.has(current)) return true;
      current = current.parentNode;
      depth++;
    }
    return false;
  }

  /** Reset per-click mutation records. Call after processing a click. */
  resetAfterClick(): void {
    this.mutatedNodes.clear();
    this.anyMutation = false;
    if (this.staleTimer) {
      clearTimeout(this.staleTimer);
      this.staleTimer = null;
    }
  }

  /** Temporarily disconnect the observer (e.g., during event emission to prevent self-triggering). */
  pause(): void {
    if (this.observer) {
      // Drain any pending records before disconnecting
      const pending = this.observer.takeRecords();
      if (pending.length > 0) {
        this.handleMutations(pending);
      }
      this.observer.disconnect();
    }
  }

  /** Reconnect the observer after a pause. */
  resume(): void {
    if (this.observer && this.root) {
      this.observer.observe(this.root, MO_OPTIONS);
    }
  }

  /**
   * Watch for a DOM mutation near a target element within a time window.
   * If a mutation occurs near the element before the timeout, calls onResult(true).
   * If the timeout expires with no nearby mutation, calls onResult(false).
   * Used by dead-click detection to implement post-click mutation windows.
   */
  watchForMutation(
    element: Element,
    selector: string,
    windowMs: number,
    onResult: (mutated: boolean) => void,
  ): void {
    const watch: PendingWatch = {
      element,
      selector,
      resolved: false,
      onResult,
      timer: setTimeout(() => {
        if (!watch.resolved) {
          watch.resolved = true;
          this.removePendingWatch(watch);
          onResult(false);
        }
      }, windowMs),
    };
    this.pendingWatches.push(watch);
  }

  /** Cancel all pending watches (e.g., on stop). */
  cancelAllWatches(): void {
    for (const watch of this.pendingWatches) {
      clearTimeout(watch.timer);
    }
    this.pendingWatches = [];
  }

  // ─── Internals ───

  private handleMutations(mutations: MutationRecord[]): void {
    this.anyMutation = true;

    for (const mutation of mutations) {
      // Record only the mutation target (the node whose children/attributes changed).
      // hasMutationNear walks UP from the queried element checking if any ancestor
      // was a mutation target — this keeps detection local without polluting via
      // shared ancestors like document.body.
      this.mutatedNodes.add(mutation.target);
    }

    // Hard cap to prevent unbounded growth on long-lived SPAs
    if (this.mutatedNodes.size > MutationTracker.MAX_MUTATED_NODES) {
      this.mutatedNodes.clear();
      this.anyMutation = false;
    }

    // Check pending watches — resolve any that now have a nearby mutation
    this.resolvePendingWatches();

    // Restart staleness timer — clear accumulated mutations if no click resets them
    this.restartStaleTimer();
  }

  private restartStaleTimer(): void {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => {
      this.mutatedNodes.clear();
      this.anyMutation = false;
      this.staleTimer = null;
    }, MutationTracker.STALE_MS);
  }

  private resolvePendingWatches(): void {
    for (const watch of this.pendingWatches) {
      if (watch.resolved) continue;
      if (this.hasMutationNear(watch.element)) {
        watch.resolved = true;
        clearTimeout(watch.timer);
        watch.onResult(true);
      }
    }
    // Clean up resolved watches
    this.pendingWatches = this.pendingWatches.filter((w) => !w.resolved);
  }

  private removePendingWatch(watch: PendingWatch): void {
    const idx = this.pendingWatches.indexOf(watch);
    if (idx !== -1) {
      this.pendingWatches.splice(idx, 1);
    }
  }
}
