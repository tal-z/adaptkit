import type { ClickEnvelope, FocusEnvelope, SubmitEnvelope, InputEnvelope } from './types.js';

export interface PrivacyOptions {
  collectTargetText: boolean;
  piiFilter?: (element: Element) => boolean;
}

const INTERACTIVE_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY']);
const INTERACTIVE_ROLES = new Set(['button', 'link', 'menuitem', 'tab', 'option']);
const FORM_FIELD_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
const MAX_ANCESTOR_WALK = 5;
const MAX_TEXT_LENGTH = 50;

interface InteractiveResult {
  element: Element;
  reason: string;
}

function resolveInteractiveAncestor(el: Element): InteractiveResult | null {
  let current: Element | null = el;
  let depth = 0;

  while (current && depth <= MAX_ANCESTOR_WALK) {
    if (INTERACTIVE_TAGS.has(current.tagName)) {
      return { element: current, reason: `tag:${current.tagName.toLowerCase()}` };
    }

    const role = current.getAttribute('role');
    if (role && INTERACTIVE_ROLES.has(role)) {
      return { element: current, reason: `role:${role}` };
    }

    try {
      if (getComputedStyle(current).cursor === 'pointer') {
        return { element: current, reason: 'cursor:pointer' };
      }
    } catch {
      // getComputedStyle can fail on detached elements
    }

    current = current.parentElement;
    depth++;
  }

  return null;
}

function findSemanticAttr(el: Element, attr: string): string | null {
  let current: Element | null = el;

  while (current) {
    if (current.hasAttribute(attr)) {
      return current.getAttribute(attr);
    }
    current = current.parentElement;
  }

  return null;
}

function checkIsSubmitType(el: Element): boolean {
  const tag = el.tagName;
  if (tag === 'INPUT') {
    return el.getAttribute('type') === 'submit';
  }
  if (tag === 'BUTTON') {
    const type = el.getAttribute('type');
    // submit is the default type for buttons
    return type === 'submit' || type === null || type === '';
  }
  return false;
}

export function buildClickEnvelope(
  event: MouseEvent,
  getSelector: (el: Element) => string,
  privacy: PrivacyOptions,
): ClickEnvelope {
  const rawTarget = event.target as Element;
  const interactive = resolveInteractiveAncestor(rawTarget);
  const element = interactive ? interactive.element : rawTarget;

  const selector = getSelector(element);
  const tag = element.tagName;
  const isPIIClick =
    findSemanticAttr(element, 'data-adapt-pii') !== null || (privacy.piiFilter?.(element) ?? false);
  const text =
    !privacy.collectTargetText || isPIIClick
      ? ''
      : (element.textContent || '').trim().slice(0, MAX_TEXT_LENGTH);

  const hasHref = element.hasAttribute('href');
  const hrefValue = hasHref ? element.getAttribute('href') : null;

  const isDisabled =
    element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';

  const isInsideForm = element.closest('form') !== null;
  const isSubmitType = checkIsSubmitType(element);

  const adaptRole = findSemanticAttr(element, 'data-adapt-role');
  const adaptStep = findSemanticAttr(element, 'data-adapt-step');

  return {
    kind: 'click',
    timestamp: event.timeStamp,
    domChangedSinceLastClick: true, // Conservative default; collector overrides with actual value
    target: {
      element,
      selector,
      tag,
      text,
      isInteractive: interactive !== null,
      interactiveReason: interactive ? interactive.reason : null,
      detail: event.detail,
      hasHref,
      hrefValue,
      isDisabled,
      isInsideForm,
      isSubmitType,
      defaultPrevented: event.defaultPrevented,
      adaptRole,
      adaptStep,
      semanticNodeId: null,
      semanticModifier: null,
    },
  };
}

export function buildFocusEnvelope(
  event: FocusEvent,
  getSelector: (el: Element) => string,
): FocusEnvelope {
  const element = event.target as Element;
  const selector = getSelector(element);
  const tag = element.tagName;
  const isFormField = FORM_FIELD_TAGS.has(tag);

  const adaptRole = findSemanticAttr(element, 'data-adapt-role');
  const adaptStep = findSemanticAttr(element, 'data-adapt-step');

  const formEl = element.closest('form');
  const formSelector = formEl ? getSelector(formEl) : null;

  return {
    kind: 'focusin',
    timestamp: event.timeStamp,
    target: {
      element,
      selector,
      tag,
      isFormField,
      formSelector,
      adaptRole,
      adaptStep,
      semanticNodeId: null,
      semanticModifier: null,
    },
  };
}

export function buildSubmitEnvelope(
  event: Event,
  getSelector: (el: Element) => string,
): SubmitEnvelope {
  const form = event.target as Element;
  const selector = getSelector(form);
  const defaultPrevented = event.defaultPrevented;

  let hasInvalidInputs = false;
  try {
    hasInvalidInputs = form.querySelectorAll(':invalid').length > 0;
  } catch {
    // querySelectorAll can fail on unusual elements
  }

  return {
    kind: 'submit',
    timestamp: event.timeStamp,
    target: {
      element: form,
      selector,
      defaultPrevented,
      hasInvalidInputs,
    },
  };
}

const PII_TYPES = new Set(['password', 'email', 'tel']);
const PII_NAME_PATTERNS =
  /ssn|social.?sec|tax.?id|phone|tel|dob|birth|address|street|city|zip|postal|card|cvv|cvc|expir|acct|account|routing|member.?id|patient|mrn|diagnosis|medication|first.?name|last.?name|full.?name/i;

function isPIIAutocomplete(value: string | null): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return (
    v.startsWith('cc-') ||
    v === 'current-password' ||
    v === 'new-password' ||
    v.startsWith('tel') ||
    v.startsWith('address') ||
    v.startsWith('bday') ||
    v === 'name' ||
    v === 'given-name' ||
    v === 'family-name' ||
    v === 'additional-name' ||
    v === 'honorific-prefix' ||
    v === 'honorific-suffix' ||
    v === 'email'
  );
}

export function buildInputEnvelope(
  event: Event,
  getSelector: (el: Element) => string,
  privacy: PrivacyOptions,
): InputEnvelope | null {
  const element = event.target as HTMLInputElement | HTMLTextAreaElement | null;
  if (!element || !('value' in element)) return null;

  const tag = element.tagName;
  if (tag !== 'INPUT' && tag !== 'TEXTAREA') return null;

  // Skip PII fields
  const inputType = element.getAttribute('type')?.toLowerCase() ?? '';
  const autocomplete = element.getAttribute('autocomplete');
  const name = element.getAttribute('name') ?? '';
  const isPII =
    PII_TYPES.has(inputType) ||
    isPIIAutocomplete(autocomplete) ||
    PII_NAME_PATTERNS.test(name) ||
    element.classList.contains('adapt-ignore') ||
    findSemanticAttr(element, 'data-adapt-pii') !== null ||
    (privacy.piiFilter?.(element) ?? false);
  const text = isPII ? '' : (element as HTMLInputElement).value;

  return {
    kind: 'input',
    timestamp: event.timeStamp,
    target: {
      element,
      selector: getSelector(element),
      tag,
      bufferLength: isPII ? 0 : (element as HTMLInputElement).value.length,
      text,
      precedingShortcut: null, // Set by collector from keydown ring buffer
    },
  };
}
