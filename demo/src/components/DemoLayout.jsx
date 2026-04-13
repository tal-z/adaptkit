import Nav from './Nav.jsx';
import ContextPill from './ContextPill.jsx';
import SourceSection from './SourceSection.jsx';

export default function DemoLayout({ title, subtitle, contextValues, reactCode, vanillaCode, nextDemo, children }) {
  return (
    <div style={styles.wrapper}>
      <Nav />
      <main className="container" style={styles.main}>
        <header style={styles.header}>
          <h1>{title}</h1>
          {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
        </header>
        {children}
        <SourceSection reactCode={reactCode} vanillaCode={vanillaCode} />
        {nextDemo && (
          <div style={styles.nextDemo}>
            <a href={nextDemo.hash} style={styles.nextDemoLink}>
              Next: {nextDemo.label} &rarr;
            </a>
          </div>
        )}
      </main>
      <ContextPill values={contextValues} />
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  main: {
    flex: 1,
    paddingTop: '2rem',
    paddingBottom: '4rem',
  },
  header: {
    marginBottom: '2rem',
  },
  subtitle: {
    marginTop: '0.5rem',
    fontSize: '1rem',
    color: 'var(--color-text-secondary)',
  },
  nextDemo: {
    marginTop: '2.5rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid var(--color-border)',
    textAlign: 'right',
  },
  nextDemoLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '0.9375rem',
    fontWeight: 500,
    color: 'var(--color-primary)',
    textDecoration: 'none',
  },
};
