import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AdaptProvider } from '@adaptkit/react';
import './styles.css';

import IndexPage from './demos/IndexPage.jsx';
import Environment from './demos/Environment.jsx';
import Friction from './demos/Friction.jsx';
import Behavior from './demos/Behavior.jsx';
import Familiarity from './demos/Familiarity.jsx';
import Task from './demos/Task.jsx';

const routes = {
  '': IndexPage,
  '#environment': Environment,
  '#friction': Friction,
  '#behavior': Behavior,
  '#familiarity': Familiarity,
  '#task': Task,
};

function Router() {
  const [hash, setHash] = useState(location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const Page = routes[hash] || IndexPage;
  return <Page />;
}

const DEMO_CONFIG = {
  debug: true,
  thresholds: {
    // Friction sensors: faster firing for demo
    rageClickCooldownMs: 300,
    deadClickCooldownMs: 200,
    formThrashMinRevisits: 2,
    formThrashWindowMs: 15000,
    blockedIntentClickWindowMs: 3000,
    // Behavior: faster stabilization for demo
    behaviorKeyboardFirstMinEvents: 5,
    behaviorChangeDebouncMs: 200,
    scrollWindowMs: 2000,
    // Friction levels: easier escalation for demo
    frictionSustainedMinEvents: 2,
    frictionSustainedWindowMs: 20000,
  },
};

function App() {
  return (
    <AdaptProvider config={DEMO_CONFIG}>
      <Router />
    </AdaptProvider>
  );
}

createRoot(document.getElementById('root')).render(<App />);
