import { describe, it, expect, beforeEach } from 'vitest';
import { getSelector } from '../selector.js';

describe('getSelector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should return #id for element with unique id', () => {
    document.body.innerHTML = '<button id="my-btn">Click</button>';
    const el = document.querySelector('#my-btn')!;
    expect(getSelector(el)).toBe('#my-btn');
  });

  it('should return [data-testid] for element with data-testid', () => {
    document.body.innerHTML = '<button data-testid="submit-btn">Submit</button>';
    const el = document.querySelector('[data-testid="submit-btn"]')!;
    expect(getSelector(el)).toBe('[data-testid="submit-btn"]');
  });

  it('should return tag.class for element with short class names', () => {
    document.body.innerHTML = '<button class="primary large">Click</button>';
    const el = document.querySelector('button')!;
    const sel = getSelector(el);
    expect(sel).toBe('button.primary.large');
  });

  it('should filter out long/hash class names', () => {
    document.body.innerHTML = '<button class="primary css-1a2b3c4d5e6f7g">Click</button>';
    const el = document.querySelector('button')!;
    const sel = getSelector(el);
    expect(sel).not.toContain('css-1a2b3c4d5e6f7g');
    expect(sel).toContain('primary');
  });

  it('should append nth-of-type when siblings match', () => {
    document.body.innerHTML = `
      <div>
        <button class="btn">First</button>
        <button class="btn">Second</button>
      </div>
    `;
    const buttons = document.querySelectorAll('button.btn');
    const sel1 = getSelector(buttons[0]);
    const sel2 = getSelector(buttons[1]);
    expect(sel1).toContain(':nth-of-type(1)');
    expect(sel2).toContain(':nth-of-type(2)');
  });

  it('should build ancestor chain when needed for uniqueness', () => {
    document.body.innerHTML = `
      <div id="container">
        <div><button>A</button></div>
        <div><button>B</button></div>
      </div>
    `;
    const buttons = document.querySelectorAll('button');
    const sel = getSelector(buttons[1]);
    // Should include an ancestor to disambiguate
    expect(sel).toContain('>');
    // Must resolve back to the correct element
    expect(document.querySelector(sel)).toBe(buttons[1]);
  });

  it('should truncate to 200 characters max', () => {
    // Create deeply nested structure with long class names
    let html = '<div id="root">';
    for (let i = 0; i < 10; i++) {
      html += `<div class="container-level-${i}">`;
    }
    html += '<button class="target">Click</button>';
    for (let i = 0; i < 10; i++) {
      html += '</div>';
    }
    html += '</div>';
    document.body.innerHTML = html;
    const el = document.querySelector('button.target')!;
    const sel = getSelector(el);
    expect(sel.length).toBeLessThanOrEqual(200);
  });

  it('should produce a selector that resolves via querySelector', () => {
    document.body.innerHTML = `
      <form>
        <div>
          <input type="text" class="field" />
          <input type="email" class="field" />
        </div>
      </form>
    `;
    const inputs = document.querySelectorAll('input.field');
    for (const input of inputs) {
      const sel = getSelector(input);
      expect(document.querySelector(sel)).toBe(input);
    }
  });

  it('should handle element with no distinguishing attributes', () => {
    document.body.innerHTML = '<div><span>Hello</span></div>';
    const el = document.querySelector('span')!;
    const sel = getSelector(el);
    expect(sel).toBeTruthy();
    expect(document.querySelector(sel)).toBe(el);
  });

  it('should escape special characters in id', () => {
    document.body.innerHTML = '<button id="my:btn.test">Click</button>';
    const el = document.querySelector('[id="my:btn.test"]')!;
    const sel = getSelector(el);
    expect(document.querySelector(sel)).toBe(el);
  });
});
