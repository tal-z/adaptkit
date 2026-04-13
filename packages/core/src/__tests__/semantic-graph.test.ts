import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SemanticGraph, parseRole } from '../semantic-graph.js';

const stubSelector = (el: Element) => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '');

describe('parseRole', () => {
  it('should parse a simple base role', () => {
    const result = parseRole('primary-action', false);
    expect(result).toEqual({ role: 'primary-action', modifier: null });
  });

  it('should parse compound role:modifier', () => {
    const result = parseRole('primary-action:delete', false);
    expect(result).toEqual({ role: 'primary-action', modifier: 'delete' });
  });

  it('should reject unknown modifier and degrade to base role', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = parseRole('primary-action:archive', true);
    expect(result).toEqual({ role: 'primary-action', modifier: null });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown modifier "archive"'));
    warnSpy.mockRestore();
  });

  it('should reject modifier on non-action role', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = parseRole('nav-link:delete', true);
    expect(result).toEqual({ role: 'nav-link', modifier: null });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('non-action role'));
    warnSpy.mockRestore();
  });

  it('should warn on unknown base role in debug mode', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = parseRole('custom-widget', true);
    expect(result).toEqual({ role: 'custom-widget', modifier: null });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown base role'));
    warnSpy.mockRestore();
  });

  it('should NOT warn on unknown base role when debug is false', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    parseRole('custom-widget', false);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('should accept all valid base roles', () => {
    const roles = [
      'primary-action',
      'secondary-action',
      'nav-link',
      'required-input',
      'optional-input',
      'info-toggle',
      'error-message',
      'dialog',
      'form-group',
      'loading-state',
      'search',
      'media-control',
      'drag-handle',
    ];
    for (const role of roles) {
      const result = parseRole(role, false);
      expect(result.role).toBe(role);
    }
  });

  it('should accept delete modifier on secondary-action', () => {
    const result = parseRole('secondary-action:delete', false);
    expect(result).toEqual({ role: 'secondary-action', modifier: 'delete' });
  });

  it('should accept all valid modifiers on action roles', () => {
    const modifiers = ['delete', 'save', 'submit', 'cancel', 'navigate', 'confirm'];
    for (const mod of modifiers) {
      const result = parseRole(`primary-action:${mod}`, false);
      expect(result).toEqual({ role: 'primary-action', modifier: mod });
    }
  });
});

describe('SemanticGraph', () => {
  let graph: SemanticGraph;

  beforeEach(() => {
    document.body.innerHTML = '';
    graph = new SemanticGraph(stubSelector, false);
  });

  describe('build', () => {
    it('should find elements with data-adapt-role', () => {
      document.body.innerHTML = '<button data-adapt-role="primary-action" id="btn">Pay</button>';
      graph.build();
      expect(graph.size).toBe(1);
      const nodes = graph.getAllNodes();
      expect(nodes[0].role).toBe('primary-action');
    });

    it('should find elements with data-adapt-step', () => {
      document.body.innerHTML = '<div data-adapt-step="checkout" id="step">Content</div>';
      graph.build();
      expect(graph.size).toBe(1);
      expect(graph.getAllNodes()[0].step).toBe('checkout');
    });

    it('should parse compound role:modifier', () => {
      document.body.innerHTML =
        '<button data-adapt-role="primary-action:delete" id="del">Delete</button>';
      graph.build();
      const node = graph.getAllNodes()[0];
      expect(node.role).toBe('primary-action');
      expect(node.modifier).toBe('delete');
    });

    it('should use data-adapt-id as node ID when present', () => {
      document.body.innerHTML =
        '<button data-adapt-role="primary-action" data-adapt-id="pay-btn">Pay</button>';
      graph.build();
      const node = graph.getAllNodes()[0];
      expect(node.id).toBe('pay-btn');
    });

    it('should generate ID from CSS selector when no data-adapt-id', () => {
      document.body.innerHTML = '<button data-adapt-role="primary-action" id="btn">Pay</button>';
      graph.build();
      const node = graph.getAllNodes()[0];
      expect(node.id).toBe('button#btn');
    });

    it('should build parent-child relationships', () => {
      document.body.innerHTML = `
        <div data-adapt-step="checkout" id="step">
          <button data-adapt-role="primary-action" id="btn">Pay</button>
        </div>
      `;
      graph.build();
      expect(graph.size).toBe(2);

      const btn = graph.getNode('button#btn');
      const step = graph.getNode('div#step');
      expect(btn).not.toBeNull();
      expect(step).not.toBeNull();
      expect(btn!.parentId).toBe('div#step');
      expect(step!.children).toContain('button#btn');
      expect(step!.parentId).toBeNull();
    });

    it('should handle nested semantic hierarchy (3 levels)', () => {
      document.body.innerHTML = `
        <div data-adapt-step="billing" id="billing">
          <form data-adapt-step="payment" id="payment">
            <button data-adapt-role="primary-action" id="pay">Pay</button>
          </form>
        </div>
      `;
      graph.build();
      expect(graph.size).toBe(3);

      const pay = graph.getNode('button#pay');
      expect(pay!.parentId).toBe('form#payment');

      const payment = graph.getNode('form#payment');
      expect(payment!.parentId).toBe('div#billing');

      const billing = graph.getNode('div#billing');
      expect(billing!.parentId).toBeNull();
    });

    it('should handle sibling nodes under same parent', () => {
      document.body.innerHTML = `
        <div data-adapt-step="checkout" id="step">
          <button data-adapt-role="primary-action" id="pay">Pay</button>
          <button data-adapt-role="secondary-action" id="cancel">Cancel</button>
        </div>
      `;
      graph.build();
      expect(graph.size).toBe(3);

      const parent = graph.getNode('div#step');
      expect(parent!.children).toHaveLength(2);
      expect(parent!.children).toContain('button#pay');
      expect(parent!.children).toContain('button#cancel');
    });

    it('should skip non-semantic intermediate elements', () => {
      document.body.innerHTML = `
        <div data-adapt-step="checkout" id="step">
          <div class="wrapper">
            <div class="inner">
              <button data-adapt-role="primary-action" id="btn">Go</button>
            </div>
          </div>
        </div>
      `;
      graph.build();
      const btn = graph.getNode('button#btn');
      expect(btn!.parentId).toBe('div#step');
    });

    it('should handle element with both role and step', () => {
      document.body.innerHTML =
        '<button data-adapt-role="primary-action" data-adapt-step="payment" id="btn">Pay</button>';
      graph.build();
      const node = graph.getAllNodes()[0];
      expect(node.role).toBe('primary-action');
      expect(node.step).toBe('payment');
    });
  });

  describe('resolve', () => {
    it('should resolve a semantic element to itself', () => {
      document.body.innerHTML = '<button data-adapt-role="primary-action" id="btn">Pay</button>';
      graph.build();
      const btn = document.getElementById('btn')!;
      const node = graph.resolve(btn);
      expect(node).not.toBeNull();
      expect(node!.role).toBe('primary-action');
    });

    it('should resolve a non-semantic element to its nearest semantic ancestor', () => {
      document.body.innerHTML = `
        <div data-adapt-step="checkout" id="step">
          <span id="label">Price: $10</span>
        </div>
      `;
      graph.build();
      const span = document.getElementById('label')!;
      const node = graph.resolve(span);
      expect(node).not.toBeNull();
      expect(node!.step).toBe('checkout');
    });

    it('should return null for elements with no semantic ancestor', () => {
      document.body.innerHTML = '<div id="plain">No semantic</div>';
      graph.build();
      const div = document.getElementById('plain')!;
      expect(graph.resolve(div)).toBeNull();
    });

    it('should resolve deeply nested non-semantic element', () => {
      document.body.innerHTML = `
        <div data-adapt-step="checkout" id="step">
          <div><div><div><span id="deep">Deep</span></div></div></div>
        </div>
      `;
      graph.build();
      const span = document.getElementById('deep')!;
      const node = graph.resolve(span);
      expect(node).not.toBeNull();
      expect(node!.step).toBe('checkout');
    });
  });

  describe('getPath', () => {
    it('should return the path from node to root', () => {
      document.body.innerHTML = `
        <div data-adapt-step="billing" id="billing">
          <form data-adapt-step="payment" id="payment">
            <button data-adapt-role="primary-action" id="pay">Pay</button>
          </form>
        </div>
      `;
      graph.build();
      const path = graph.getPath('button#pay');
      expect(path).toHaveLength(3);
      expect(path[0].id).toBe('button#pay');
      expect(path[1].id).toBe('form#payment');
      expect(path[2].id).toBe('div#billing');
    });

    it('should return single node for root', () => {
      document.body.innerHTML = '<div data-adapt-step="main" id="main">Root</div>';
      graph.build();
      const path = graph.getPath('div#main');
      expect(path).toHaveLength(1);
    });
  });

  describe('getRoots', () => {
    it('should return only nodes with no parent', () => {
      document.body.innerHTML = `
        <div data-adapt-step="checkout" id="step">
          <button data-adapt-role="primary-action" id="btn">Pay</button>
        </div>
        <div data-adapt-step="sidebar" id="side">Nav</div>
      `;
      graph.build();
      const roots = graph.getRoots();
      expect(roots).toHaveLength(2);
      const ids = roots.map((r) => r.id);
      expect(ids).toContain('div#step');
      expect(ids).toContain('div#side');
    });
  });

  describe('toJSON', () => {
    it('should return serializable snapshot', () => {
      document.body.innerHTML = '<button data-adapt-role="primary-action" id="btn">Pay</button>';
      graph.build();
      const json = graph.toJSON();
      expect(json.nodes).toHaveLength(1);
      expect(json.nodes[0].role).toBe('primary-action');
      // Should not contain Element references
      expect(JSON.stringify(json)).toBeTruthy();
    });
  });

  describe('rebuild on empty DOM', () => {
    it('should produce empty graph when no semantic elements', () => {
      document.body.innerHTML = '<div><button>Normal</button></div>';
      graph.build();
      expect(graph.size).toBe(0);
    });
  });

  describe('debug logging', () => {
    it('should log graph size in debug mode', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const debugGraph = new SemanticGraph(stubSelector, true);
      document.body.innerHTML = '<button data-adapt-role="primary-action" id="btn">Go</button>';
      debugGraph.build();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Graph built: 1 nodes'));
      logSpy.mockRestore();
    });
  });
});
