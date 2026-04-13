import { useState, useEffect } from 'react';
import { useTask } from '@adaptkit/react';
import AdaptKit from '@adaptkit/core';
import DemoLayout from '../components/DemoLayout.jsx';

const REACT_CODE = `function CheckoutFlow() {
  const task = useTask();

  return (
    <>
      <StepIndicator current={task.currentStep} completed={task.completedSteps} />
      {task.abandonedAndReturned && (
        <div className="return-banner">
          Updating your info? Your other details are saved.
        </div>
      )}
      <section data-adapt-step="shipping">
        <ShippingForm />
        {task.currentStep === 'shipping' && liveTimeInStep > 30 && (
          <HelpMessage>Not sure about your address format?</HelpMessage>
        )}
      </section>
      {/* ... */}
    </>
  );
}`;

const VANILLA_CODE = `setInterval(() => {
  const { task } = AdaptKit.getContext();
  updateStepIndicator(task.currentStep, task.completedSteps);
  if (liveTimeInStep > 30) showHelpFor(task.currentStep);
  if (task.abandonedAndReturned) showReturnBanner();
}, 1000);`;

const STEPS = ['shipping', 'payment', 'review'];

const stepLabels = {
  shipping: 'Shipping',
  payment: 'Payment',
  review: 'Review',
};

function StepIndicator({ current, completed }) {
  return (
    <div style={stepStyles.container}>
      {STEPS.map((step, i) => {
        const isCompleted = completed.includes(step);
        const isCurrent = current === step;

        return (
          <div key={step} style={stepStyles.stepWrapper}>
            {i > 0 && (
              <div
                style={{
                  ...stepStyles.connector,
                  background: isCompleted || isCurrent
                    ? 'var(--color-primary)'
                    : 'var(--color-border)',
                }}
              />
            )}
            <div
              style={{
                ...stepStyles.circle,
                ...(isCompleted ? stepStyles.circleCompleted : {}),
                ...(isCurrent && !isCompleted ? stepStyles.circleCurrent : {}),
              }}
            >
              {isCompleted ? '\u2713' : i + 1}
            </div>
            <span
              style={{
                ...stepStyles.label,
                ...(isCurrent ? stepStyles.labelCurrent : {}),
                ...(isCompleted ? stepStyles.labelCompleted : {}),
              }}
            >
              {stepLabels[step]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LiveTimer({ seconds }) {
  return <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{seconds}s</span>;
}

export default function Task() {
  const task = useTask();
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    card: '',
    expiry: '',
  });
  // Live elapsed-time counter derived from stepEnteredAt.
  // liveTimeInStep is a snapshot frozen by the React store cache; stepEnteredAt is
  // stable across renders (only changes on step transitions) so we can compute live time.
  const [liveTimeInStep, setLiveTimeInStep] = useState(0);
  const stepEnteredAt = task.stepEnteredAt;

  useEffect(() => {
    if (!stepEnteredAt) { setLiveTimeInStep(0); return; }
    setLiveTimeInStep(Math.round((Date.now() - stepEnteredAt) / 1000));
    const interval = setInterval(() => {
      setLiveTimeInStep(Math.round((Date.now() - stepEnteredAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [stepEnteredAt]);

  const handleComplete = (step) => {
    AdaptKit.markCompleted(step);
  };

  const contextValues = {
    currentStep: task.currentStep ?? 'none',
    timeInStep: `${liveTimeInStep}s`,
    completedSteps: task.completedSteps.length > 0 ? task.completedSteps.join(', ') : 'none',
    abandonedAndReturned: task.abandonedAndReturned,
  };

  const shippingCompleted = task.completedSteps.includes('shipping');
  const paymentCompleted = task.completedSteps.includes('payment');

  return (
    <DemoLayout
      title="Task"
      subtitle="A multi-step checkout with time awareness, step completion tracking, and return detection. Click into each section to set it as the current step. Navigate to another demo and come back to see return detection."
      contextValues={contextValues}
      reactCode={REACT_CODE}
      vanillaCode={VANILLA_CODE}
    >
      <StepIndicator current={task.currentStep} completed={task.completedSteps} />

      <div style={styles.stepHint}>
        <code>currentStep</code> is set by the most recently clicked/focused <code>data-adapt-step</code> section. Help hints appear after 5s and 10s.
      </div>

      {task.abandonedAndReturned && (
        <div style={styles.returnBanner} className="fade-in">
          Updating your info? Your other details are saved.
        </div>
      )}

      <div style={styles.sections}>
        {/* Shipping section */}
        <section data-adapt-step="shipping" style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>
              {shippingCompleted && <span style={styles.checkmark}>&check;</span>}
              Shipping Information
            </h2>
            {shippingCompleted && (
              <span style={styles.summaryBadge}>
                {formData.name || 'Completed'} &mdash; {formData.city || 'Address saved'}
              </span>
            )}
          </div>

          <div style={styles.sectionBody}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Full Name</label>
              <input
                className="input"
                type="text"
                placeholder="Jane Smith"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-adapt-role="required-input"
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Address</label>
              <input
                className="input"
                type="text"
                placeholder="123 Main Street, Apt 4B"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                data-adapt-role="required-input"
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>City</label>
              <input
                className="input"
                type="text"
                placeholder="San Francisco"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                data-adapt-role="required-input"
              />
            </div>

            {task.currentStep === 'shipping' && liveTimeInStep > 5 && (
              <div style={styles.helpMessage} className="fade-in">
                Not sure about your address format? Use the format: Street, Apartment/Suite, City.
              </div>
            )}

            {task.currentStep === 'shipping' && liveTimeInStep > 10 && (
              <div style={styles.helpTip} className="fade-in">
                <strong>Tip:</strong> For international addresses, include your postal code and country name on separate lines.
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={() => handleComplete('shipping')}
              style={{ marginTop: '0.5rem' }}
              data-adapt-role="primary-action"
            >
              Continue to Payment
            </button>
          </div>
        </section>

        {/* Payment section */}
        <section data-adapt-step="payment" style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>
              {paymentCompleted && <span style={styles.checkmark}>&check;</span>}
              Payment Details
            </h2>
            {paymentCompleted && (
              <span style={styles.summaryBadge}>Card ending in {formData.card.slice(-4) || '****'}</span>
            )}
          </div>

          <div style={styles.sectionBody}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Card Number</label>
              <input
                className="input"
                type="text"
                placeholder="4242 4242 4242 4242"
                maxLength={19}
                value={formData.card}
                onChange={(e) => setFormData({ ...formData, card: e.target.value })}
                data-adapt-role="required-input"
              />
            </div>
            <div style={styles.row}>
              <div style={{ ...styles.fieldGroup, flex: 1 }}>
                <label style={styles.label}>Expiry</label>
                <input
                  className="input"
                  type="text"
                  placeholder="MM/YY"
                  maxLength={5}
                  value={formData.expiry}
                  onChange={(e) => setFormData({ ...formData, expiry: e.target.value })}
                  data-adapt-role="required-input"
                />
              </div>
              <div style={{ ...styles.fieldGroup, flex: 1 }}>
                <label style={styles.label}>CVV</label>
                <input
                  className="input"
                  type="text"
                  placeholder="123"
                  maxLength={4}
                  data-adapt-role="required-input"
                />
              </div>
            </div>

            {task.currentStep === 'payment' && liveTimeInStep > 5 && (
              <div style={styles.helpMessage} className="fade-in">
                Need help? Your card number is the 16-digit number on the front of your card.
              </div>
            )}

            {task.currentStep === 'payment' && liveTimeInStep > 10 && (
              <div style={styles.helpTip} className="fade-in">
                <strong>Tip:</strong> Make sure your card is not expired. The expiry date is printed below the card number as MM/YY.
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={() => handleComplete('payment')}
              style={{ marginTop: '0.5rem' }}
              data-adapt-role="primary-action"
            >
              Continue to Review
            </button>
          </div>
        </section>

        {/* Review section */}
        <section data-adapt-step="review" style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Order Review</h2>
          </div>

          <div style={styles.sectionBody}>
            <div style={styles.reviewCard}>
              <div style={styles.reviewRow}>
                <span style={styles.reviewLabel}>Shipping to</span>
                <span style={styles.reviewValue}>
                  {formData.name && formData.city
                    ? `${formData.name}, ${formData.city}`
                    : 'Not yet provided'}
                </span>
              </div>
              <div style={styles.reviewRow}>
                <span style={styles.reviewLabel}>Payment</span>
                <span style={styles.reviewValue}>
                  {formData.card
                    ? `Card ending in ${formData.card.slice(-4)}`
                    : 'Not yet provided'}
                </span>
              </div>
              <div style={{ ...styles.reviewRow, borderBottom: 'none' }}>
                <span style={styles.reviewLabel}>Order total</span>
                <span style={{ ...styles.reviewValue, fontWeight: 700, fontSize: '1.125rem' }}>$49.00</span>
              </div>
            </div>

            {task.currentStep === 'review' && liveTimeInStep > 5 && (
              <div style={styles.helpMessage} className="fade-in">
                Take your time reviewing. Click &quot;Place Order&quot; when you&apos;re ready.
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.75rem', minHeight: '44px' }}
              data-adapt-role="primary-action"
            >
              Place Order
            </button>
          </div>
        </section>
      </div>

      {/* Time in step indicator */}
      {task.currentStep && (
        <div style={styles.timeIndicator}>
          Time in <strong>{stepLabels[task.currentStep] || task.currentStep}</strong>:{' '}
          <LiveTimer seconds={liveTimeInStep} />
        </div>
      )}
    </DemoLayout>
  );
}

const stepStyles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0',
    marginBottom: '2rem',
    padding: '1.5rem 1rem',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
  },
  stepWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  connector: {
    width: '3rem',
    height: '2px',
    borderRadius: '1px',
    transition: 'background 0.2s',
    marginRight: '0.5rem',
  },
  circle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '2px solid var(--color-border)',
    background: 'var(--color-surface)',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    flexShrink: 0,
    transition: 'all 0.2s',
  },
  circleCompleted: {
    background: 'var(--color-success)',
    borderColor: 'var(--color-success)',
    color: '#fff',
  },
  circleCurrent: {
    borderColor: 'var(--color-primary)',
    color: 'var(--color-primary)',
    boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.15)',
  },
  label: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: 'var(--color-text-muted)',
    transition: 'color 0.2s',
  },
  labelCurrent: {
    color: 'var(--color-primary)',
    fontWeight: 600,
  },
  labelCompleted: {
    color: 'var(--color-success)',
  },
};

const styles = {
  returnBanner: {
    padding: '0.75rem 1rem',
    background: 'var(--color-primary-light)',
    border: '1px solid var(--color-primary)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    color: 'var(--color-primary)',
    marginBottom: '1.5rem',
  },
  sections: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  section: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
  },
  sectionHeader: {
    padding: '1rem 1.5rem',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-bg-subtle)',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  checkmark: {
    color: 'var(--color-success)',
    fontSize: '1.125rem',
  },
  summaryBadge: {
    display: 'block',
    marginTop: '0.25rem',
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
  },
  sectionBody: {
    padding: '1.25rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
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
  },
  row: {
    display: 'flex',
    gap: '1rem',
  },
  helpMessage: {
    padding: '0.75rem 1rem',
    background: 'var(--color-warning-light)',
    border: '1px solid var(--color-warning)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8125rem',
    color: 'var(--color-warning)',
  },
  helpTip: {
    padding: '0.75rem 1rem',
    background: 'var(--color-primary-light)',
    border: '1px solid var(--color-primary)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8125rem',
    color: 'var(--color-text-secondary)',
  },
  reviewCard: {
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  },
  reviewRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid var(--color-border)',
  },
  reviewLabel: {
    fontSize: '0.8125rem',
    color: 'var(--color-text-muted)',
  },
  reviewValue: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text)',
  },
  stepHint: {
    padding: '0.5rem 0.75rem',
    background: 'var(--color-bg-subtle)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    textAlign: 'center',
    marginBottom: '1rem',
  },
  timeIndicator: {
    marginTop: '1.5rem',
    padding: '0.75rem 1rem',
    background: 'var(--color-bg-subtle)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8125rem',
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
  },
};
