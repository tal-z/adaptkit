import { useState } from 'react';
import { useFriction } from '@adaptkit/react';
import DemoLayout from '../components/DemoLayout.jsx';

const REACT_CODE = `function PaymentForm() {
  const friction = useFriction('payment');

  return (
    <form className={\`payment-form \${friction.level >= 3 ? 'simplified' : ''}\`}
          data-adapt-step="payment">
      {friction.level >= 2 && <HelpBanner />}
      <CardNumberField showTooltip={friction.level >= 1} />
      <button data-adapt-role="primary-action"
              className={friction.level >= 1 ? 'pulse' : ''}>
        Pay $49.00
      </button>
      {friction.level >= 3 && <HelpChatWidget />}
    </form>
  );
}`;

const VANILLA_CODE = `AdaptKit.on('*', () => {
  const { friction } = AdaptKit.getContext('payment');
  form.classList.toggle('simplified', friction.level >= 3);
  helpBanner.hidden = friction.level < 2;
  chatWidget.hidden = friction.level < 3;
});`;

const COACHING_STEPS = [
  { label: 'Click \u2018Apply\u2019 rapidly 5+ times (move the mouse slightly between bursts)', signals: ['RAGE_CLICK', 'DEAD_CLICK'] },
  { label: 'Type a short card number, then Tab away', signals: ['BLOCKED_INTENT'] },
  { label: 'Click \u2018Pay\u2019 twice', signals: ['BLOCKED_INTENT'] },
];

function CoachingStrip({ recentSignals }) {
  const firedTypes = new Set(recentSignals.map((s) => s.type.replace('ADAPT_', '')));

  return (
    <div style={coachStyles.container}>
      <div style={coachStyles.label}>Try these interactions:</div>
      <div style={coachStyles.steps}>
        {COACHING_STEPS.map((step, i) => {
          const done = step.signals.some((s) => firedTypes.has(s));
          return (
            <div key={i} style={{ ...coachStyles.step, ...(done ? coachStyles.stepDone : {}) }}>
              <span style={coachStyles.stepNum}>{done ? '\u2713' : i + 1}</span>
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const coachStyles = {
  container: {
    padding: '0.875rem 1rem',
    background: 'var(--color-bg-subtle)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    marginBottom: '1.5rem',
    fontSize: '0.8125rem',
  },
  label: {
    fontWeight: 600,
    marginBottom: '0.5rem',
    color: 'var(--color-text)',
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: 'var(--color-text-secondary)',
  },
  stepDone: {
    color: 'var(--color-success)',
  },
  stepNum: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: 'var(--color-bg-muted)',
    fontSize: '0.6875rem',
    fontWeight: 600,
    flexShrink: 0,
  },
};

export default function Friction() {
  const friction = useFriction('payment');
  const [cardError, setCardError] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const contextValues = {
    'friction.level': friction.level,
    'recent signals': friction.recentSignals.length > 0
      ? friction.recentSignals.map((s) => s.type.replace('ADAPT_', '')).join(', ')
      : 'none',
  };

  const simplified = friction.level >= 3;

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitError(true);
  };

  const handleCardBlur = (e) => {
    const val = e.target.value.replace(/\s/g, '');
    if (val.length > 0 && val.length < 16) {
      setCardError(true);
    } else {
      setCardError(false);
    }
  };

  return (
    <DemoLayout
      title="Friction"
      subtitle="A payment form that detects when you're struggling and progressively offers help. Try clicking the coupon button, making card number errors, and submitting twice."
      contextValues={contextValues}
      reactCode={REACT_CODE}
      vanillaCode={VANILLA_CODE}
      nextDemo={{ hash: '#behavior', label: 'Behavior' }}
    >
      <CoachingStrip recentSignals={friction.recentSignals} />

      <div style={styles.container} data-adapt-step="payment">
        {/* Level 2+: Help Banner */}
        {friction.level >= 2 && (
          <div style={styles.helpBanner} className="fade-in">
            <div style={styles.helpBannerIcon}>?</div>
            <div>
              <strong>Having trouble?</strong> Here are some tips:
              <ul style={styles.helpList}>
                <li>Card number should be 16 digits</li>
                <li>Check your expiration date format (MM/YY)</li>
                <li>The coupon field is currently unavailable</li>
              </ul>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{
            ...styles.form,
            ...(simplified ? styles.formSimplified : {}),
          }}
        >
          <h2 style={styles.formTitle}>Complete Your Purchase</h2>

          {submitError && (
            <div style={styles.errorBanner}>
              {friction.level >= 2
                ? 'Please check the highlighted fields below and try again.'
                : 'An error occurred. Please try again.'}
            </div>
          )}

          {/* Name field */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              Cardholder Name
              {friction.level >= 1 && <span style={styles.tooltip} title="Enter the name as it appears on your card">?</span>}
            </label>
            <input
              className="input"
              type="text"
              placeholder="Jane Smith"
              data-adapt-role="required-input"
            />
          </div>

          {/* Card Number field */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              Card Number
              {friction.level >= 1 && <span style={styles.tooltip} title="16-digit number on the front of your card">?</span>}
            </label>
            <input
              className={`input ${cardError ? 'input-error' : ''}`}
              type="text"
              placeholder="4242 4242 4242 4242"
              maxLength={19}
              onBlur={handleCardBlur}
              style={friction.level >= 2 && cardError ? { borderColor: 'var(--color-warning)' } : {}}
              data-adapt-role="required-input"
            />
            {cardError && (
              <span style={styles.fieldError}>
                {friction.level >= 2
                  ? 'Card number must be exactly 16 digits. You entered fewer.'
                  : 'Invalid card number'}
              </span>
            )}
            {simplified && (
              <span style={styles.inlineHelp}>
                Enter all 16 digits without spaces. Example: 4242424242424242
              </span>
            )}
          </div>

          {/* Expiry / CVV row */}
          <div style={simplified ? {} : styles.row}>
            <div style={{ ...styles.fieldGroup, flex: 1 }}>
              <label style={styles.label}>
                Expiry
                {friction.level >= 1 && <span style={styles.tooltip} title="Month/Year format">?</span>}
              </label>
              <input
                className="input"
                type="text"
                placeholder="MM/YY"
                maxLength={5}
                data-adapt-role="required-input"
              />
            </div>
            <div style={{ ...styles.fieldGroup, flex: 1 }}>
              <label style={styles.label}>
                CVV
                {friction.level >= 1 && <span style={styles.tooltip} title="3 or 4 digit code on the back of your card">?</span>}
              </label>
              <input
                className="input"
                type="text"
                placeholder="123"
                maxLength={4}
                data-adapt-role="required-input"
              />
            </div>
          </div>

          {/* Coupon code — dead click target (no onClick!) */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Coupon Code</label>
            <div style={styles.couponRow}>
              <input
                className="input"
                type="text"
                placeholder="Enter code"
                style={{ flex: 1 }}
              />
              {/* This button intentionally has NO onClick handler.
                  Clicking it produces a dead click (no DOM mutation within 300ms). */}
              <button type="button" className="btn" style={styles.couponBtn}>
                Apply
              </button>
            </div>
            {friction.level >= 2 && (
              <span style={styles.inlineHelp}>
                The coupon system is currently unavailable. You can proceed without one.
              </span>
            )}
          </div>

          {/* Order total */}
          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>Order Total</span>
            <span style={styles.totalAmount}>$49.00</span>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            className={`btn btn-primary ${friction.level >= 1 ? 'pulse' : ''}`}
            style={styles.submitBtn}
            data-adapt-role="primary-action"
          >
            Pay $49.00
          </button>
        </form>

        {/* Level 3: Help Chat Widget */}
        {friction.level >= 3 && (
          <div style={styles.chatWidget} className="slide-up">
            <div style={styles.chatHeader}>
              <span style={styles.chatDot} />
              Live Help
            </div>
            <div style={styles.chatBody}>
              <p style={styles.chatMessage}>
                Hi! I noticed you might be having trouble with the payment form. Can I help with anything?
              </p>
              <div style={styles.chatSuggestions}>
                <button className="btn" style={styles.chatSugBtn}>I can&apos;t enter my card</button>
                <button className="btn" style={styles.chatSugBtn}>The coupon won&apos;t apply</button>
                <button className="btn" style={styles.chatSugBtn}>Other issue</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Adaptation info */}
      <div style={styles.infoCard}>
        <h3 style={styles.infoTitle}>What&apos;s adapting?</h3>
        <ul style={styles.infoList}>
          <li>
            <strong>Level 0</strong> &mdash; Default form. No extra help shown.
          </li>
          <li>
            <strong>Level 1 (low friction)</strong> &mdash; Tooltip hints appear next to each field label (the &ldquo;?&rdquo; icons).{' '}
            {friction.level >= 1 ? 'Active now.' : 'Not yet triggered.'}
          </li>
          <li>
            <strong>Level 2 (moderate)</strong> &mdash; Help banner appears above the form. Error messages become more detailed.{' '}
            {friction.level >= 2 ? 'Active now.' : 'Not yet triggered.'}
          </li>
          <li>
            <strong>Level 3 (high / sustained)</strong> &mdash; Form widens to a simplified layout. Inline help text appears. Live chat widget pops up.{' '}
            {friction.level >= 3 ? 'Active now.' : 'Not yet triggered.'}
          </li>
        </ul>
      </div>
    </DemoLayout>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  helpBanner: {
    display: 'flex',
    gap: '0.75rem',
    padding: '1rem 1.25rem',
    background: 'var(--color-primary-light)',
    border: '1px solid var(--color-primary)',
    borderRadius: 'var(--radius-lg)',
    fontSize: '0.875rem',
    color: 'var(--color-text)',
    lineHeight: 1.6,
  },
  helpBannerIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: 'var(--color-primary)',
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  helpList: {
    marginTop: '0.375rem',
    paddingLeft: '1.25rem',
    fontSize: '0.8125rem',
    color: 'var(--color-text-secondary)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    padding: '1.5rem',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    maxWidth: '480px',
    transition: 'max-width 0.3s ease',
  },
  formSimplified: {
    maxWidth: '100%',
    fontSize: '1.0625rem',
    gap: '1.5rem',
  },
  formTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
  },
  errorBanner: {
    padding: '0.75rem 1rem',
    background: 'var(--color-danger-light)',
    border: '1px solid var(--color-danger)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8125rem',
    color: 'var(--color-danger)',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  label: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: 'var(--color-text)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  tooltip: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: 'var(--color-bg-muted)',
    border: '1px solid var(--color-border-strong)',
    fontSize: '0.625rem',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    cursor: 'help',
    flexShrink: 0,
  },
  fieldError: {
    fontSize: '0.75rem',
    color: 'var(--color-danger)',
  },
  inlineHelp: {
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    fontStyle: 'italic',
  },
  row: {
    display: 'flex',
    gap: '1rem',
  },
  couponRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  couponBtn: {
    flexShrink: 0,
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '0.75rem 0',
    borderTop: '1px solid var(--color-border)',
  },
  totalLabel: {
    fontSize: '0.9375rem',
    fontWeight: 500,
  },
  totalAmount: {
    fontSize: '1.25rem',
    fontWeight: 700,
  },
  submitBtn: {
    width: '100%',
    minHeight: '44px',
    fontSize: '0.9375rem',
    fontWeight: 600,
  },
  chatWidget: {
    position: 'fixed',
    bottom: '1rem',
    left: '1rem',
    width: '300px',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
    zIndex: 900,
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    background: 'var(--color-primary)',
    color: '#fff',
    fontSize: '0.8125rem',
    fontWeight: 600,
  },
  chatDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#4ade80',
  },
  chatBody: {
    padding: '1rem',
  },
  chatMessage: {
    fontSize: '0.8125rem',
    lineHeight: 1.5,
    color: 'var(--color-text-secondary)',
    marginBottom: '0.75rem',
  },
  chatSuggestions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  chatSugBtn: {
    fontSize: '0.75rem',
    padding: '0.375rem 0.625rem',
    textAlign: 'left',
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
