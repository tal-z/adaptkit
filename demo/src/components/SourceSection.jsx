import { useState } from 'react';
import { Highlight, themes } from 'prism-react-renderer';

export default function SourceSection({ reactCode, vanillaCode }) {
  const [tab, setTab] = useState('react');
  const [collapsed, setCollapsed] = useState(false);

  const code = tab === 'react' ? reactCode : vanillaCode;
  const language = tab === 'react' ? 'jsx' : 'javascript';

  return (
    <section id="source" style={styles.section}>
      <button
        style={styles.collapseBtn}
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
      >
        <span style={styles.collapseIcon}>{collapsed ? '\u25B6' : '\u25BC'}</span>
        Source Code
      </button>
      {!collapsed && (
        <div style={styles.content}>
          <div style={styles.tabs}>
            <button
              style={{ ...styles.tab, ...(tab === 'react' ? styles.tabActive : {}) }}
              onClick={() => setTab('react')}
            >
              React
            </button>
            <button
              style={{ ...styles.tab, ...(tab === 'vanilla' ? styles.tabActive : {}) }}
              onClick={() => setTab('vanilla')}
            >
              Vanilla JS
            </button>
          </div>
          <Highlight theme={themes.nightOwl} code={code} language={language}>
            {({ style, tokens, getLineProps, getTokenProps }) => (
              <pre style={{ ...styles.code, ...style }}>
                {tokens.map((line, i) => (
                  <div key={i} {...getLineProps({ line })}>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        </div>
      )}
    </section>
  );
}

const styles = {
  section: {
    marginTop: '3rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid var(--color-border)',
  },
  collapseBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'none',
    border: 'none',
    color: 'var(--color-text-secondary)',
    fontSize: '0.9375rem',
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    padding: '0.25rem 0',
  },
  collapseIcon: {
    fontSize: '0.6875rem',
    transition: 'transform 0.15s',
  },
  content: {
    marginTop: '1rem',
  },
  tabs: {
    display: 'flex',
    gap: '0.25rem',
    marginBottom: '0.5rem',
  },
  tab: {
    padding: '0.375rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text-secondary)',
    fontSize: '0.8125rem',
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },
  tabActive: {
    background: 'var(--color-primary)',
    color: 'var(--color-primary-text)',
    borderColor: 'var(--color-primary)',
  },
  code: {
    margin: 0,
    padding: '1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8125rem',
    lineHeight: 1.7,
    overflow: 'auto',
  },
};
