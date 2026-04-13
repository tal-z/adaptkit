import type { TaskContext, ContextChangeEvent } from './types.js';
import { CONTEXT_EVENTS } from './types.js';
import type { ActionBus } from './bus.js';

export class TaskTracker {
  private context: TaskContext;
  /** Tracks which steps the user has visited, for abandoned-and-returned detection. */
  private visitedSteps = new Set<string>();
  /** Timestamp when the current step became active. */
  private stepEnteredAt: number | null = null;

  constructor(private bus: ActionBus) {
    this.context = {
      currentStep: null,
      timeInStep: 0,
      stepEnteredAt: null,
      completedSteps: [],
      abandonedAndReturned: false,
    };
  }

  /** Record that the user interacted with an element in a given step.
   *  Called when a focus/click event occurs on an element with data-adapt-step. */
  recordStepInteraction(step: string, now: number): void {
    if (step === this.context.currentStep) {
      // Same step — just update time
      this.updateTimeInStep(now);
      return;
    }

    const previousStep = this.context.currentStep;

    // Check for abandoned-and-returned: user visited this step before,
    // then left to interact with a different step, and has now come back
    if (this.visitedSteps.has(step) && previousStep !== null && previousStep !== step) {
      this.context = { ...this.context, abandonedAndReturned: true };
    }

    this.visitedSteps.add(step);
    this.stepEnteredAt = now;
    this.context = {
      ...this.context,
      currentStep: step,
      timeInStep: 0,
      stepEnteredAt: now,
    };

    const event: ContextChangeEvent = {
      type: CONTEXT_EVENTS.STEP_CHANGE,
      timestamp: now,
      field: 'currentStep',
      previousValue: previousStep,
      currentValue: step,
    };
    this.bus.emit(event);
  }

  /** Mark a step as completed. Called on successful form submit within a step scope,
   *  or explicitly by the host app via AdaptKit.markCompleted(). */
  markStepCompleted(step: string): void {
    if (this.context.completedSteps.includes(step)) return;
    this.context = {
      ...this.context,
      completedSteps: [...this.context.completedSteps, step],
    };
  }

  /** Get current task context snapshot.
   *  Computes timeInStep from step entry timestamp for accuracy. */
  getTask(now?: number): TaskContext {
    const currentNow = now ?? Date.now();
    return {
      ...this.context,
      timeInStep:
        this.stepEnteredAt !== null ? Math.round((currentNow - this.stepEnteredAt) / 1000) : 0,
    };
  }

  /** Clear all task state for a new session. */
  reset(): void {
    this.context = {
      currentStep: null,
      timeInStep: 0,
      stepEnteredAt: null,
      completedSteps: [],
      abandonedAndReturned: false,
    };
    this.visitedSteps.clear();
    this.stepEnteredAt = null;
  }

  // ─── Internals ───

  private updateTimeInStep(now: number): void {
    if (this.stepEnteredAt !== null) {
      this.context = {
        ...this.context,
        timeInStep: Math.round((now - this.stepEnteredAt) / 1000),
      };
    }
  }
}
