import type {
  ClickEnvelope,
  ClickTarget,
  FocusEnvelope,
  FocusTarget,
  SubmitEnvelope,
  SubmitTarget,
  InputEnvelope,
  InputTarget,
} from '../types.js';

let elementCounter = 0;

/**
 * Create a minimal Element stub for buffer identity comparison.
 * Only needed because rage-click uses element reference equality.
 */
export function stubElement(id?: string): Element {
  return { __stubId: id ?? `stub-${elementCounter++}` } as unknown as Element;
}

/**
 * Create a ClickEnvelope with sensible defaults (dead-click candidate: interactive button, no handler).
 * domChangedSinceLastClick defaults to true (conservative — no blocked-intent by default).
 */
export function clickEnvelope(
  overrides?: Partial<ClickTarget> & { timestamp?: number; domChangedSinceLastClick?: boolean },
): ClickEnvelope {
  const timestamp = overrides?.timestamp ?? Date.now();
  const element = overrides?.element ?? stubElement();

  return {
    kind: 'click',
    timestamp,
    domChangedSinceLastClick: overrides?.domChangedSinceLastClick ?? true,
    target: {
      element,
      selector: overrides?.selector ?? 'button#test',
      tag: overrides?.tag ?? 'BUTTON',
      text: overrides?.text ?? 'Click me',
      isInteractive: overrides?.isInteractive ?? true,
      interactiveReason: overrides?.interactiveReason ?? 'tag:button',
      detail: overrides?.detail ?? 1,
      hasHref: overrides?.hasHref ?? false,
      hrefValue: overrides?.hrefValue ?? null,
      isDisabled: overrides?.isDisabled ?? false,
      isInsideForm: overrides?.isInsideForm ?? false,
      isSubmitType: overrides?.isSubmitType ?? false,
      defaultPrevented: overrides?.defaultPrevented ?? false,
      adaptRole: overrides?.adaptRole ?? null,
      adaptStep: overrides?.adaptStep ?? null,
      semanticNodeId: overrides?.semanticNodeId ?? null,
      semanticModifier: overrides?.semanticModifier ?? null,
    },
  };
}

/**
 * Create a FocusEnvelope with sensible defaults (form field input).
 */
export function focusEnvelope(
  overrides?: Partial<FocusTarget> & { timestamp?: number },
): FocusEnvelope {
  const timestamp = overrides?.timestamp ?? Date.now();
  const element = overrides?.element ?? stubElement();

  return {
    kind: 'focusin',
    timestamp,
    target: {
      element,
      selector: overrides?.selector ?? 'input#field',
      tag: overrides?.tag ?? 'INPUT',
      isFormField: overrides?.isFormField ?? true,
      formSelector: overrides?.formSelector ?? null,
      adaptRole: overrides?.adaptRole ?? null,
      adaptStep: overrides?.adaptStep ?? null,
      semanticNodeId: overrides?.semanticNodeId ?? null,
      semanticModifier: overrides?.semanticModifier ?? null,
    },
  };
}

/**
 * Create a SubmitEnvelope with sensible defaults.
 */
export function submitEnvelope(
  overrides?: Partial<SubmitTarget> & { timestamp?: number },
): SubmitEnvelope {
  const timestamp = overrides?.timestamp ?? Date.now();
  const element = overrides?.element ?? stubElement();

  return {
    kind: 'submit',
    timestamp,
    target: {
      element,
      selector: overrides?.selector ?? 'form#test',
      defaultPrevented: overrides?.defaultPrevented ?? false,
      hasInvalidInputs: overrides?.hasInvalidInputs ?? false,
    },
  };
}

/**
 * Create an InputEnvelope with sensible defaults.
 */
export function inputEnvelope(
  overrides?: Partial<InputTarget> & { timestamp?: number },
): InputEnvelope {
  const element = overrides?.element ?? stubElement();
  return {
    kind: 'input',
    timestamp: overrides?.timestamp ?? Date.now(),
    target: {
      element,
      selector: overrides?.selector ?? 'input#field',
      tag: overrides?.tag ?? 'INPUT',
      bufferLength: overrides?.bufferLength ?? 0,
      text: overrides?.text ?? '',
      precedingShortcut: overrides?.precedingShortcut ?? null,
    },
  };
}
