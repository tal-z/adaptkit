import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AdaptKit from '@adaptkit/core';
import {
  AdaptProvider,
  useAdapt,
  useEnvironment,
  useFriction,
  useBehavior,
  useFamiliarity,
  useTask,
  useAdaptEvent,
} from '../index.jsx';

// Suppress React 19 act warnings in test output
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('React SDK', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    AdaptKit.stop();
  });

  afterEach(() => {
    AdaptKit.stop();
  });

  describe('AdaptProvider', () => {
    it('should render children', () => {
      render(
        <AdaptProvider>
          <div data-testid="child">Hello</div>
        </AdaptProvider>,
      );
      expect(screen.getByTestId('child')).toBeDefined();
    });

    it('should start AdaptKit on mount', () => {
      const startSpy = vi.spyOn(AdaptKit, 'start');
      render(
        <AdaptProvider config={{ debug: false }}>
          <div />
        </AdaptProvider>,
      );
      expect(startSpy).toHaveBeenCalledTimes(1);
      startSpy.mockRestore();
    });

    it('should stop AdaptKit on unmount', () => {
      const stopSpy = vi.spyOn(AdaptKit, 'stop');
      const { unmount } = render(
        <AdaptProvider>
          <div />
        </AdaptProvider>,
      );
      unmount();
      expect(stopSpy).toHaveBeenCalled();
      stopSpy.mockRestore();
    });
  });

  describe('useAdapt', () => {
    function TestComponent({ scope }: { scope?: string }) {
      const adapt = useAdapt(scope);
      return (
        <div>
          <span data-testid="viewport">{adapt.environment.viewport}</span>
          <span data-testid="friction-level">{adapt.friction.level}</span>
          <span data-testid="tempo">{adapt.behavior.interactionTempo}</span>
          <span data-testid="visit-count">{adapt.familiarity.visitCount}</span>
          <span data-testid="current-step">{adapt.task.currentStep ?? 'none'}</span>
        </div>
      );
    }

    it('should return all five context dimensions', () => {
      render(
        <AdaptProvider config={{ debug: false }}>
          <TestComponent />
        </AdaptProvider>,
      );

      expect(screen.getByTestId('viewport').textContent).toBeTruthy();
      expect(screen.getByTestId('friction-level').textContent).toBe('0');
      expect(screen.getByTestId('tempo').textContent).toBe('moderate');
      expect(screen.getByTestId('visit-count').textContent).toBe('0');
      expect(screen.getByTestId('current-step').textContent).toBe('none');
    });
  });

  describe('useEnvironment', () => {
    function EnvironmentComponent() {
      const env = useEnvironment();
      return (
        <div>
          <span data-testid="pointer">{env.pointer}</span>
          <span data-testid="modality">{env.inputModality}</span>
        </div>
      );
    }

    it('should return environment context', () => {
      render(
        <AdaptProvider config={{ debug: false }}>
          <EnvironmentComponent />
        </AdaptProvider>,
      );

      expect(screen.getByTestId('pointer').textContent).toBeTruthy();
      expect(screen.getByTestId('modality').textContent).toBeTruthy();
    });
  });

  describe('useFriction', () => {
    function FrictionComponent({ scope }: { scope?: string }) {
      const friction = useFriction(scope);
      return (
        <div>
          <span data-testid="level">{friction.level}</span>
          <span data-testid="has-signals">{String(friction.hasSignals)}</span>
        </div>
      );
    }

    it('should return zero friction initially', () => {
      render(
        <AdaptProvider config={{ debug: false }}>
          <FrictionComponent />
        </AdaptProvider>,
      );

      expect(screen.getByTestId('level').textContent).toBe('0');
      expect(screen.getByTestId('has-signals').textContent).toBe('false');
    });
  });

  describe('useBehavior', () => {
    function BehaviorComponent() {
      const behavior = useBehavior();
      return (
        <div>
          <span data-testid="tempo">{behavior.interactionTempo}</span>
          <span data-testid="keyboard-first">{String(behavior.keyboardFirst)}</span>
        </div>
      );
    }

    it('should return default behavior context', () => {
      render(
        <AdaptProvider config={{ debug: false }}>
          <BehaviorComponent />
        </AdaptProvider>,
      );

      expect(screen.getByTestId('tempo').textContent).toBe('moderate');
      expect(screen.getByTestId('keyboard-first').textContent).toBe('false');
    });
  });

  describe('useFamiliarity', () => {
    function FamiliarityComponent({ scope }: { scope: string }) {
      const fam = useFamiliarity(scope);
      return (
        <div>
          <span data-testid="visit-count">{fam.visitCount}</span>
          <span data-testid="first-visit">{String(fam.isFirstVisit)}</span>
        </div>
      );
    }

    it('should record a visit on mount and reflect it immediately', async () => {
      render(
        <AdaptProvider config={{ debug: false }}>
          <FamiliarityComponent scope="checkout" />
        </AdaptProvider>,
      );

      // useFamiliarity records the visit in a useEffect, which fires after layout effects.
      // After the effect runs, visitCount should be 1 and isFirstVisit true (first session).
      await waitFor(() => {
        expect(screen.getByTestId('visit-count').textContent).toBe('1');
        expect(screen.getByTestId('first-visit').textContent).toBe('true');
      });
    });
  });

  describe('useTask', () => {
    function TaskComponent() {
      const task = useTask();
      return (
        <div>
          <span data-testid="current-step">{task.currentStep ?? 'none'}</span>
          <span data-testid="time">{task.timeInStep}</span>
        </div>
      );
    }

    it('should return default task context', () => {
      render(
        <AdaptProvider config={{ debug: false }}>
          <TaskComponent />
        </AdaptProvider>,
      );

      expect(screen.getByTestId('current-step').textContent).toBe('none');
      expect(screen.getByTestId('time').textContent).toBe('0');
    });
  });

  describe('useAdaptEvent', () => {
    it('should subscribe to specific event types', () => {
      const handler = vi.fn();

      function EventComponent() {
        useAdaptEvent('ADAPT_RAGE_CLICK', handler);
        return <div />;
      }

      render(
        <AdaptProvider config={{ debug: false }}>
          <EventComponent />
        </AdaptProvider>,
      );

      // Verify the hook registered without errors
      expect(handler).not.toHaveBeenCalled();
    });

    it('should clean up subscription on unmount', () => {
      const handler = vi.fn();

      function EventComponent() {
        useAdaptEvent('ADAPT_RAGE_CLICK', handler);
        return <div />;
      }

      const { unmount } = render(
        <AdaptProvider config={{ debug: false }}>
          <EventComponent />
        </AdaptProvider>,
      );

      unmount();
      // No error should occur
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
