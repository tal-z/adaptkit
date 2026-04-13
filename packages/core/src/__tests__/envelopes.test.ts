import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildClickEnvelope,
  buildFocusEnvelope,
  buildSubmitEnvelope,
  buildInputEnvelope,
} from '../envelopes.js';
import type { PrivacyOptions } from '../envelopes.js';

const stubSelector = (el: Element) => el.tagName.toLowerCase();

const defaultPrivacy: PrivacyOptions = { collectTargetText: false };
const textEnabled: PrivacyOptions = { collectTargetText: true };

function clickOn(el: Element): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true });
  el.dispatchEvent(event);
  return event;
}

function focusOn(el: Element): FocusEvent {
  const event = new FocusEvent('focusin', { bubbles: true });
  el.dispatchEvent(event);
  return event;
}

describe('buildClickEnvelope', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should resolve a button as interactive with tag reason', () => {
    document.body.innerHTML = '<button id="btn">Click me</button>';
    const btn = document.getElementById('btn')!;
    const event = clickOn(btn);
    const env = buildClickEnvelope(event, stubSelector, defaultPrivacy);
    expect(env.kind).toBe('click');
    expect(env.target.isInteractive).toBe(true);
    expect(env.target.interactiveReason).toBe('tag:button');
    expect(env.target.tag).toBe('BUTTON');
    expect(env.target.text).toBe('');
  });

  it('should capture text when collectTargetText is true', () => {
    document.body.innerHTML = '<button id="btn">Click me</button>';
    const btn = document.getElementById('btn')!;
    const event = clickOn(btn);
    const env = buildClickEnvelope(event, stubSelector, textEnabled);
    expect(env.target.text).toBe('Click me');
  });

  it('should resolve click on span inside button to the button ancestor', () => {
    document.body.innerHTML = '<button><span id="inner">Text</span></button>';
    const span = document.getElementById('inner')!;
    const event = clickOn(span);
    const env = buildClickEnvelope(event, stubSelector, defaultPrivacy);
    expect(env.target.tag).toBe('BUTTON');
    expect(env.target.isInteractive).toBe(true);
    expect(env.target.interactiveReason).toBe('tag:button');
  });

  it('should mark plain div as not interactive', () => {
    document.body.innerHTML = '<div id="plain">Just text</div>';
    const div = document.getElementById('plain')!;
    const event = clickOn(div);
    const env = buildClickEnvelope(event, stubSelector, defaultPrivacy);
    expect(env.target.isInteractive).toBe(false);
    expect(env.target.interactiveReason).toBeNull();
  });

  it('should resolve div with role="button" as interactive', () => {
    document.body.innerHTML = '<div role="button" id="rbtn">Role btn</div>';
    const div = document.getElementById('rbtn')!;
    const event = clickOn(div);
    const env = buildClickEnvelope(event, stubSelector, defaultPrivacy);
    expect(env.target.isInteractive).toBe(true);
    expect(env.target.interactiveReason).toBe('role:button');
  });

  it('should detect href on link', () => {
    document.body.innerHTML = '<a href="/page" id="link">Link</a>';
    const link = document.getElementById('link')!;
    const event = clickOn(link);
    const env = buildClickEnvelope(event, stubSelector, defaultPrivacy);
    expect(env.target.hasHref).toBe(true);
    expect(env.target.hrefValue).toBe('/page');
  });

  it('should detect disabled state', () => {
    document.body.innerHTML = '<button disabled id="btn">Disabled</button>';
    const btn = document.getElementById('btn')!;
    const event = clickOn(btn);
    const env = buildClickEnvelope(event, stubSelector, defaultPrivacy);
    expect(env.target.isDisabled).toBe(true);
  });

  it('should detect submit button inside form', () => {
    document.body.innerHTML = '<form><button type="submit" id="btn">Submit</button></form>';
    const btn = document.getElementById('btn')!;
    const event = clickOn(btn);
    const env = buildClickEnvelope(event, stubSelector, defaultPrivacy);
    expect(env.target.isSubmitType).toBe(true);
    expect(env.target.isInsideForm).toBe(true);
  });

  it('should extract data-adapt-role from the element', () => {
    document.body.innerHTML = '<button data-adapt-role="primary" id="btn">Go</button>';
    const btn = document.getElementById('btn')!;
    const event = clickOn(btn);
    const env = buildClickEnvelope(event, stubSelector, defaultPrivacy);
    expect(env.target.adaptRole).toBe('primary');
  });

  it('should find data-adapt-role from an ancestor', () => {
    document.body.innerHTML = '<div data-adapt-role="checkout"><button id="btn">Go</button></div>';
    const btn = document.getElementById('btn')!;
    const event = clickOn(btn);
    const env = buildClickEnvelope(event, stubSelector, defaultPrivacy);
    expect(env.target.adaptRole).toBe('checkout');
  });
});

describe('buildFocusEnvelope', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should identify input as form field', () => {
    document.body.innerHTML = '<input type="text" id="field" />';
    const input = document.getElementById('field')!;
    const event = focusOn(input);
    const env = buildFocusEnvelope(event, stubSelector);
    expect(env.kind).toBe('focusin');
    expect(env.target.isFormField).toBe(true);
    expect(env.target.tag).toBe('INPUT');
  });

  it('should identify div as not a form field', () => {
    document.body.innerHTML = '<div id="d" tabindex="0">Div</div>';
    const div = document.getElementById('d')!;
    const event = focusOn(div);
    const env = buildFocusEnvelope(event, stubSelector);
    expect(env.target.isFormField).toBe(false);
  });
});

describe('buildSubmitEnvelope', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should build a submit envelope with form target', () => {
    document.body.innerHTML =
      '<form id="myform"><input required /><button type="submit">Go</button></form>';
    const form = document.getElementById('myform')!;
    const event = new Event('submit', { bubbles: true });
    Object.defineProperty(event, 'target', { value: form });
    const env = buildSubmitEnvelope(event, stubSelector);
    expect(env.kind).toBe('submit');
    expect(typeof env.timestamp).toBe('number');
    expect(env.target.selector).toBe('form');
    expect(env.target.defaultPrevented).toBe(false);
  });

  it('should detect invalid inputs in form', () => {
    document.body.innerHTML =
      '<form id="myform"><input required value="" /><button type="submit">Go</button></form>';
    const form = document.getElementById('myform')!;
    const event = new Event('submit', { bubbles: true });
    Object.defineProperty(event, 'target', { value: form });
    const env = buildSubmitEnvelope(event, stubSelector);
    expect(env.target.hasInvalidInputs).toBe(true);
  });
});

describe('buildInputEnvelope — PII exclusion', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function inputOn(el: Element): Event {
    const event = new Event('input', { bubbles: true });
    Object.defineProperty(event, 'target', { value: el });
    return event;
  }

  it('should return text for normal text input', () => {
    document.body.innerHTML = '<input type="text" id="field" value="hello" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env).not.toBeNull();
    expect(env!.target.text).toBe('hello');
  });

  it('should suppress text for password fields', () => {
    document.body.innerHTML = '<input type="password" id="field" value="secret" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env).not.toBeNull();
    expect(env!.target.text).toBe('');
  });

  it('should suppress text for email fields', () => {
    document.body.innerHTML = '<input type="email" id="field" value="user@test.com" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env).not.toBeNull();
    expect(env!.target.text).toBe('');
  });

  it('should suppress text for cc-number autocomplete', () => {
    document.body.innerHTML =
      '<input type="text" autocomplete="cc-number" id="field" value="4111" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
  });

  it('should suppress text for cc-csc autocomplete', () => {
    document.body.innerHTML = '<input type="text" autocomplete="cc-csc" id="field" value="123" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
  });

  it('should suppress text for current-password autocomplete', () => {
    document.body.innerHTML =
      '<input type="text" autocomplete="current-password" id="field" value="pass" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
  });

  it('should suppress text for fields with SSN-related name', () => {
    document.body.innerHTML = '<input type="text" name="ssn" id="field" value="123-45" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
  });

  it('should suppress text for fields with social_security name', () => {
    document.body.innerHTML = '<input type="text" name="social_security" id="field" value="123" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
  });

  it('should suppress text for fields with tax-id name', () => {
    document.body.innerHTML = '<input type="text" name="tax-id" id="field" value="123" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
  });

  it('should suppress text for adapt-ignore class', () => {
    document.body.innerHTML =
      '<input type="text" class="adapt-ignore" id="field" value="secret" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
  });

  it('should suppress both text and bufferLength for PII fields', () => {
    document.body.innerHTML = '<input type="password" id="field" value="secret123" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
    expect(env!.target.bufferLength).toBe(0);
  });
});

describe('buildInputEnvelope — expanded PII patterns', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function inputOn(el: Element): Event {
    const event = new Event('input', { bubbles: true });
    Object.defineProperty(event, 'target', { value: el });
    return event;
  }

  it('should suppress for type="tel"', () => {
    document.body.innerHTML = '<input type="tel" id="field" value="555-1234" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
    expect(env!.target.bufferLength).toBe(0);
  });

  it('should suppress for name="phone_number"', () => {
    document.body.innerHTML = '<input type="text" name="phone_number" id="field" value="555" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
    expect(env!.target.bufferLength).toBe(0);
  });

  it('should suppress for name="first_name"', () => {
    document.body.innerHTML = '<input type="text" name="first_name" id="field" value="John" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
    expect(env!.target.bufferLength).toBe(0);
  });

  it('should suppress for name="card_number"', () => {
    document.body.innerHTML =
      '<input type="text" name="card_number" id="field" value="4111111111111111" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
    expect(env!.target.bufferLength).toBe(0);
  });

  it('should suppress for autocomplete="tel-national"', () => {
    document.body.innerHTML =
      '<input type="text" autocomplete="tel-national" id="field" value="555" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
    expect(env!.target.bufferLength).toBe(0);
  });

  it('should suppress for autocomplete="given-name"', () => {
    document.body.innerHTML =
      '<input type="text" autocomplete="given-name" id="field" value="Jane" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
    expect(env!.target.bufferLength).toBe(0);
  });

  it('should suppress for autocomplete="bday-year"', () => {
    document.body.innerHTML =
      '<input type="text" autocomplete="bday-year" id="field" value="1990" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
    expect(env!.target.bufferLength).toBe(0);
  });

  it('should suppress for autocomplete="address-line1"', () => {
    document.body.innerHTML =
      '<input type="text" autocomplete="address-line1" id="field" value="123 Main" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
    expect(env!.target.bufferLength).toBe(0);
  });

  it('should NOT suppress for type="number" (not a PII type)', () => {
    document.body.innerHTML = '<input type="number" id="field" value="42" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('42');
    expect(env!.target.bufferLength).toBe(2);
  });

  it('should NOT suppress for type="date" (not a PII type)', () => {
    document.body.innerHTML = '<input type="date" id="field" value="2024-01-01" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    // date inputs have tagName INPUT but buildInputEnvelope only processes INPUT/TEXTAREA
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('2024-01-01');
    expect(env!.target.bufferLength).toBe(10);
  });
});

describe('data-adapt-pii attribute', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function inputOn(el: Element): Event {
    const event = new Event('input', { bubbles: true });
    Object.defineProperty(event, 'target', { value: el });
    return event;
  }

  it('should suppress input text and bufferLength when element has data-adapt-pii', () => {
    document.body.innerHTML = '<input type="text" data-adapt-pii id="field" value="secret" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
    expect(env!.target.bufferLength).toBe(0);
  });

  it('should suppress input inside a container with data-adapt-pii', () => {
    document.body.innerHTML =
      '<div data-adapt-pii><input type="text" id="field" value="secret" /></div>';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
    expect(env!.target.bufferLength).toBe(0);
  });

  it('should suppress input 2 levels deep under data-adapt-pii', () => {
    document.body.innerHTML =
      '<section data-adapt-pii><div><input type="text" id="field" value="secret" /></div></section>';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    expect(env!.target.text).toBe('');
    expect(env!.target.bufferLength).toBe(0);
  });

  it('should suppress input deeply nested under data-adapt-pii', () => {
    document.body.innerHTML =
      '<div data-adapt-pii><div><div><div><input type="text" id="field" value="secret" /></div></div></div></div>';
    const input = document.getElementById('field')! as HTMLInputElement;
    const env = buildInputEnvelope(inputOn(input), stubSelector, defaultPrivacy);
    // data-adapt-pii cascades to all descendants regardless of nesting depth
    expect(env!.target.text).toBe('');
    expect(env!.target.bufferLength).toBe(0);
  });

  it('should suppress click text even when collectTargetText is true', () => {
    document.body.innerHTML = '<button data-adapt-pii id="btn">Patient Name</button>';
    const btn = document.getElementById('btn')!;
    const event = clickOn(btn);
    const env = buildClickEnvelope(event, stubSelector, textEnabled);
    expect(env.target.text).toBe('');
  });

  it('should suppress click text inside data-adapt-pii container', () => {
    document.body.innerHTML = '<div data-adapt-pii><button id="btn">Patient Name</button></div>';
    const btn = document.getElementById('btn')!;
    const event = clickOn(btn);
    const env = buildClickEnvelope(event, stubSelector, textEnabled);
    expect(env.target.text).toBe('');
  });
});

describe('collectTargetText option', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should return empty text when collectTargetText is false (default)', () => {
    document.body.innerHTML = '<button id="btn">Click me</button>';
    const btn = document.getElementById('btn')!;
    const event = clickOn(btn);
    const env = buildClickEnvelope(event, stubSelector, defaultPrivacy);
    expect(env.target.text).toBe('');
  });

  it('should return truncated textContent when collectTargetText is true', () => {
    document.body.innerHTML = '<button id="btn">Click me</button>';
    const btn = document.getElementById('btn')!;
    const event = clickOn(btn);
    const env = buildClickEnvelope(event, stubSelector, textEnabled);
    expect(env.target.text).toBe('Click me');
  });

  it('should truncate text to 50 characters', () => {
    const longText = 'A'.repeat(100);
    document.body.innerHTML = `<button id="btn">${longText}</button>`;
    const btn = document.getElementById('btn')!;
    const event = clickOn(btn);
    const env = buildClickEnvelope(event, stubSelector, textEnabled);
    expect(env.target.text).toBe('A'.repeat(50));
  });

  it('should suppress text even with collectTargetText when data-adapt-pii is present', () => {
    document.body.innerHTML = '<button data-adapt-pii id="btn">Sensitive</button>';
    const btn = document.getElementById('btn')!;
    const event = clickOn(btn);
    const env = buildClickEnvelope(event, stubSelector, textEnabled);
    expect(env.target.text).toBe('');
  });

  it('should suppress text even with collectTargetText when piiFilter returns true', () => {
    document.body.innerHTML = '<button id="btn" data-custom-pii>Sensitive</button>';
    const btn = document.getElementById('btn')!;
    const event = clickOn(btn);
    const privacy: PrivacyOptions = {
      collectTargetText: true,
      piiFilter: (el) => el.hasAttribute('data-custom-pii'),
    };
    const env = buildClickEnvelope(event, stubSelector, privacy);
    expect(env.target.text).toBe('');
  });
});

describe('piiFilter option', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function inputOn(el: Element): Event {
    const event = new Event('input', { bubbles: true });
    Object.defineProperty(event, 'target', { value: el });
    return event;
  }

  it('should suppress input text and bufferLength when piiFilter returns true', () => {
    document.body.innerHTML = '<input type="text" id="field" data-patient value="PHI data" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const privacy: PrivacyOptions = {
      collectTargetText: false,
      piiFilter: (el) => el.hasAttribute('data-patient'),
    };
    const env = buildInputEnvelope(inputOn(input), stubSelector, privacy);
    expect(env!.target.text).toBe('');
    expect(env!.target.bufferLength).toBe(0);
  });

  it('should NOT suppress when piiFilter returns false', () => {
    document.body.innerHTML = '<input type="text" id="field" value="visible" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const privacy: PrivacyOptions = {
      collectTargetText: false,
      piiFilter: () => false,
    };
    const env = buildInputEnvelope(inputOn(input), stubSelector, privacy);
    expect(env!.target.text).toBe('visible');
    expect(env!.target.bufferLength).toBe(7);
  });

  it('should suppress click text when piiFilter returns true', () => {
    document.body.innerHTML = '<button id="btn" data-patient>Patient Info</button>';
    const btn = document.getElementById('btn')!;
    const event = clickOn(btn);
    const privacy: PrivacyOptions = {
      collectTargetText: true,
      piiFilter: (el) => el.hasAttribute('data-patient'),
    };
    const env = buildClickEnvelope(event, stubSelector, privacy);
    expect(env.target.text).toBe('');
  });

  it('should suppress when both built-in check and piiFilter apply', () => {
    document.body.innerHTML = '<input type="password" id="field" data-patient value="secret" />';
    const input = document.getElementById('field')! as HTMLInputElement;
    const privacy: PrivacyOptions = {
      collectTargetText: false,
      piiFilter: (el) => el.hasAttribute('data-patient'),
    };
    const env = buildInputEnvelope(inputOn(input), stubSelector, privacy);
    expect(env!.target.text).toBe('');
    expect(env!.target.bufferLength).toBe(0);
  });
});
