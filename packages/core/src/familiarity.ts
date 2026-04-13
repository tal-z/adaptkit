import type { FamiliarityContext, ContextChangeEvent } from './types.js';
import { CONTEXT_EVENTS } from './types.js';
import type { ActionBus } from './bus.js';

// ─── Storage ───

const STORAGE_KEY = 'adaptkit_familiarity';
const SCHEMA_VERSION = 1;

interface ScopeData {
  visits: number;
  completed: boolean;
  lastVisit: number;
}

interface StorageSchema {
  version: number;
  scopes: Partial<Record<string, ScopeData>>;
}

/** Default context for scopes with no stored data. */
const DEFAULT_FAMILIARITY: FamiliarityContext = {
  visitCount: 0,
  hasCompleted: false,
  isFirstVisit: true,
  lastVisitMs: null,
};

export class FamiliarityTracker {
  private data: StorageSchema;
  /** Scopes already visited in this session — prevents duplicate FAMILIARITY_CHANGE events. */
  private visitedThisSession = new Set<string>();

  constructor(private bus: ActionBus) {
    this.data = this.load();
  }

  /** Record a visit to a scope. Call this when a component/step becomes active.
   *  Increments visit count, updates lastVisit, and emits ADAPT_FAMILIARITY_CHANGE
   *  on the first visit to this scope within the current session. */
  recordVisit(scope: string): void {
    // Only count one visit per scope per session. Without this guard,
    // every click/focus inside a data-adapt-step region would inflate
    // the visit counter, making visitCount meaningless as a "how many
    // sessions has the user seen this" signal.
    if (this.visitedThisSession.has(scope)) return;
    this.visitedThisSession.add(scope);

    const now = Date.now();
    const existing = this.data.scopes[scope];
    const previousCount = existing ? existing.visits : 0;

    if (existing) {
      existing.visits++;
      existing.lastVisit = now;
    } else {
      this.data.scopes[scope] = {
        visits: 1,
        completed: false,
        lastVisit: now,
      };
    }

    this.save();

    const event: ContextChangeEvent = {
      type: CONTEXT_EVENTS.FAMILIARITY_CHANGE,
      timestamp: now,
      field: 'visitCount',
      previousValue: previousCount,
      currentValue: this.data.scopes[scope]!.visits,
    };
    this.bus.emit(event);
  }

  /** Mark a scope as completed by the user.
   *  Updates the completed flag in localStorage. */
  markCompleted(scope: string): void {
    const existing = this.data.scopes[scope];
    const wasCompleted = existing?.completed ?? false;

    if (existing) {
      existing.completed = true;
    } else {
      // Scope wasn't visited yet — create it with 1 visit + completed
      this.data.scopes[scope] = {
        visits: 1,
        completed: true,
        lastVisit: Date.now(),
      };
    }
    this.save();

    if (!wasCompleted) {
      const event: ContextChangeEvent = {
        type: CONTEXT_EVENTS.FAMILIARITY_CHANGE,
        timestamp: Date.now(),
        field: 'hasCompleted',
        previousValue: false,
        currentValue: true,
      };
      this.bus.emit(event);
    }
  }

  /** Get familiarity context for a specific scope. */
  getFamiliarity(scope: string): FamiliarityContext {
    const stored = this.data.scopes[scope];
    if (!stored) return { ...DEFAULT_FAMILIARITY };

    const now = Date.now();
    // Subtract the current session's visit so isFirstVisit reflects prior sessions only.
    // Without this, a return visit reads stored.visits===1 as "first visit" until the
    // user interacts (which would increment to 2) — causing FullWizard to show on reload.
    const priorVisitCount = stored.visits - (this.visitedThisSession.has(scope) ? 1 : 0);
    return {
      visitCount: stored.visits,
      hasCompleted: stored.completed,
      isFirstVisit: priorVisitCount === 0,
      lastVisitMs: now - stored.lastVisit,
    };
  }

  /** Clear all familiarity data from localStorage. */
  reset(): void {
    this.data = { version: SCHEMA_VERSION, scopes: {} };
    this.visitedThisSession.clear();
    this.save();
  }

  /** Clear familiarity data for a specific scope. */
  resetScope(scope: string): void {
    delete this.data.scopes[scope];
    this.visitedThisSession.delete(scope);
    this.save();
  }

  /** Reset session tracking without clearing persisted data.
   *  Used for SPA route changes — allows FAMILIARITY_CHANGE to fire again. */
  resetSession(): void {
    this.visitedThisSession.clear();
  }

  // ─── Internals ───

  private load(): StorageSchema {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { version: SCHEMA_VERSION, scopes: {} };

      const parsed = JSON.parse(raw) as StorageSchema;

      // Version check: if schema version doesn't match, start fresh
      // rather than risking corrupt data from an incompatible format
      if (parsed.version !== SCHEMA_VERSION) {
        return { version: SCHEMA_VERSION, scopes: {} };
      }

      return parsed;
    } catch {
      // localStorage unavailable (private browsing) or corrupt data —
      // degrade to empty state, do not throw
      return { version: SCHEMA_VERSION, scopes: {} };
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // localStorage unavailable or quota exceeded — silently degrade.
      // Safari private browsing throws on setItem.
    }
  }
}
