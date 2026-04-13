import { useState, useEffect } from 'react';
import { useEnvironment } from '@adaptkit/react';
import AdaptKit from '@adaptkit/core';
import DemoLayout from '../components/DemoLayout.jsx';

const REACT_CODE = `function ProductCard() {
  const env = useEnvironment();

  return (
    <div className={\`card \${env.viewport === 'compact' ? 'stacked' : 'horizontal'}\`}>
      <div className={\`card-image \${env.connection === 'slow' ? 'low-fi' : ''}\`} />
      <div className="card-body">
        <h2>Premium Wireless Headphones</h2>
        <p className="price">$249</p>
        <button className={\`btn-primary \${env.pointer === 'coarse' ? 'btn-large' : ''}\`}>
          Add to Cart
        </button>
      </div>
    </div>
  );
}`;

const VANILLA_CODE = `AdaptKit.on('ADAPT_ENVIRONMENT_CHANGE', () => {
  const env = AdaptKit.getEnvironment();
  card.classList.toggle('stacked', env.viewport === 'compact');
  document.body.classList.toggle('touch-targets', env.pointer === 'coarse');
  document.body.classList.toggle('no-motion', env.prefersReducedMotion);
});`;

const SIM_OPTIONS = [
  { field: 'pointer', label: 'Coarse pointer', value: 'coarse', detected: 'fine' },
  { field: 'connection', label: 'Slow connection', value: 'slow', detected: null },
  { field: 'prefersReducedMotion', label: 'Reduced motion', value: true, detected: false },
  { field: 'viewport', label: 'Compact viewport', value: 'compact', detected: undefined },
  { field: 'colorScheme', label: 'Dark mode', value: 'dark', detected: undefined },
];

function SimulationToolbar() {
  const [active, setActive] = useState({});

  // Clean up overrides and CSS class when unmounting (navigating away)
  useEffect(() => {
    return () => {
      AdaptKit.clearEnvironmentOverrides();
      document.documentElement.classList.remove('dark');
    };
  }, []);

  const toggle = (option) => {
    const isActive = active[option.field];
    const next = { ...active, [option.field]: !isActive };
    setActive(next);

    // Dark mode needs CSS class toggle in addition to the context override
    if (option.field === 'colorScheme') {
      document.documentElement.classList.toggle('dark', !isActive);
    }

    if (!isActive) {
      AdaptKit.overrideEnvironment({ [option.field]: option.value });
    } else {
      // Clear all overrides and re-apply the remaining active ones
      AdaptKit.clearEnvironmentOverrides();
      const remaining = {};
      for (const [field, on] of Object.entries(next)) {
        if (on) {
          const opt = SIM_OPTIONS.find((o) => o.field === field);
          if (opt) remaining[field] = opt.value;
        }
      }
      if (Object.keys(remaining).length > 0) {
        AdaptKit.overrideEnvironment(remaining);
      }
    }
  };

  return (
    <div style={simStyles.container}>
      <div style={simStyles.header}>
        <span style={simStyles.label}>Simulation</span>
        <span style={simStyles.hint}>In production, values are detected automatically</span>
      </div>
      <div style={simStyles.toggles}>
        {SIM_OPTIONS.map((option) => (
          <button
            key={option.field}
            type="button"
            style={{
              ...simStyles.toggle,
              ...(active[option.field] ? simStyles.toggleActive : {}),
            }}
            onClick={() => toggle(option)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const simStyles = {
  container: {
    marginBottom: '1.5rem',
    padding: '1rem 1.25rem',
    background: 'var(--color-bg-subtle)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.75rem',
    marginBottom: '0.75rem',
  },
  label: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--color-text-muted)',
  },
  hint: {
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    fontStyle: 'italic',
  },
  toggles: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  toggle: {
    padding: '0.375rem 0.75rem',
    borderRadius: '999px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
  },
  toggleActive: {
    background: 'var(--color-primary)',
    color: '#fff',
    borderColor: 'var(--color-primary)',
  },
};

export default function Environment() {
  const env = useEnvironment();

  const isCompact = env.viewport === 'compact';
  const isSlow = env.connection === 'slow';
  const isCoarse = env.pointer === 'coarse';
  const isKeyboard = env.inputModality === 'keyboard';

  const contextValues = {
    viewport: env.viewport,
    pointer: env.pointer,
    inputModality: env.inputModality,
    colorScheme: env.colorScheme ?? 'detecting...',
    prefersReducedMotion: env.prefersReducedMotion,
    connection: env.connection ?? 'detecting...',
  };

  return (
    <DemoLayout
      title="Environment"
      subtitle="A product card that adapts to device conditions in real-time. Resize the browser, toggle OS dark mode, use keyboard navigation."
      contextValues={contextValues}
      reactCode={REACT_CODE}
      vanillaCode={VANILLA_CODE}
      nextDemo={{ hash: '#friction', label: 'Friction' }}
    >
      <SimulationToolbar />

      {env.prefersReducedMotion && (
        <div style={styles.motionNotice}>
          Animations paused &mdash; respecting your motion preferences.
        </div>
      )}

      {isKeyboard && (
        <div style={styles.keyboardHint}>
          Keyboard navigation detected. Use <kbd style={styles.kbd}>Tab</kbd> to move between elements.
        </div>
      )}

      <div
        style={{
          ...styles.card,
          ...(isCompact ? styles.cardStacked : styles.cardHorizontal),
        }}
      >
        {/* Product image */}
        <div
          style={{
            ...styles.image,
            ...(isCompact ? styles.imageStacked : styles.imageHorizontal),
            ...(isSlow ? styles.imageLowFi : styles.imageRich),
          }}
        >
          {isSlow && <span style={styles.lowBadge}>Low bandwidth</span>}
          {!isSlow && (
            <div style={styles.imageContent}>
              <div style={styles.headphoneIcon}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Product body */}
        <div style={styles.body}>
          <div style={styles.category}>Audio</div>
          <h2 style={styles.productName}>Premium Wireless Headphones</h2>
          <p style={styles.description}>
            Active noise cancellation, 30-hour battery life, and hi-res audio codec support.
          </p>

          <div style={styles.features}>
            <span style={styles.feature}>Bluetooth 5.3</span>
            <span style={styles.feature}>ANC</span>
            <span style={styles.feature}>30h Battery</span>
          </div>

          <div style={styles.priceRow}>
            <span style={styles.price}>$249</span>
            <span style={styles.originalPrice}>$299</span>
          </div>

          <div style={styles.actions}>
            <button
              className="btn btn-primary"
              style={isCoarse ? { minHeight: '48px', padding: '0.75rem 1.5rem', fontSize: '1rem' } : {}}
            >
              Add to Cart
            </button>
            <button
              className="btn"
              style={isCoarse ? { minHeight: '48px', padding: '0.75rem 1.5rem', fontSize: '1rem' } : {}}
            >
              Save
            </button>
          </div>

          {isCoarse && (
            <p style={styles.touchNote}>
              Touch-optimized: larger targets for easier interaction.
            </p>
          )}
        </div>
      </div>

      {/* Connection info */}
      <div style={styles.infoCard}>
        <h3 style={styles.infoTitle}>What&apos;s adapting?</h3>
        <ul style={styles.infoList}>
          <li><strong>Viewport ({env.viewport})</strong> &mdash; {isCompact ? 'Vertical stack layout' : 'Horizontal layout with more space'}</li>
          <li><strong>Pointer ({env.pointer})</strong> &mdash; {isCoarse ? '48px min button height for touch' : 'Standard button sizes for precision pointer'}</li>
          <li><strong>Input ({env.inputModality})</strong> &mdash; {isKeyboard ? 'Keyboard shortcuts hint shown' : 'Standard interaction mode'}</li>
          <li><strong>Color scheme ({env.colorScheme ?? 'unknown'})</strong> &mdash; CSS variables swapped automatically</li>
          <li><strong>Reduced motion ({env.prefersReducedMotion ? 'on' : 'off'})</strong> &mdash; {env.prefersReducedMotion ? 'All transitions disabled' : 'Smooth transitions active'}</li>
          <li><strong>Connection ({env.connection ?? 'unknown'})</strong> &mdash; {isSlow ? 'Low-fi image placeholder shown' : 'Full imagery loaded'}</li>
        </ul>
      </div>
    </DemoLayout>
  );
}

const styles = {
  motionNotice: {
    padding: '0.75rem 1rem',
    background: 'var(--color-warning-light)',
    border: '1px solid var(--color-warning)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    color: 'var(--color-warning)',
    marginBottom: '1.5rem',
  },
  keyboardHint: {
    padding: '0.75rem 1rem',
    background: 'var(--color-primary-light)',
    border: '1px solid var(--color-primary)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    color: 'var(--color-primary)',
    marginBottom: '1.5rem',
  },
  kbd: {
    display: 'inline-block',
    padding: '0.125rem 0.375rem',
    background: 'var(--color-bg-muted)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
  },
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-xl)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-md)',
  },
  cardStacked: {
    display: 'flex',
    flexDirection: 'column',
  },
  cardHorizontal: {
    display: 'flex',
    flexDirection: 'row',
  },
  image: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  imageStacked: {
    height: '200px',
    width: '100%',
  },
  imageHorizontal: {
    width: '320px',
    minHeight: '280px',
    flexShrink: 0,
  },
  imageRich: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  imageLowFi: {
    background: 'var(--color-bg-muted)',
    border: 'none',
  },
  lowBadge: {
    padding: '0.25rem 0.75rem',
    background: 'var(--color-bg-inset)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--color-text-muted)',
  },
  imageContent: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  headphoneIcon: {
    opacity: 0.9,
  },
  body: {
    padding: '1.5rem',
    flex: 1,
  },
  category: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--color-primary)',
    marginBottom: '0.25rem',
  },
  productName: {
    fontSize: '1.375rem',
    fontWeight: 700,
    marginBottom: '0.5rem',
  },
  description: {
    fontSize: '0.875rem',
    lineHeight: 1.6,
    color: 'var(--color-text-secondary)',
    marginBottom: '1rem',
  },
  features: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginBottom: '1rem',
  },
  feature: {
    padding: '0.25rem 0.625rem',
    background: 'var(--color-bg-muted)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
  },
  priceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.5rem',
    marginBottom: '1.25rem',
  },
  price: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  originalPrice: {
    fontSize: '0.9375rem',
    color: 'var(--color-text-muted)',
    textDecoration: 'line-through',
  },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  touchNote: {
    marginTop: '0.75rem',
    fontSize: '0.75rem',
    fontStyle: 'italic',
    color: 'var(--color-text-muted)',
  },
  infoCard: {
    marginTop: '2rem',
    padding: '1.25rem',
    background: 'var(--color-bg-subtle)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
  },
  infoTitle: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    marginBottom: '0.75rem',
  },
  infoList: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    fontSize: '0.8125rem',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.6,
  },
};
