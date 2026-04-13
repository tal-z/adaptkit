import { useState } from 'react';

export default function ContextPill({ values }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={styles.container}>
      <button
        style={styles.toggle}
        onClick={() => setExpanded(!expanded)}
        aria-label={expanded ? 'Collapse context pill' : 'Expand context pill'}
      >
        <span style={styles.toggleIcon}>{expanded ? '\u25BC' : '\u25B2'}</span>
        <span style={styles.toggleLabel}>Context</span>
      </button>
      {expanded && (
        <div style={styles.body}>
          {Object.entries(values).map(([label, value]) => (
            <div key={label} style={styles.row}>
              <span style={styles.label}>{label}</span>
              <span style={styles.value}>
                {value === null || value === undefined
                  ? '\u2013'
                  : typeof value === 'boolean'
                    ? value ? 'true' : 'false'
                    : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    bottom: '1rem',
    right: '1rem',
    zIndex: 1000,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    minWidth: '220px',
    maxWidth: '320px',
    overflow: 'hidden',
    fontSize: '0.75rem',
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.5rem 0.75rem',
    border: 'none',
    background: 'var(--color-bg-muted)',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.6875rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  toggleIcon: {
    fontSize: '0.5rem',
  },
  toggleLabel: {},
  body: {
    padding: '0.5rem 0.75rem',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '0.2rem 0',
    gap: '0.75rem',
  },
  label: {
    color: 'var(--color-text-muted)',
    flexShrink: 0,
  },
  value: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.6875rem',
    color: 'var(--color-text)',
    textAlign: 'right',
    wordBreak: 'break-all',
  },
};
