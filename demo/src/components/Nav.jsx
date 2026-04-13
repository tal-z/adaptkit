import { useState, useEffect } from 'react';

const links = [
  { hash: '#environment', label: 'Environment' },
  { hash: '#friction', label: 'Friction' },
  { hash: '#behavior', label: 'Behavior' },
  { hash: '#familiarity', label: 'Familiarity' },
  { hash: '#task', label: 'Task' },
];

export default function Nav() {
  const [currentHash, setCurrentHash] = useState(location.hash);

  useEffect(() => {
    const onHashChange = () => setCurrentHash(location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <nav style={styles.nav}>
      <a href="#" style={styles.wordmark}>AdaptKit</a>
      <div style={styles.links}>
        {links.map(({ hash, label }) => (
          <a
            key={hash}
            href={hash}
            style={{
              ...styles.link,
              ...(currentHash === hash ? styles.linkActive : {}),
            }}
          >
            {label}
          </a>
        ))}
      </div>
      <a href="#source" style={styles.sourceLink}>Source</a>
    </nav>
  );
}

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1.5rem',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    gap: '1rem',
    flexWrap: 'wrap',
  },
  wordmark: {
    fontWeight: 700,
    fontSize: '1rem',
    color: 'var(--color-text)',
    textDecoration: 'none',
    letterSpacing: '-0.02em',
    flexShrink: 0,
  },
  links: {
    display: 'flex',
    gap: '0.25rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  link: {
    padding: '0.375rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    textDecoration: 'none',
    transition: 'background 0.15s, color 0.15s',
  },
  linkActive: {
    background: 'var(--color-primary-light)',
    color: 'var(--color-primary)',
  },
  sourceLink: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: 'var(--color-text-muted)',
    textDecoration: 'none',
    flexShrink: 0,
  },
};
