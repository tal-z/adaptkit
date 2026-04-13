import { useState } from 'react';
import { useFamiliarity } from '@adaptkit/react';
import AdaptKit from '@adaptkit/core';
import DemoLayout from '../components/DemoLayout.jsx';

const REACT_CODE = `function OnboardingWizard() {
  const fam = useFamiliarity('onboarding');

  if (fam.hasCompleted) {
    return <QuickAction />;
  }
  if (!fam.isFirstVisit) {
    return <CondensedWizard />;
  }
  return <FullWizard />;
}`;

const VANILLA_CODE = `const { familiarity } = AdaptKit.getContext('onboarding');
if (familiarity.isFirstVisit) showFullGuide();
else if (familiarity.visitCount === 2) showCondensedGuide();
else showQuickAction();`;

function formatDuration(ms) {
  if (ms === null) return '\u2013';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const illustrationStyles = {
  box: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    background: 'var(--color-bg-muted)',
    borderRadius: 'var(--radius-lg)',
    minHeight: '120px',
  },
  windowBar: {
    display: 'flex',
    gap: '4px',
    marginBottom: '0.5rem',
  },
  dot: (color) => ({
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: color,
  }),
  content: {
    display: 'flex',
    gap: '0.5rem',
  },
  sidebar: {
    width: '40px',
    height: '60px',
    background: 'var(--color-bg-inset)',
    borderRadius: 'var(--radius-sm)',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1,
  },
  line: (width) => ({
    height: '8px',
    width,
    background: 'var(--color-bg-inset)',
    borderRadius: '4px',
  }),
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '1rem',
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    width: '160px',
  },
  avatarRow: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  avatar: (bg) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: bg,
    color: '#fff',
    fontSize: '0.8125rem',
    fontWeight: 600,
  }),
  avatarPlus: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '2px dashed var(--color-border-strong)',
    color: 'var(--color-text-muted)',
    fontSize: '1rem',
  },
};

const guideSteps = [
  {
    title: 'Welcome to Your Workspace',
    description: 'This is where you\'ll manage your projects, collaborate with your team, and track progress. Let\'s take a quick tour of the key features.',
    illustration: (
      <div style={illustrationStyles.box}>
        <div style={illustrationStyles.windowBar}>
          <span style={illustrationStyles.dot('#ef4444')} />
          <span style={illustrationStyles.dot('#eab308')} />
          <span style={illustrationStyles.dot('#22c55e')} />
        </div>
        <div style={illustrationStyles.content}>
          <div style={illustrationStyles.sidebar} />
          <div style={illustrationStyles.main}>
            <div style={illustrationStyles.line('60%')} />
            <div style={illustrationStyles.line('80%')} />
            <div style={illustrationStyles.line('45%')} />
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Create Your First Project',
    description: 'Projects organize your work into focused areas. Each project has its own tasks, files, and team members. Click "New Project" in the sidebar to get started.',
    illustration: (
      <div style={illustrationStyles.box}>
        <div style={illustrationStyles.card}>
          <div style={illustrationStyles.line('50%')} />
          <div style={{ ...illustrationStyles.line('100%'), height: '24px', borderRadius: '4px' }} />
          <div style={illustrationStyles.line('70%')} />
        </div>
      </div>
    ),
  },
  {
    title: 'Invite Your Team',
    description: 'Collaboration works best with your team onboard. Share a link or enter email addresses to invite teammates. They\'ll get access to all projects you share.',
    illustration: (
      <div style={illustrationStyles.box}>
        <div style={illustrationStyles.avatarRow}>
          <div style={illustrationStyles.avatar('#3b82f6')}>A</div>
          <div style={illustrationStyles.avatar('#8b5cf6')}>B</div>
          <div style={illustrationStyles.avatar('#ec4899')}>C</div>
          <div style={illustrationStyles.avatarPlus}>+</div>
        </div>
      </div>
    ),
  },
];

function FullWizard({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = guideSteps[currentStep];

  return (
    <div style={wizardStyles.full}>
      <div style={wizardStyles.welcome} className="fade-in">
        <h2 style={wizardStyles.welcomeTitle}>Welcome! Let&apos;s get you set up.</h2>
        <p style={wizardStyles.welcomeSubtitle}>This quick tour will show you the essentials.</p>
      </div>

      <div style={wizardStyles.stepIndicator}>
        {guideSteps.map((_, i) => (
          <div
            key={i}
            style={{
              ...wizardStyles.stepDot,
              background: i <= currentStep ? 'var(--color-primary)' : 'var(--color-border)',
            }}
          />
        ))}
      </div>

      <div className="fade-in" key={currentStep}>
        <div style={wizardStyles.illustration}>{step.illustration}</div>
        <h3 style={wizardStyles.stepTitle}>{step.title}</h3>
        <p style={wizardStyles.stepDesc}>{step.description}</p>
      </div>

      <div style={wizardStyles.actions}>
        {currentStep > 0 && (
          <button className="btn" onClick={() => setCurrentStep(currentStep - 1)}>
            Back
          </button>
        )}
        {currentStep < guideSteps.length - 1 ? (
          <button className="btn btn-primary" onClick={() => setCurrentStep(currentStep + 1)}>
            Next
          </button>
        ) : (
          <button className="btn btn-primary" onClick={onComplete}>
            Get Started
          </button>
        )}
      </div>
    </div>
  );
}

function CondensedWizard({ onComplete }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <div style={wizardStyles.condensed} className="fade-in">
      <h2 style={wizardStyles.condensedTitle}>Welcome back!</h2>
      <p style={wizardStyles.condensedSubtitle}>Here&apos;s a quick refresher. Click any section to expand.</p>

      <div style={wizardStyles.stepList}>
        {guideSteps.map((step, i) => (
          <div key={i} style={wizardStyles.collapsedStep}>
            <button
              style={wizardStyles.collapsedStepBtn}
              onClick={() => setExpanded(expanded === i ? null : i)}
              aria-expanded={expanded === i}
            >
              <span style={wizardStyles.stepNumber}>{i + 1}</span>
              <span style={wizardStyles.collapsedStepTitle}>{step.title}</span>
              <span style={wizardStyles.chevron}>{expanded === i ? '\u25B2' : '\u25BC'}</span>
            </button>
            {expanded === i && (
              <div style={wizardStyles.expandedContent} className="fade-in">
                <p style={wizardStyles.stepDesc}>{step.description}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={onComplete}>
        I&apos;m Ready
      </button>
    </div>
  );
}

function QuickAction() {
  return (
    <div style={wizardStyles.quick} className="fade-in">
      <div style={wizardStyles.quickIcon}>&#10003;</div>
      <h2 style={wizardStyles.quickTitle}>Ready to go?</h2>
      <p style={wizardStyles.quickSubtitle}>You&apos;ve done this before. Jump right in.</p>
      <button className="btn btn-primary" style={{ marginTop: '1rem' }}>
        Open Dashboard
      </button>
    </div>
  );
}

function FamiliarityHint({ isFirstVisit, visitCount }) {
  let message;
  let state;
  if (visitCount >= 3) {
    message = "Three visits in. The wizard knows you now — it\u2019s as brief as it gets.";
    state = 'veteran';
  } else if (!isFirstVisit) {
    message = "You\u2019ve been here before. The wizard condensed itself \u2014 and so did this tip.";
    state = 'returning';
  } else {
    message = "First time? Come back a few times and watch how the wizard \u2014 and this message \u2014 adapt.";
    state = 'new';
  }

  return (
    <div style={{ ...hintStyles.container, ...hintStyles[state] }} className="fade-in" key={state}>
      <span style={hintStyles.label}>Adaptive tip</span>
      <p style={hintStyles.message}>{message}</p>
    </div>
  );
}

const hintStyles = {
  container: {
    padding: '0.875rem 1rem',
    borderRadius: 'var(--radius-md)',
    borderLeft: '3px solid',
    fontSize: '0.875rem',
    lineHeight: 1.5,
  },
  new: {
    background: 'var(--color-bg-subtle)',
    borderColor: 'var(--color-border-strong)',
  },
  returning: {
    background: 'var(--color-primary-light)',
    borderColor: 'var(--color-primary)',
  },
  veteran: {
    background: 'var(--color-success-light)',
    borderColor: 'var(--color-success)',
  },
  label: {
    display: 'block',
    fontSize: '0.6875rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-muted)',
    marginBottom: '0.25rem',
  },
  message: {
    margin: 0,
    color: 'var(--color-text-secondary)',
  },
};

const STATES = [
  { key: 'first', label: 'First Visit', desc: 'Full walkthrough wizard' },
  { key: 'returning', label: 'Returning', desc: 'Condensed accordion' },
  { key: 'completed', label: 'Completed', desc: 'Quick action only' },
];

function StatePreview({ currentState }) {
  return (
    <div style={previewStyles.container}>
      <div style={previewStyles.label}>All three states:</div>
      <div style={previewStyles.cards}>
        {STATES.map((state) => (
          <div
            key={state.key}
            style={{
              ...previewStyles.card,
              ...(state.key === currentState ? previewStyles.cardActive : {}),
            }}
          >
            <div style={previewStyles.cardTitle}>{state.label}</div>
            <div style={previewStyles.cardDesc}>{state.desc}</div>
            {state.key === currentState && <div style={previewStyles.badge}>Current</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

const previewStyles = {
  container: {
    padding: '1rem 1.25rem',
    background: 'var(--color-bg-subtle)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
  },
  label: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--color-text-muted)',
    marginBottom: '0.75rem',
  },
  cards: {
    display: 'flex',
    gap: '0.75rem',
  },
  card: {
    flex: 1,
    padding: '0.75rem',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    position: 'relative',
  },
  cardActive: {
    borderColor: 'var(--color-primary)',
    boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.15)',
  },
  cardTitle: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    marginBottom: '0.25rem',
  },
  cardDesc: {
    fontSize: '0.6875rem',
    color: 'var(--color-text-muted)',
    lineHeight: 1.4,
  },
  badge: {
    position: 'absolute',
    top: '-8px',
    right: '8px',
    padding: '0.125rem 0.5rem',
    background: 'var(--color-primary)',
    color: '#fff',
    fontSize: '0.5625rem',
    fontWeight: 600,
    borderRadius: '999px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
};

export default function Familiarity() {
  const fam = useFamiliarity('onboarding');

  const handleComplete = () => {
    AdaptKit.markCompleted('onboarding');
  };

  const contextValues = {
    visitCount: fam.visitCount,
    isFirstVisit: fam.isFirstVisit,
    hasCompleted: fam.hasCompleted,
    lastVisitMs: formatDuration(fam.lastVisitMs),
  };

  let content;
  if (fam.hasCompleted) {
    content = <QuickAction />;
  } else if (!fam.isFirstVisit) {
    content = <CondensedWizard onComplete={handleComplete} />;
  } else {
    content = <FullWizard onComplete={handleComplete} />;
  }

  return (
    <DemoLayout
      title="Familiarity"
      subtitle="An onboarding wizard that progressively simplifies as you return. Complete the wizard, then reload the page to see how it adapts."
      contextValues={contextValues}
      reactCode={REACT_CODE}
      vanillaCode={VANILLA_CODE}
      nextDemo={{ hash: '#task', label: 'Task' }}
    >
      <div style={styles.container} data-adapt-step="onboarding">
        {content}
        <FamiliarityHint isFirstVisit={fam.isFirstVisit} visitCount={fam.visitCount} />

        <button
          className="btn"
          style={styles.resetBtn}
          onClick={() => AdaptKit.resetFamiliarity('onboarding')}
        >
          Reset &amp; Replay
        </button>

        <StatePreview currentState={fam.hasCompleted ? 'completed' : fam.isFirstVisit ? 'first' : 'returning'} />
      </div>
    </DemoLayout>
  );
}

const wizardStyles = {
  full: {
    padding: '2rem',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    maxWidth: '520px',
  },
  welcome: {
    marginBottom: '1.5rem',
  },
  welcomeTitle: {
    fontSize: '1.375rem',
    fontWeight: 700,
    marginBottom: '0.375rem',
  },
  welcomeSubtitle: {
    fontSize: '0.9375rem',
    color: 'var(--color-text-secondary)',
  },
  stepIndicator: {
    display: 'flex',
    gap: '0.375rem',
    marginBottom: '1.5rem',
  },
  stepDot: {
    width: '2rem',
    height: '4px',
    borderRadius: '2px',
    transition: 'background 0.2s',
  },
  illustration: {
    marginBottom: '1.25rem',
  },
  stepTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  stepDesc: {
    fontSize: '0.875rem',
    lineHeight: 1.6,
    color: 'var(--color-text-secondary)',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '1.5rem',
  },
  condensed: {
    padding: '2rem',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    maxWidth: '520px',
  },
  condensedTitle: {
    fontSize: '1.375rem',
    fontWeight: 700,
    marginBottom: '0.25rem',
  },
  condensedSubtitle: {
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary)',
    marginBottom: '1.25rem',
  },
  stepList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  collapsedStep: {
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  },
  collapsedStepBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    width: '100%',
    padding: '0.75rem 1rem',
    border: 'none',
    background: 'var(--color-bg-subtle)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.875rem',
    textAlign: 'left',
    color: 'var(--color-text)',
  },
  stepNumber: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: 'var(--color-primary)',
    color: '#fff',
    fontSize: '0.6875rem',
    fontWeight: 600,
    flexShrink: 0,
  },
  collapsedStepTitle: {
    flex: 1,
    fontWeight: 500,
  },
  chevron: {
    fontSize: '0.625rem',
    color: 'var(--color-text-muted)',
  },
  expandedContent: {
    padding: '0 1rem 1rem',
  },
  quick: {
    textAlign: 'center',
    padding: '3rem 2rem',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    maxWidth: '420px',
  },
  quickIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'var(--color-success-light)',
    color: 'var(--color-success)',
    fontSize: '1.5rem',
    marginBottom: '1rem',
  },
  quickTitle: {
    fontSize: '1.375rem',
    fontWeight: 700,
    marginBottom: '0.375rem',
  },
  quickSubtitle: {
    fontSize: '0.9375rem',
    color: 'var(--color-text-secondary)',
  },
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  resetBtn: {
    alignSelf: 'flex-start',
    fontSize: '0.8125rem',
  },
};
