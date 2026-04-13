import type { SemanticNode } from './types.js';

// ─── Closed Namespace (v1) ───

const VALID_BASE_ROLES = new Set([
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
]);

const VALID_MODIFIERS = new Set(['delete', 'save', 'submit', 'cancel', 'navigate', 'confirm']);

// Only action roles can carry modifiers
const MODIFIER_ELIGIBLE_ROLES = new Set(['primary-action', 'secondary-action']);

// ─── Role Parsing ───

export interface ParsedRole {
  role: string;
  modifier: string | null;
}

export function parseRole(raw: string, debug: boolean): ParsedRole {
  const colonIdx = raw.indexOf(':');
  let role: string;
  let modifier: string | null = null;

  if (colonIdx === -1) {
    role = raw;
  } else {
    role = raw.slice(0, colonIdx);
    modifier = raw.slice(colonIdx + 1);
  }

  if (!VALID_BASE_ROLES.has(role) && debug) {
    console.warn(
      `[AdaptKit:semantic] Unknown base role "${role}". Node will be included but role may not be recognized by the system.`,
    );
  }

  if (modifier !== null) {
    if (!MODIFIER_ELIGIBLE_ROLES.has(role)) {
      if (debug) {
        console.warn(
          `[AdaptKit:semantic] Modifier "${modifier}" on non-action role "${role}". Modifier ignored.`,
        );
      }
      modifier = null;
    } else if (!VALID_MODIFIERS.has(modifier)) {
      if (debug) {
        console.warn(
          `[AdaptKit:semantic] Unknown modifier "${modifier}" on role "${role}". Modifier ignored, degrading to base role.`,
        );
      }
      modifier = null;
    }
  }

  return { role, modifier };
}

// ─── Semantic Graph ───

const SEMANTIC_SELECTOR = '[data-adapt-role], [data-adapt-step]';

export class SemanticGraph {
  private nodes = new Map<string, SemanticNode>();
  private elementToId = new WeakMap<Element, string>();
  private observer: MutationObserver | null = null;

  constructor(
    private selectorFn: (el: Element) => string,
    private debug: boolean,
  ) {}

  /** Scan the DOM and build the semantic tree. */
  build(root: Element = document.body): void {
    this.nodes.clear();

    const elements = root.querySelectorAll(SEMANTIC_SELECTOR);
    // Also check root itself
    const all: Element[] = [];
    if (root.matches(SEMANTIC_SELECTOR)) {
      all.push(root);
    }
    for (const el of elements) {
      all.push(el);
    }

    // First pass: create nodes
    for (const el of all) {
      const node = this.createNode(el);
      this.nodes.set(node.id, node);
      this.elementToId.set(el, node.id);
    }

    // Second pass: resolve parent-child relationships
    for (const el of all) {
      const nodeId = this.elementToId.get(el);
      if (!nodeId) continue;
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      const parentEl = this.findSemanticAncestor(el);
      if (parentEl) {
        const parentId = this.elementToId.get(parentEl);
        if (parentId && parentId !== nodeId) {
          node.parentId = parentId;
          const parent = this.nodes.get(parentId);
          if (parent && !parent.children.includes(nodeId)) {
            parent.children.push(nodeId);
          }
        }
      }
    }

    if (this.debug) {
      console.log(`[AdaptKit:semantic] Graph built: ${this.nodes.size} nodes`);
    }
  }

  /** Resolve a DOM element to its nearest semantic node (self or ancestor).
   *  Crosses shadow DOM boundaries by walking from ShadowRoot to its host. */
  resolve(element: Element): SemanticNode | null {
    let current: Element | null = element;
    while (current) {
      const id = this.elementToId.get(current);
      if (id) {
        return this.nodes.get(id) ?? null;
      }
      if (current.parentElement) {
        current = current.parentElement;
      } else {
        // Shadow DOM boundary: walk to host element
        const root = current.getRootNode();
        if ('host' in root) {
          current = (root as ShadowRoot).host;
        } else {
          current = null;
        }
      }
    }
    return null;
  }

  /** Get a node by ID. */
  getNode(id: string): SemanticNode | null {
    return this.nodes.get(id) ?? null;
  }

  /** Get all nodes. */
  getAllNodes(): SemanticNode[] {
    return Array.from(this.nodes.values());
  }

  /** Get root nodes (no parent). */
  getRoots(): SemanticNode[] {
    return this.getAllNodes().filter((n) => n.parentId === null);
  }

  /** Get the full ancestor path from a node to the root. */
  getPath(nodeId: string): SemanticNode[] {
    const path: SemanticNode[] = [];
    let current = this.nodes.get(nodeId);
    while (current) {
      path.push(current);
      current = current.parentId ? this.nodes.get(current.parentId) : undefined;
    }
    return path;
  }

  /** Number of nodes in the graph. */
  get size(): number {
    return this.nodes.size;
  }

  /** Start observing DOM mutations to keep graph in sync.
   *  Rebuilds are debounced via requestAnimationFrame to coalesce rapid mutations. */
  observe(root: Element = document.body): void {
    let pendingRebuild = false;

    this.observer = new MutationObserver(() => {
      if (!pendingRebuild) {
        pendingRebuild = true;
        // Use rAF to coalesce mutations within a single frame
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => {
            pendingRebuild = false;
            this.build(root);
          });
        } else {
          // Fallback for environments without rAF (e.g., jsdom)
          setTimeout(() => {
            pendingRebuild = false;
            this.build(root);
          }, 0);
        }
      }
    });
    this.observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-adapt-role', 'data-adapt-step', 'data-adapt-id'],
    });
  }

  /** Stop observing and clear the graph. */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.nodes.clear();
  }

  /** Serializable snapshot of the full graph. */
  toJSON(): { nodes: SemanticNode[] } {
    return { nodes: this.getAllNodes() };
  }

  // ─── Internals ───

  private createNode(el: Element): SemanticNode {
    const rawRole = el.getAttribute('data-adapt-role');
    const step = el.getAttribute('data-adapt-step');
    const explicitId = el.getAttribute('data-adapt-id');
    const selector = this.selectorFn(el);
    const id = explicitId ?? selector;

    let role: string | null = null;
    let modifier: string | null = null;

    if (rawRole) {
      const parsed = parseRole(rawRole, this.debug);
      role = parsed.role;
      modifier = parsed.modifier;
    }

    return {
      id,
      role,
      modifier,
      step,
      selector,
      parentId: null,
      children: [],
    };
  }

  private findSemanticAncestor(el: Element): Element | null {
    let current: Element | null = el.parentElement;
    while (current) {
      if (current.hasAttribute('data-adapt-role') || current.hasAttribute('data-adapt-step')) {
        return current;
      }
      if (current.parentElement) {
        current = current.parentElement;
      } else {
        // Shadow DOM boundary
        const root = current.getRootNode();
        if ('host' in root) {
          current = (root as ShadowRoot).host;
        } else {
          current = null;
        }
      }
    }
    return null;
  }
}
