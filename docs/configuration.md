[&larr; Back to README](../README.md)

# Configuration

## Start Options

```js
AdaptKit.start({
  // Log sensor evaluations and events to console (auto-detects localhost)
  debug: false,

  // Opt-in to collect first 50 chars of clicked element text
  collectTargetText: false,

  // Custom PII filter (runs alongside built-in checks)
  piiFilter: (element) => element.hasAttribute('data-sensitive'),

  // Override any detection threshold
  thresholds: {
    rageClickCount: 3,
    rageClickWindowMs: 1000,
    rageClickCooldownMs: 1000,
    deadClickCooldownMs: 500,
    deadClickMutationWindowMs: 300,
    blockedIntentSubmitWindowMs: 10000,
    blockedIntentClickWindowMs: 2000,
    formThrashWindowMs: 10000,
    formThrashMinRevisits: 4,
    formThrashMinFields: 2,
    resignationRatio: 0.7,
    resignationWindowMs: 1500,
    frustrationTextCooldownMs: 3000,
    completionWindowMs: 2000,
    emissionFloor: 0.55,
    maxEventsPerMinute: 0, // 0 = unlimited
  },
});
```

## Semantic Instrumentation

Optional DOM attributes that improve friction detection accuracy and enable task tracking:

```html
<!-- Role: what this element does -->
<button data-adapt-role="primary-action:submit">Place Order</button>

<!-- Step: which workflow step this belongs to -->
<div data-adapt-step="shipping">
  <input data-adapt-role="required-input" />
</div>

<!-- Privacy: suppress text collection from this subtree -->
<div data-adapt-pii>
  <input type="text" name="ssn" />
</div>
```

### Valid Roles

`primary-action`, `secondary-action`, `nav-link`, `required-input`, `optional-input`, `info-toggle`, `error-message`, `dialog`, `form-group`, `loading-state`, `search`, `media-control`, `drag-handle`

### Valid Modifiers (action roles only)

`delete`, `save`, `submit`, `cancel`, `navigate`, `confirm`

Format: `data-adapt-role="base-role:modifier"` (e.g., `primary-action:delete`)

### Steps

`data-adapt-step="step-name"` enables task tracking and scoped familiarity. Elements within a step scope automatically track visit counts and workflow progress.

---

See also: [The Five Dimensions](dimensions.md) | [API Reference](api-reference.md)
