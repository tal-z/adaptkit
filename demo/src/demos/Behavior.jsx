import { useState, useEffect, useRef } from 'react';
import { useBehavior } from '@adaptkit/react';
import DemoLayout from '../components/DemoLayout.jsx';

const REACT_CODE = `function ContentLayout() {
  const behavior = useBehavior();

  return (
    <div className={\`layout \${behavior.scrollBehavior === 'reading' ? 'reading-mode' : ''}\`}>
      {behavior.scrollBehavior === 'scanning' && <Sidebar expanded />}
      <main style={{ maxWidth: behavior.scrollBehavior === 'reading' ? '65ch' : undefined }}>
        {behavior.keyboardFirst && <KeyboardShortcuts />}
        <ArticleSections />
      </main>
      {behavior.scrollBehavior === 'reading' && <ReadingProgressBar />}
    </div>
  );
}`;

const VANILLA_CODE = `AdaptKit.on('ADAPT_BEHAVIOR_CHANGE', () => {
  const { behavior } = AdaptKit.getContext();
  sidebar.classList.toggle('expanded', behavior.scrollBehavior === 'scanning');
  main.style.maxWidth = behavior.scrollBehavior === 'reading' ? '65ch' : '';
  progressBar.hidden = behavior.scrollBehavior !== 'reading';
});`;

const sections = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    content: [
      'AdaptKit is a client-side context engine that observes how users interact with your application and provides structured context you can use to adapt the interface in real-time. Unlike analytics that tell you what happened after the fact, AdaptKit gives you signals as they happen.',
      'Installation is straightforward with any package manager. Import the provider at your app root, and use hooks wherever you need adaptive behavior. The SDK weighs under 8kb gzipped and has zero runtime dependencies beyond React as a peer dependency.',
      'The core philosophy is detection, not prescription. AdaptKit tells you that a user is struggling with a form or scanning quickly through content — what you do with that information is up to you. This keeps the SDK focused and your UI decisions in your hands.',
    ],
  },
  {
    id: 'configuration',
    title: 'Configuration',
    content: [
      'The AdaptProvider accepts a config object that controls debug logging, threshold overrides, and privacy settings. In development, debug mode is enabled automatically when running on localhost — you will see sensor evaluations in the console.',
      'Threshold overrides let you tune every sensor independently. For example, if your users tend to click rapidly as part of normal interaction (like a music app), you can raise the rage-click threshold from 3 to 5 clicks. Every threshold has an HCI-grounded default that works well for most applications.',
      'Privacy is built into the architecture. By default, no text content is captured from input fields. The PII filter runs before any data enters the sensor pipeline. You can provide a custom filter function for domain-specific rules about what constitutes sensitive data.',
    ],
  },
  {
    id: 'api-reference',
    title: 'API Reference',
    content: [
      'The React SDK exports a provider and seven hooks. useAdapt() returns the complete context object, while useEnvironment(), useFriction(), useBehavior(), useFamiliarity(), and useTask() return individual dimensions. useAdaptEvent() subscribes to raw events for analytics integration.',
      'Each hook uses useSyncExternalStore internally, which means updates are batched within React\'s rendering cycle. Multiple context changes within the same frame produce a single re-render. Snapshots are cached by version to prevent infinite render loops.',
      'The vanilla API is equally simple: AdaptKit.start(), AdaptKit.getContext(), and AdaptKit.on() for event subscriptions. The context object shape is identical whether you access it through hooks or the imperative API.',
    ],
  },
  {
    id: 'plugins',
    title: 'Plugins & Extensions',
    content: [
      'AdaptKit\'s sensor architecture is designed for extensibility. Each sensor implements a simple interface: it declares which event types it accepts, processes envelopes, and returns friction events when thresholds are met. Custom sensors follow the same pattern.',
      'The semantic graph resolves data-adapt-* attributes into a structured tree that sensors can use for scoping and confidence boosting. Annotating your DOM with roles like "primary-action" or "required-input" gives the engine richer context about what each element means to the user.',
      'Integration with analytics platforms is straightforward through the event bus. Subscribe to specific event types or use the wildcard listener to forward everything. Events include timestamps, deterministic CSS selectors, and semantic context — ready for your data pipeline.',
    ],
  },
  {
    id: 'deployment',
    title: 'Deployment',
    content: [
      'AdaptKit runs entirely in the browser. There are no server components, no API calls, no data leaving the client. This means deployment is just shipping the JavaScript bundle — no infrastructure to manage, no GDPR data processing agreements needed for the SDK itself.',
      'For production builds, tree-shaking eliminates unused code. If you only import useEnvironment, the friction sensors and behavior profiler are not included in your bundle. The ESM build supports all modern bundlers including Vite, webpack, Rollup, and esbuild.',
      'Performance impact is minimal. Sensors use passive event listeners and requestIdleCallback where available. The mutation observer is scoped to interactive elements only. On a mid-range mobile device, the overhead is under 2ms per interaction event.',
    ],
  },
];

function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div style={progressStyles.bar}>
      <div style={{ ...progressStyles.fill, width: `${progress}%` }} />
    </div>
  );
}

const progressStyles = {
  bar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: 'var(--color-border)',
    zIndex: 200,
  },
  fill: {
    height: '100%',
    background: 'var(--color-primary)',
    transition: 'width 0.1s linear',
  },
};

function KeyboardShortcuts() {
  return (
    <div style={kbStyles.container} className="fade-in">
      <h3 style={kbStyles.title}>Keyboard Shortcuts</h3>
      <div style={kbStyles.grid}>
        <div style={kbStyles.shortcut}>
          <kbd style={kbStyles.key}>J</kbd> / <kbd style={kbStyles.key}>K</kbd>
          <span style={kbStyles.desc}>Next / Previous section</span>
        </div>
        <div style={kbStyles.shortcut}>
          <kbd style={kbStyles.key}>/</kbd>
          <span style={kbStyles.desc}>Focus search</span>
        </div>
        <div style={kbStyles.shortcut}>
          <kbd style={kbStyles.key}>Enter</kbd>
          <span style={kbStyles.desc}>Expand section</span>
        </div>
      </div>
    </div>
  );
}

const kbStyles = {
  container: {
    padding: '1rem 1.25rem',
    background: 'var(--color-bg-subtle)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    marginBottom: '0.75rem',
  },
  grid: {
    display: 'flex',
    gap: '1.5rem',
    flexWrap: 'wrap',
  },
  shortcut: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.8125rem',
  },
  key: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    background: 'var(--color-bg-muted)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  desc: {
    color: 'var(--color-text-secondary)',
  },
};

export default function Behavior() {
  const behavior = useBehavior();
  const [coachDismissed, setCoachDismissed] = useState(false);
  const contentRef = useRef(null);

  const isReading = behavior.scrollBehavior === 'reading';
  const isScanning = behavior.scrollBehavior === 'scanning';
  const isRapid = behavior.interactionTempo === 'rapid';
  const isDeliberate = behavior.interactionTempo === 'deliberate';

  const contextValues = {
    interactionTempo: behavior.interactionTempo,
    keyboardFirst: behavior.keyboardFirst,
    scrollBehavior: behavior.scrollBehavior ?? 'detecting...',
  };

  return (
    <DemoLayout
      title="Behavior"
      subtitle="A documentation page that adapts to how you interact. Try scrolling through quickly, navigating with Tab, or reading slowly."
      contextValues={contextValues}
      reactCode={REACT_CODE}
      vanillaCode={VANILLA_CODE}
      nextDemo={{ hash: '#familiarity', label: 'Familiarity' }}
    >
      {/* Coaching strip */}
      {!coachDismissed && (
        <div style={styles.coaching}>
          <div style={styles.coachingText}>
            <strong>Try different interaction patterns:</strong> Scroll quickly through sections...
            or use <kbd style={kbStyles.key}>Tab</kbd> to navigate... or read a section slowly and carefully.
          </div>
          <button
            style={styles.coachingDismiss}
            onClick={() => setCoachDismissed(true)}
            aria-label="Dismiss coaching tip"
          >
            &times;
          </button>
        </div>
      )}

      {isReading && <ReadingProgressBar />}

      {/* Tempo badge */}
      {isRapid && (
        <div style={styles.tempoBadge} className="fade-in">
          Power User Mode
        </div>
      )}

      <div style={styles.layout}>
        {/* Sidebar TOC — visible when scanning */}
        <aside
          style={{
            ...styles.sidebar,
            ...(isScanning ? styles.sidebarExpanded : styles.sidebarCollapsed),
          }}
        >
          <h3 style={styles.sidebarTitle}>Contents</h3>
          <nav>
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} style={styles.tocLink}>
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div
          ref={contentRef}
          style={{
            ...styles.content,
            maxWidth: isReading ? '65ch' : undefined,
            ...(isRapid ? styles.contentCompact : {}),
            ...(isDeliberate ? styles.contentRelaxed : {}),
          }}
        >
          {behavior.keyboardFirst && <KeyboardShortcuts />}

          {behavior.scrollBehavior === null && (
            <div style={styles.scrollPrompt}>
              Start scrolling to see the page adapt to your reading style.
            </div>
          )}

          {sections.map((section) => (
            <section key={section.id} id={section.id} style={styles.section}>
              <h2 style={{
                ...styles.sectionTitle,
                ...(isScanning ? styles.sectionTitleLarge : {}),
              }}>
                {section.title}
              </h2>
              {section.content.map((para, i) => (
                <p
                  key={i}
                  style={{
                    ...styles.paragraph,
                    ...(isDeliberate ? styles.paragraphRelaxed : {}),
                    ...(isRapid ? styles.paragraphCompact : {}),
                  }}
                >
                  {para}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>

      {/* Adaptation info */}
      <div style={styles.infoCard}>
        <h3 style={styles.infoTitle}>What&apos;s adapting?</h3>
        <ul style={styles.infoList}>
          <li>
            <strong>Tempo ({behavior.interactionTempo})</strong> &mdash;{' '}
            {isRapid
              ? 'Compact spacing, dense layout, "Power User" badge'
              : isDeliberate
                ? 'Generous spacing, larger body text'
                : 'Balanced defaults'}
          </li>
          <li>
            <strong>Keyboard ({behavior.keyboardFirst ? 'yes' : 'no'})</strong> &mdash;{' '}
            {behavior.keyboardFirst
              ? 'Shortcut legend visible, prominent focus rings'
              : 'Standard navigation'}
          </li>
          <li>
            <strong>Scroll ({behavior.scrollBehavior ?? 'detecting...'})</strong> &mdash;{' '}
            {isScanning
              ? 'TOC sidebar expanded, headers enlarged'
              : isReading
                ? 'Sidebar collapsed, max-width 65ch, progress bar'
                : 'Waiting for scroll pattern...'}
          </li>
        </ul>
      </div>
    </DemoLayout>
  );
}

const styles = {
  coaching: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    background: 'var(--color-primary-light)',
    border: '1px solid var(--color-primary)',
    borderRadius: 'var(--radius-md)',
    marginBottom: '1.5rem',
    fontSize: '0.8125rem',
    lineHeight: 1.6,
  },
  coachingText: {
    flex: 1,
    color: 'var(--color-text-secondary)',
  },
  coachingDismiss: {
    background: 'none',
    border: 'none',
    fontSize: '1.25rem',
    cursor: 'pointer',
    color: 'var(--color-text-muted)',
    padding: '0',
    lineHeight: 1,
  },
  tempoBadge: {
    display: 'inline-block',
    padding: '0.375rem 0.75rem',
    background: 'var(--color-success-light)',
    border: '1px solid var(--color-success)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-success)',
    marginBottom: '1rem',
  },
  layout: {
    display: 'flex',
    gap: '2rem',
    alignItems: 'flex-start',
  },
  sidebar: {
    flexShrink: 0,
    position: 'sticky',
    top: '4.5rem',
    transition: 'width 0.3s ease, opacity 0.3s ease',
    overflow: 'hidden',
  },
  sidebarExpanded: {
    width: '180px',
    opacity: 1,
  },
  sidebarCollapsed: {
    width: 0,
    opacity: 0,
  },
  sidebarTitle: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--color-text-muted)',
    marginBottom: '0.5rem',
  },
  tocLink: {
    display: 'block',
    padding: '0.25rem 0',
    fontSize: '0.8125rem',
    color: 'var(--color-text-secondary)',
    textDecoration: 'none',
  },
  content: {
    flex: 1,
    minWidth: 0,
    transition: 'max-width 0.3s ease',
  },
  contentCompact: {
    lineHeight: 1.4,
  },
  contentRelaxed: {
    lineHeight: 1.8,
  },
  section: {
    marginBottom: '2.5rem',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    marginBottom: '0.75rem',
    transition: 'font-size 0.2s ease',
  },
  sectionTitleLarge: {
    fontSize: '1.5rem',
  },
  paragraph: {
    fontSize: '0.9375rem',
    lineHeight: 1.7,
    color: 'var(--color-text-secondary)',
    marginBottom: '0.75rem',
  },
  paragraphRelaxed: {
    fontSize: '1.0625rem',
    lineHeight: 1.8,
    marginBottom: '1rem',
  },
  paragraphCompact: {
    fontSize: '0.875rem',
    lineHeight: 1.5,
    marginBottom: '0.5rem',
  },
  scrollPrompt: {
    padding: '0.75rem 1rem',
    background: 'var(--color-primary-light)',
    border: '1px solid var(--color-primary)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8125rem',
    color: 'var(--color-primary)',
    marginBottom: '1.5rem',
    textAlign: 'center',
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
