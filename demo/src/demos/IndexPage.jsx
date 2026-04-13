import Nav from '../components/Nav.jsx';

const demos = [
  {
    hash: '#environment',
    name: 'Environment',
    label: '1. Device & Preferences',
    description:
      'A product card that adapts to your viewport, pointer type, color scheme, motion preferences, and connection speed \u2014 all in real-time.',
    cta: 'Start here \u2192',
  },
  {
    hash: '#friction',
    name: 'Friction',
    label: '2. Struggle Detection',
    description:
      'A payment form that detects when you\u2019re struggling and progressively offers help \u2014 hints, clearer errors, and a simplified layout.',
  },
  {
    hash: '#behavior',
    name: 'Behavior',
    label: '3. Interaction Patterns',
    description:
      'A documentation page that adapts to how you interact. Rapid users get density. Keyboard navigators see shortcuts. Scanners get a TOC.',
  },
  {
    hash: '#familiarity',
    name: 'Familiarity',
    label: '4. Return Visits',
    description:
      'An onboarding wizard that remembers you. First visit: full walkthrough. Returning: condensed. Frequent: straight to action.',
  },
  {
    hash: '#task',
    name: 'Task',
    label: '5. Multi-Step Flow',
    description:
      'A checkout flow that tracks your progress, notices when you\u2019re stuck, and welcomes you back if you leave mid-step.',
  },
];

export default function IndexPage() {
  return (
    <div style={styles.wrapper}>
      <Nav />
      <main className="container" style={styles.main}>
        <header style={styles.header}>
          <h1 style={styles.title}>AdaptKit Demos</h1>
          <p style={styles.subtitle}>
            One import. Five dimensions of user context. Your UI responds to what the user
            is doing, struggling with, and familiar with.
          </p>
        </header>
        <div style={styles.grid}>
          {demos.map((demo) => (
            <a key={demo.hash} href={demo.hash} style={styles.card}>
              <div style={styles.cardLabel}>{demo.label}</div>
              <h2 style={styles.cardTitle}>{demo.name}</h2>
              <p style={styles.cardDesc}>{demo.description}</p>
              <span style={styles.cardLink}>{demo.cta || 'Open demo \u2192'}</span>
            </a>
          ))}
        </div>
        <footer style={styles.footer}>
          Built with <code>@adaptkit/react</code>
        </footer>
      </main>
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
    paddingTop: '3rem',
    paddingBottom: '3rem',
    maxWidth: '960px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '3rem',
  },
  title: {
    fontSize: '2.25rem',
    letterSpacing: '-0.03em',
  },
  subtitle: {
    marginTop: '0.75rem',
    fontSize: '1.125rem',
    color: 'var(--color-text-secondary)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1.25rem',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    padding: '1.5rem',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'box-shadow 0.15s, transform 0.15s',
  },
  cardLabel: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--color-primary)',
    marginBottom: '0.375rem',
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  cardDesc: {
    fontSize: '0.875rem',
    lineHeight: 1.6,
    color: 'var(--color-text-secondary)',
    flex: 1,
  },
  cardLink: {
    marginTop: '1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-primary)',
  },
  footer: {
    textAlign: 'center',
    marginTop: '3rem',
    fontSize: '0.8125rem',
    color: 'var(--color-text-muted)',
  },
};
