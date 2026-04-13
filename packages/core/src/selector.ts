const MAX_LENGTH = 200;
const HASH_PATTERN = /[0-9a-f]{6,}/;
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-/;
const BASE64_PATTERN = /[A-Za-z0-9+/=]{12,}/;
const MAX_CLASS_LENGTH = 30;

function escapeId(id: string): string {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(id);
  }
  // Fallback for environments without CSS.escape (e.g. jsdom)
  return id.replace(/([\0-\x1f\x7f]|^-?[0-9])|[^a-zA-Z0-9_\-]/g, (ch) => '\\' + ch);
}

function isHashClass(cls: string): boolean {
  return (
    cls.length > MAX_CLASS_LENGTH ||
    HASH_PATTERN.test(cls) ||
    UUID_PATTERN.test(cls) ||
    BASE64_PATTERN.test(cls)
  );
}

function getTagSelector(el: Element): string {
  return el.tagName.toLowerCase();
}

function getClasses(el: Element): string[] {
  return Array.from(el.classList).filter((cls) => !isHashClass(cls));
}

function getNthOfType(el: Element): number {
  const parent = el.parentElement;
  if (!parent) return 1;
  const tag = el.tagName;
  let index = 0;
  for (const child of parent.children) {
    if (child.tagName === tag) {
      index++;
      if (child === el) return index;
    }
  }
  return 1;
}

function isUnique(selector: string, context: Element): boolean {
  try {
    const root = context.ownerDocument;
    return root.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

function buildLocalSelector(el: Element): string {
  // 1. Unique ID
  const id = el.getAttribute('id');
  if (id) {
    const idSelector = '#' + escapeId(id);
    if (isUnique(idSelector, el)) {
      return idSelector;
    }
  }

  // 2. data-testid
  const testId = el.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${testId}"]`;
  }

  // 3. data-adapt-id
  const adaptId = el.getAttribute('data-adapt-id');
  if (adaptId) {
    return `[data-adapt-id="${adaptId}"]`;
  }

  // 4. tag + classes
  const tag = getTagSelector(el);
  const classes = getClasses(el);
  const tagClass = classes.length > 0 ? tag + '.' + classes.join('.') : tag;

  // Check if unique among siblings
  if (isUnique(tagClass, el)) {
    return tagClass;
  }

  // 5. nth-of-type
  const nth = getNthOfType(el);
  return `${tagClass}:nth-of-type(${nth})`;
}

export function getSelector(el: Element): string {
  // Try local selector first — if globally unique, done
  const local = buildLocalSelector(el);
  if (
    local.startsWith('#') ||
    local.startsWith('[data-testid') ||
    local.startsWith('[data-adapt-id')
  ) {
    return local;
  }
  if (isUnique(local, el)) {
    return local;
  }

  // Build ancestor chain (max 4 ancestors)
  const parts: string[] = [local];
  let current = el.parentElement;
  let depth = 0;

  while (current && current !== el.ownerDocument.documentElement && depth < 4) {
    const parentPart = buildLocalSelector(current);
    parts.unshift(parentPart);

    // If any ancestor has a unique selector (id, data-testid), the chain is anchored
    const fullSelector = parts.join(' > ');
    if (fullSelector.length <= MAX_LENGTH && isUnique(fullSelector, el)) {
      return fullSelector;
    }

    current = current.parentElement;
    depth++;
  }

  // Assemble full chain, truncate from left if over max length
  let selector = parts.join(' > ');
  while (selector.length > MAX_LENGTH && parts.length > 1) {
    parts.shift();
    selector = parts.join(' > ');
  }

  return selector;
}
